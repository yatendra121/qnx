/// <reference types='vitest' />
import { defineConfig } from 'vite'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin'

export default defineConfig({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/app',
    plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [ nxViteTsPaths() ],
    // },
    test: {
        watch: false,
        globals: true,
        environment: 'happy-dom', // crypto not worked with jsdom. reference https://github.com/jsdom/jsdom/issues/3711#issuecomment-2096255351
        include: ['__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        reporters: ['default'],
        coverage: {
            reportsDirectory: '../../coverage/packages/app',
            provider: 'v8'
        }
    }
})
