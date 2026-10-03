import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

const complexityRules = {
  complexity: ['error', 12],
  'max-depth': ['error', 4],
  'max-params': ['error', 4],
  'max-nested-callbacks': ['error', 3],
  'max-lines-per-function': ['error', {max: 60, skipBlankLines: true, skipComments: true}],
};

export default tseslint.config(
  {
    // workers/ はアプリ本体と別デプロイ(Cloudflare Workers)の独立したパッケージなので対象外にする
    ignores: ['node_modules/**', 'dist/**', '.claude/worktrees/**', 'coverage/**', 'workers/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked, sonarjs.configs.recommended],
    plugins: {'react-hooks': reactHooks, 'react-refresh': reactRefresh},
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      ...complexityRules,
      // Promiseを意図的に無視する `void expr` イディオム(no-floating-promises対策)と衝突するため無効化
      'sonarjs/void-use': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', {assertionStyle: 'never'}],
      // 常にtrue/falseになる条件や、不要な ?. / ?? を検出する(実質的な「optional chaining乱用」対策)
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-restricted-syntax': [
        'error',
        {selector: 'TSEnumDeclaration', message: 'enumは禁止です。Union type ("A" | "B") を使ってください'},
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow'},
        {selector: 'function', format: ['camelCase', 'PascalCase']},
        {selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow'},
        {selector: 'typeLike', format: ['PascalCase']},
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'max-lines-per-function': 'off',
    },
  }
);
