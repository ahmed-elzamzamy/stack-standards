import { expect, test } from 'vitest'
import { renderViteConfig } from './viteConfig.js'

test('renders the React plugin config', () => {
  const config = renderViteConfig()
  expect(config).toContain(`import react from '@vitejs/plugin-react'`)
  expect(config).toContain('plugins: [react()]')
})
