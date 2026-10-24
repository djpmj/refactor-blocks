export const APP_TITLE = 'Refactor Blocks';

/** タブ名。リファクタリングは「<ステージ名> - Refactor Blocks」、他のモードは「<モード名> - Refactor Blocks」。 */
export function pageTitle(modeLabel: string, stageTitle: string | null): string {
  const view = stageTitle === null || stageTitle === '' ? modeLabel : stageTitle;
  return `${view} - ${APP_TITLE}`;
}
