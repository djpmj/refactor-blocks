import type { NodeProps } from '@xyflow/react';
import { fieldsOf, findClass, findInterfaces, findSuperclass } from '../../domain/codebase/Codebase';
import { classLines, methodLines } from '../../domain/codebase/lineCount';
import { DependencyHandles } from '../canvas/DependencyHandles';
import { FieldChipView } from '../canvas/FieldChip';
import type { ClassFlowNode } from '../canvas/layoutCodebase';
import { MethodChipView } from '../canvas/MethodChip';
import { SuperclassLabel } from '../canvas/SuperclassLabel';
import { useCodebasePreview } from './CodebasePreviewContext';

/** ClassNode の読み取り専用版。dnd-kitのドラッグ・ドロップ先を持たず、メソッド・フィールドの並びだけを見せる。 */
export function PreviewClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const { codebase, methodLimit, selectedMethodId, onSelectMethod } = useCodebasePreview();
  const codeClass = findClass(codebase, data.classId);
  const superclass = findSuperclass(codebase, data.classId);
  const interfaceNames = findInterfaces(codebase, data.classId).map((interfaceClass) => interfaceClass.name);
  if (codeClass === undefined) return null;
  const fields = fieldsOf(codeClass);
  return (
    <div className="class-node" data-testid={`preview-class-${codeClass.name}`}>
      <DependencyHandles />
      <div className="class-node__header">
        <span className="class-node__name">
          {codeClass.name}
          <SuperclassLabel superclassName={superclass?.name} interfaceNames={interfaceNames} />
        </span>
        <span className="line-badge">{classLines(codeClass)}行</span>
      </div>
      {fields.length === 0 ? null : (
        <div className="class-node__fields" aria-label="フィールド">
          {fields.map((field) => (
            <FieldChipView key={field.id} field={field} />
          ))}
        </div>
      )}
      <div className="class-node__methods">
        {codeClass.methods.length === 0 ? (
          <div className="class-node__empty">メソッドなし</div>
        ) : (
          codeClass.methods.map((method) => {
            const chip = <MethodChipView method={method} overLimit={methodLines(method) > methodLimit} selected={selectedMethodId === method.id} />;
            return onSelectMethod === undefined ? <div key={method.id}>{chip}</div> : (
              <button key={method.id} type="button" data-testid={`preview-method-${method.id}`} className="method-chip-button nodrag nopan" onClick={() => onSelectMethod(method.id)} aria-pressed={selectedMethodId === method.id}>
                {chip}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
