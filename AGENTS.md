# Repository Guidelines

## Project Structure & Module Organization
`public/` contains the static frontend: `index.html`, `admin.html`, public status/blog pages, shared styles in `style.css`, and browser logic in `app.js` and `blog.js`. The public `blog.html#status` view is a structured public flock-update page: header/CTAs, a summary strip, a featured boss-hen card, compact supporting-hen cards, a featured chicks card, and a lower-priority memorial section. `blog.js` owns the public status-page hash routing, summary-strip derivation from `/api/status`, loading/fallback states, and card rendering variants. `functions/api/` contains Cloudflare Pages Functions, typically one route per file plus shared helpers such as `_auth.js`, `_chat-tools.js`, and `_weather-data.js`. Keep schema changes in `schema.sql`, operational scripts in `scripts/`, and image assets in `public/images/`.

## Build, Test, and Development Commands
Run `npm install` to install Wrangler. Use `npx wrangler pages dev public` for local Pages + Functions development. Deploy with `npx wrangler pages deploy`. For D1 queries, prefer `npx wrangler d1 execute chicken-dashboard-db --remote --command "SELECT * FROM weather_logs LIMIT 5"` unless the task explicitly says local. `node scripts/backfill-weather.js > backfill.sql` generates SQL for weather backfills.

## Coding Style & Naming Conventions
This repo uses vanilla JavaScript, CommonJS in `package.json`, and 4-space indentation in both frontend and function files. Match the existing style: semicolons enabled, single quotes in JS, and descriptive kebab-case filenames for routes such as `free-range.js` and `weather-log.js`. Keep Cloudflare route handlers in `functions/api/` exporting `onRequestGet` and/or `onRequestPost`. Reuse existing shared helpers before adding new endpoint-specific utilities.

## Testing Guidelines
There is no automated test suite wired up yet; `npm test` intentionally fails. For changes, verify manually with `npx wrangler pages dev public` and exercise the affected page or API route. For the public status page, check both desktop and mobile widths, direct hash loads like `blog.html#status` and `blog.html#blog`, keyboard tab navigation, and loading/error states for `/api/status`. For API work, test happy-path and auth/error responses. For data-touching changes, confirm expected D1 reads after the request and note any manual validation you performed in the PR.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit messages such as `Fix weather log workflow endpoint` and `Rename Rudy meter to menace level`. Keep commits narrowly scoped and descriptive. PRs should include a concise summary, affected routes/pages, any schema or secret changes, and screenshots for UI work. Call out production-impacting Cloudflare, D1, or R2 changes explicitly.

## Security & Configuration Notes
This project uses production bindings. Treat `DB`, `PHOTOS`, `ADMIN_PASSWORD`, `OPENROUTER_API_KEY`, and `WEATHER_LOG_TOKEN` as secrets; never commit values. Avoid destructive database operations unless the user explicitly requests them.
