# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

- **`server.js`** — Express entry point. Static serves `admin/` at `/admin`. Mounts 7 route modules under `/api/*`. No middleware beyond CORS + JSON body parsing.
- **`db.js`** — MySQL connection pool via `mysql2/promise` (10 connections, utf8mb4).
- **`middleware/auth.js`** — JWT verification with hard 30-minute expiry from `iat`, not just token expiration. All admin routes use this.
- **`routes/auth.js`** — Password-only login (no username). Password is bcrypt-hashed, fixed at `zyh123456`. Returns JWT with `expiresIn: '30m'`.
- **`routes/chat.js`** — **Core module.** Single endpoint `POST /generate` receives `{question, session_id, mode}`. Two separate system-prompt builders depending on mode:
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

Single-page WeChat mini program (`pages/index/index`). Two-mode UI with tab switching. `app.js` provides a global `request()` wrapper and generates a persistent `session_id` for conversation memory. All API calls target `https://wfr.ccvo.top`.

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
