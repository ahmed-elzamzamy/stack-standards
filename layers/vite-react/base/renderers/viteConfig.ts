// ponytail: static until a layer needs a Vite plugin (Paraglide); then add a contribution kind and render it here.
export function renderViteConfig(): string {
  return `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
`
}
