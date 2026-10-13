import type { ExtractPreview } from '../../application/RefactorUseCases';

export function describeExtractPreview(methodName: string, preview: ExtractPreview): string {
  const overhead = preview.fileLinesAfter - preview.fileLinesBefore;
  const base = `抽出すると: ${methodName} ${preview.sourceLinesBefore}行 → ${preview.sourceLinesAfter}行 / 新しい ${preview.newMethodName} ${preview.newMethodLines}行`;
  return overhead > 0 ? `${base}(ファイルは +${overhead}行: 宣言と呼び出しの分)` : base;
}
