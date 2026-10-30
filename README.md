# JARVIS · Career command

A single-user job application workspace with a dark command-center interface. Runs locally with SQLite or on Vercel with persistent Turso/libSQL storage. Requires Node.js 24.

## Run

```sh
cd /workspace/job-seeker
npm ci
npm start
```

The server listens on `127.0.0.1:3000`. Use `npm run dev` for automatic server restarts. Keep local development bound to loopback. Set `APP_PASSWORD` to enable HTTP Basic authentication. Vercel deployments require this password and use HTTPS; the browser asks for credentials when the API is accessed. Use any username and your configured password. This is one shared workspace, not a multi-user service.

## Deploy on Vercel

1. Create a Turso database and database auth token. You need its `libsql://…` URL and token. Hosted deployments never write data to Vercel's temporary filesystem.
2. Import this GitHub repository into Vercel. Select **Other** as the framework, leave the root directory at the repository root, and use Node.js **24.x**. The checked-in `vercel.json` sets the build command (`npm run build`), static output (`public`), API function, and 180-second function limit.
3. Add these variables in **Vercel → Project Settings → Environment Variables**, for each environment you intend to use:

   | Variable | Purpose |
   | --- | --- |
   | `TURSO_DATABASE_URL` | Required. The database's `libsql://…` address. |
   | `TURSO_AUTH_TOKEN` | Required. Database authentication token. |
   | `APP_PASSWORD` | Required. A strong, private workspace password. |
   | `AI_API_KEY` | OpenAI API key, required for AI tailoring. |
   | `AI_MODEL` | Optional; defaults to `gpt-4.1-mini`. |

4. Deploy or redeploy after saving environment variables. Static assets are served by Vercel and `/api/*` requests use `api/[...path].js`. There is no long-running server in production. Tables are created automatically on first authenticated API access.
5. Open the deployment and sign in with any username and `APP_PASSWORD`. Save your profile, create a test application, reload, and verify it remains. Verify an unauthenticated `/api/state` request returns 401. Live OpenAI generation requires your key and account quota.

The API fails closed when the production password or persistent database configuration is missing. Never set `DATA_DIR=/tmp` as a Vercel persistence workaround. Production and Preview deployments should use separate databases if you want to keep test data isolated. Local SQLite records are not automatically uploaded to Turso; back up any existing local workspace before migrating data.

The Vercel Node builder has been exercised locally. An actual hosted deployment and live Turso connection require your Vercel project and database credentials; a successful local build does not prove those services are configured.

## Connect OpenAI

Copy `.env.example` to `.env` and set `AI_API_KEY` securely in that local file or the server environment. Restart the server. The key is never returned to the browser. `AI_MODEL` defaults to `gpt-4.1-mini`. AI requests require HTTPS access to `api.openai.com` and a funded OpenAI API account. Generating documents sends the original CV, base cover letter, custom prompt, and selected posting to OpenAI and incurs provider usage charges.

## Workflow

1. Open **My profile & prompts**. Paste your original CV, optionally import a `.txt` / `.md` file, and save your standard prompt. PDF/DOCX import is not included yet.
2. Add an application with the company, role, full posting text, and optional source link. Each application becomes a persistent dossier.
3. With your CV saved and AI connected, creating a dossier automatically generates drafts. You can also choose **Tailor with AI** to generate complete CV and cover-letter drafts in English and highlight requirements not evidenced by your CV. Review the factual accuracy before using them. The posting link is stored; it is not scraped.
4. Edit and save each document, then export Markdown. Regeneration replaces the existing drafts after confirmation.
5. Change status through Saved, Applied, Interview, Offer, or Rejected. Record feedback, interview dates, and follow-ups under Activity & notes. The dashboard supports search and status filters.

Without an API key, application tracking, profile storage, manual document editing, and exports still work. AI generation reports the missing configuration rather than returning fake output. Natural-language status updates, automatic submission, reminders, PDF exports, and multiple-user accounts are not implemented.

## Storage and validation

Locally, data is stored in ignored `data/mission-control.sqlite`. On Vercel it is stored in the configured remote database. Keep this directory private; it contains personal information in plaintext. Back up SQLite using its backup facility, or stop the server before copying the entire data directory. Set `DATA_DIR` to override local storage. The existing local settings and applications schema is preserved. Do not commit `.env` or your data.

```sh
npm test
```

Tests run against an isolated temporary database and cover the real HTTP application lifecycle, input/status validation, cross-origin write protection, missing-key behavior, persistence across server restarts, simulated AI response validation, concurrent status/notes preservation, production configuration guards, authentication, and Vercel pre-parsed request bodies. Generation leases and transactional updates are stored in the database so requests on different function instances coordinate safely. A live OpenAI call requires a configured key and is not part of automated tests.
