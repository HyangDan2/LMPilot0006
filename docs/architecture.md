# Web MVP Architecture

## Goals and scope

Bring the LMPilot0004 PySide6 coding-assistant workflow to a local-first static web app. The UI provides a ChatGPT-style multi-conversation experience on desktop and mobile. Keep the external model contract separate from the UI so the project can support static hosting and optional server APIs as needed.

The production frontend is static. Production builds can call NVIDIA's OpenAI-compatible API or another compatible endpoint directly, but browser CORS policies may block those requests. During local development, a Vite dev-server proxy handles requests to NVIDIA's hosted API. For GitHub Pages, use the separately deployed Cloudflare Worker relay described below.

The Cloudflare Worker relay was added after direct NVIDIA calls from the GitHub Pages origin were blocked by CORS. Pages still serves only the static frontend. Users set the Worker URL, `https://<name>.<subdomain>.workers.dev/v1`, as the Base URL. The Worker accepts only `GET /v1/models` and `POST /v1/chat/completions` from the configured Pages origin and forwards requests to NVIDIA's fixed endpoint. It streams response bodies without buffering so SSE output remains incremental.

## Product flow

1. The user creates a session or selects a saved session.
2. The user enters a message and, if needed, provides code, an issue, Import Layer content, or text documents.
   Text documents are extracted as UTF-8 in the browser and shown in a preview before sending.
3. The frontend converts session messages and system instructions into a Provider request.
4. The Provider streams a request to the model provider and delivers response chunks to the UI.
5. Conversations are saved in local session storage and restored on the next visit.

## Layers and responsibilities

| Layer | Responsibility | MVP implementation |
|---|---|---|
| Presentation | Chat view, responsive layout, settings and confirmation dialogs, streaming indicator | React + TypeScript; desktop sidebar and mobile navigation |
| Application | Create, switch, and delete sessions; send and cancel requests; apply settings | Use cases and state management separated from provider details |
| Domain | Session, Message, Provider request and response contracts | Provider-independent types |
| Provider Adapter | Model API requests, SSE parsing, normalized errors | Browser calls through the configured compatible endpoint; NVIDIA calls use the local Vite proxy in development or the Cloudflare Worker on Pages |
| Local Persistence | Conversations, attachments, and non-secret settings | IndexedDB for sessions and attachments; only URL and model name in settings |
| Optional Future Backend | Additional server APIs, authentication, usage control, provider-key management | Consider after MVP evaluation; the current Worker is a narrow relay, not a general application backend |

Vite builds static files. Use the development server locally. A hosted build may need a Vite base path for the repository subpath. Do not open the app directly with `file://`; browser security and API request restrictions make it an unsupported run mode.

## Production and test Pages paths

On the same GitHub Pages origin, production is served from `/LMPilot0006/` and the test build from `/LMPilot0006/test/`. A push to either `main` or `test` triggers the deployment workflow. The workflow builds the latest source from both branches and combines them into one Pages artifact. The production Vite base path is `/LMPilot0006/`; the test base path is `/LMPilot0006/test/`.

Because both paths share an origin, IndexedDB and localStorage would otherwise be shared. Build-time `VITE_APP_NAMESPACE` values of `prod` and `test` isolate session and attachment IndexedDB databases, settings keys, and app cache names. The clear-data action deletes only data in the current namespace. API keys remain in memory only.

## Core interfaces

Use provider-independent contracts so frontend use cases do not depend directly on NVIDIA URLs or stream formats.

```ts
interface ChatProvider {
  streamChat(
    request: ChatRequest,
    options: { apiKey: string; signal: AbortSignal },
    onDelta: (text: string) => void,
  ): Promise<void>;
}

interface SessionRepository {
  list(): Promise<SessionSummary[]>;
  get(sessionId: string): Promise<ChatSession | undefined>;
  save(session: ChatSession): Promise<void>;
  deleteAll(): Promise<void>;
}
```

If a broader server architecture is introduced later, add a server-proxy `ChatProvider`. To preserve the no-key-storage policy, pass the user's key per request and never write it to server logs, traces, or error messages. Storing an operator-owned service key requires a separate product decision and key-management policy.

