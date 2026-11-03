import { resolve } from 'path'
import { defineConfig } from 'vite'
import {
    copyReadme,
    external,
    generatePackageJson,
    packageJson,
    qnxDependencies
} from './vite.config'

const {
    name,
    version,
    description,
    author,
    license,
    funding,
    homepage,
    keywords,
    repository,
    dependencies
} = packageJson
const { express: _, ...depsWithoutExpress } = dependencies
const resolvedDependencies = { ...depsWithoutExpress, ...qnxDependencies }

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
            dependencies: resolvedDependencies,
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
