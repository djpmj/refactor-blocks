import { defineConfig, devices } from '@playwright/test';

const rawPort = process.env.E2E_PORT ?? '5174';
const PORT = Number(rawPort);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error(`E2E_PORT は 1024〜65535 の整数で指定してください(受け取った値: ${rawPort})`);
}
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ORIGIN,
    // ツアー表示済み・ストーリーOFFにして、多くのテストでツアーが出ないようにする
    storageState: {
      cookies: [],
      origins: [
        {
          origin: ORIGIN,
          localStorage: [
            { name: 'refactor-blocks:tour-seen', value: 'true' },
            { name: 'refactor-blocks:story', value: 'false' },
          ],
        },
      ],
    },
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --mode test で .env.test を読み込み、AI講評の呼び出し先をPlaywrightがモックできる同一オリジンのURLにする
    command: `npm run dev -- --port ${PORT} --strictPort --mode test`,
    url: ORIGIN,
    // 別のworktreeのサーバーを黙って使わないよう、E2E_REUSE_SERVER=1 のときだけ再利用する
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE_SERVER === '1',
  },
});
