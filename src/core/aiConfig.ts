import { MAX_INPUT_BYTES_RANGE, MAX_ISSUES_RANGE, TIMEOUT_MS_RANGE } from './constants';
import { ConfigurationError } from './errors';

export interface AiConfiguration {
  apiKey: string;
  baseUrl: string;
  model: string;
  language: string;
  maxIssues: number;
  maxInputBytes: number;
  timeoutMs: number;
}

export function validateMaxIssues(maxIssues: number): number {
  if (!Number.isInteger(maxIssues)
    || maxIssues < MAX_ISSUES_RANGE.minimum
    || maxIssues > MAX_ISSUES_RANGE.maximum) {
    throw new ConfigurationError(`Maximum issues must be between ${MAX_ISSUES_RANGE.minimum} and ${MAX_ISSUES_RANGE.maximum}.`);
  }
  return maxIssues;
}

export function validateMaxInputBytes(maxInputBytes: number): number {
  if (!Number.isInteger(maxInputBytes)
    || maxInputBytes < MAX_INPUT_BYTES_RANGE.minimum
    || maxInputBytes > MAX_INPUT_BYTES_RANGE.maximum) {
    throw new ConfigurationError(
      `Maximum input size must be between ${MAX_INPUT_BYTES_RANGE.minimum} and ${MAX_INPUT_BYTES_RANGE.maximum} UTF-8 bytes.`,
    );
  }
  return maxInputBytes;
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
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const ipv4Parts = host.split('.');
  const isIpv4Loopback = ipv4Parts.length === 4
    && ipv4Parts[0] === '127'
    && ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  const isLoopback = host === 'localhost' || host === '::1' || isIpv4Loopback;
  if (url.protocol === 'http:' && !isLoopback) {
    throw new ConfigurationError('Base URL must use HTTPS unless the host is localhost or a loopback IP address.');
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

  const maxIssues = validateMaxIssues(configuration.maxIssues);
  const maxInputBytes = validateMaxInputBytes(configuration.maxInputBytes);
  if (!Number.isInteger(configuration.timeoutMs)
    || configuration.timeoutMs < TIMEOUT_MS_RANGE.minimum
    || configuration.timeoutMs > TIMEOUT_MS_RANGE.maximum) {
    throw new ConfigurationError(`Timeout must be between ${TIMEOUT_MS_RANGE.minimum} and ${TIMEOUT_MS_RANGE.maximum} milliseconds.`);
  }

  return { apiKey, baseUrl, model, language, maxIssues, maxInputBytes, timeoutMs: configuration.timeoutMs };
}
