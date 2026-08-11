import type { DocumentBoundary, ReviewRange } from './types';

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 0) {
    return '';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return maxLength === 1 ? '…' : `${text.slice(0, maxLength - 1)}…`;
}

export function isValidRange(range: ReviewRange): boolean {
  const values = [range.startLine, range.startCharacter, range.endLine, range.endCharacter];

  if (values.some((value) => !Number.isInteger(value) || value < 0)) {
    return false;
  }

  return range.startLine < range.endLine
    || (range.startLine === range.endLine && range.startCharacter <= range.endCharacter);
}

export function clampRange(range: ReviewRange, boundary: DocumentBoundary): ReviewRange {
  if (!Number.isInteger(boundary.lineCount) || boundary.lineCount <= 0) {
    return { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 0 };
  }

  const lastLine = boundary.lineCount - 1;
  const lastLineLength = Math.max(0, boundary.lastLineLength);
  const clampLine = (line: number) => Math.max(0, Math.min(lastLine, line));
  const clampCharacter = (line: number, character: number) => {
    const nonNegativeCharacter = Math.max(0, character);
    return line === lastLine ? Math.min(lastLineLength, nonNegativeCharacter) : nonNegativeCharacter;
  };

  const startLine = clampLine(range.startLine);
  const startCharacter = clampCharacter(startLine, range.startCharacter);
  const endLine = clampLine(range.endLine);
  const endCharacter = clampCharacter(endLine, range.endCharacter);

  if (startLine > endLine || (startLine === endLine && startCharacter > endCharacter)) {
    return { startLine, startCharacter, endLine: startLine, endCharacter: startCharacter };
  }

  return { startLine, startCharacter, endLine, endCharacter };
}

export function textInRange(text: string, range: ReviewRange): string {
  if (!isValidRange(range)) {
    return '';
  }

  const lines = normalizeLineEndings(text).split('\n');
  const lastLine = lines.length - 1;
  const startLine = Math.min(range.startLine, lastLine);
  const endLine = Math.min(range.endLine, lastLine);

  if (startLine > endLine) {
    return '';
  }

  if (startLine === endLine) {
    return lines[startLine].slice(range.startCharacter, range.endCharacter);
  }

  const selection = [lines[startLine].slice(range.startCharacter)];
  selection.push(...lines.slice(startLine + 1, endLine));
  selection.push(lines[endLine].slice(0, range.endCharacter));
  return selection.join('\n');
}
