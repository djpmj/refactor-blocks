import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { NodeProps } from "@xyflow/react";
import { fieldsOf, findClass, findInterfaces, findSuperclass, type CodeClass } from "../../domain/codebase/Codebase";
import { classDependencies, cyclicClassIds } from "../../domain/codebase/dependencies";
import { classLines } from "../../domain/codebase/lineCount";
import { previewExtractMethod } from "../../application/RefactorUseCases";
import { classLayers } from "../../domain/scoring/layers";
import { classResponsibilities } from "../../domain/scoring/responsibilities";
import { responsibilityMarks } from "../../domain/stage/responsibilityMarks";
import { responsibilityMarkLetter } from "../editor/responsibilityMarkLetter";
import { violationTargets } from "../../domain/scoring/violationTargets";
import { useGameStore } from "../store/useGameStore";
import { classDragId, classDropId } from "./dndIds";
import { DependencyHandles } from "./DependencyHandles";
import { FieldChip } from "./FieldChip";
import { InlineEditableLabel } from "./InlineEditableLabel";
import type { ClassFlowNode } from "./layoutCodebase";
import { ManualFixCheck, MethodChip, MethodChipView } from "./MethodChip";
import type { Method } from "../../domain/codebase/Codebase";
import { useShowDetails } from "./semanticZoom";
import { SuperclassLabel } from "./SuperclassLabel";
import { BLOCK_OPERATION_TITLES } from "../guide/operationGuide";
import { useDropTargetClassNames } from "./DropTargetsContext";
import { useResolvedCelebration } from "./useResolvedCelebration";
import { findUnplacedParts, TRAY_CLASS_ID } from "../../domain/blank/tray";
import { classRoleName, classStereotype } from "./classStereotype";

/** 循環依存に関与しているクラスの印。色だけに頼らずアイコンとラベルでも伝える。ズームで詳細を隠していても出す。 */
function CyclicMark() {
  const label = "循環依存にあります";
  return (
    <span className="cyclic-mark" role="img" aria-label={label} title={label} data-testid="cyclic-mark">
      🔁
    </span>
  );
}

/** ステージに層の定義があるとき、クラスが属する層の名前を出す。色に頼らず文字で伝える。 */
function LayerTag({ name, className }: Readonly<{ name: string; className: string }>) {
  return (
    <span className="class-node__layer" data-testid={`layer-${className}`}>
      {name}
    </span>
  );
}

/** ドロップ先・循環依存の強調を両立できるよう、該当するクラス名だけを組み立てる。 */
function classNodeClassName({ isOver, isCyclic }: Readonly<{ isOver: boolean; isCyclic: boolean }>): string {
  return ["class-node", isOver ? "class-node--drop-target" : null, isCyclic ? "class-node--cyclic" : null]
    .filter(Boolean)
    .join(" ");
}

/** クラス名と、親クラス(継承元/実装先)があれば "extends 親クラス名" か "implements 親クラス名" を添える。 */
function ClassNameLabel({ classId, name }: Readonly<{ classId: string; name: string }>) {
  const codebase = useGameStore((state) => state.codebase);
  const superclass = findSuperclass(codebase, classId);
  const interfaceNames = findInterfaces(codebase, classId).map((codeClass) => codeClass.name);
  const renameClass = useGameStore((state) => state.renameClass);
  return (
    <span className="class-node__name-line">
      <InlineEditableLabel
        value={name}
        ariaLabel="クラス名"
        className="class-node__name"
        onSubmit={(newName) => renameClass(classId, newName)}
      />
      <SuperclassLabel superclassName={superclass?.name} interfaceNames={interfaceNames} />
    </span>
  );
}

function ClassStereotypeMark({ stereotype }: Readonly<{ stereotype: ReturnType<typeof classStereotype> }>) {
  if (stereotype === null) return null;
  return <span className="class-node__stereotype">«{stereotype}»</span>;
}

function classHeaderLabel(codeClass: CodeClass): string {
  const roleName = classRoleName(classStereotype(codeClass));
  const rolePrefix = roleName === '' ? '' : `${roleName} `;
  return `${rolePrefix}${codeClass.name} を別ファイルへ移動`;
}

