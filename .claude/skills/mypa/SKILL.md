---
name: mypa
description: Maintain, extend, deploy or rebuild "היום שלי" (mypa), the Hebrew RTL task manager for a mom with ADHD (React + Vite + Supabase, hosted on Netlify). Use whenever the user asks to change a feature, fix a bug, add a view/column/filter, touch accounts/database/images, publish, or rebuild this app, or mentions its tasks, categories, tags, statuses, the Claude "brain", Supabase or Netlify.
---

# mypa – "היום שלי"

Hebrew (RTL) task manager for a mom with ADHD. Cheerful and minimal, in the spirit of Tiimo/Structured.
Stack: React 18 + Vite, `@supabase/supabase-js`, hosted on Netlify. Code: github.com/miritshop/mytasks (branch `main`; pushes auto-deploy).

## Start every task like this

1. Read `CLAUDE.md` (rules and pitfalls) and the relevant part of `SPEC.md` (decisions and behavior). `README.md` has run, setup and deploy steps.
2. Answer the user in **Hebrew**, short and clear. If a request is ambiguous, ask: several decisions were made on purpose (below).
3. Work on a **feature branch**. Change the code, then `npm run build`, then check it in the browser (preview server `mypa`, port 5173). `npm run dev` uses the separate **dev Supabase project** (`.env.development.local`), never the live data.
4. When the user **confirms a feature works**, update **both** `SPEC.md` and `CLAUDE.md`. Until then do not treat the docs as final.
5. Commit with the attribution line from the session. **Never merge or push to `main` without the user's explicit OK** (it redeploys the live site). Schema changes run on the dev project first, on the live project only right before an approved release.

## Decisions that must not be undone without asking

- **No Anthropic/Claude API key anywhere in the app.** Prioritizing and splitting use a copy-paste bridge with the chat (`buildBrainPrompt`, `buildSplitPrompt`, `applyBrainPlan`, `parseSplit` in `src/store.js`).
- **Splitting into categories is suggested (from 5 tasks) and always approved by the user**, exactly 2 categories, editable before applying.
- **Categories are tasks** with `isGroup: true`; nesting is `parentId`. No separate structure.
- **Statuses and tags are optional columns** (`select`, `tags`), not mandatory fields. Priority is a built-in column that may be empty.
- **Icons come from local keyword rules** (`ICON_RULES`, no AI). No match: tasks 📝; categories 🏷️ beside 📁; tags/status options none. First matching rule wins, so specific rules go first.
- **Never create an account in the user's Supabase project to test.** Sign-up data goes to supabase.co, so ask her to sign up and test, and ask her to describe what she sees.
- **AI calls (planned) go through a server function (Supabase Edge Function) holding the Anthropic key as a secret**; never a key in the browser, git or any `VITE_*` variable. Suggestions come first from the user's own tags/priorities/categories; new ones are flagged "new". AI-set values are marked ✨ and approved or edited by the user (`tasks.ai`).
- **Never use or accept the `service_role` / secret key.** The anon key is public by design; Row Level Security (`supabase/schema.sql`) is the real protection. Every new table needs RLS with `owner = auth.uid()`.
- Avoid very new emoji (Emoji 13+): they render as empty boxes on Windows 10.

## Where things are

| Area | Files |
|---|---|
| State, actions, save/sync (`commit`, `flush`), icons, categories, Claude bridge | `src/store.js` |
| All database access, row conversion, `diff`/`push`, images | `src/cloud.js`, `src/supabase.js` |
| Login, sign-up, password reset | `src/Root.jsx` |
| Layout and sidebar | `src/App.jsx` |
| Views | `TodayView`, `TableView`, `GraphView`, `FilterView` (`src/*.jsx`) |
| Dialogs | `TaskModal`, `CategoryModals` (split banner, split, category), `BrainModal`, `Attachments` |
| Shared UI, columns, tags, emoji picker | `src/components.jsx`, `src/emojis.js` |
| Database schema and RLS | `supabase/schema.sql` (idempotent; user runs it in the SQL Editor) |

## Pitfalls that already cost time

- **Adding a field to a task or list** needs three things: a column in `schema.sql` (`alter table ... add column if not exists`, and tell the user to run it), both conversion directions in `cloud.js`, and a default for existing rows. Otherwise it silently does not save.
- **`flush()` in `store.js`:** never clear `flushing` inside the async function itself; use `run().finally(...)`. Doing it inside froze saving forever after an empty flush.
- **First login lock:** filling a new account only if `cloud.claimInit` succeeds; otherwise two tabs duplicate all data.
- **Ids are UUIDs** from `uid()`; `crypto.randomUUID` does not exist on plain http.
- **New table/column:** update `schema.sql`, `cloud.js` conversions, and the `SCHEMA_OUTDATED` probe in `fetchAll`.
- **Table rows** are rendered by a function (`renderNode`), not a nested component, so inputs keep focus.
- **Testing:** `import('/src/store.js')` in the console creates a separate module copy and changes nothing on screen. The data is in the cloud and belongs to the user, so verify through the UI; if you need her account behavior, ask her.
- **Saving feedback must be honest:** the sidebar shows "✓ הכל נשמר" only after a real successful push; errors show the real message.

## Typical jobs

- **New column type or cell:** `components.jsx` (`Cell`, `COL_TYPES`, `ColumnModal`), keep `FilterView` working (it matches columns by name and option label).
- **New view:** add `ui.view` value, a nav item and a branch in `App.jsx`; remember `isList` means table/graph only.
- **Database change:** edit `supabase/schema.sql`, give the user the exact SQL to run, update `cloud.js`.
- **Publish:** commit and push to `main`, Netlify builds. Env vars live in Netlify (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). After a new site address, set Supabase Authentication → URL Configuration.
- **Rebuild from scratch:** follow `SPEC.md` plus `supabase/schema.sql`, then the setup in `README.md`.

## Things only the user can do (do not try)

Create the Supabase project and run SQL there, create accounts, enter passwords, log in to GitHub (a push may need her sign-in), create the Netlify site and set its environment variables.
