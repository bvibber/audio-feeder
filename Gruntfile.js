// Gruntfile for the JS build
const path = require('path');
const dist = path.resolve(__dirname, 'dist');

module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    eslint: {
      options: {
        //configFile: 'eslint.json'
      },
      target: 'src'
    },
    webpack: {
      main: {
        entry: './src/index.js',
        mode: 'production',
        output: {
          path: dist,
          filename: 'AudioFeeder.js',
          libraryTarget: 'umd',
          library: 'AudioFeeder',
        }
      },
      demo: {
        entry: './src/demo.js',
        mode: 'production',
        output: {
          path: dist,
          filename: 'demo.js',
          libraryTarget: 'var',
          library: 'demo'
        }
      }
    },
    uglify: {
      build: {
        src: 'dist/AudioFeeder.js',
        dest: 'dist/AudioFeeder.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-eslint');
  grunt.loadNpmTasks('grunt-webpack');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('default', ['eslint', 'webpack:main', 'webpack:demo', 'uglify']);

};
