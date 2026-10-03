import type { Stage } from '../../domain/stage/Stage';
import { advancedStages } from './advancedStages';
import { beginnerStages } from './beginnerStages';
import { intermediateStages } from './intermediateStages';
import { tutorialStages } from './tutorialStages';

/** 遊べるステージの一覧。チュートリアル → 初級 → 中級 → 上級の順に並べる。 */
export const stages: readonly Stage[] = [...tutorialStages, ...beginnerStages, ...intermediateStages, ...advancedStages];
