# AI Agent Harness Guide

## Purpose

This guide defines the roles, rules, and collaboration practices for AI agents extending the LMPilot0004 PySide6 app into a local-first static web MVP and preparing it for deployment. The harness is a guide for agents working on the project; it is not an application runtime layer.

## Shared goals and confirmed requirements

- Bring the existing PySide6 workflow for code, issue, and Import Layer input, prompt construction, and model responses to the web.
- Keep the MVP as a static web app that runs locally. Separate the frontend from model-provider connections so the app can later support static hosting and an optional API server.
- Provide a ChatGPT-style conversation view that works on desktop and mobile.
- Let users enter a Base URL, model name, and API key in Settings. Saving stores only the Base URL and model name; never store an API key in browser storage.
- Keep the API key in memory only while the current page is open. Require users to re-enter it after a reload or when opening a new tab.
- Support multiple conversation sessions, session switching, and session restoration after reopening the browser.
- The clear-data action removes all app-owned sessions and settings. Do not describe it as clearing the browser's entire HTTP cache.
- Tell users that code, issues, attachments, and conversation content may be sent to NVIDIA or the configured model provider.
- Write all project documentation in English. Keep the product UI and user-facing app copy in Korean unless the user requests a language change.

## Roles and responsibilities

### Lead / Integrator

- Set the scope against the requirements and architecture documents, then integrate the work.
- Coordinate changes to agent interfaces, storage formats, and API contracts.
- Record design changes in `docs/architecture.md` and update related tasks in `docs/todo.md`.
- Resolve implementation conflicts and report changed files, verification results, and remaining limitations.

### Frontend Agent

- Implement the responsive chat UI, session list, Settings dialog, local persistence, file input, and response downloads.
- Keep API keys out of localStorage, IndexedDB, Cache Storage, URLs, console output, analytics events, and error logs.
- Communicate with model services through the Provider interface; keep provider-specific request details out of the UI.
- Ask for confirmation before clearing data and clearly report when the action is complete.

### Backend / API Agent

- The product frontend remains a static app. For local development, evaluate browser-direct requests and NVIDIA API compatibility; the Vite dev server has a development-only proxy for NVIDIA.
- For GitHub Pages, maintain the approved Cloudflare Worker relay that forwards per-request user keys without storing them. Keep the Worker limited to required routes, origins, and methods, and preserve streaming responses.
- Agree on message, streaming, and error contracts with the Frontend Agent.
- Do not add a broader application backend unless the user requests or approves that phase.
- Ensure server-side logs, traces, and error responses do not contain API keys or user prompts.

### QA Agent

- Define manual scenarios and automation candidates for each requirement.
- Focus on API-key non-persistence, session restoration and deletion, mobile UI, streaming completion/errors, and CORS behavior for direct calls and the Worker relay.
- Record reproducible inputs, environment, and results for failures, and report release blockers to the Integrator.

### Git Admin Agent

- Preserve the existing PySide6 app while maintaining the web source and build configuration.
- Manage `.gitignore`, branches, change scope, and static deployment paths.
- Check that keys, local session data, and personal settings are not included in the repository or deployment artifacts.
- Summarize changed files and repository state before commits or deployments. Never push, create a pull request, or deploy unless the user explicitly requests it.

## Work and collaboration rules

1. Read relevant documents and existing implementation before starting. The reference behavior for the existing app is documented in the repository-root `README.md` and `app/` code.
2. Assign each agent a bounded set of files and responsibilities. Notify the Integrator and agree on the contract before changing files owned by another role.
3. Record shared contract changes in documentation before code changes, and update affected roles and TODO items.
4. Do not include secrets or user conversation content in examples, test fixtures, logs, or screenshots. Use unmistakable placeholders such as `YOUR_API_KEY` for sample keys.
5. Include implementation details, changed files, verification performed, unresolved items, and blockers in completion reports.
6. Do not expand scope with unrequested features or external service integrations.

## Completion criteria

- The artifacts listed in the relevant TODO items exist and meet their requirements.
- Keys are not written to app-owned persistent storage, logs, or static artifacts.
- Changes to shared contracts and architecture are reflected in the documentation.
- The Integrator receives reproducible verification results and known limitations.

## Document index

- Product and system structure: [`architecture.md`](architecture.md)
- Role-specific tasks and evaluation gates: [`todo.md`](todo.md)
