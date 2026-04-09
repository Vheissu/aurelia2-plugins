import tseslint from 'typescript-eslint';
import eslintPluginImport from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'examples/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: eslintPluginImport,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
);
