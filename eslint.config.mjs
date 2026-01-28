import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslintPlugin from '@typescript-eslint/eslint-plugin';
import tseslintParser from '@typescript-eslint/parser';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {
        ignores: ['out/', 'dist/', '**/*.d.ts', 'webpack.config.js'],
    },
    {
        files: ['src/**/*.{js,mjs,cjs,ts}'],
        languageOptions: {
            globals: globals.node,
            parser: tseslintParser,
            parserOptions: {
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': tseslintPlugin,
        },
        rules: {
            ...pluginJs.configs.recommended.rules,
            ...tseslintPlugin.configs.recommended.rules,

            // Custom rules
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],
            '@typescript-eslint/semi': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',
            semi: 'off',
            'no-undef': 'off',
        },
    },
    {
        files: ['src/test/**/*.ts'],
        languageOptions: {
            globals: globals.mocha,
        },
    },
    eslintPluginPrettierRecommended,
];
