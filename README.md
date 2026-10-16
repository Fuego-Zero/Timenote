English | [中文](README.zh-CN.md)

# Timenote

Timenote (岁时记) is a self-hosted service for birthdays and anniversaries. Enter birthdays, anniversaries, and one-off events in the web app. Each year they expand by Gregorian or lunar rules, and a private ICS URL subscribes them to any calendar that supports ICS or webcal (Apple Calendar, Google Calendar, Outlook).

- Multiple accounts: on an empty database, create the first admin in the web setup flow (`POST /api/setup/admin`). There is no `INITIAL_ADMIN` environment variable. Public self-registration is off by default (`PUBLIC_REGISTER_ENABLED`). When it is on, `REGISTER_DEFAULT_DISABLED` decides whether new accounts start disabled (the default; an admin must enable them). Admins create, enable, disable, reset passwords, and delete accounts under Accounts. Each account's events and feed URLs are isolated.
- Event types: birthdays (age N), anniversaries (Nth year), and one-off events. Supports an unknown year, February 29, lunar leap months and the 30th, multi-day events, and up to two reminders.
- Preview the next 5 occurrences before saving. Preview, subscription, and export share one rules engine (`packages/calendar`).
- One feed URL per device. Rotate or revoke it at any time; the old URL returns 404 immediately. The URL does not contain names, birthdays, or dates.

Product behavior is informed by TimeMark (read-only; see `.cursor/rules/02-timemark-readonly.mdc`). The engineering setup follows mm-agent: a pnpm workspace, TypeScript strict, Fastify + SQLite, React + Ant Design, Vitest + Playwright. Architecture, data flow, and the UID strategy are in the [architecture notes](docs/architecture.md) (Chinese).

## Start from an empty environment

Install Node.js 22.21.1 (or a newer Node 22 / Node 24), then run:

```sh
npm install --global pnpm@10.28.0
cd <path-to-this-repo>
pnpm install --frozen-lockfile
pnpm env:init
pnpm dev
```

`env:init` writes a basic `.env` only when that file does not exist; it does not overwrite an existing file. `.env` is gitignored. Open [Timenote](http://127.0.0.1:8720). On an empty database, create the admin account in the first-run setup. All variables are in [environment variables](docs/environment-variables.md) (Chinese).

| Service                       | Address                      |
| ----------------------------- | ---------------------------- |
| Web and same-origin API proxy | http://127.0.0.1:8720        |
| API health check              | http://127.0.0.1:8721/health |

One process starts two listeners: the web server (Vite middleware in development, static files in production) and a Fastify API bound only to `127.0.0.1`. Browsers and calendar apps talk only to the web server. `/api/*` is proxied on the same origin. In development the web server binds `0.0.0.0` by default and prints LAN addresses in the startup log. To debug feeds from a phone, set `WEB_ORIGIN` to that LAN address and restart.

Check the production static build:

```sh
pnpm build
pnpm start
```

## How to use

1. The admin creates accounts for other people under Accounts (time zone is optional; reminders use the account time zone).
2. Under Events, create a birthday, anniversary, or one-off event. The form shows the next 5 dates, titles, and reminder times as you edit.
3. Under Feeds, create a feed URL for a device. The URL stays in the list and can be copied later. If it leaks, rotate or revoke it; the old URL stops working immediately.
4. Add that URL as a subscribed calendar in the calendar app. Client-specific steps are in [docs/subscription-acceptance.md](docs/subscription-acceptance.md) (Chinese).
5. Backup exports and imports JSON for the current account only. Import first shows how many events will be added or overwritten, and writes only after you confirm. For a database-level backup, run `pnpm db:backup`.

Precise rules for the lunar calendar, leap months, the 30th, and February 29 are in [anniversary rules](docs/anniversary-rules.md) (Chinese).

## Quality checks

```sh
pnpm check        # typecheck, lint, format:check, Vitest, build
pnpm test:e2e     # Playwright (local Microsoft Edge); starts pnpm dev against a temporary SQLite file
pnpm verify       # all of the above, and writes source hashes, exit codes, logs, and test JSON under .tmp/verification-results/latest
```

Test databases, screenshots, and reports go under `.tmp/`. Automated tests cover the rules engine, ICS round-trips, API permission boundaries, log redaction, and end-to-end flows. They do not replace checking a real device: each calendar app's refresh interval, reminder alerts, and display still need a manual pass against the [acceptance checklist](docs/subscription-acceptance.md) (Chinese).

## Deployment

A single Docker instance with a named volume for persistence. GitHub Actions publishes it: after a pull request is merged into `main`, the workflow builds an image, pushes it to `ghcr.io/fuego-zero/timenote`, then SSHs to the server to pull and start it. The server does not clone the repository. HTTPS and certificates are the deployer's responsibility (see [deploy/nginx.example.conf](deploy/nginx.example.conf)). Secrets, the first cutover, and rollback are in the [deployment notes](docs/deployment.md) (Chinese). Security constraints are in the [security notes](docs/security.md) (Chinese).

## AI engineering

Rules live in `.cursor/rules/`. The overview is `AGENTS.md` (Chinese). Cursor uses `.cursor/hooks.json`. Codex uses `.codex/hooks.json`. Both share `.cursor/hooks/afterAgent.mjs`, which runs Prettier on files changed in that turn. The first time Codex uses a hook, or after the hook definition changes, review and trust it in the CLI `/hooks` menu.
