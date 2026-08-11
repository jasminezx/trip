# Review Pilot

Review Pilot is a Visual Studio Code extension that asks an OpenAI-compatible
Chat Completions API to review selected code, the current file, or the current
Git diff. It shows structured findings in a native Tree View and can navigate
to a reported location or copy a suggested change. It never applies generated
code automatically.

## Features

- Review an editor selection, the active file, or staged and unstaged Git
  changes.
- Group findings by high, medium, and low severity with category and location
  details.
- Open the affected source location and copy a suggestion when one is present.
- Use any compatible Chat Completions endpoint whose base URL ends at the host,
  `/v1`, or `/v1/chat/completions`.
- Keep API keys out of prompts and extension output.

## Setup

1. Install the extension from its VSIX or a supported extension source.
2. Open **Settings** and search for `Review Pilot`.
3. Set `reviewPilot.apiKey`, and optionally set the API base URL and model.
4. Open the Review Pilot Activity Bar view and run a review command.

The key is stored in VS Code's machine-scoped settings. Treat it as a secret:
do not commit it to a workspace settings file or share it in issue reports.

### ChatGPT subscriptions and API access

This extension uses an API key; it does not use your ChatGPT web or desktop
session. A ChatGPT subscription and API access are billed and managed
separately, so a paid ChatGPT plan does not itself provide API usage for this
extension. Configure billing and create an API key in the OpenAI API platform
before using an OpenAI endpoint. See OpenAI's
[API billing guidance](https://help.openai.com/en/articles/8156019).

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `reviewPilot.apiKey` | empty | API key used to authenticate review requests. |
| `reviewPilot.baseUrl` | `https://api.openai.com/v1` | OpenAI-compatible API base URL. |
| `reviewPilot.model` | `gpt-4.1-mini` | Model sent with review requests. |
| `reviewPilot.language` | `auto` | Review language, or `auto` to use the request context. |
| `reviewPilot.defaultMode` | `selection` | Scope dispatched by **Review Pilot: Review Default Target**. |
| `reviewPilot.maxIssues` | `10` | Maximum findings returned, from 1 through 50. |
| `reviewPilot.maxInputBytes` | `100000` | Maximum selection, file, or diff content size in UTF-8 bytes, from 1000 through 1000000. Oversized input is rejected before a request. |
| `reviewPilot.timeoutMs` | `30000` | Request timeout in milliseconds, from 1000 through 120000. |

## Commands

| Command | What it reviews |
| --- | --- |
| **Review Pilot: Review Selected Code** | The active editor selection. |
| **Review Pilot: Review Current File** | The entire active document. |
| **Review Pilot: Review Git Diff** | Staged and unstaged changes in the first workspace folder. |
| **Review Pilot: Review Default Target** | The exact target selected by `reviewPilot.defaultMode`. |
| **Review Pilot: Refresh Results** | The last successfully collected review target. |
| **Review Pilot: Open Issue** | The selected finding's source location. |
| **Review Pilot: Copy Suggestion** | The selected finding's suggestion, when available. |
| **Review Pilot: Open Settings** | Review Pilot settings. |

## Development

Requires Node.js 22 or later and npm.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run package
```

`npm run package` rebuilds the extension and creates
`review-pilot-<version>.vsix` at the repository root. The VSIX intentionally
contains only the runtime bundle, manifest, activity-bar icon, and release
documents; it excludes source, tests, source maps, local configuration, and
development artifacts.

For iterative development, run `npm run watch` in one terminal and use the
provided VS Code launch configuration to start an Extension Development Host.

## Privacy and security

Review content is sent to the configured API endpoint to obtain findings. This
includes the selected code, current-file content, or Git diff, plus the file's
language identifier and prompt-facing path metadata. For files inside an open
workspace, the prompt path is workspace-relative; for editor files outside a
workspace, only the basename is sent. Trusted absolute local paths are retained
only in extension state for source navigation and are not put in model prompts.
Do not review code that you are not authorized to send to that endpoint. Review
the endpoint's privacy, retention, and billing policies before use.

The extension does not write API keys to its output channel, error messages,
repository files, or prompts. API/network diagnostics shown in the UI or output
are bounded, whitespace-normalized, and stripped of the configured key; raw
causes and unbounded response bodies are not surfaced. Network requests include
the configured API key in the Authorization header only.

HTTPS is required for configured API endpoints. Cleartext HTTP is accepted only
for explicit loopback hosts (`localhost`, IPv4 `127.0.0.0/8`, and IPv6 `::1`)
to support local model servers.

## Troubleshooting

- **"API key is required."** Set `reviewPilot.apiKey` in machine-scoped VS
  Code settings, then run the command again.
- **Timeout or network failure.** Confirm `reviewPilot.baseUrl`, network
  access, API billing, model availability, and increase `reviewPilot.timeoutMs`
  only when appropriate.
- **Input is too large.** Reduce the selection/diff or increase
  `reviewPilot.maxInputBytes`; the limit is measured in UTF-8 bytes and defaults
  to 100000.
- **No findings for a Git diff.** The command reviews only staged/unstaged
  changes in the first workspace folder; make a change or select the intended
  workspace folder.
- **Cannot open a finding.** Paths outside the open workspace are rejected for
  safety, except for the active file fallback.
- **Unexpected output format.** Use a model/endpoint that supports Chat
  Completions JSON-object responses.

## License

MIT. See [LICENSE](LICENSE).
