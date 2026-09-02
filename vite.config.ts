import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
