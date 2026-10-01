// Ejecuta: node scripts/test-safety.mjs
// Comprueba que el versionado de datos y los snapshots protegan la información
// al desplegar una versión nueva de la app.
import { readFileSync } from 'node:fs'

let fails = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(got)}${ok ? '' : ` (esperado ${JSON.stringify(want)})`}`)
}

// --- localStorage falso para poder correr safety.js fuera del navegador ---
class FakeStorage {
  constructor() { this.map = new Map() }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null }
  setItem(k, v) { this.map.set(k, String(v)) }
  removeItem(k) { this.map.delete(k) }
  clear() { this.map.clear() }
}
globalThis.localStorage = new FakeStorage()

// __APP_BUILD_ID__ lo inyecta Vite; en Node lo definimos a mano
globalThis.__APP_BUILD_ID__ = '1.0.0-nueva'

const safety = await import('../src/utils/safety.js')
const {
  SCHEMA_VERSION,
  isNewerSchema,
  listSnapshots,
  markBuildSeen,
  seenBuild,
  takeSnapshot,
  writeSchemaVersion,
  readSchemaVersion,
} = safety

// 1) Una versión más nueva de los datos -> la app debe bloquearse
eq('bloquea si los datos son más nuevos', isNewerSchema(SCHEMA_VERSION + 1), true)
// 2) La misma versión o más vieja -> la app arranca normal
eq('arranca con la misma versión', isNewerSchema(SCHEMA_VERSION), false)
eq('arranca con datos más viejos', isNewerSchema(SCHEMA_VERSION - 1), false)
eq('arranca sin versión guardada', isNewerSchema(0), false)

// 3) El snapshot guarda el estado COMPLETO (ventas incluidas)
const state = {
  sales: [{ id: 'v1', total: 1000 }, { id: 'v2', total: 2000 }],
  products: [{ id: 'p1', stock: 5 }],
  settings: { businessName: 'Mi Tienda' },
  users: [{ id: 'u1' }],
}
const meta = takeSnapshot(state, 'antes de actualizar')
eq('snapshot creado', !!meta, true)
const snap = listSnapshots()[0]
eq('guarda las 2 ventas', snap.state.sales.length, 2)
eq('guarda los productos', snap.state.products.length, 1)
eq('snapshot completo', snap.full, true)

// 4) Se conservan como máximo 3 copias (no se acumulan sin límite)
takeSnapshot(state, 'b')
takeSnapshot(state, 'c')
takeSnapshot(state, 'd')
eq('máximo 3 snapshots', listSnapshots().length, 3)
// La más reciente es la última añadida
eq('la más reciente es la última', listSnapshots()[0].reason, 'd')

// 5) Si no cabe la copia completa, se guarda una parcial CON las ventas
const enorme = { ...state, products: Array.from({ length: 4000 }, (_, i) => ({ id: `p${i}`, blob: 'x'.repeat(2000) })) }
localStorage.setItem('cajita_pos_safety_snapshots', '')
// localStorage falso sin cuota: forzamos el caso con un setItem que falla
const originalSet = localStorage.setItem.bind(localStorage)
localStorage.setItem = (k, v) => { if (k === 'cajita_pos_safety_snapshots' && v.length > 200000) throw new Error('cuota'); originalSet(k, v) }
const meta2 = takeSnapshot(enorme, 'parcial')
localStorage.setItem = originalSet
eq('copia parcial guardada', meta2 !== null, true)
const snap2 = listSnapshots()[0]
eq('la parcial no dice completa', snap2.full, false)
eq('la parcial conserva las ventas', snap2.state.sales.length, 2)

// 6) Detección de despliegue: cambia el buildId -> hay actualización
localStorage.clear()
markBuildSeen()
eq('build guardada', seenBuild(), '1.0.0-nueva')
eq('misma build -> no hay cambio', seenBuild() !== '1.0.0-nueva', false)
writeSchemaVersion()
eq('versión de datos guardada', readSchemaVersion(), SCHEMA_VERSION)

// 7) version.json se genera en el build (plugin de vite)
const viteConfig = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8')
eq('el plugin genera version.json', viteConfig.includes('version.json'), true)
eq('el plugin define __APP_BUILD_ID__', viteConfig.includes('__APP_BUILD_ID__'), true)

// 8) El service worker NO se auto-activa (para no romper una venta en curso)
const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
// El SW solo puede activarse si la app lo pide por mensaje: si se activara solo,
// cambiaría el código bajo los pies del usuario en mitad de una venta.
const swInstall = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"))
// Se busca la LLAMADA real, no la mención dentro de un comentario
eq('el SW no hace skipWaiting al instalar', /self\.skipWaiting\(\)/.test(swInstall), false)
eq('el SW avisa por mensaje', sw.includes('SKIP_WAITING'), true)
eq('version.json nunca se cachea', sw.includes("'/version.json'"), true)

console.log(fails ? `\nRESULT: ${fails} FAILURES` : '\nRESULT: ALL PASS')
process.exit(fails ? 1 : 0)
