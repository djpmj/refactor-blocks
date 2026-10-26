import { useEffect, useRef, useState } from 'react';
import { conceptMastery, isStageCleared, recommendNextStage, stageStatus, type StageStatus } from '../../domain/progress/roadmap';
import type { Milestones } from '../../domain/progress/milestones';
import type { Progress } from '../../domain/progress/Progress';
import type { Stage } from '../../domain/stage/Stage';
import { DESIGN_PRINCIPLES } from '../../infrastructure/stages/designPrinciples';
import { useGameStore } from '../store/useGameStore';
import { ConceptMasteryList } from './ConceptMasteryList';
import { LEVEL_LABEL } from './levelLabel';
import { MILESTONE_LABEL } from './milestoneLabel';

const TITLE_ID = 'stage-roadmap-title';

function describeStatus(status: StageStatus): string {
  switch (status.kind) {
    case 'not-started':
      return '未挑戦';
    case 'in-progress':
      return '挑戦中';
    case 'scored':
      return `${String(status.best)}点`;
    case 'perfect':
      return `100点(あと: ${status.remaining.map((milestone) => MILESTONE_LABEL[milestone]).join('・')})`;
    case 'cleared':
      return '✅ クリア';
  }
}

type StageCardProps = {
  readonly stage: Stage;
  readonly current: boolean;
  readonly recommended: boolean;
  readonly status: StageStatus;
  readonly onChoose: () => void;
};

function StageCard({ stage, current, recommended, status, onChoose }: StageCardProps) {
  return (
    <button
      type="button"
      className={`stage-roadmap__card${current ? ' stage-roadmap__card--current' : ''}`}
      aria-current={current ? 'true' : undefined}
      data-testid={`roadmap-stage-${stage.id}`}
      onClick={onChoose}
    >
      <span className="stage-roadmap__card-title">{stage.title}</span>
      <span className="stage-roadmap__learns">
        {stage.learns.map((item) => (
          <span key={item} className="stage-roadmap__tag">
            {item}
          </span>
        ))}
      </span>
      {stage.principles !== undefined && stage.principles.length > 0 && (
        <span className="stage-roadmap__principles" data-testid={`roadmap-principles-${stage.id}`}>
          <span className="stage-roadmap__principles-heading">原則</span>
          {stage.principles.map((p) => (
            <span key={p} className="stage-roadmap__tag stage-roadmap__tag--principle">
              {DESIGN_PRINCIPLES[p].label}
            </span>
          ))}
        </span>
      )}
      <span className="stage-roadmap__status">
        {describeStatus(status)}
        {recommended && <span className="stage-roadmap__recommend"> おすすめ</span>}
      </span>
    </button>
  );
}

type StageLevelsProps = {
  readonly stages: readonly Stage[];
  readonly currentId: string;
  readonly nextId: string | undefined;
  readonly progress: Progress;
  readonly milestones: Milestones;
  readonly draftStageIds: readonly string[];
  readonly onChoose: (stageId: string) => void;
};

function StageLevels({ stages, currentId, nextId, progress, milestones, draftStageIds, onChoose }: StageLevelsProps) {
  // ステージは難易度順に並んでいるので、出てきた順に難易度をまとめる
  const levels = [...new Set(stages.map((stage) => stage.level))];
  return levels.map((level) => (
    <section key={level} className="stage-roadmap__level">
      <h3>{LEVEL_LABEL[level]}</h3>
      <div className="stage-roadmap__cards">
        {stages
          .filter((stage) => stage.level === level)
          .map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              current={stage.id === currentId}
              recommended={stage.id === nextId}
              status={stageStatus(stage, progress, milestones, draftStageIds.includes(stage.id))}
              onChoose={() => {
                onChoose(stage.id);
              }}
            />
          ))}
      </div>
    </section>
  ));
}

type RoadmapView = 'stages' | 'concepts';

type ViewSwitchProps = {
  readonly view: RoadmapView;
  readonly onChange: (view: RoadmapView) => void;
};

function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  return (
    <div className="stage-roadmap__views">
      <button type="button" aria-pressed={view === 'stages'} data-testid="roadmap-view-stages" onClick={() => { onChange('stages'); }}>
        ステージ順
      </button>
      <button type="button" aria-pressed={view === 'concepts'} data-testid="roadmap-view-concepts" onClick={() => { onChange('concepts'); }}>
        学べることごと
      </button>
    </div>
  );
}

type StageRoadmapDialogProps = {
  /** false なら表示しない。ネイティブの dialog に Esc・背景の上乗せ・フォーカスの復帰を任せる。 */
  readonly open: boolean;
  readonly onClose: () => void;
};

export function StageRoadmapDialog({ open, onClose }: StageRoadmapDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<RoadmapView>('stages');
  const stages = useGameStore((state) => state.stages);
  const currentId = useGameStore((state) => state.stage.id);
  const progress = useGameStore((state) => state.progress);
  const milestones = useGameStore((state) => state.milestones);
  const draftStageIds = useGameStore((state) => state.draftStageIds);
  const selectStage = useGameStore((state) => state.selectStage);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, [open]);
  if (!open) return null;
  const next = recommendNextStage(stages, progress, milestones);
  const close = () => ref.current?.close();
  // 常時マウントされているので、閉じるときに表示切替を初期値へ戻す(開いた直後は「ステージ順」)
  const handleClosed = () => {
    setView('stages');
    onClose();
  };
  const choose = (stageId: string) => {
    if (stageId !== currentId) selectStage(stageId);
    close();
  };
  return (
    <dialog ref={ref} className="stage-roadmap" aria-labelledby={TITLE_ID} onClose={handleClosed} data-testid="stage-roadmap">
      <div className="stage-roadmap__header">
        <h2 className="stage-roadmap__title" id={TITLE_ID}>
          ステージ一覧
        </h2>
        <button type="button" onClick={close} aria-label="閉じる">
          ✕
        </button>
      </div>
      <div className="stage-roadmap__body">
        <p className="stage-roadmap__next" data-testid="roadmap-next">
          {next === undefined ? '全ステージをクリアしました' : `次のおすすめ: ${next.title}`}
        </p>
        <ViewSwitch view={view} onChange={setView} />
        {view === 'concepts' ? (
          <ConceptMasteryList mastery={conceptMastery(stages, (id) => isStageCleared(id, progress))} onChoose={choose} />
        ) : (
          <StageLevels
            stages={stages}
            currentId={currentId}
            nextId={next?.id}
            progress={progress}
            milestones={milestones}
            draftStageIds={draftStageIds}
            onChoose={choose}
          />
        )}
      </div>
    </dialog>
  );
}
