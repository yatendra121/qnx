/// <reference types="vitest" />

import { resolve, join } from 'path'
import { defineConfig } from 'vite'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'

export function collectViteConfig(packageJson: any, dirName: string, option = {}) {
    const { rollupOptions } = option as any
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
        plugins: [nxViteTsPaths()],
        build: {
            lib: {
                entry: resolve(dirName, 'src/index.ts'),
                name: getPackageNameCamelCase(),
                formats: ['es', 'cjs', 'iife'],
                fileName: (format) => fileName[format]
            },
            rollupOptions
        },
        test: {
            globals: true,
            // cache: {
            //     dir: '../node_modules/.vitest'
            // },
            environment: 'node',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

            reporters: ['default'],
            coverage: {
                reportsDirectory: `../coverage/${getPackageName()}`,
                provider: 'v8'
            }
        }
    })
}
