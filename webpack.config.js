const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  target: 'node',
  mode: 'development', // Change from 'none' to 'development' to reduce aggressive optimizations
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  node: {
    __dirname: false
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  optimization: {
    minimize: false, // Disable minification that might break crypto operations
    mangleExports: false,
    usedExports: false
  },
  infrastructureLogging: {
    level: "log",
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: 'templates',
          to: 'templates',
          globOptions: {
            ignore: ['**/.DS_Store']
          }
        }
      ]
    })
  ]
};