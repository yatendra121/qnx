import type { UserConfig } from 'vitest/config'
import { collectViteConfig } from '../../vite.config.base'
import packageJson from './package.json'

const viteConfig = collectViteConfig(packageJson, __dirname) as UserConfig
viteConfig.test = {
    ...viteConfig.test,
    // Type-level tests for the public API, in src/**/*.test-d.ts. Errors in other files are left to
    // the typecheck target, so the workspace's vite config doesn't fail these.
    typecheck: {
        enabled: true,
        tsconfig: './tsconfig.spec.json',
        include: ['src/**/*.test-d.ts'],
        ignoreSourceErrors: true
    }
}
export default viteConfig
