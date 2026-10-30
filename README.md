# JARVIS · Career command

A local, single-user job application workspace with a dark command-center interface. Requires Node.js 24+. No npm dependencies or external database service.

## Run

```sh
cd /workspace/job-seeker
npm start
```

The server listens on `127.0.0.1:3000`. Use `npm run dev` for automatic server restarts. This is a local application without accounts or authentication; keep it bound to loopback. Add authentication and HTTPS before any public deployment.

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

Data is stored in ignored `data/mission-control.sqlite` (SQLite WAL). Keep this directory private; it contains personal information in plaintext. Back up SQLite using its backup facility, or stop the server before copying the entire data directory. Set `DATA_DIR` to override the storage location. Do not commit `.env` or your data.

```sh
npm test
```

Tests run against an isolated temporary database and cover the real HTTP application lifecycle, input/status validation, cross-origin write protection, missing-key behavior, persistence across server restarts, simulated AI response validation, and concurrent status/notes preservation. A live OpenAI call requires a configured key and is not part of automated tests.
