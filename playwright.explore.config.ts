import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

/** 実機プレイの探索用(`npm run explore`)。E2E本体の設定を使い、テストの場所だけ explore/ に変える。 */
export default defineConfig({
  ...base,
  testDir: './explore',
  fullyParallel: false,
  retries: 0,
});
