export type InlineSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string };

/** バッククォートで囲まれた部分を code、それ以外を text に分ける。対にならないバッククォートは文字のまま text に残す。 */
export function splitInlineCode(text: string): readonly InlineSegment[] {
  const segments: InlineSegment[] = [];
  const pattern = /`([^`]+)`/g;
  let position = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > position) segments.push({ kind: 'text', text: text.slice(position, start) });
    segments.push({ kind: 'code', text: match[1] });
    position = start + match[0].length;
  }
  if (position < text.length) segments.push({ kind: 'text', text: text.slice(position) });
  return segments;
}
