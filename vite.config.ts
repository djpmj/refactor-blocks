import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    // feature-harnessのimplementerがリポジトリ内(.claude/worktrees/)に作るgit worktreeと、
    // PlaywrightのE2Eテスト(e2e/)をVitestで実行しないよう除外する(デフォルトの除外設定は維持する)。
    exclude: [...configDefaults.exclude, '.claude/worktrees/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // ゲームのルール(分割・統合・採点)の正しさが品質の中心なので、domain/application層に閾値をかける。
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
      exclude: [...(configDefaults.coverage?.exclude ?? []), 'src/**/*.test.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
