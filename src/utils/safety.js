// ===== Datos a salvo durante las actualizaciones =====
// La app guarda TODO en el navegador (IndexedDB + localStorage), así que un
// deploy en Vercel NO borra los datos: el código nuevo lee los mismos datos.
// Lo que sí puede pasar es que el código nuevo espere campos que el estado
// guardado no tiene, o que se abra una versión vieja sobre datos nuevos.
// Estos módulos controlan las tres cosas que lo evitan:
//
//  1. SCHEMA_VERSION: la versión de la forma de los datos. Si un usuario abre
//     la app con una versión MÁS VIEJA que la de sus datos, se bloquea con una
//     alerta en vez de cargar y sobrescribir con datos incompletos.
//  2. Snapshots: antes de aplicar una actualización se guarda una copia
//     completa del estado en localStorage, para poder volver atrás si algo
//     sale mal.
//  3. Detección de versión nueva: se compara la versión desplegada contra un
//     archivo de versión en el servidor (version.json).

// Debe subirse junto con el estado: si cambia la forma de los datos, súbelo.
export const SCHEMA_VERSION = 1

// Identificador de esta build. Vite lo reemplaza al compilar (__APP_BUILD_ID__).
export const APP_BUILD_ID =
  typeof __APP_BUILD_ID__ === 'string' ? __APP_BUILD_ID__ : 'dev'

const SCHEMA_KEY = 'cajita_pos_schema_version'
const SEEN_BUILD_KEY = 'cajita_pos_seen_build'
const SNAPSHOTS_KEY = 'cajita_pos_safety_snapshots'
// 3 copias bastan: la anterior a la última actualización, la actual y una vieja
const MAX_SNAPSHOTS = 3

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false // cuota llena o modo privado: no es crítico
  }
}

export const readSchemaVersion = () => {
  const n = Number(localStorage.getItem(SCHEMA_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export const writeSchemaVersion = () => writeJSON(SCHEMA_KEY, SCHEMA_VERSION)

// `true` cuando los datos guardados los creó una versión MÁS NUEVA que esta.
// En ese caso la app no debe arrancar: se mostraría incompleta y, peor, al
// guardar podría pisar campos que la versión nueva ya usa.
export function isNewerSchema(storedVersion) {
  return Number(storedVersion) > SCHEMA_VERSION
}

// ---------- Snapshots de seguridad ----------

/**
 * Guarda una copia completa del estado ANTES de una actualización.
 * Se guarda completa; si no cabe (muchos datos), se reintenta solo con lo
 * imprescindible (ventas + productos) antes de rendirse.
 */
export function takeSnapshot(state, reason = 'actualización') {
  if (!state) return null
  const meta = { at: new Date().toISOString(), reason, appBuild: APP_BUILD_ID, schema: SCHEMA_VERSION }
  const full = { ...meta, full: true, state }
  if (writeJSON(SNAPSHOTS_KEY, [full, ...listSnapshots()].slice(0, MAX_SNAPSHOTS))) return meta

  // No cupo completa: se guarda SOLO lo irrecuperable (las ventas) más los
  // usuarios y la configuración del negocio, para poder volver a facturar.
  // Productos, deudas y nómina se pueden volver a crear, así que se omiten
  // (son justamente los que hacen que la copia no quepa).
  const light = {
    ...meta,
    full: false,
    state: { sales: state.sales || [], settings: state.settings, users: state.users || [], products: [] },
  }
  return writeJSON(SNAPSHOTS_KEY, [light, ...listSnapshots()].slice(0, MAX_SNAPSHOTS)) ? meta : null
}

export function listSnapshots() {
  const list = readJSON(SNAPSHOTS_KEY, [])
  return Array.isArray(list) ? list : []
}

export function latestSnapshot() {
  return listSnapshots()[0] || null
}

/** Borra los snapshots (lo usa "descartar" en la alerta). */
export function clearSnapshots() {
  try {
    localStorage.removeItem(SNAPSHOTS_KEY)
  } catch { /* ignore */ }
}

// ---------- Detección de versión nueva ----------

// Marca la build con la que la app ya está corriendo, para detectar el próximo arranque.
export function markBuildSeen() {
  try {
    localStorage.setItem(SEEN_BUILD_KEY, APP_BUILD_ID)
  } catch { /* ignore */ }
}

export function seenBuild() {
  try {
    return localStorage.getItem(SEEN_BUILD_KEY) || ''
  } catch {
    return ''
  }
}

/**
 * Descarga `version.json` del servidor (Vite lo genera en cada build).
 * Devuelve `{ version, buildId }` del despliegue actual o `null` si no se
 * puede leer (sin red, o servidor viejo sin el archivo).
 */
export async function fetchDeployedVersion() {
  // `no-store` + query con la hora: nunca debe servirse desde la caché
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.buildId) return null
    return data
  } catch {
    return null
  }
}
