# LMPilot Web MVP

A local-first static web MVP that brings the coding-assistant workflow from the LMPilot0004 PySide6 app to the browser. During local development, NVIDIA-compatible API requests go through the Vite proxy. The production frontend is static and does not include an application server.

## Run locally

Install Node.js 20.19 or later, then run these commands from the project directory. See the [Vite environment requirements](https://vite.dev/guide/) for details.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. Do not open the HTML file directly with `file://`.

The local development server forwards requests to `https://integrate.api.nvidia.com` through a Vite proxy, avoiding NVIDIA API browser CORS restrictions. This proxy is available only during development. GitHub Pages uses the Cloudflare Worker described below.

## Use NVIDIA on GitHub Pages

NVIDIA direct requests from GitHub Pages are blocked by CORS. The `worker/index.js` file in this repository is a relay deployed as a separate Cloudflare Worker. Pages and the Worker are deployed separately.

1. Create a [Cloudflare account](https://dash.cloudflare.com/sign-up). Clone this repository locally and run `npm ci`.
2. Check that `ALLOWED_ORIGIN` in `wrangler.toml` matches the actual Pages origin. Its current value is `https://hyangdan2.github.io`. Do not include the `/LMPilot0006/` path in the origin.
3. Run `npx wrangler login` and complete Cloudflare login in the browser.
4. Run `npm run worker:deploy`. On first use, Wrangler may ask you to choose a `workers.dev` subdomain. Save the `https://...workers.dev` URL printed by the command.
5. Deploy frontend changes to GitHub Pages, then set the app's **Base URL** to `https://...workers.dev/v1` under **Settings**. Enter the model name and NVIDIA API key, then save. The key is not stored in browser storage or Worker settings.
6. Select **Test connection**, then send a message to verify streaming. The key must be entered again after a page reload.

The Worker forwards only `GET /v1/models` and `POST /v1/chat/completions` to NVIDIA. It rejects browser requests from origins other than the configured Pages origin and limits request bodies to 2 MiB. It does not log API keys or conversation content; Worker observability logs are disabled in `wrangler.toml`. Anyone using this public Pages site must enter their own NVIDIA key. Requests pass through the Worker, so users must trust its operator. Redeploy the Worker after changing its code by running `npm run worker:deploy`. Frontend changes require a separate GitHub Pages deployment.

`ALLOWED_ORIGIN` is a CORS restriction against requests from other websites; it is not user authentication. The Worker URL is public, and clients outside a browser can spoof the Origin header. Monitor Cloudflare usage and add request limits if public traffic grows. NVIDIA usage and quotas apply to each user's own key.

Use `npm run worker:test` to validate Worker behavior locally. For Cloudflare deployment and login details, see the [official Workers getting started guide](https://developers.cloudflare.com/workers/get-started/guide/).

## Use the app

1. Open **Settings** and enter the Base URL, model name, and API key.
2. Saving stores only the Base URL and model name in the browser. The API key stays in memory for the current tab only.
3. Start a conversation. If needed, add code, an issue, or Import Layer information under the Korean-language **Add code and reference material** section.
4. Select a previous conversation from the left sidebar. On mobile, open the list with the menu button.
5. The Korean-language **Delete all local data** action asks for confirmation, then removes all app-owned sessions and settings.

Prompts include the user's input and are sent to the selected model provider. In production, NVIDIA requests go through the configured Cloudflare Worker.

## Build static assets

```bash
npm run build
```

The build output is written to `dist/`. For hosting under a repository subpath such as GitHub Pages, set `VITE_BASE_PATH` to that path at build time. Production files do not contain API keys or personal settings.

## Project documents

- AI roles and collaboration rules: [`docs/ai-harness.md`](docs/ai-harness.md)
- System architecture and data policy: [`docs/architecture.md`](docs/architecture.md)
- Implementation and evaluation tasks: [`docs/todo.md`](docs/todo.md)
