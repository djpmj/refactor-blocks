import { useEffect, useRef } from 'react';
import { recommendNextStage, stageStatus, type StageStatus } from '../../domain/progress/roadmap';
import type { Stage } from '../../domain/stage/Stage';
import { useGameStore } from '../store/useGameStore';
import { LEVEL_LABEL } from './levelLabel';

const TITLE_ID = 'stage-roadmap-title';

function describeStatus(status: StageStatus): string {
  switch (status.kind) {
    case 'not-started':
      return '未挑戦';
    case 'in-progress':
      return '挑戦中';
    case 'scored':
      return `${String(status.best)}点`;
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
      <span className="stage-roadmap__status">
        {describeStatus(status)}
        {recommended && <span className="stage-roadmap__recommend"> おすすめ</span>}
      </span>
    </button>
  );
}

type StageRoadmapDialogProps = {
  /** false なら表示しない。ネイティブの dialog に Esc・背景の上乗せ・フォーカスの復帰を任せる。 */
  readonly open: boolean;
  readonly onClose: () => void;
};

export function StageRoadmapDialog({ open, onClose }: StageRoadmapDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const stages = useGameStore((state) => state.stages);
  const currentId = useGameStore((state) => state.stage.id);
  const progress = useGameStore((state) => state.progress);
  const draftStageIds = useGameStore((state) => state.draftStageIds);
  const selectStage = useGameStore((state) => state.selectStage);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, [open]);
  if (!open) return null;
  const next = recommendNextStage(stages, progress);
  // ステージは難易度順に並んでいるので、出てきた順に難易度をまとめる
  const levels = [...new Set(stages.map((stage) => stage.level))];
  const close = () => ref.current?.close();
  return (
    <dialog ref={ref} className="stage-roadmap" aria-labelledby={TITLE_ID} onClose={onClose} data-testid="stage-roadmap">
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
        {levels.map((level) => (
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
                    recommended={stage.id === next?.id}
                    status={stageStatus(stage.id, progress, draftStageIds.includes(stage.id))}
                    onChoose={() => {
                      if (stage.id !== currentId) selectStage(stage.id);
                      close();
                    }}
                  />
                ))}
            </div>
          </section>
        ))}
      </div>
    </dialog>
  );
}
