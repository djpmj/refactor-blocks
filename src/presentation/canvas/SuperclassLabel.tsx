type SuperclassLabelProps = Readonly<{
  kind: "extends" | "implements";
  superclassName: string;
}>;

/** クラス名の後ろに添える "extends 親クラス名" / "implements 親クラス名"。 */
export function SuperclassLabel({ kind, superclassName }: SuperclassLabelProps) {
  return (
    <span className="class-node__superclass">
      {" "}
      {kind} {superclassName}
    </span>
  );
}
