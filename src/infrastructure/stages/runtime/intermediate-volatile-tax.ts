import type { StageRuntime } from '../../../domain/stage/StageRuntime';
import { salesReportRuntime } from './salesReportSupport';

/** 中級4: 税の計算がよく変わる売上帳票。中級5と同じ初期コードなので、補助コードを共有する。 */
export const intermediateVolatileTaxRuntime: StageRuntime = salesReportRuntime;
