import { execFile } from 'node:child_process';
import type { ProcessRunner } from './reviewContext';

export interface ProcessExecutionError extends Error {
  code?: string | number;
}

export type ExecFileExecutor = (
  command: string,
  args: string[],
  options: { cwd: string; encoding: 'utf8'; windowsHide: true },
  callback: (error: ProcessExecutionError | null, stdout: string, stderr: string) => void,
) => void;

export function createProcessRunner(execute: ExecFileExecutor): ProcessRunner {
  return (command, args, cwd) => new Promise((resolve) => {
    execute(command, args, { cwd, encoding: 'utf8', windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        exitCode: typeof error?.code === 'number' ? error.code : error ? 1 : 0,
        stdout,
        stderr: stderr || error?.message || '',
      });
    });
  });
}

export const runProcess = createProcessRunner(execFile as unknown as ExecFileExecutor);
