import { resolve } from 'path'
import { defineConfig } from 'vite'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { external, generatePackageJson, packageJson } from './vite.config'

const { name, version, description, author, license, funding, homepage, keywords, repository, dependencies } = packageJson

export default defineConfig({
    plugins: [
        nxViteTsPaths(),
        generatePackageJson({
            name, version, description, author, license, funding, homepage, keywords, repository, dependencies,
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
