import { MAX_ISSUES_RANGE, TIMEOUT_MS_RANGE } from './constants';
import { ConfigurationError } from './errors';

export interface AiConfiguration {
  apiKey: string;
  baseUrl: string;
  model: string;
  language: string;
  maxIssues: number;
  timeoutMs: number;
}

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ConfigurationError(`${name} is required.`);
  }
  return normalized;
}

export function resolveChatCompletionsEndpoint(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new ConfigurationError('Base URL must be a valid HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigurationError('Base URL must use HTTP or HTTPS.');
  }

  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/chat/completions')) {
    url.pathname = path;
  } else if (path.endsWith('/v1')) {
    url.pathname = `${path}/chat/completions`;
  } else {
    url.pathname = `${path || ''}/v1/chat/completions`;
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function validateAiConfiguration(configuration: AiConfiguration): AiConfiguration {
  const apiKey = required(configuration.apiKey, 'API key');
  const model = required(configuration.model, 'Model');
  const language = required(configuration.language, 'Language');
  const baseUrl = required(configuration.baseUrl, 'Base URL').replace(/\/+$/, '');
  resolveChatCompletionsEndpoint(baseUrl);

  if (!Number.isInteger(configuration.maxIssues)
    || configuration.maxIssues < MAX_ISSUES_RANGE.minimum
    || configuration.maxIssues > MAX_ISSUES_RANGE.maximum) {
    throw new ConfigurationError(`Maximum issues must be between ${MAX_ISSUES_RANGE.minimum} and ${MAX_ISSUES_RANGE.maximum}.`);
  }
  if (!Number.isInteger(configuration.timeoutMs)
    || configuration.timeoutMs < TIMEOUT_MS_RANGE.minimum
    || configuration.timeoutMs > TIMEOUT_MS_RANGE.maximum) {
    throw new ConfigurationError(`Timeout must be between ${TIMEOUT_MS_RANGE.minimum} and ${TIMEOUT_MS_RANGE.maximum} milliseconds.`);
  }

  return { apiKey, baseUrl, model, language, maxIssues: configuration.maxIssues, timeoutMs: configuration.timeoutMs };
}
