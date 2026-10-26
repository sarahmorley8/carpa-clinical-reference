import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.strict.rules,
      'no-console': 'error',
      // Content is always rendered as text, never as HTML.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Never render content as HTML. Clinical content must be displayed as plain text.',
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Never render content as HTML.',
        },
      ],
      // Patient data must never be persisted. Only the preferences module may use storage.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use src/state/preferences.ts (non-patient data only).' },
        { name: 'sessionStorage', message: 'Patient data must not be persisted.' },
        { name: 'indexedDB', message: 'Patient data must not be persisted.' },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['src/state/preferences.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['scripts/**', 'vite-plugins/**', 'vite.config.ts', 'playwright.config.ts', 'tests/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off' },
  },
);
