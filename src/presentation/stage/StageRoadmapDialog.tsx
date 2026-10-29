import { useEffect, useRef, useState } from 'react';
import { retryMark, type AssistLevel } from '../../domain/progress/assists';
import { conceptMastery, isStageCleared, recommendNextStage, recommendReviewStage, stageStatus, type StageStatus } from '../../domain/progress/roadmap';
import type { Milestones } from '../../domain/progress/milestones';
import type { Progress } from '../../domain/progress/Progress';
import type { ReflectionNotes } from '../../domain/progress/reflectionNotes';
import { summarizeQuizRecord } from '../../domain/quiz/quizRecord';
import type { Stage } from '../../domain/stage/Stage';
import { antipatterns } from '../../infrastructure/gallery/antipatterns';
import { loadQuizRecord } from '../../infrastructure/progress/quizRecordStorage';
import { comparisonQuizzes } from '../../infrastructure/quizzes/comparisonQuizzes';
import { DESIGN_PRINCIPLES } from '../../infrastructure/stages/designPrinciples';
import { useGameStore } from '../store/useGameStore';
import { GlossaryText } from '../glossary/GlossaryText';
import { AntipatternGallery } from './AntipatternGallery';
import { ConceptMasteryList } from './ConceptMasteryList';
import { LearningRecordSection } from './LearningRecordSection';
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

const RETRY_LABEL: Readonly<Record<AssistLevel, string>> = {
  step: 'もう一度自力で(次の一手を見てクリア)',
  ghost: 'もう一度自力で(動きで見てクリア)',
  answer: 'もう一度自力で(答えを見てクリア)',
};

type StageCardProps = {
  readonly stage: Stage;
  readonly current: boolean;
  readonly recommended: boolean;
  readonly reviewRecommended: boolean;
  readonly retry: AssistLevel | undefined;
  readonly status: StageStatus;
  readonly note: string | undefined;
  readonly onChoose: () => void;
};

function StageCard({ stage, current, recommended, reviewRecommended, retry, status, note, onChoose }: StageCardProps) {
  return (
    <div
      className={`stage-roadmap__card${current ? ' stage-roadmap__card--current' : ''}`}
      data-testid={`roadmap-card-${stage.id}`}
    >
      <button
        type="button"
        className="stage-roadmap__choose"
        aria-current={current ? 'true' : undefined}
        data-testid={`roadmap-stage-${stage.id}`}
        onClick={onChoose}
      >
        <span className="stage-roadmap__card-title">{stage.title}</span>
        <span className="stage-roadmap__status">
          {describeStatus(status)}
          {retry !== undefined && (
            <span className="stage-roadmap__retry" data-testid={`roadmap-retry-${stage.id}`}> {RETRY_LABEL[retry]}</span>
          )}
          {recommended && <span className="stage-roadmap__recommend"> おすすめ</span>}
          {reviewRecommended && <span className="stage-roadmap__recommend"> 復習</span>}
        </span>
        {note !== undefined && <span className="stage-roadmap__note" data-testid={`roadmap-note-${stage.id}`} title={note}>メモ: {note}</span>}
      </button>
      <span className="stage-roadmap__learns">
        {stage.learns.map((item) => (
          <span key={item} className="stage-roadmap__tag">
            <GlossaryText text={item} />
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
    </div>
  );
}

type StageLevelsProps = {
  readonly stages: readonly Stage[];
  readonly currentId: string;
  readonly nextId: string | undefined;
  readonly progress: Progress;
  readonly reflectionNotes: ReflectionNotes;
  readonly milestones: Milestones;
  readonly draftStageIds: readonly string[];
  readonly onChoose: (stageId: string) => void;
};

function StageLevels({ stages, currentId, nextId, progress, reflectionNotes, milestones, draftStageIds, onChoose }: StageLevelsProps) {
  const assists = useGameStore((state) => state.assists);
  const reviewId = recommendReviewStage(stages, progress, assists)?.id;
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
              reviewRecommended={stage.id === reviewId}
              retry={isStageCleared(stage.id, progress) ? retryMark(assists, stage.id) : undefined}
              status={stageStatus(stage, progress, milestones, draftStageIds.includes(stage.id))}
              note={reflectionNotes[stage.id]}
              onChoose={() => {
                onChoose(stage.id);
              }}
            />
          ))}
      </div>
    </section>
  ));
}

type RoadmapView = 'stages' | 'concepts' | 'gallery';

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
      <button type="button" aria-pressed={view === 'gallery'} data-testid="roadmap-view-gallery" onClick={() => { onChange('gallery'); }}>
        コードの臭い図鑑
      </button>
    </div>
  );
}

function ReviewNotice({ stages, progress }: Readonly<{ stages: readonly Stage[]; progress: Progress }>) {
  const assists = useGameStore((state) => state.assists);
  const review = recommendReviewStage(stages, progress, assists);
  if (review === undefined) return null;
  return (
    <p className="stage-roadmap__next" data-testid="roadmap-review">
      {`復習のおすすめ: ${review.title}(もう一度自力で)`}
    </p>
  );
}

/** 設計くらべの正答状況。開くたびに読み直す(設計くらべで答えたあとに開いても最新になる)。 */
function QuizRecordNotice() {
  const { correct, answered, total } = summarizeQuizRecord(comparisonQuizzes.map((quiz) => quiz.id), loadQuizRecord());
  const mark = correct === total ? ' ✅' : '';
  const label = answered === 0 ? '未挑戦' : `${String(total)}問中${String(correct)}問正解${mark}`;
  return (
    <p className="stage-roadmap__next" data-testid="roadmap-quiz">
      設計くらべ: {label}
    </p>
  );
}

function Notices({ stages, progress }: Readonly<{ stages: readonly Stage[]; progress: Progress }>) {
  return (
    <>
      <QuizRecordNotice />
      <ReviewNotice stages={stages} progress={progress} />
    </>
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
  const reflectionNotes = useGameStore((state) => state.reflectionNotes);
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
        <Notices stages={stages} progress={progress} />
        <ViewSwitch view={view} onChange={setView} />
        {view === 'concepts' && <ConceptMasteryList mastery={conceptMastery(stages, (id) => isStageCleared(id, progress))} onChoose={choose} />}
        {view === 'gallery' && <AntipatternGallery entries={antipatterns} stages={stages} onChoose={choose} />}
        {view === 'stages' && (
          <StageLevels
            stages={stages}
            currentId={currentId}
            nextId={next?.id}
            progress={progress}
            reflectionNotes={reflectionNotes}
            milestones={milestones}
            draftStageIds={draftStageIds}
            onChoose={choose}
          />
        )}
        <LearningRecordSection />
      </div>
    </dialog>
  );
}
