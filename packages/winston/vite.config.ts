/// <reference types="vitest" />
import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'

const option = {
    rollupOptions: {
        external: ['winston', 'winston-daily-rotate-file', 'fs', 'path']
    }
}
const viteConfig = collectViteConfig(packageJson, __dirname, option)
export default viteConfig
