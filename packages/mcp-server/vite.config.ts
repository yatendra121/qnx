import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'

const option = {
    rollupOptions: {
        external: ['@qnx/errors', '@qnx/winston', 'express', 'zod', '@modelcontextprotocol/sdk']
    }
}

const viteConfig = collectViteConfig(packageJson, __dirname, option)
export default viteConfig
