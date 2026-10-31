import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';

hljs.registerLanguage('csharp', csharp);

function splitHighlightedLines(highlightedSource: string): string[] {
  const lines: string[] = [];
  const openTags: string[] = [];
  const markupPattern = /<span class="[^"]*">|<\/span>|\n/g;
  let currentLine = '';
  let cursor = 0;
  let markup = markupPattern.exec(highlightedSource);

  while (markup !== null) {
    const token = markup[0];
    currentLine += highlightedSource.slice(cursor, markup.index);
    if (token === '\n') {
      lines.push(`${currentLine}${'</span>'.repeat(openTags.length)}`);
      currentLine = openTags.join('');
    } else {
      currentLine += token;
      if (token === '</span>') openTags.pop();
      else openTags.push(token);
    }
    cursor = markup.index + token.length;
    markup = markupPattern.exec(highlightedSource);
  }

  lines.push(currentLine + highlightedSource.slice(cursor));
  return lines;
}

/** C#のソースを色付けし、元の行と同じ数のHTML文字列に分けて返す。 */
export function highlightCsharpLines(source: string): string[] {
  return splitHighlightedLines(hljs.highlight(source, { language: 'csharp' }).value);
}
