import { resolve } from 'node:path';
import { defineConfig } from '@rspack/cli';
import nodeExternals from 'webpack-node-externals';

export default defineConfig({
  context: import.meta.dirname,
  mode: 'production',
  target: 'node',
  entry: './src/main.ts',
  output: {
    path: resolve(import.meta.dirname, 'dist'),
    filename: 'main.js',
    module: true,
    clean: true,
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  externals: [nodeExternals({ importType: 'module' })],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        resolve: { fullySpecified: false },
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              target: 'es2023',
              parser: { syntax: 'typescript', decorators: true },
              transform: {
                legacyDecorator: true,
                decoratorMetadata: true,
              },
            },
          },
        },
      },
    ],
  },
  // NestJS and Pino use class/handler names at runtime.
  optimization: { minimize: false },
});
