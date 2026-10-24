# Agent instructions

Read [`docs/ai-harness.md`](docs/ai-harness.md) before changing this project. Use [`docs/architecture.md`](docs/architecture.md) as the design reference and keep [`docs/todo.md`](docs/todo.md) current.

Project constraints:

- Keep the MVP frontend static and hostable. Do not add a backend unless the user requests or approves that phase.
- Never persist, log, or bundle an API key. Only Base URL and model name may be persisted as settings.
- Store conversation sessions locally and make the clear-data action remove all app-owned sessions and settings.
- Preserve the responsive desktop/mobile chat UX and keep provider-specific request details behind the provider adapter.
- Do not commit, push, or deploy unless explicitly requested.
