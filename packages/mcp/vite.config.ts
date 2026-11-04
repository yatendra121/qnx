import { builtinModules } from 'module'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { collectViteConfig } from '../../vite.config.base'
import { type Plugin } from 'vite'
import packageJson from './package.json'

export { packageJson }

/**
 * Builds the published dependency list from what the bundle really imports, so it can't drift.
 * Workspace packages get a caret on the current minor: the bundle stays on compatible releases,
 * and a patch release deployed from main installs before its packages finish publishing.
 */
function resolveDependencies(imports: string[]) {
    const dependencies: Record<string, string> = packageJson.dependencies
    const [major, minor] = packageJson.version.split('.')
    const names = imports.map((id) => id.split('/').slice(0, id.startsWith('@') ? 2 : 1).join('/'))

    return Object.fromEntries(
        [...new Set(names)]
            .filter((name) => name in dependencies)
            .sort()
            .map((name) => {
                const range = dependencies[name]
                return [name, range.startsWith('workspace:') ? `^${major}.${minor}.0` : range]
            })
    )
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
        generateBundle(_options, bundle) {
            const imports = Object.values(bundle).flatMap((output) =>
                output.type === 'chunk' ? output.imports : []
            )
            this.emitFile({
                type: 'asset',
                fileName: 'package.json',
                source: JSON.stringify(
                    { ...content, dependencies: resolveDependencies(imports) },
                    null,
                    2
                )
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
    rolldownOptions: { external }
})
export default viteConfig
