/** Root ESLint config shared by core and desktop (TypeScript packages). */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    es2020: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
  },
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.expo/**',
    '**/ios/**',
    '**/android/**',
  ],
  overrides: [
    {
      // Electron renderer: browser globals (window, document) + JSX + hooks rules.
      files: ['packages/desktop/src/renderer/**/*.{ts,tsx}'],
      env: { browser: true, es2020: true, node: false },
      parserOptions: { ecmaFeatures: { jsx: true } },
      plugins: ['react', 'react-hooks'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: { react: { version: '18.3' } },
      rules: {
        'react/react-in-jsx-scope': 'off', // React 17+ automatic JSX runtime
        'react/prop-types': 'off', // TypeScript covers this
      },
    },
    {
      // Electron main/preload: Node + Electron globals, no browser globals.
      files: ['packages/desktop/src/main/**/*.ts', 'packages/desktop/src/preload/**/*.ts'],
      env: { node: true, browser: false },
    },
    {
      // React Native app: JSX + hooks rules, RN's own JS-engine globals
      // (not a browser, not Node — fetch/console/etc. exist but window/document don't).
      files: ['packages/mobile/**/*.{ts,tsx}'],
      env: { es2020: true, node: false, browser: false },
      globals: {
        fetch: 'readonly',
        __DEV__: 'readonly',
        FormData: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        Headers: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
      plugins: ['react', 'react-hooks'],
      extends: ['plugin:react/recommended', 'plugin:react-hooks/recommended'],
      settings: { react: { version: '18.3' } },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
  ],
};
