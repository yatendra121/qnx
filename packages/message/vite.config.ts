import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'

const viteConfig = collectViteConfig(packageJson, __dirname)
export default viteConfig
