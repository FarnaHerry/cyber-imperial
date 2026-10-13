import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5273,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
})
