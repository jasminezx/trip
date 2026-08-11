import type { ReviewMode } from './types';

export const EXTENSION_ID = 'reviewPilot';
export const RESULTS_VIEW_ID = 'reviewPilot.results';

export const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_MODEL = 'gpt-4.1-mini';
export const DEFAULT_LANGUAGE = 'auto';
export const DEFAULT_MODE: ReviewMode = 'selection';
export const DEFAULT_MAX_ISSUES = 10;
export const DEFAULT_TIMEOUT_MS = 30_000;

export const MAX_ISSUES_RANGE = { minimum: 1, maximum: 50 } as const;
export const TIMEOUT_MS_RANGE = { minimum: 1_000, maximum: 120_000 } as const;
