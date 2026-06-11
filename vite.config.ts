import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 5188 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    netlify(),
    viteReact(), // must come AFTER tanstackStart()
  ],
})
