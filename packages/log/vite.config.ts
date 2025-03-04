import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'

const option = {
    rollupOptions: {
        external: ['chalk']
    }
}

const viteConfig = collectViteConfig(packageJson, __dirname, option)
export default viteConfig
