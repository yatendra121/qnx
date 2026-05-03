import { resolve } from 'path'
import { defineConfig } from 'vite'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { external, generatePackageJson, packageJson, qnxDependencies } from './vite.config'

const { name, version, description, author, license, funding, homepage, keywords, repository, dependencies } = packageJson
const resolvedDependencies = { ...dependencies, ...qnxDependencies }

export default defineConfig({
    plugins: [
        nxViteTsPaths(),
        generatePackageJson({
            name, version, description, author, license, funding, homepage, keywords, repository, dependencies: resolvedDependencies,
            type: 'module',
            main: './main.js'
        })
    ],
    build: {
        outDir: 'http',
        lib: {
            entry: resolve(__dirname, 'src/main.ts'),
            formats: ['es'],
            fileName: () => 'main.js'
        },
        rollupOptions: {
            external,
            output: {
                banner: '#!/usr/bin/env node'
            }
        }
    }
})
