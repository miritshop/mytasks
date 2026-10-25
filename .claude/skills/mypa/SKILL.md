---
name: mypa
description: Maintain, extend, deploy or rebuild "היום שלי" (mypa), the Hebrew RTL task manager for a mom with ADHD (React + Vite + Supabase, hosted on Netlify). Use whenever the user asks to change a feature, fix a bug, add a view/column/filter, touch accounts/database/images/AI, publish, or rebuild this app, or mentions its tasks, categories, tags, statuses, "when", the AI suggestions, Supabase or Netlify.
---

# mypa – "היום שלי"

This skill only points to where the knowledge lives, so nothing is written twice.

1. **Read `CLAUDE.md` first.** It has the workflow (branch, test on the dev database, approvals, deploying to dev), the rules that must not be broken, the file map and the known pitfalls.
2. **Read the relevant part of `SPEC.md`** before changing behavior. It has what the app does and why, the decisions the user made, and the data model.
3. **`README.md`** has how to run, set up from scratch (Supabase, Netlify) and deploy. **`supabase/schema.sql`** is the database schema.
4. To **rebuild from scratch**: follow `SPEC.md` plus `supabase/schema.sql`, then the setup in `README.md`.

Two things to remember even before opening the files: never merge or push to `main` without the user's explicit OK, and never create accounts, handle passwords or print secrets.
