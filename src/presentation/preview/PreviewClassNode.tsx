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
  const { codebase, methodLimit, selectedMethodId, onSelectMethod, highlights, glowClassNames } = useCodebasePreview();
  const codeClass = findClass(codebase, data.classId);
  const superclass = findSuperclass(codebase, data.classId);
  const interfaceNames = findInterfaces(codebase, data.classId).map((interfaceClass) => interfaceClass.name);
  if (codeClass === undefined) return null;
  const fields = fieldsOf(codeClass);
  return (
    <div className={glowClassNames?.has(codeClass.name) === true ? 'class-node class-node--glow' : 'class-node'} data-testid={`preview-class-${codeClass.name}`} data-glow={glowClassNames?.has(codeClass.name) === true ? 'true' : undefined}>
      <DependencyHandles />
      <div className="class-node__header">
        <span className="class-node__name">
          {codeClass.name}
          <SuperclassLabel superclassName={superclass?.name} interfaceNames={interfaceNames} />
        </span>
        <span className="line-badge">{classLines(codeClass, codebase)}行</span>
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
            const chip = <MethodChipView method={method} overLimit={methodLines(method, codebase) > methodLimit} selected={selectedMethodId === method.id} />;
            const highlight = highlights?.get(method.id);
            const content = <>{chip}{highlight !== undefined && <span className="impact-highlight__label">{highlight === 'missed' ? '直し忘れ' : '直す'}</span>}</>;
            const className = highlight === undefined ? '' : `impact-highlight impact-highlight--${highlight}`;
            return onSelectMethod === undefined ? <div key={method.id} data-testid={`preview-method-${method.id}`} className={className} data-impact-highlight={highlight}>{content}</div> : (
              <button key={method.id} type="button" data-testid={`preview-method-${method.id}`} className={`method-chip-button nodrag nopan ${className}`} onClick={() => onSelectMethod(method.id)} aria-pressed={selectedMethodId === method.id} data-impact-highlight={highlight}>
                {content}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
