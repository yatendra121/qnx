/// <reference types='vitest' />
import { defineConfig } from 'vite'
import { workspaceTestAlias } from '../../vite.config.base'
import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin'

export default defineConfig({
    plugins: [nxReadySignal()],
    resolve: {
        tsconfigPaths: true
    },
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/app',
    test: {
        alias: workspaceTestAlias,
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
