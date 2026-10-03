import { useState } from 'react';
import hljs from 'highlight.js/lib/core';
import csharp from 'highlight.js/lib/languages/csharp';
import { generateClassSource } from '../../domain/codebase/generateClassSource';
import type { CodeLanguage, Codebase } from '../../domain/codebase/Codebase';

hljs.registerLanguage('csharp', csharp);

export function ClassCodePreview({ codebase, classId }: Readonly<{ codebase: Codebase; classId: string }>) {
  const [language, setLanguage] = useState<CodeLanguage>('csharp');
  const source = generateClassSource(codebase, classId, language);
  const highlightedSource = hljs.highlight(source, { language: 'csharp' }).value;
  const lineNumbers = source.split('\n').map((_, index) => index + 1);
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
        <div className="code-preview__line-numbers" aria-hidden="true">
          {lineNumbers.map((lineNumber) => <span key={lineNumber}>{lineNumber}</span>)}
        </div>
        <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedSource }} /></pre>
      </div>
    </section>
  );
}
