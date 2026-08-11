import { describe, expect, it } from 'vitest';
import { createProcessRunner, type ExecFileExecutor } from './processRunner';

describe('process runner', () => {
  it('captures stdout, stderr, exit code, arguments, and working directory', async () => {
    let received: unknown;
    const execute: ExecFileExecutor = (command, args, options, callback) => {
      received = { command, args, options };
      callback(null, 'the diff', 'warning');
    };
    const run = createProcessRunner(execute);

    await expect(run('git', ['diff'], 'C:/repo')).resolves.toEqual({
      exitCode: 0, stdout: 'the diff', stderr: 'warning',
    });
    expect(received).toEqual({
      command: 'git', args: ['diff'], options: { cwd: 'C:/repo', encoding: 'utf8', windowsHide: true },
    });
  });

  it('returns a failed process result so the context collector can include stderr', async () => {
    const execute: ExecFileExecutor = (_command, _args, _options, callback) => {
      callback(Object.assign(new Error('failed'), { code: 128 }), '', 'fatal: bad repo');
    };
    await expect(createProcessRunner(execute)('git', ['diff'], 'C:/repo')).resolves.toEqual({
      exitCode: 128, stdout: '', stderr: 'fatal: bad repo',
    });
  });

  it('preserves the launch error when a failed process has no stderr', async () => {
    const execute: ExecFileExecutor = (_command, _args, _options, callback) => {
      callback(Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' }), '', '');
    };
    await expect(createProcessRunner(execute)('git', ['diff'], 'C:/repo')).resolves.toEqual({
      exitCode: 1, stdout: '', stderr: 'spawn git ENOENT',
    });
  });
});
