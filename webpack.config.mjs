import CopyWebpackPlugin from 'copy-webpack-plugin';
import { createRequire } from 'module';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';

const { BannerPlugin } = webpack;

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

const rootPath = process.cwd();
const context = path.join(rootPath, 'src');
const outputPath = path.join(rootPath, 'build');

function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const date = ('0' + today.getDate()).slice(-2);
  return `${year}-${month}-${date}`;
}

function getBanner() {
  return (
    `#!/usr/bin/env node\n` +
    `/*! ${pkg.name} - ${pkg.version} - ` +
    `${getCurrentDate()} ` +
    `| (c) 2026 ${pkg.author} | ${pkg.homepage} */`
  );
}

export default {
  mode: 'production',
  context,
  entry: {
    dicomwebMcpServer: './index.js',
  },
  target: 'node',
  experiments: {
    outputModule: true,
  },
  output: {
    clean: true,
    environment: {
      module: true,
    },
    filename: 'dicomweb-mcp-server.js',
    library: {
      type: 'module',
    },
    path: outputPath,
  },
  optimization: {
    minimize: true,
    splitChunks: false,
    usedExports: false,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        parallel: true,
        terserOptions: {
          format: {
            comments: /^\s*!/,
          },
          sourceMap: true,
        },
      }),
    ],
  },
  plugins: [
    new BannerPlugin({
      banner: getBanner(),
      entryOnly: true,
      raw: true,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.join(rootPath, '.env.example'),
          to: path.join(outputPath, '.env'),
          toType: 'file',
        },
      ],
    }),
  ],
};
