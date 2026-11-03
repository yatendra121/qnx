const path = require('path')
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin')

const root = path.resolve(__dirname, '../../')
const qnxAliases = {
  '@qnx/client': path.join(root, 'packages/client/src/index.ts'),
  '@qnx/core-helpers': path.join(root, 'packages/core-helpers/src/index.ts'),
  '@qnx/crypto': path.join(root, 'packages/crypto/src/index.ts'),
  '@qnx/errors': path.join(root, 'packages/errors/src/index.ts'),
  '@qnx/interfaces': path.join(root, 'packages/interfaces/src/index.ts'),
  '@qnx/log': path.join(root, 'packages/log/src/index.ts'),
  '@qnx/mcp-server': path.join(root, 'packages/mcp-server/src/index.ts'),
  '@qnx/message': path.join(root, 'packages/message/src/index.ts'),
  '@qnx/response': path.join(root, 'packages/response/src/index.ts'),
  '@qnx/winston': path.join(root, 'packages/winston/src/index.ts')
}

module.exports = {
  output: {
    path: path.join(root, 'dist/packages/app')
  },
  resolve: {
    alias: qnxAliases
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      outputHashing: 'none',
      optimization: false
    })
  ]
}
