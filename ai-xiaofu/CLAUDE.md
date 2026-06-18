# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Working Rules

These rules are mandatory for all future work in this project.

### Product direction

AI小福 is **not** a generic chat app. It is a WeChat mini program for:

1. 建站接单客服助手: helping the developer reply to website-building customer inquiries on platforms such as Xianyu/Taobao/Pinduoduo.
2. AI小福陪伴聊天: a separate companion-chat experience that must not break or replace the customer-service workflow.

Any new feature must support this direction. If a request would change the product direction, ask the user before implementing it.

### Absolute prohibitions

- **Do not fully rewrite or rebuild the project from scratch.** Make small, incremental changes on top of the existing code.
- Do not perform broad rewrites of the mini program, admin panel, backend, or database unless the user explicitly asks for that scope.
- Do not replace the current stack with a new stack or build pipeline without explicit approval.
- Do not add user registration, user login, payment, membership, recharge, subscription, or similar monetization/account systems to the mini program unless explicitly requested.
- Do not programmatically change the fixed admin-password mechanism unless explicitly requested.
- Do not commit or write secrets into the repository: `.env`, API keys, JWT secrets, database passwords, or production credentials.
- Do not bypass compliance rules in `work` mode. The banned-word/platform-risk filter must remain active for customer-service replies.
- Do not change the production domain `wfr.ccvo.top` without explicit approval.
- Do not change the API response style away from `{ code, data, message }`.
- Do not delete tables, columns, or production data without a migration and explicit user confirmation.

### Required workflow before modifying files

Before changing code, docs, SQL, or config:

1. Check the current worktree (`git status --short`, `git diff --stat`, `git diff --name-only`) and protect existing uncommitted changes.
2. Read the target file before editing it.
3. Prefer targeted edits over whole-file replacement.
4. Reuse existing routes, middleware, UI patterns, and data structures before adding new ones.
5. If a change touches behavior, explain how it was verified; if it was not verified, say so.

### Project skill

Use the project skill `ai-xiaofu-guard` before modifying AI小福 files. It lives at `.claude/skills/ai-xiaofu-guard/SKILL.md` and repeats the guardrails for incremental edits, product direction, mode boundaries, and sensitive-data protection.

## Project Overview

AI小福 is a customer-service assistant for developers who take website-building orders on platforms like Xianyu/Taobao/Pinduoduo. It has two operating modes:

- **客服模式 (`work`)**: Generates compliance-filtered replies for customer inquiries about web development services. Includes banned-word detection, platform rule enforcement, and product catalog integration.
- **AI小福模式 (`chat`)**: A personal AI companion mode with conversation memory, distinct from the customer-service mode. Banned-word filtering is **skipped** in this mode.

## Commands

```bash
# Start the backend
cd backend && npm start        # Runs on port 3000, serves admin panel at /admin

# Database setup (one-time)
mysql -u root -p < database.sql

# No build step — admin is a vanilla Vue3 SPA loaded via CDN, miniprogram is uncompiled WeChat native code
```

There is no test suite, no linter, and no build pipeline.

## Architecture

### Request Flow (core path)

```
Mini Program → POST /api/chat/generate → System Prompt Builder → API Call (with failover) → Banned-Word Check → Save Log → Response
```

### Backend (`backend/`)

- **`server.js`** — Express entry point. Static serves `admin/` at `/admin`. Mounts 7 route modules under `/api/*`. Uses CORS, JSON/urlencoded body parsing, request logging, trust-proxy, global API rate limiting, strict `/api/chat/generate` rate limiting, enhanced health checks, 404 handling, and unified error handling.
- **`db.js`** — MySQL connection pool via `mysql2/promise` (10 connections, utf8mb4).
- **`middleware/auth.js`** — JWT verification for admin routes. Tokens are issued with a 30-minute expiry and `jwt.verify()` handles expiration.
- **`routes/auth.js`** — Password-only login (no username). Password is bcrypt-hashed, fixed at `zyh123456`. Returns JWT with `expiresIn: '30m'`.
- **`routes/chat.js`** — **Core module.** Single endpoint `POST /generate` receives `{question, session_id, mode, chat_form}`. It treats `work` as customer-service mode and `chat`/`human` as AI小福 companion modes. Two separate system-prompt builders are used depending on mode:
  - `buildSystemPrompt()` for `work` mode — injects platform compliance rules, product catalog from DB, AI persona settings.
  - `buildChatSystemPrompt()` for `chat` mode — warm companion persona, loads recent conversation memory.
  - API call logic: tries primary API → falls back to any other active API on failure → falls back to hardcoded fallback replies if all APIs fail.
  - Banned-word filtering **only runs in work mode**; if violations detected, retries with correction prompt, and if still violated, censors with `***`.
  - Saves conversation context to `ai_memories` table when memory is enabled.
- **`routes/products.js`** — Full CRUD + toggle enable/disable + Excel import/export via `xlsx` library. Has a public `/public` endpoint (no auth) for mini program to fetch active products.
- **`routes/apis.js`** — Manage multiple LLM API configs (DeepSeek, OpenAI-compatible). Supports setting primary API, connectivity test endpoint.
- **`routes/ai-settings.js`** — Single-row settings table (read/write). On update, auto-prunes expired memories.
- **`routes/banned-words.js`** — Manage banned words with categories. Supports regex patterns. Has a `/check` endpoint to test text against the word list.
- **`routes/logs.js`** — Chat log viewer with keyword/date filtering, stats aggregation, batch delete.

### Admin Panel (`admin/`)

Single-file Vue 3 SPA (`admin/js/app.js`) using CDN-loaded Vue 3 + Element Plus. No bundler. All state in one giant `setup()` function. Communicates with backend via `fetch()`, passes JWT in `Authorization: Bearer` header. Auto-logout on 401.

### Mini Program (`miniprogram/`)

Native WeChat mini program with `pages/index/index` as the main two-mode page and `pages/chat/chat` as the independent AI小福/human-style chat page. `app.js` provides environment-aware API config, a global `request()` wrapper with retry behavior, update checks, and a persistent `session_id` for conversation memory. Production API calls target `https://wfr.ccvo.top`.

### Database (`database.sql`)

8 tables: `admin`, `ai_settings`, `product_categories`, `products`, `api_configs`, `chat_logs`, `banned_words`, `ai_memories`. Key design notes:
- `ai_settings` is a single-row table (always `ORDER BY id DESC LIMIT 1`).
- `api_configs` uses `is_primary` + `weight` for API selection priority.
- `banned_words` supports both plain text and regex patterns (`is_regex` flag).
- `ai_memories` stores per-session conversation history for context retention.

## Key Constraints

- **Never** add user registration/login/payment features to the mini program.
- **Never** modify the admin password programmatically — it is fixed.
- Admin panel and all API routes require JWT auth (except `/api/auth/login`, `/api/chat/generate`, `/api/chat/public-info`, `/api/products/public`, `/api/health`).
- API responses always use `{code: 200, data: ...}` or `{code: 4xx/5xx, message: ...}` format.
- The banned-word filter must never apply to chat mode — only to work/customer-service mode.
