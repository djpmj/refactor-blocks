import type { NodeProps } from '@xyflow/react';
import { findClass, findInterfaces, findSuperclass } from '../../domain/codebase/Codebase';
import { classLines, methodLines } from '../../domain/codebase/lineCount';
import { DependencyHandles } from '../canvas/DependencyHandles';
import type { ClassFlowNode } from '../canvas/layoutCodebase';
import { MethodChipView } from '../canvas/MethodChip';
import { SuperclassLabel } from '../canvas/SuperclassLabel';
import { useCodebasePreview } from './CodebasePreviewContext';

/** ClassNode の読み取り専用版。dnd-kitのドラッグ・ドロップ先を持たず、メソッドの並びだけを見せる。 */
export function PreviewClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const { codebase, methodLimit } = useCodebasePreview();
  const codeClass = findClass(codebase, data.classId);
  const superclass = findSuperclass(codebase, data.classId);
  const interfaceNames = findInterfaces(codebase, data.classId).map((interfaceClass) => interfaceClass.name);
  if (codeClass === undefined) return null;
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
      <div className="class-node__methods">
        {codeClass.methods.length === 0 ? (
          <div className="class-node__empty">メソッドなし</div>
        ) : (
          codeClass.methods.map((method) => <MethodChipView key={method.id} method={method} overLimit={methodLines(method) > methodLimit} />)
        )}
      </div>
    </div>
  );
}
