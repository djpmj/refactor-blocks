type RelationLabelProps = Readonly<{
  superclassName?: string;
  interfaceNames: readonly string[];
}>;

/** クラス名の後ろに添える " extends 親クラス名 implements A, B"(どちらか片方だけならその部分だけ)。 */
export function SuperclassLabel({ superclassName, interfaceNames }: RelationLabelProps) {
  if (superclassName === undefined && interfaceNames.length === 0) return null;
  return (
    <span className="class-node__superclass">
      {superclassName === undefined ? null : ` extends ${superclassName}`}
      {interfaceNames.length === 0 ? null : ` implements ${interfaceNames.join(', ')}`}
    </span>
  );
}
