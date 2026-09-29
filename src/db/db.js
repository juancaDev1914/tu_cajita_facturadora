// ===== Capa de datos local (IndexedDB + respaldo localStorage) =====
// Todo se guarda en el navegador: IndexedDB como principal y
// localStorage (cajita_pos_backup_v1) como segunda copia local.

const DB_NAME = 'cajita-pos-db'
const DB_VERSION = 2
const STATE_STORE = 'state'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.reject(new Error('IndexedDB no disponible'))
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    let req
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (e) {
      reject(e)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('No se pudo abrir IndexedDB'))
  })
  return dbPromise
}

function run(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        let t
        try {
          t = db.transaction(store, mode)
        } catch (e) {
          reject(e)
          return
        }
        const os = t.objectStore(store)
        const req = fn(os)
        t.oncomplete = () => resolve(req ? req.result : undefined)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

// Estado principal (clave-valor)
export const idbGet = (key) => run(STATE_STORE, 'readonly', (os) => os.get(key))
export const idbSet = (key, value) => run(STATE_STORE, 'readwrite', (os) => os.put(value, key))
export const idbDelete = (key) => run(STATE_STORE, 'readwrite', (os) => os.delete(key))