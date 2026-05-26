import { builtinModules } from 'module'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { collectViteConfig } from '../../vite.config.base'
import { type Plugin } from 'vite'
import packageJson from './package.json'

export { packageJson }

export const qnxDependencies = {
    '@qnx/crypto': 'latest',
    '@qnx/errors': 'latest',
    '@qnx/response': 'latest',
    '@qnx/winston': 'latest'
}

export function copyReadme(): Plugin {
    return {
        name: 'copy-readme',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'README.md',
                source: readFileSync(resolve(__dirname, 'README.md'), 'utf-8')
            })
        }
    }
}

export function generatePackageJson(content: Record<string, unknown>): Plugin {
    return {
        name: 'generate-package-json',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify(content, null, 2)
            })
        }
    }
}

const externalLibs = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {})
]

export const external = (id: string) =>
    id.startsWith('node:') ||
    builtinModules.includes(id) ||
    externalLibs.some((lib) => id === lib || id.startsWith(`${lib}/`))

const viteConfig = collectViteConfig(packageJson, __dirname, {
    rollupOptions: { external }
})
export default viteConfig
