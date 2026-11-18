import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'nextjs', 'react'],
    categories: {
      correctness: 'warn',
    },
    env: {
      builtin: true,
    },
    ignorePatterns: ['**/dist/**', '**/.next/**', '**/node_modules/**', '**/next-env.d.ts', '.playwright/**'],
    rules: {
      'no-array-constructor': 'error',
      'no-unused-expressions': 'error',
      'no-unused-vars': 'error',
      'nextjs/no-html-link-for-pages': 'off',
      'nextjs/inline-script-id': 'error',
      'nextjs/no-assign-module-variable': 'error',
      'nextjs/no-document-import-in-page': 'error',
      'nextjs/no-duplicate-head': 'error',
      'nextjs/no-head-import-in-document': 'error',
      'nextjs/no-script-component-in-head': 'error',
      'react/rules-of-hooks': 'error',
      'react/exhaustive-deps': 'warn',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-duplicate-enum-values': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-extra-non-null-assertion': 'error',
      'typescript/no-misused-new': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-asserted-optional-chain': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-this-alias': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-declaration-merging': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'typescript/no-wrapper-object-types': 'error',
      'typescript/prefer-as-const': 'error',
      'typescript/prefer-namespace-keyword': 'error',
      'typescript/triple-slash-reference': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
        rules: {
          'constructor-super': 'off',
          'getter-return': 'off',
          'no-class-assign': 'off',
          'no-const-assign': 'off',
          'no-dupe-class-members': 'off',
          'no-dupe-keys': 'off',
          'no-func-assign': 'off',
          'no-import-assign': 'off',
          'no-new-native-nonconstructor': 'off',
          'no-obj-calls': 'off',
          'no-redeclare': 'off',
          'no-setter-return': 'off',
          'no-this-before-super': 'off',
          'no-undef': 'off',
          'no-unreachable': 'off',
          'no-unsafe-negation': 'off',
          'no-var': 'error',
          'no-with': 'off',
          'prefer-const': 'error',
          'prefer-rest-params': 'error',
          'prefer-spread': 'error',
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
  // Pre-commit (.vite-hooks/pre-commit runs `vp staged`): format, lint and fix the staged files.
  staged: {
    '*': 'vp check --fix',
  },
  run: {
    tasks: {
      // The full check: pre-push (.vite-hooks/pre-push) and GitHub CI both run `vp run ci`.
      // Build first: the example imports @n3wtou/mnml-cms from its dist, which `vp check` type-checks.
      ci: {
        command: ['pnpm build', 'vp check --deny-warnings', 'pnpm typecheck', 'vp test run', 'pnpm --filter example build'],
        cache: false,
      },
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
  },
  fmt: {
    singleQuote: true,
    printWidth: 160,
    sortPackageJson: false,
    ignorePatterns: [
      'node_modules',
      'dist',
      '.next',
      'pnpm-lock.yaml',
      'CHANGELOG.md',
      '.changeset/*.md',
      'next-env.d.ts',
      '*.tsbuildinfo',
      '*.md',
      '*.css',
      '.playwright',
    ],
  },
});
