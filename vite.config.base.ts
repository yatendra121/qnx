/// <reference types="vitest" />

import { resolve, join } from 'path'
import { defineConfig } from 'vite'
import tsconfigBase from './tsconfig.base.json'

// resolve.tsconfigPaths skips files no tsconfig includes, so tests alias workspace packages to their source.
export const workspaceTestAlias = Object.fromEntries(
    Object.entries(tsconfigBase.compilerOptions.paths).map(([name, [path]]) => [
        name,
        resolve(__dirname, path)
    ])
)

/**
 * Vitest's default module cache is one folder shared by the whole workspace, which it deletes when a
 * project's lockfile hash differs from the stored one. Nx runs each project's tests as a separate
 * process, so one process could delete the folder while another was writing to it, failing with
 * ENOTEMPTY. A folder per project means a process can only ever delete its own.
 */
export function vitestModuleCachePath(project: string) {
    return resolve(__dirname, 'node_modules/.vitest-module-cache', project)
}

export function collectViteConfig(packageJson: any, dirName: string, option = {}) {
    const { rolldownOptions } = option as any
    const getPackageName = (): string => {
        return packageJson.name.substring(5)
    }

    const getPackageNameCamelCase = () => {
        try {
            return getPackageName().replace(/-./g, (char: string) => char[1].toUpperCase())
        } catch (err) {
            throw new Error('Name property in package.json is missing.')
        }
    }

    const fileName = {
        es: `${getPackageName()}.mjs`,
        cjs: `${getPackageName()}.cjs`,
        iife: `${getPackageName()}.iife.js`
    }

    return defineConfig({
        // root: __dirname,  #do wants uncomment, verify tests cases
        cacheDir: `../../node_modules/.vite/${getPackageName()}`,
        base: './',
        resolve: {
            tsconfigPaths: true
        },
        build: {
            lib: {
                entry: resolve(dirName, 'src/index.ts'),
                name: getPackageNameCamelCase(),
                formats: ['es', 'cjs', 'iife'],
                fileName: (format) => fileName[format]
            },
            rolldownOptions
        },
        test: {
            alias: workspaceTestAlias,
            fsModuleCachePath: vitestModuleCachePath(getPackageName()),
            globals: true,
            // cache: {
            //     dir: '../node_modules/.vitest'
            // },
            environment: 'node',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

            reporters: ['default'],
            coverage: {
                reportsDirectory: `../../coverage/packages/${getPackageName()}`,
                provider: 'v8'
            }
        }
    })
}
