import type { ExtractPreview } from '../../application/RefactorUseCases';
import type { LineLimits } from '../../domain/scoring/lineLimits';

/** 抽出によって初めて上限を超える対象と、次の段階を伝える。 */
export function describeGrowthHeadsUp(preview: ExtractPreview, limits: LineLimits): string | undefined {
  if (preview.classLinesBefore <= limits.class && preview.classLinesAfter > limits.class) {
    return `クラスが ${preview.classLinesBefore}行 → ${preview.classLinesAfter}行 になり、上限(${limits.class}行)を超えます。分けたメソッドは、次の段階で受け皿のクラスへ移しましょう`;
  }
  if (preview.fileLinesBefore <= limits.file && preview.fileLinesAfter > limits.file) {
    return `ファイルが ${preview.fileLinesBefore}行 → ${preview.fileLinesAfter}行 になり、上限(${limits.file}行)を超えます。分けたメソッドは、次の段階で受け皿のクラス(別のファイル)へ移しましょう`;
  }
  return undefined;
}
