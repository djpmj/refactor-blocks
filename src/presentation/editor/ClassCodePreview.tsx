import { useState } from 'react';
import { generateClassSource } from '../../domain/codebase/generateClassSource';
import { highlightCsharpLines } from './highlightCsharp';
import type { CodeLanguage, Codebase } from '../../domain/codebase/Codebase';

export function ClassCodePreview({ codebase, classId }: Readonly<{ codebase: Codebase; classId: string }>) {
  const [language, setLanguage] = useState<CodeLanguage>('csharp');
  const source = generateClassSource(codebase, classId, language);
  const highlightedLines = highlightCsharpLines(source);
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
