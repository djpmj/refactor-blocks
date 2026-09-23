import { useEffect, useRef, useState } from 'react';
import type { BlankDesignProblem } from '../../domain/blank/BlankDesignProblem';
import type { BlankDesignReview, DesignReview, ReviewError } from '../../domain/blank/reviewBlankDesign';
import type { Result } from '../../domain/shared/Result';
import { describeDeductions, siteNames } from '../change/describeChange';
import { CodebasePreviewDialog } from '../preview/CodebasePreviewDialog';
import { describeScore } from '../stage/describeScore';

type ChangeCompareProps = {
  readonly title: string;
  readonly description: string;
  readonly requestId: string;
  readonly player: DesignReview;
  readonly model: DesignReview;
  readonly index: number;
};

/** 変更依頼1件ぶんの、プレイヤーと模範解答の点数・変更箇所・減点理由。 */
function ChangeCompare({ title, description, requestId, player, model, index }: Readonly<ChangeCompareProps>) {
  const playerChange = player.changes[index];
  const modelChange = model.changes[index];
  const reasons = describeDeductions(playerChange, player.codebase);
  return (
    <li className="change-outcome" data-testid={`blank-change-${requestId}`}>
      <h3 className="change-outcome__title">{title}</h3>
      <p>{description}</p>
      <p className="change-outcome__scores">
        あなたの設計 <strong>{playerChange.score.total}点</strong> / 模範解答 <span>{modelChange.score.total}点</span>
      </p>
      <p className="change-outcome__facts">
        変更が必要: {siteNames(playerChange, player.codebase)}({playerChange.impact.classesTouched}クラス・{playerChange.impact.filesTouched}
        ファイル・+{playerChange.impact.linesAdded}行)
      </p>
      {reasons.length === 0 ? (
        <p className="change-outcome__good">減点なし。この変更は1か所で済み、影響も小さい設計です</p>
      ) : (
        <ul className="change-outcome__reasons">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ReviewBody({ problem, review }: Readonly<{ problem: BlankDesignProblem; review: BlankDesignReview }>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { player, model } = review;
  return (
    <>
      <p data-testid="blank-score-player">あなたの設計: {describeScore(player.score)}</p>
      <p data-testid="blank-score-model">模範解答: {describeScore(model.score)}</p>
      <p>
        変更のしやすさ: あなたの設計 <strong>{player.changeScore}点</strong> / 模範解答 <span>{model.changeScore}点</span>
      </p>
      <ul className="change-outcomes">
        {problem.changeRequests.map((request, index) => (
          <ChangeCompare key={request.id} title={request.title} description={request.description} requestId={request.id} player={player} model={model} index={index} />
        ))}
      </ul>
      <p>{problem.explanation}</p>
      <button type="button" onClick={() => { setPreviewOpen(true); }}>
        模範解答の図を見る
      </button>
      <CodebasePreviewDialog
        title="模範解答の図"
        codebase={previewOpen ? model.codebase : null}
        methodLimit={problem.limits.method}
        onClose={() => {
          setPreviewOpen(false);
        }}
      />
    </>
  );
}

type BlankDesignResultPanelProps = {
  readonly problem: BlankDesignProblem;
  readonly review: Result<BlankDesignReview, ReviewError>;
  readonly onClose: () => void;
};

/** 答え合わせの結果。開いている間は呼び出し側で計算し直した review を渡してもらう(配置を変えると結果も変わる)。 */
export function BlankDesignResultPanel({ problem, review, onClose }: Readonly<BlankDesignResultPanelProps>) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <aside className="method-editor change-panel" aria-label="答え合わせ" data-testid="blank-result">
      <h2 className="method-editor__title" ref={headingRef} tabIndex={-1}>
        答え合わせ
      </h2>
      {review.ok ? (
        <ReviewBody problem={problem} review={review.value} />
      ) : (
        <p className="method-editor__hint">部品置き場に部品が残っています</p>
      )}
      <button type="button" data-testid="blank-result-close" onClick={onClose}>
        閉じる
      </button>
    </aside>
  );
}
