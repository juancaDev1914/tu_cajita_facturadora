import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // `__APP_BUILD_ID__` lo inyecta el plugin de vite.config.js al compilar
      globals: { ...globals.browser, __APP_BUILD_ID__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
