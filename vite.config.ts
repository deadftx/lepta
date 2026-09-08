import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

let commitHash = 'local'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
} catch {}

const buildTime = new Date().toISOString()

function versionFilePlugin() {
  return {
    name: 'version-file-plugin',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist')
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true })
        }
        fs.writeFileSync(
          path.join(distDir, 'version.json'),
          JSON.stringify({ commit: commitHash, builtAt: buildTime }, null, 2),
          'utf8'
        )
      } catch (err) {
        console.warn('Aviso ao gerar version.json:', err)
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __APP_COMMIT__: JSON.stringify(commitHash),
    __APP_BUILD_TIME__: JSON.stringify(buildTime)
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://lepta.com.br',
        changeOrigin: true,
        secure: true
      },
      '/groups': {
        target: 'https://lepta.com.br',
        changeOrigin: true,
        secure: true
      },
      '/users': {
        target: 'https://lepta.com.br',
        changeOrigin: true,
        secure: true
      },
      '/databaseTables': {
        target: 'https://lepta.com.br',
        changeOrigin: true,
        secure: true
      },
      '/calendarEvents': {
        target: 'https://lepta.com.br',
        changeOrigin: true,
        secure: true
      }
    }
  }
})