function classNameGroupClass(stereotype: ReturnType<typeof classStereotype>): string {
  if (stereotype === 'interface') return 'class-node__name-group class-node__name-group--interface';
  if (stereotype === 'abstract') return 'class-node__name-group class-node__name-group--abstract';
  return 'class-node__name-group';
}

/** フィールド(あれば)とメソッドの一覧。詳細表示(showDetails)のときだけ描く。 */
function ClassBody({ codeClass }: Readonly<{ codeClass: CodeClass }>) {
  const fields = fieldsOf(codeClass);
  const codebase = useGameStore((state) => state.codebase);
  const draft = useGameStore((state) => state.extractDraft);
  const methodLimit = useGameStore((state) => state.stage.limits.method);
  const previewAllowed = useGameStore((state) => state.changeSession === null && state.manualFix === null);
  const manualFixing = useGameStore((state) => state.manualFix !== null);
  const preview = draft === null || !previewAllowed ? undefined : previewExtractMethod(codebase, draft);
  return (
    <>
      {fields.length === 0 ? null : (
        <div className="class-node__fields" aria-label="フィールド">
          {fields.map((field) => (
            <FieldChip key={field.id} field={field} />
          ))}
        </div>
      )}
      <div className="class-node__methods">
        {codeClass.methods.length === 0 ? (
          <div className="class-node__empty">ここにメソッドをドロップ</div>
        ) : (
          codeClass.methods.map((method) => {
            const isSource = preview?.sourceMethodId === method.id;
            const placeholder: Method = {
              id: 'extract-preview-placeholder',
              name: preview?.newMethodName ?? '',
              visibility: 'private',
              fragments: [{ id: 'extract-preview-fragment', label: '', lines: Math.max(0, (preview?.newMethodLines ?? 3) - 3), responsibility: 'preview' }],
            };
            return (
              <div className={manualFixing ? 'method-chip-row method-chip-row--manual-fix' : 'method-chip-row'} key={method.id}>
                <MethodChip
                  method={method}
                  linePreview={isSource
                    ? { before: preview.sourceLinesBefore, after: preview.sourceLinesAfter, afterOverLimit: preview.sourceLinesAfter > methodLimit }
                    : undefined}
                />
                <ManualFixCheck method={method} className={codeClass.name} />
                {isSource ? (
                  <div className="extract-preview-chip" role="img" aria-label={`抽出後のプレビュー: ${placeholder.name}() ${preview.newMethodLines}行`} data-testid="extract-preview-chip">
                    <MethodChipView method={placeholder} overLimit={false} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function ClassLineBadge({ codeClass, limit }: Readonly<{ codeClass: CodeClass; limit: number }>) {
  const codebase = useGameStore((state) => state.codebase);
  const lines = classLines(codeClass, codebase);
  return <span className={lines > limit ? 'line-badge line-badge--over' : 'line-badge'}>{lines}行</span>;
}

function ClassResponsibilityBadge({ codeClass, limit }: Readonly<{ codeClass: CodeClass; limit: number }>) {
  const current = useGameStore((state) => state.codebase);
  const initial = useGameStore((state) => state.stage.codebase);
  const stage = useGameStore((state) => state.stage);
  const reservedResponsibilities = stage.changeRequests.map((request) => request.responsibility);
  const responsibilities = classResponsibilities(codeClass);
  const marks = responsibilityMarks(initial, current, reservedResponsibilities);
  if (responsibilities.length === 0) return null;
  const letters = responsibilities.map((responsibility) => responsibilityMarkLetter(marks.get(responsibility) ?? 0));
  const over = responsibilities.length > limit;
  return (
    <span
      className={over ? 'responsibility-count responsibility-count--over' : 'responsibility-count'}
      data-testid={`class-responsibilities-${codeClass.name}`}
      title={`責務 ${letters.join('・')}`}
    >
      責務 {responsibilities.length}種類{over ? `(上限 ${limit})` : ''}
    </span>
  );
}

/** ヘッダー右側の印と数値。部品置き場は採点されないので、責務・行数は出さない。 */
function ClassHeaderBadges({ codeClass, layerName, isCyclic, isTray }: Readonly<{ codeClass: CodeClass; layerName: string | undefined; isCyclic: boolean; isTray: boolean }>) {
  const showDetails = useShowDetails();
  const limit = useGameStore((state) => state.stage.limits.class);
  const responsibilityLimit = useGameStore((state) => state.stage.responsibilityLimit);
  const showCounts = showDetails && !isTray;
  return (
    <>
      {layerName === undefined ? null : <LayerTag name={layerName} className={codeClass.name} />}
      {isCyclic ? <CyclicMark /> : null}
      {showCounts ? <ClassResponsibilityBadge codeClass={codeClass} limit={responsibilityLimit} /> : null}
      {showCounts ? <ClassLineBadge codeClass={codeClass} limit={limit} /> : null}
    </>
  );
}

/** 部品置き場の見出し。採点されない置き場なので、責務・行数ではなく残りの部品数だけを出す。 */
function TrayHeaderLabel() {
  const remaining = useGameStore((state) => findUnplacedParts(state.stage.codebase, state.codebase).length);
  return <span className="class-node__name" data-testid="tray-label">部品置き場(あと {remaining} 個)</span>;
}

export function ClassNode({ data }: Readonly<NodeProps<ClassFlowNode>>) {
  const resolved = useResolvedCelebration('classIds', data.classId);
  const codeClass = useGameStore((state) =>
    findClass(state.codebase, data.classId),
  );
  const isCyclic = useGameStore((state) =>
    cyclicClassIds(classDependencies(state.codebase)).has(data.classId),
  );
  const layerName = useGameStore((state) => {
    const { layers } = state.stage;
    const index = layers === undefined ? undefined : classLayers(state.codebase, layers).get(data.classId);
    return layers === undefined || index === undefined ? undefined : layers[index].name;
  });
  const flagged = useGameStore((state) => {
    const rule = state.focusedRule;
    return rule !== null
      ? violationTargets(state.codebase, state.stage)[rule].classIds.includes(data.classId)
      : state.hintTarget?.classIds.includes(data.classId) ?? (state.previewRule !== null && violationTargets(state.codebase, state.stage)[state.previewRule].classIds.includes(data.classId));
  });
  const showDetails = useShowDetails();
  const dropTargetClasses = useDropTargetClassNames('class', data.classId);
  const { setNodeRef, isOver } = useDroppable({
    id: classDropId(data.classId),
  });
  // ヘッダーを掴むとクラスごと別ファイルへドラッグできる
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    isDragging,
  } = useDraggable({ id: classDragId(data.classId) });
  if (codeClass === undefined) return null;
  const isTray = data.classId === TRAY_CLASS_ID;
  return (
    <div ref={setNodeRef} className={[classNodeClassName({ isOver, isCyclic }), isTray ? 'class-node--tray' : '', dropTargetClasses, flagged ? 'class-node--flagged' : '', resolved ? 'class-node--resolved' : ''].filter(Boolean).join(' ')} data-testid={`class-${codeClass.name}`}>
      {/* 依存の矢印の接続点。つなぐ操作はさせないので見た目には出さない。 */}
      <DependencyHandles />
      <div
        ref={setDragRef}
        className="class-node__header nodrag nopan"
        style={{ opacity: isDragging ? 0.3 : 1 }}
        data-testid={`class-header-${codeClass.name}`}
        aria-label={classHeaderLabel(codeClass)}
        title={BLOCK_OPERATION_TITLES.class}
        {...attributes}
        {...listeners}
      >
        <span className={classNameGroupClass(classStereotype(codeClass))}>
          <ClassStereotypeMark stereotype={classStereotype(codeClass)} />
          {isTray ? <TrayHeaderLabel /> : <ClassNameLabel classId={data.classId} name={codeClass.name} />}
        </span>
        <ClassHeaderBadges codeClass={codeClass} layerName={layerName} isCyclic={isCyclic} isTray={isTray} />
      </div>
      {showDetails ? <ClassBody codeClass={codeClass} /> : null}
    </div>
  );
}
