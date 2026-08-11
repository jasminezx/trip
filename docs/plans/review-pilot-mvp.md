# Review Pilot MVP Implementation Plan

## Context

Build the VS Code extension planned in Codex task `019db4cb-f3e7-7c91-b81f-5c5c8413eb3c`: an AI code-review assistant focused on selected code, the current file, and the current Git diff. Results are structured, grouped by severity in a native Tree View, and link back to source locations. The model interface is OpenAI-compatible and configurable.

## Global Constraints

- Extension name and command namespace are `Review Pilot` and `reviewPilot.*`.
- Use TypeScript and the VS Code Extension API; bundle with esbuild and test pure behavior with Vitest.
- Keep command, context collection, review/AI, state, and UI concerns in separate focused modules.
- The three review targets are exactly `selection`, `file`, and `diff`.
- Model output is strict JSON with `summary` and `issues`; every normalized issue has an id, title, severity, category, message, suggestion, file, startLine, and endLine.
- Valid severities are `high`, `medium`, and `low`. Valid categories are `bug`, `performance`, `security`, `maintainability`, and `best_practice`.
- The extension never applies model-generated code automatically. It may copy suggestions and navigate to affected code.
- API keys must never be written to logs, errors, repository files, or model prompts.
- Support an OpenAI-compatible Chat Completions endpoint. Accept base URLs ending at the host, `/v1`, or `/v1/chat/completions` without duplicating path segments.
- Use `response_format: { "type": "json_object" }`, abort requests after the configured timeout, and surface useful HTTP/network/parse errors.
- Follow TDD for production behavior: record a focused failing test before implementation and a passing test afterward.

## Task 1: Project scaffold and core contracts

Create the buildable extension foundation.

- Add `package.json`, `package-lock.json`, `tsconfig.json`, Vitest configuration, esbuild build script, `.vscode/launch.json`, and `.vscode/tasks.json`.
- Declare commands for reviewing selected code, current file, and Git diff; refreshing results; opening an issue; copying a suggestion; and opening Review Pilot settings.
- Declare an Activity Bar container and `reviewPilot.results` Tree View, editor context menu for selected-code review, and refresh view-title action.
- Declare settings for `apiKey`, `baseUrl`, `model`, `language`, `defaultMode`, `maxIssues`, and `timeoutMs` with sensible defaults and validation ranges.
- Add core review types/constants, typed error classes, issue id generation, and small text/range utilities.
- Add tests for non-trivial utilities and normalization contracts before their implementations.
- Verify focused tests, full tests, typecheck, and build; commit the task.

## Task 2: Review pipeline and OpenAI-compatible client

Implement the testable review engine without VS Code UI dependencies.

- Add AI configuration validation and endpoint resolution.
- Add a fetch-injected Chat Completions client with timeout/abort handling, HTTP error details, JSON response extraction, and nested network-cause reporting.
- Build target-specific prompts for selection, file, and diff reviews. Require concrete, actionable findings and strict JSON only.
- Parse raw model output, including fenced JSON, and normalize invalid-but-recoverable severity/category/line/file fields. Reject malformed top-level results and enforce `maxIssues`.
- Add `ReviewService` to coordinate prompt building, AI invocation, parsing, and result metadata.
- Cover endpoint variants, request payload, response/error branches, prompts, fenced JSON, malformed output, defaulting, line normalization, and issue limits with TDD.
- Verify focused tests, full tests, typecheck, and build; commit the task.

## Task 3: VS Code contexts, state, commands, and Tree View

Wire the core pipeline into the editor.

- Collect selection and current-file context from the active editor, with clear validation errors.
- Collect unstaged and staged Git diff from the first workspace root through a process-runner abstraction, with clear empty/no-workspace errors and useful stderr reporting.
- Implement a review store with idle/loading/success/empty/error states and last-target tracking.
- Implement the Tree View with Summary and High/Medium/Low groups, category/line metadata, suggestion tooltips, empty/loading/error states, and stable issue commands.
- Implement issue navigation, temporary range highlighting, suggestion copying, configuration guidance, and a `Review Pilot` output channel that never logs secrets.
- Register and dispose all commands/providers/resources in `extension.ts`; prevent overlapping reviews and support refresh of the last target.
- Add tests around context-free orchestration/state/tree-model behavior using narrow VS Code test doubles only at the framework boundary.
- Verify focused tests, full tests, typecheck, and build; commit the task.

## Task 4: Documentation, packaging, and acceptance verification

Finish the repository as a usable MVP.

- Add `README.md` covering features, setup, settings, commands, development, privacy, troubleshooting, and the distinction between ChatGPT subscriptions and OpenAI API access.
- Add `CHANGELOG.md`, `LICENSE`, extension icon, and `.vscodeignore`.
- Ensure package metadata and scripts support `npm test`, `npm run typecheck`, `npm run build`, and `npm run package`.
- Add or refine acceptance tests for all pure critical paths discovered during integration.
- Run a clean install, full tests, typecheck, production build, and VSIX packaging. Inspect the produced package contents and ensure secrets/local artifacts are absent.
- Commit the task.

