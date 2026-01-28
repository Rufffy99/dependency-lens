// @ts-nocheck
const path = require('path');
const webpack = require('webpack'); // eslint-disable-line @typescript-eslint/no-var-requires

/** @typedef {import('webpack').Configuration} WebpackConfig */

/** @type WebpackConfig */
const webExtensionConfig = {
    mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: 'node', // extensions run in a node context
    entry: {
        extension: './src/extension.ts',
    },
    output: {
        filename: '[name].js',
        path: path.join(__dirname, './dist'),
        libraryTarget: 'commonjs',
        devtoolModuleFilenameTemplate: '../../[resource-path]'
    },
    resolve: {
        mainFields: ['module', 'main'],
        extensions: ['.ts', '.js'], // support ts-files and js-files
        fallback: {
            "path": require.resolve("path-browserify"),
            "fs": false
        }
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
    externals: {
        'vscode': 'commonjs vscode', // ignored because it doesn't exist
    },
    performance: {
        hints: false
    },
    devtool: 'nosources-source-map', // create a source map that points to the original source file
    infrastructureLogging: {
        level: "log", // enables infrastructure logging
        debug: /PackFileCache/
    }
};

module.exports = [webExtensionConfig];
