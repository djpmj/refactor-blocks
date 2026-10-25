import { useGameStore } from '../store/useGameStore';
import { stageStep } from '../../domain/change/stageStep';
import { painRequestsOf } from '../../domain/change/changePain';
import { scoreCodebase } from '../../domain/scoring/score';

/** エディタのドロワー(幅700px以下)がバナーに重ならないよう、バナーの高さをCSS変数で渡す。 */
function reportBannerHeight(element: HTMLElement | null) {
  if (element === null) return undefined;
  const root = document.documentElement;
  const report = () => root.style.setProperty('--opening-fix-banner-height', `${String(element.offsetHeight)}px`);
  report();
  // 通知の中で配置(ドロワーの上端)が変わるとResizeObserverのループ警告になるので、次のフレームで反映する
  let frame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(report);
  });
  observer.observe(element);
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    root.style.removeProperty('--opening-fix-banner-height');
  };
}

export function OpeningFixBanner() {
  const stage = useGameStore((state) => state.stage);
  const codebase = useGameStore((state) => state.codebase);
  const score = scoreCodebase(codebase, stage).total;
  const openingDone = useGameStore((state) => Object.prototype.hasOwnProperty.call(state.openingFixes, stage.id));
  const closingSolved = useGameStore((state) => state.closingFixSolved);
  const openingFixEnabled = useGameStore((state) => state.openingFixEnabled);
  const manualFix = useGameStore((state) => state.manualFix);
  const changeSession = useGameStore((state) => state.changeSession);
  const tourStep = useGameStore((state) => state.tourStep);
  const startManualFix = useGameStore((state) => state.startManualFix);
  const request = painRequestsOf(stage).modify;
  const step = stageStep({ score, hasModifyRequest: request !== undefined, openingDone, closingSolved });
  if (!openingFixEnabled || step !== 'opening-fix' || manualFix !== null || changeSession !== null || tourStep !== null || request === undefined) return null;
  return <div className="opening-fix-banner" data-testid="opening-fix-banner" role="status" ref={reportBannerHeight}>
    <span>組み替える前に、まずこのコードのまま「{request.title}」を手で入れてみよう。抽出や移動は、そのあとでできます</span>
    <button type="button" data-tour="manual-fix-start" onClick={startManualFix}>実際に直してみる</button>
  </div>;
}
