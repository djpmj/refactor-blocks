import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { combineLearningRecords, parseLearningRecord, serializeLearningRecord, type ImportMode, type LearningRecord } from '../../application/LearningRecordUseCases';
import { loadLearningRecord, saveLearningRecord } from '../../infrastructure/progress/learningRecordStorage';

const SAVE_FAILED_MESSAGE = 'ブラウザに保存できませんでした。容量が足りないか、保存が許可されていない可能性があります。';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function exportFileName(now: Date): string {
  return `refactor-blocks-learning-record-${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

function downloadLearningRecord(): void {
  const blob = new Blob([serializeLearningRecord(loadLearningRecord())], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(new Date());
  link.click();
  URL.revokeObjectURL(url);
}

function summarize(record: LearningRecord): string {
  const scores = Object.values(record.progress);
  const cleared = scores.filter((score) => score === 100).length;
  return `選んだファイル: 点数の記録 ${String(scores.length)} ステージ(うちクリア ${String(cleared)})、下書き ${String(Object.keys(record.drafts).length)} 件`;
}

type ConfirmProps = {
  readonly imported: LearningRecord;
  readonly onApply: (mode: ImportMode) => void;
  readonly onCancel: () => void;
};

function ImportConfirm({ imported, onApply, onCancel }: ConfirmProps) {
  const [mode, setMode] = useState<ImportMode>('merge');
  const mergeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mergeRef.current?.focus();
  }, []);
  return (
    <div className="learning-record__confirm" data-testid="learning-record-confirm">
      <p>{summarize(imported)}</p>
      <fieldset>
        <legend>読み込み方</legend>
        <label>
          <input ref={mergeRef} type="radio" name="learning-record-mode" checked={mode === 'merge'} onChange={() => { setMode('merge'); }} data-testid="learning-record-mode-merge" />
          マージ: ステージごとに点数が高いほうを残す(おすすめ)
        </label>
        <label>
          <input type="radio" name="learning-record-mode" checked={mode === 'overwrite'} onChange={() => { setMode('overwrite'); }} data-testid="learning-record-mode-overwrite" />
          上書き: このブラウザの記録をファイルの内容に置き換える
        </label>
      </fieldset>
      {mode === 'overwrite' && <p className="learning-record__warning">このブラウザの今の記録は消えます。心配なら先に書き出してください。</p>}
      <div className="learning-record__actions">
        <button type="button" onClick={() => { onApply(mode); }} data-testid="learning-record-apply">読み込む</button>
        <button type="button" onClick={onCancel} data-testid="learning-record-cancel">やめる</button>
      </div>
      <p className="learning-record__note">読み込むと画面を読み込み直します。</p>
    </div>
  );
}

/** ステージ一覧の末尾に置く、学習記録(localStorage の5キー)をJSONファイルで書き出し・読み込みする欄。 */
export function LearningRecordSection() {
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const importButtonRef = useRef<HTMLButtonElement>(null);
  const [imported, setImported] = useState<LearningRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    setImported(null);
    setError(null);
    if (file === undefined) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setError('ファイルを読み込めませんでした');
      return;
    }
    const result = parseLearningRecord(text);
    if (result.ok) setImported(result.value);
    else setError(result.error);
  };

  const apply = (mode: ImportMode) => {
    if (imported === null) return;
    // 読み込み後はページを読み込み直し、起動時の既存処理に新しい記録で画面を作らせる
    if (saveLearningRecord(combineLearningRecords(loadLearningRecord(), imported, mode))) window.location.reload();
    else setError(SAVE_FAILED_MESSAGE);
  };

  const cancel = () => {
    setImported(null);
    importButtonRef.current?.focus();
  };

  return (
    <section className="learning-record" aria-labelledby={titleId} data-testid="learning-record">
      <h3 id={titleId}>学習記録の持ち運び</h3>
      <p>記録(自己ベスト・挑戦中の下書き・最後に遊んだステージ・設定)は、このブラウザにだけ保存されています。別のPCやブラウザで続けるとき、サイトデータを消す前に書き出しておいてください。</p>
      <div className="learning-record__actions">
        <button type="button" onClick={downloadLearningRecord} data-testid="learning-record-export">学習記録を書き出す</button>
        <button ref={importButtonRef} type="button" onClick={() => fileRef.current?.click()} data-testid="learning-record-import">学習記録を読み込む</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => void handleFile(event)} data-testid="learning-record-file" />
      </div>
      {error !== null && <p role="alert" className="learning-record__error" data-testid="learning-record-error">{error}</p>}
      {imported !== null && <ImportConfirm imported={imported} onApply={apply} onCancel={cancel} />}
    </section>
  );
}
