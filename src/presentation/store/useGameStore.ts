import { create } from 'zustand';
import type { Codebase } from '../../domain/codebase/Codebase';
import type { Stage } from '../../domain/stage/Stage';
import {
  describeExtractError,
  describeMoveError,
  extractMethodUseCase,
  moveMethodUseCase,
  type ExtractMethodInput,
} from '../../application/RefactorUseCases';
import { tutorialStage } from '../../infrastructure/samples/tutorialStage';

type GameState = {
  stage: Stage;
  codebase: Codebase;
  selectedMethodId: string | null;
  message: string | null;
  selectMethod: (methodId: string | null) => void;
  moveMethod: (methodId: string, targetClassId: string) => void;
  extractMethod: (input: ExtractMethodInput) => boolean;
  resetStage: () => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  stage: tutorialStage,
  codebase: tutorialStage.codebase,
  selectedMethodId: null,
  message: null,
  selectMethod: (methodId) => {
    set({ selectedMethodId: methodId, message: null });
  },
  moveMethod: (methodId, targetClassId) => {
    const result = moveMethodUseCase(get().codebase, methodId, targetClassId);
    set(result.ok ? { codebase: result.value, message: null } : { message: describeMoveError(result.error) });
  },
  extractMethod: (input) => {
    const result = extractMethodUseCase(get().codebase, input, () => crypto.randomUUID());
    set(result.ok ? { codebase: result.value, message: null } : { message: describeExtractError(result.error) });
    return result.ok;
  },
  resetStage: () => {
    set({ codebase: get().stage.codebase, selectedMethodId: null, message: null });
  },
}));
