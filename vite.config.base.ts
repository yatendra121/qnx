/// <reference types="vitest" />

import { resolve } from 'path'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import dts from 'vite-plugin-dts'
import { joinPathFragments } from '@nx/devkit'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';


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
        root: __dirname,
        cacheDir: `../../node_modules/.vite/${getPackageName()}`,
        base: './',
        plugins: [
            // viteTsConfigPaths({
            //     root: '../../' //this path is using from packages/LIB_NAME/vite.config.ts
            // })
            nxViteTsPaths()
            // dts()
        ],
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
            cache: {
                dir: '../../node_modules/.vitest'
            },
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
        }
        // resolve: {
        //     alias: {
        //         '@qnx/core-helpers': resolve(__dirname, 'packages/core-helpers/src/index.ts'),
        //         '@qnx/errors': resolve(__dirname, 'packages/errors/src/index.ts'),
        //         '@qnx/interfaces': resolve(__dirname, 'packages/interfaces/src/index.ts'),
        //         '@qnx/response': resolve(__dirname, 'packages/response/src/index.ts'),
        //         '@qnx/crypto': resolve(__dirname, 'packages/crypto/src/index.ts'),
        //         '@qnx/messages': resolve(__dirname, 'packages/messages/src/index.ts')
        //     }
        // }
    })
}
