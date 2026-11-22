import { expect, test } from 'vitest'
import { layerDir } from './layerDir.js'

test('points built layers at the shipped files folder, not dist', () => {
  expect(layerDir('file:///pkg/layers/vite-react/base/layer.ts')).toBe('/pkg/layers/vite-react/base/files')
  expect(layerDir('file:///pkg/dist/layers/vite-react/base/layer.js')).toBe('/pkg/layers/vite-react/base/files')
})
