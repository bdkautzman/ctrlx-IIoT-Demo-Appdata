module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);

    const compileLib = require('./build-resources/js/lib/compile.lib.js')(grunt),
        supportedBrowsers = ["chrome 78","firefox 72","not dead","not ie 11"];

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        unzip: {
            'less/': '.webiq/less-sources.zip'
        }
    });

    grunt.registerTask('extract-less', 'extract LESS sources if necessary', function() {
        if (!grunt.file.isDir('less/')) {
            grunt.task.run(["unzip"]);
        }
    });

    grunt.registerTask('compile-less', "compiles less sources", function() {
        const done = this.async();
        const buildRunner = require("./build-resources/less-builder/build-runner");
        buildRunner.buildLess(".").then(() => {
            done(null);
        }).catch((err) => {
            done(err);
        });
    });

    grunt.registerTask('build-less', [
        'extract-less',
        'compile-less'
    ]);

    grunt.registerTask('build-palette' , "build theme palette", () => {
        const done  = this.async();
        const paletteBuilder = require("./build-resources/palette-builder/palette-builder");
        paletteBuilder.buildPalette(".").then(() => {
            done(null);
        }).catch((err) => {
            done(err);
        });
    });
};
