# Web MVP TODO and Workstream Assignments

Status: `[ ]` not started, `[-]` in progress, `[x]` complete. The core frontend MVP and static build are complete. Direct NVIDIA calls from the GitHub Pages origin were blocked by CORS, so an approved Cloudflare Worker relay was added and deployed. Browser integration using a real NVIDIA key remains to be verified. When architecture decisions change, the Integrator updates this document and `architecture.md` together.

## Shared / Integrator

- [x] Document product requirements and AI-agent collaboration rules.
- [x] Define the `ChatRequest`, streaming, and error contracts between the frontend and Provider.
- [x] Define the data model and session-title policy based on the first user message.
- [ ] Summarize unresolved risks and evaluation results at the end of each phase.

## Frontend

- [x] Map the existing PySide6 app workflow to web UI requirements.
- [x] Implement a responsive chat UI with a desktop sidebar and mobile session drawer.
- [x] Implement conversation creation, selection, titles, and switching.
- [x] Implement code, issue, and Import Layer input, plus text-file loading.
- [x] Implement multiple text-document attachments, extracted-text previews before sending, and per-file removal.
- [x] Store original attachments and extracted text in session-scoped IndexedDB; support original-file download and session/all-data deletion.
- [x] Download analysis results as Markdown reports with attachment lists and timestamps.
- [x] Enforce attachment format, file-count, file-size, and extracted-text limits, and explain provider transmission.
- [x] Implement a request preview.
- [x] Implement Base URL, model name, and API-key fields and a Save button in the settings dialog.
- [x] Save only the Base URL and model name; keep the API key in current-tab memory only.
- [x] Implement IndexedDB session storage, restoration, and updates.
- [x] Implement streaming responses, cancellation, loading states, and errors.
- [x] Implement safe Markdown rendering, response copying, and downloads.
- [x] Implement a confirmation and completion message for deleting all local app data.
- [x] Inform users that input may be sent to an external model provider.

## Backend / API

- [x] Document the scope and limitations of browser-direct calls in the static MVP.
- [ ] Verify NVIDIA OpenAI-compatible endpoints, model availability, and streaming events.
- [x] Define the Provider interface and request, response, and error types.
- [x] Add an NVIDIA API proxy to the local Vite dev server to bypass browser CORS restrictions.
- [x] Record the NVIDIA CORS preflight result for the GitHub Pages origin: the `OPTIONS /v1/chat/completions` response for `https://hyangdan2.github.io` did not include `Access-Control-Allow-Origin`.
- [x] Add a Cloudflare Worker relay that forwards user keys per request.
- [x] Implement and document Worker origin, route, method, and request-size limits, log exclusion, and streaming forwarding.
- [x] Deploy the Cloudflare Worker to `https://lmpilot-nvidia-proxy.hd2botstarter.workers.dev`.
- [ ] Verify NVIDIA connection and streaming from Pages through the Worker using a real key.
- [ ] Do not store an operator-owned key in the current scope; request a separate product decision if needed.

## QA

- [ ] Write manual scenarios and completion criteria for each requirement.
- [x] Check mobile font and layout behavior for the composer, reference-material inputs, and settings fields at a 390×844 viewport.
- [ ] Check input interactions on desktop and major mobile devices. Verify Korean IME behavior on desktop and focus-related input zoom prevention in iPhone Safari on real devices.
- [ ] Verify session creation, switching, persistence, and restoration after restart.
- [ ] Verify supported attachments, persistence after reload, per-session deletion, and full data deletion.
- [ ] Verify file-size, attachment-count, and text-length limits; unsupported-file rejection; and report source metadata.
- [ ] Verify API keys are absent from localStorage, IndexedDB, Cache Storage, URLs, console output, logs, and static artifacts.
- [ ] Verify Save stores only the URL and model name, not the key.
- [ ] Verify full local-data deletion removes sessions and saved settings.
- [ ] Verify streaming success, errors, timeouts, and user cancellation.
- [x] Check the NVIDIA direct-call CORS preflight from the Pages origin.
- [x] Check that the deployed Worker's Pages-origin CORS preflight returns `204`.
- [ ] Verify model listing and chat streaming through the deployed Worker in a real browser.
- [ ] Verify script injection does not execute in HTML/Markdown output.
- [ ] Verify the UI explains that user input is sent to an external model provider.
- [ ] Record MVP evaluation-gate results and blockers.

## Git Admin

- [x] Keep the existing PySide6 app separate from the web source tree.
- [x] Document frontend development, build, and preview commands.
- [x] Add dependencies, build output, and local environment files to `.gitignore`.
- [ ] Check that examples, fixtures, logs, and screenshots contain no API keys or real user data.
- [x] Configure the Vite base path for GitHub Pages repository subpaths.
- [x] Assemble production at `/LMPilot0006/` and test at `/LMPilot0006/test/` in one GitHub Pages artifact.
- [x] Build both branches on pushes to `main` and `test`, and isolate session, settings, and app cache stores by environment.
- [x] Open both production and test paths in the deployed Pages site and verify routing and data isolation.
- [ ] Define a pre-deployment check that prevents secrets from entering build artifacts.
- [ ] Report changed files and repository state; commit or deploy only within the scope explicitly requested by the user.

## Post-evaluation server decisions

- [x] Confirm that the Pages-origin NVIDIA CORS preflight does not allow direct requests.
- [x] Decide that a user-key relay is needed and use the Cloudflare Worker for GitHub Pages.
- [ ] Finalize server authentication, request limits, data retention, and logging policy.
- [ ] Agree with the user on how server deployment affects the no-key-storage policy.
- [ ] Add separately scoped TODO items and a deployment plan for any approved server expansion.
