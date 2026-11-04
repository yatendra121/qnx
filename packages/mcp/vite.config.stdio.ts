import { resolve } from 'path'
import { defineConfig } from 'vite'
import { copyReadme, external, generatePackageJson, packageJson } from './vite.config'

const {
    name,
    version,
    description,
    author,
    license,
    funding,
    homepage,
    keywords,
    repository
} = packageJson

export default defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    plugins: [
        copyReadme(),
        generatePackageJson({
            name,
            version,
            description,
            author,
            license,
            funding,
            homepage,
            keywords,
            repository,
            type: 'module',
            main: './stdio.js',
            bin: { 'qnx-mcp': './stdio.js' }
        })
    ],
    build: {
        outDir: 'stdio',
        lib: {
            entry: resolve(__dirname, 'src/stdio.ts'),
            formats: ['es'],
            fileName: () => 'stdio.js'
        },
        rolldownOptions: {
            external,
            output: {
                banner: '#!/usr/bin/env node'
            }
        }
    }
})
