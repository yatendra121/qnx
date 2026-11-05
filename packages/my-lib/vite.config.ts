/// <reference types="vitest" />
import { defineConfig } from 'vite'

import dts from 'vite-plugin-dts'
import { joinPathFragments } from '@nx/devkit'
import { vitestModuleCachePath } from '../../vite.config.base'

export default defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    cacheDir: '../../node_modules/.vite/my-lib',

    plugins: [
        dts({
            entryRoot: 'src',
            tsConfigFilePath: joinPathFragments(__dirname, 'tsconfig.lib.json'),
            skipDiagnostics: true
        })
    ],

    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [
    //    viteTsConfigPaths({
    //      root: '../../',
    //    }),
    //  ],
    // },

    // Configuration for building your library.
    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
        lib: {
            // Could also be a dictionary or array of multiple entry points.
            entry: 'src/index.ts',
            name: 'my-lib',
            fileName: 'index',
            // Change this to the formats you want to support.
            // Don't forgot to update your package.json as well.
            formats: ['es', 'cjs']
        },
        rolldownOptions: {
            // External packages that should not be bundled into your library.
            external: []
        }
    },

    test: {
        globals: true,
        fsModuleCachePath: vitestModuleCachePath('my-lib'),
        cache: {
            dir: '../../node_modules/.vitest'
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
    }
})
