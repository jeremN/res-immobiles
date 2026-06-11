import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 5188 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    viteReact(), // must come AFTER tanstackStart()
  ],
})
