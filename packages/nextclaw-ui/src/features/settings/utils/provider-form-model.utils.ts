import type { ThinkingLevel } from '@/shared/lib/api';
import {
  THINKING_LEVELS,
  toProviderLocalModelId,
  type ModelConfig
} from './provider-form-support.utils';

type AddProviderModelResult = {
  models: string[];
  draft: string;
};

export function addProviderLocalModel(models: string[], draft: string, aliases: string[]): AddProviderModelResult {
  const next = toProviderLocalModelId(draft, aliases);
  if (!next) {
    return { models, draft };
  }
  if (models.includes(next)) {
    return { models, draft: '' };
  }
  return { models: [...models, next], draft: '' };
}

export function removeProviderLocalModel(models: string[], modelConfig: ModelConfig, modelName: string): {
  models: string[];
  modelConfig: ModelConfig;
} {
  const nextConfig = { ...modelConfig };
  delete nextConfig[modelName];
  return {
    models: models.filter((name) => name !== modelName),
    modelConfig: nextConfig
  };
}

export function toggleModelThinkingLevelInConfig(modelConfig: ModelConfig, modelName: string, level: ThinkingLevel): ModelConfig {
  const currentEntry = modelConfig[modelName];
  const currentLevels = currentEntry?.thinking?.supported ?? [];
  const nextLevels = currentLevels.includes(level)
    ? currentLevels.filter((item) => item !== level)
    : THINKING_LEVELS.filter((item) => item === level || currentLevels.includes(item));
  const nextDefault =
    currentEntry?.thinking?.default && nextLevels.includes(currentEntry.thinking.default)
      ? currentEntry.thinking.default
      : undefined;
  const nextEntry = {
    ...currentEntry,
    thinking:
      nextLevels.length > 0
        ? nextDefault
          ? { supported: nextLevels, default: nextDefault }
          : { supported: nextLevels }
        : undefined
  };
  const next = { ...modelConfig };
  if (nextEntry.thinking || nextEntry.vision === true) {
    next[modelName] = nextEntry;
  } else {
    delete next[modelName];
  }
  return next;
}

export function setModelThinkingDefaultInConfig(modelConfig: ModelConfig, modelName: string, level: ThinkingLevel | null): ModelConfig {
  const currentEntry = modelConfig[modelName];
  const currentThinking = currentEntry?.thinking;
  if (!currentThinking || currentThinking.supported.length === 0) {
    return modelConfig;
  }
  if (level && !currentThinking.supported.includes(level)) {
    return modelConfig;
  }
  return {
    ...modelConfig,
    [modelName]: {
      ...currentEntry,
      thinking: level
        ? { supported: currentThinking.supported, default: level }
        : { supported: currentThinking.supported }
    }
  };
}

export function setModelVisionInConfig(modelConfig: ModelConfig, modelName: string, vision: boolean): ModelConfig {
  const currentEntry = modelConfig[modelName];
  const nextEntry = {
    ...currentEntry,
    vision: vision ? true : undefined
  };
  const next = { ...modelConfig };
  if (nextEntry.thinking || nextEntry.vision === true) {
    next[modelName] = nextEntry;
  } else {
    delete next[modelName];
  }
  return next;
}
