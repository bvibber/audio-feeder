var webpack = require('webpack');
var path = require("path");

const BUILD_DIR = 'build';

function publicPath() {
  return '/' + BUILD_DIR + '/';
}

module.exports = [
  {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, BUILD_DIR),
      publicPath: publicPath(),
      filename: 'AudioFeeder.js',
      libraryTarget: 'var',
      library: 'AudioFeeder'
    }
  }
];
