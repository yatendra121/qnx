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
            main: './stdio.js',
            bin: { 'qnx-mcp-server': './stdio.js' }
        })
    ],
    build: {
        outDir: 'stdio',
        lib: {
            entry: resolve(__dirname, 'src/stdio.ts'),
            formats: ['es'],
            fileName: () => 'stdio.js'
        },
        rollupOptions: {
            external,
            output: {
                banner: '#!/usr/bin/env node'
            }
        }
    }
})
