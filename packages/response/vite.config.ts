import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'
const option = {
    rollupOptions: {
        external: ['@qnx/errors', 'http', 'zod', 'express']
    }
}
const viteConfig = collectViteConfig(packageJson, __dirname, option)
export default viteConfig
