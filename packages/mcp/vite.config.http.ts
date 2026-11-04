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
        rolldownOptions: {
            external,
            output: {
                banner: '#!/usr/bin/env node'
            }
        }
    }
})
