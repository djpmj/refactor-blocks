import { useState } from 'react';
import { generateClassSource } from '../../domain/codebase/generateClassSource';
import type { CodeLanguage, Codebase } from '../../domain/codebase/Codebase';

export function ClassCodePreview({ codebase, classId }: Readonly<{ codebase: Codebase; classId: string }>) {
  const [language, setLanguage] = useState<CodeLanguage>('csharp');
  return (
    <section role="tabpanel" aria-label="コード">
      <label>
        言語{' '}
        <select aria-label="コードの言語" value={language} onChange={() => { setLanguage('csharp'); }}>
          <option value="csharp">C#</option>
        </select>
      </label>
      <pre><code>{generateClassSource(codebase, classId, language)}</code></pre>
    </section>
  );
}
