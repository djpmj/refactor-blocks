type RelationLabelProps = Readonly<{
  superclassName?: string;
  interfaceNames: readonly string[];
}>;

/** クラス名の後ろに添える " extends 親クラス名 implements A, B"(どちらか片方だけならその部分だけ)。 */
export function SuperclassLabel({ superclassName, interfaceNames }: RelationLabelProps) {
  if (superclassName === undefined && interfaceNames.length === 0) return null;
  return (
    <span className="class-node__superclass">
      {superclassName === undefined ? null : <span className="class-node__relation class-node__relation--extends"> extends {superclassName}</span>}
      {interfaceNames.length === 0 ? null : <span className="class-node__relation class-node__relation--implements"> implements {interfaceNames.join(', ')}</span>}
    </span>
  );
}
