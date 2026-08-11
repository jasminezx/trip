import type { IssueIdInput } from './types';

function hash32(value: string): string {
  let hash = 0x811c9dc5;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createIssueId(input: IssueIdInput): string {
  const { filePath, message, range, title, suggestion } = input;
  const location = `${range.startLine}:${range.startCharacter}-${range.endLine}:${range.endCharacter}`;
  return `issue_${hash32(`${filePath}|${location}|${message}|${title}|${suggestion}`)}`;
}
