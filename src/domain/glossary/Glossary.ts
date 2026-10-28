export type GlossaryTerm = {
  /** 例: 'coupling'。data-testid に使う */
  readonly id: string;
  /** 見出し。例: '結合度'。name 自体も見つける対象に含める */
  readonly name: string;
  /** 別表記。例: ['依存先']。無ければ [] */
  readonly aliases: readonly string[];
  /** 1〜2文 */
  readonly definition: string;
  /** 一言の例(「例:」は表示側で付ける) */
  readonly example: string;
};

export type TextSegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'term'; readonly text: string; readonly termId: string };

type Notation = { readonly text: string; readonly termId: string };

const isAsciiWord = (char: string | undefined): boolean => char !== undefined && /^[A-Za-z0-9]$/.test(char);

/** 英字で始まる・終わる表記は、その外側が英数字なら別の語の一部なので一致させない。 */
function matchesAt(text: string, index: number, notation: string): boolean {
  if (!text.startsWith(notation, index)) return false;
  if (isAsciiWord(notation[0]) && isAsciiWord(text[index - 1])) return false;
  return !(isAsciiWord(notation.at(-1)) && isAsciiWord(text[index + notation.length]));
}

function longestMatchAt(text: string, index: number, notations: readonly Notation[]): Notation | undefined {
  let best: Notation | undefined;
  for (const notation of notations) {
    if (matchesAt(text, index, notation.text) && (best === undefined || notation.text.length > best.text.length)) best = notation;
  }
  return best;
}

function appendText(segments: TextSegment[], text: string): void {
  const last = segments.at(-1);
  if (last?.kind === 'text') segments[segments.length - 1] = { kind: 'text', text: last.text + text };
  else segments.push({ kind: 'text', text });
}

/** 文字列を、用語(最長一致・全出現)とそれ以外に分ける。 */
export function splitByTerms(text: string, terms: readonly GlossaryTerm[]): readonly TextSegment[] {
  const notations = terms.flatMap((term) => [term.name, ...term.aliases].filter((notation) => notation !== '').map((notation) => ({ text: notation, termId: term.id })));
  const segments: TextSegment[] = [];
  let index = 0;
  // ponytail: 表記数×文字数の素朴な走査。数百語・長文に広げるときは表記を長さ順の正規表現1本にまとめる
  while (index < text.length) {
    const match = longestMatchAt(text, index, notations);
    if (match === undefined) {
      appendText(segments, text[index]);
      index += 1;
    } else {
      segments.push({ kind: 'term', text: match.text, termId: match.termId });
      index += match.text.length;
    }
  }
  return segments;
}
