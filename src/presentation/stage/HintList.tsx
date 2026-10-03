export function HintList({ hints }: Readonly<{ hints: readonly string[] }>) {
  if (hints.length === 0) return null;
  return (
    <ol className="stage-panel__hint-list">
      {hints.map((hint, index) => (
        <li key={index}>{hint}</li>
      ))}
    </ol>
  );
}