The current Cloudflare Worker uses the existing Provider contract and Base URL setting. It forwards the user's key in the per-request `Authorization` header and does not store it in Worker variables or storage. The Worker does not log request or response bodies, and Worker observability is explicitly disabled. Since traffic passes through the Worker account and platform, users must trust its operator. Verify real NVIDIA requests through the deployed Worker with the user's own account and key.

## Data and key policy

### Persistent data allowed

- Session ID, title, creation and update timestamps
- Message role, content, timestamp, and display state
- User-saved Base URL and model name
- App UI preferences explicitly set by the user
- Attachment filename, type, size, original Blob, extracted text, and creation time

### Persistent data prohibited

- API keys and authorization headers
- URLs, request captures, or error logs containing an API key
- API keys in localStorage, IndexedDB, Cache Storage, or service-worker caches

Keep the API key in tab memory so it can be reused after saving settings. Clear it on page reload or tab close. The Save button stores only the Base URL and model name and must explain that the key is not saved.

Before a request, tell users that their code, issues, attachments, and conversations may be sent to the selected model provider. Do not collect request bodies in app logs or analytics.

## Sessions, attachments, and data deletion

- Store sessions in IndexedDB and restore them after reopening the browser.
- Store original attachment Blobs and extracted text in a separate IndexedDB `attachments` store, linked by session ID. Messages reference attachment IDs and display metadata only.
- Let users download an original attachment from its card in a saved conversation.
- MVP attachment formats: `.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.yml`, `.log`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.html`, and `.css`. Read files as text in the browser. PDF/DOCX parsing and image OCR are not supported.
- Limit each file to 2 MB, each message to five attachments, and total extracted attachment text to 80,000 characters. Include extracted text in the request; do not send original binary files to the model provider.
- Tell users that attachment text, like code and conversation content, may be sent to the selected model provider.
- Save attachments to the session when sending. Deleting a session also deletes its attachment Blobs and extracted text. Clearing all local data empties every attachment store.
- IndexedDB is local to the current browser profile, and the app does not encrypt attachments. Anyone with access to the device or browser profile may be able to read saved content.
- Download analysis results as Markdown with a report title, save time, analyzed attachment filenames, and results.
- Each session contains messages, creation and update timestamps, and a display title. The default proposed title is derived from the first user message.
- Use a left session sidebar on desktop and a toggleable drawer on mobile.
- The Korean-language **Delete all local data** action asks for confirmation, then removes all app-owned IndexedDB sessions, settings, Cache Storage, and service-worker data.
- This action does not clear the browser's HTTP cache or data belonging to other sites. The confirmation must state that all session messages will be deleted.

## Errors and streaming

- Read streams from `fetch` response bodies and parse SSE events. Browser `EventSource` is generally unsuitable for POST JSON requests with custom Authorization headers.
- The stream parser handles multi-line events, blank-line separators, `[DONE]`, malformed JSON, and server error events.
- Use `AbortController` to stop a browser request when the user cancels generation.
- Show readable API errors while hiding credentials and sensitive response bodies.
- Render model-generated Markdown safely or sanitize it to prevent HTML/script injection.

## Deployment options

1. **Static hosting with direct browser calls:** simplest, but depends on the API provider's CORS support and exposes the user-entered key to the browser runtime.
2. **Static hosting with a user-key relay:** the user key is passed per request and is not stored by the server. Require data minimization, log exclusion, TLS, and request limits. The current Cloudflare Worker follows this narrow relay pattern for GitHub Pages.
3. **Service backend with an operator key:** users do not enter keys, but the operator must store and rotate a key, authenticate users, control usage and costs, and prevent abuse. This changes the current no-key-storage product policy and requires a separate decision and approval.

Choose any broader server technology after MVP evaluation. FastAPI is a possible candidate because the existing project uses Python, but no choice has been made.

## MVP evaluation gates

Evaluate these items before expanding server work:

- Do NVIDIA-compatible requests work through the local development path?
- Does direct browser access from an HTTPS static host pass CORS? If not, does the approved Worker relay work?
- Are provider keys absent from app storage, logs, and build artifacts?
- Are long conversations and streaming stable on desktop and mobile browsers?
- Do session restoration and full local-data deletion work as expected?
- Are users clearly informed that prompts and code are sent to an external model provider?
