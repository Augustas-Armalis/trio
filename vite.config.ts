import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5174, host: true },
  build: { target: 'es2022', cssCodeSplit: false, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 },
})
