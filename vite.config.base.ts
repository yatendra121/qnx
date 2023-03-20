import path, { resolve } from 'path'
import { defineConfig } from 'vite'

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
        base: './',
        build: {
            lib: {
                entry: path.resolve(dirName, 'src/index.ts'),
                name: getPackageNameCamelCase(),
                formats: ['es', 'cjs', 'iife'],
                fileName: (format) => fileName[format]
            },
            rollupOptions
        },
        resolve: {
            alias: {
                '@qnx/core-helpers': resolve(__dirname, 'packages/core-helpers/src/index.ts'),
                '@qnx/errors': resolve(__dirname, 'packages/errors/src/index.ts'),
                '@qnx/interfaces': resolve(__dirname, 'packages/interfaces/src/index.ts'),
                '@qnx/response': resolve(__dirname, 'packages/response/src/index.ts')
            }
        }
    })
}
