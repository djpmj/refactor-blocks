import { useState } from 'react';
import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';
import { generateClassSource } from '../../domain/codebase/generateClassSource';
import type { CodeLanguage, Codebase } from '../../domain/codebase/Codebase';

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

export function ClassCodePreview({ codebase, classId }: Readonly<{ codebase: Codebase; classId: string }>) {
  const [language, setLanguage] = useState<CodeLanguage>('csharp');
  const source = generateClassSource(codebase, classId, language);
  const highlightedLines = splitHighlightedLines(hljs.highlight(source, { language: 'csharp' }).value);
  const sourceLines = source.split('\n');
  function updateLanguage(value: string) {
    if (value === 'csharp') setLanguage(value);
  }

  return (
    <section role="tabpanel" aria-label="コード">
      <label>
        言語{' '}
        <select aria-label="コードの言語" value={language} onChange={(event) => { updateLanguage(event.target.value); }}>
          <option value="csharp">C#</option>
        </select>
      </label>
      <div className="code-preview">
        <pre><code className="hljs">{sourceLines.map((_, index) => (
          <span className="code-preview__line" data-line-number={index + 1} key={index}>
            <span className="code-preview__line-source" dangerouslySetInnerHTML={{ __html: highlightedLines[index] }} />
          </span>
        )).flatMap((line, index) => index < sourceLines.length - 1 ? [line, '\n'] : [line])}</code></pre>
      </div>
    </section>
  );
}
