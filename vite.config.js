import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// Identificador único de cada compilación. Se usa para dos cosas:
//  - `__APP_BUILD_ID__` (inyectado en el bundle) para detectar en el navegador
//    que hubo un despliegue nuevo.
//  - `version.json` en dist/, que la app consulta para saber si en el servidor
//    hay una versión más reciente que la que tiene abierta.
// El nombre de los archivos ya cambia en cada build (Vite usa hash), pero el
// id explícito permite que la app y el service worker hablar del mismo deploy.
function buildIdPlugin() {
  let buildId = ''
  return {
    name: 'cajita-build-id',
    apply: 'build',
    buildStart() {
      // package.json + timestamp: cambia con cada despliegue
      const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
      buildId = `${pkg.version}-${Date.now().toString(36)}`
    },
    config() {
      return { define: { __APP_BUILD_ID__: JSON.stringify(buildId) } }
    },
    generateBundle() {
      // Archivo que la app consulta (con no-store) para detectar actualizaciones
      const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          version: pkg.version,
          buildId,
          builtAt: new Date().toISOString(),
        }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    buildIdPlugin(),
  ],
})

