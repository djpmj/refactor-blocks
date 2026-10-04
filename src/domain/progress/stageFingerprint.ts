import type { Stage } from '../stage/Stage';

/** ステージの初期コードの JSON から作る短い文字列(32bit の FNV-1a を16進で)。 */
// ponytail: 指紋は簡単な32bitハッシュ。暗号的な強さは要らない(偶然の一致で古い下書きが復元されても、形の検証は通っている)。問題が出たら長いハッシュにする
export function stageFingerprint(stage: Pick<Stage, 'codebase'>): string {
  const json = JSON.stringify(stage.codebase);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash = Math.imul(hash ^ json.charCodeAt(i), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
