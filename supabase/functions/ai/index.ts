// @ts-nocheck
// Supabase Edge Function "ai": the ONLY place that talks to Anthropic. The API key lives here as a
// secret (ANTHROPIC_API_KEY) and never reaches the browser.
//
// Deploy (dashboard): Edge Functions -> Deploy a new function -> "Via Editor" -> name it `ai`
// -> paste this whole file -> Deploy. Keep "Verify JWT" ON (the default).
//
// Secrets (Edge Functions -> Secrets):
//   ANTHROPIC_API_KEY   required
//   AI_ALLOWED_EMAILS   optional, comma separated. If set, only these accounts may use the AI.
//   AI_DAILY_LIMIT      optional, requests per user per day (default 40)
//   AI_MODEL_FAST       optional (default claude-haiku-4-5-20251001), used for task suggestions
//   AI_MODEL_SMART      optional (default claude-sonnet-5-5), used for "plan my day"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ---------- input cleaning (never trust the browser) ----------
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(+v) ? null : +v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function cleanRules(rules) {
  return (Array.isArray(rules) ? rules : []).slice(0, 30)
    .map((r) => ({ id: clip(r?.id, 60), text: clip(r?.text, 300), listId: r?.listId ? clip(r.listId, 60) : null }))
    .filter((r) => r.id && r.text);
}

export function cleanSuggestInput(b) {
  const lists = (Array.isArray(b?.lists) ? b.lists : []).slice(0, 20).map((l) => ({
    id: clip(l?.id, 60),
    name: clip(l?.name, 60),
    tagColumn: l?.tagColumn ? {
      id: clip(l.tagColumn.id, 60),
      name: clip(l.tagColumn.name, 40),
      options: (Array.isArray(l.tagColumn.options) ? l.tagColumn.options : []).slice(0, 60)
        .map((o) => ({ id: clip(o?.id, 60), label: clip(o?.label, 40) })).filter((o) => o.id && o.label),
    } : null,
    groups: (Array.isArray(l?.groups) ? l.groups : []).slice(0, 60)
      .map((g) => ({ id: clip(g?.id, 60), title: clip(g?.title, 50) })).filter((g) => g.id && g.title),
  })).filter((l) => l.id);
  const tasks = (Array.isArray(b?.tasks) ? b.tasks : []).slice(0, 25).map((t) => ({
    id: clip(t?.id, 60),
    listId: clip(t?.listId, 60),
    title: clip(t?.title, 200),
    note: clip(t?.note, 300),
    category: t?.category ? clip(t.category, 50) : null,
    current: {
      estimateMin: num(t?.current?.estimateMin),
      priority: num(t?.current?.priority),
      tags: (Array.isArray(t?.current?.tags) ? t.current.tags : []).slice(0, 10).map((x) => clip(x, 40)),
    },
  })).filter((t) => t.id && t.title && lists.some((l) => l.id === t.listId));
  return { lists, rules: cleanRules(b?.rules), tasks };
}

export function cleanPlanInput(b) {
  const tasks = (Array.isArray(b?.tasks) ? b.tasks : []).slice(0, 80).map((t) => ({
    id: clip(t?.id, 60),
    title: clip(t?.title, 200),
    list: clip(t?.list, 60),
    category: t?.category ? clip(t.category, 50) : null,
    priority: num(t?.priority),
    estimateMin: num(t?.estimateMin),
    due: t?.due ? clip(t.due, 10) : null,
    inFocusToday: !!t?.today,
    note: clip(t?.note, 200),
  })).filter((t) => t.id && t.title);
  return {
    date: clip(b?.date, 10),
    hours: clamp(num(b?.hours) ?? 3, 0.25, 16),
    energy: ['low', 'normal', 'high'].includes(b?.energy) ? b.energy : 'normal',
    context: clip(b?.context, 400),
    tasks,
    rules: cleanRules(b?.rules),
  };
}

// ---------- prompts ----------
export const SYSTEM_SUGGEST = `את עוזרת לאמא עם ADHD לארגן את המשימות שלה. עני בעברית.
לכל משימה הציעי: הערכת זמן בדקות, עדיפות, תגיות, וקטגוריה.
כללי עבודה:
1. תמיד העדיפי תגיות וקטגוריות שכבר קיימות ברשימה (לפי המזהים שניתנו). הציעי חדשה (newTags / newCategory) רק אם אין התאמה סבירה, ובשם קצר של 1 עד 3 מילים בעברית.
2. הערכת זמן: מספר שלם של דקות, ריאלי ונדיב (אצל מי שיש לה ADHD קשה להתחיל ויש הפרעות). אל תעגלי לערכים גדולים בלי סיבה.
3. עדיפות: 1 = דחוף, 2 = חשוב, 3 = יכול לחכות. אם אין מספיק מידע, החזירי null.
4. הכללים של המשתמשת (rules) מחייבים. כל כלל שהשפיע על ההצעה, רשמי את המזהה שלו ב-ruleIds. כלל עם listId חל רק על משימות באותה רשימה.
5. אל תשני כותרות משימות. אם משימה כבר מכילה ערך (current), אפשר להשאיר אותו (החזירי אותו כמו שהוא).
6. reason: משפט קצר מאוד בעברית (עד 12 מילים) שמסביר את ההצעה.
החזירי את התוצאה רק דרך הכלי submit_suggestions.`;

export const TOOL_SUGGEST = {
  name: 'submit_suggestions',
  description: 'Return suggestions for every task.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            estimateMin: { type: ['integer', 'null'] },
            priority: { type: ['integer', 'null'], enum: [1, 2, 3, null] },
            tagOptionIds: { type: 'array', items: { type: 'string' } },
            newTags: { type: 'array', items: { type: 'string' } },
            categoryId: { type: ['string', 'null'] },
            newCategory: { type: ['string', 'null'] },
            ruleIds: { type: 'array', items: { type: 'string' } },
            reason: { type: 'string' },
          },
          required: ['id', 'estimateMin', 'priority', 'tagOptionIds', 'newTags', 'categoryId', 'newCategory', 'ruleIds', 'reason'],
        },
      },
    },
    required: ['items'],
  },
};

export const SYSTEM_PLAN = `את עוזרת לאמא עם ADHD לתכנן את היום הקרוב. עני בעברית.
קיבלת: כמה שעות פנויות יש לה, רמת אנרגיה, הקשר חופשי להיום, רשימת משימות פתוחות (עם עדיפות, זמן משוער ותאריך יעד), והכללים האישיים שלה.
בחרי מה למקד היום ובאיזה סדר:
1. בחרי בין 3 ל-7 משימות. סך הזמן המשוער לא יעלה על כ-80% מהזמן הפנוי (משימה בלי הערכת זמן: הניחי 20 דקות).
2. אנרגיה נמוכה: התחילי בניצחון קטן וקל, ובחרי פחות משימות. אנרגיה גבוהה: אפשר להתחיל במשימה הכי חשובה.
3. תאריכי יעד שהגיעו או עברו ועדיפות 1 קודמים, אלא אם ההקשר או כלל מונעים.
4. הכללים של המשתמשת (rules) והקשר להיום מחייבים (למשל "לבשל רק כשהתינוק ער" ו"התינוק ער עד 11"). רשמי ב-ruleIds כל כלל שהשפיע.
5. why: משפט קצר מאוד בעברית (עד 12 מילים) לכל משימה. message: משפט עידוד חם וקצר.
החזירי את התוצאה רק דרך הכלי submit_plan, לפי סדר הביצוע.`;

export const TOOL_PLAN = {
  name: 'submit_plan',
  description: 'Return the plan for the day, in order.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, why: { type: 'string' }, ruleIds: { type: 'array', items: { type: 'string' } } },
          required: ['id', 'why', 'ruleIds'],
        },
      },
    },
    required: ['message', 'items'],
  },
};

// ---------- validating the model output ----------
const applicableRules = (rules, listId) => rules.filter((r) => !r.listId || r.listId === listId);
const lower = (s) => String(s).toLowerCase();

export function validateSuggest(raw, input) {
  const seen = new Set();
  const items = [];
  for (const it of Array.isArray(raw?.items) ? raw.items : []) {
    const task = input.tasks.find((t) => t.id === it?.id);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    const list = input.lists.find((l) => l.id === task.listId);
    const est = num(it.estimateMin);
    const pr = num(it.priority);

    // tags: existing first; a "new" tag that equals an existing label becomes that existing option
    const optionIds = [];
    const newTags = [];
    if (list?.tagColumn) {
      const opts = list.tagColumn.options;
      for (const id of Array.isArray(it.tagOptionIds) ? it.tagOptionIds : []) {
        if (opts.some((o) => o.id === id) && !optionIds.includes(id)) optionIds.push(id);
      }
      for (const raw of Array.isArray(it.newTags) ? it.newTags : []) {
        const label = clip(raw, 30);
        if (!label) continue;
        const existing = opts.find((o) => lower(o.label) === lower(label));
        if (existing) { if (!optionIds.includes(existing.id)) optionIds.push(existing.id); }
        else if (!newTags.some((x) => lower(x) === lower(label))) newTags.push(label);
      }
    }

    // category: existing first, same rule
    let categoryId = list?.groups.some((g) => g.id === it.categoryId) ? it.categoryId : null;
    let newCategory = null;
    const nc = clip(it.newCategory, 30);
    if (!categoryId && nc) {
      const existing = list?.groups.find((g) => lower(g.title) === lower(nc));
      if (existing) categoryId = existing.id; else newCategory = nc;
    }

    const ok = applicableRules(input.rules, task.listId);
    items.push({
      id: task.id,
      estimateMin: est === null ? null : clamp(Math.round(est), 1, 480),
      priority: [1, 2, 3].includes(pr) ? pr : null,
      tagOptionIds: optionIds.slice(0, 4),
      newTags: newTags.slice(0, 2),
      categoryId,
      newCategory,
      ruleIds: (Array.isArray(it.ruleIds) ? it.ruleIds : []).filter((id) => ok.some((r) => r.id === id)).slice(0, 5),
      reason: clip(it.reason, 120),
    });
  }
  return { items };
}

export function validatePlan(raw, input) {
  const seen = new Set();
  const items = [];
  for (const it of Array.isArray(raw?.items) ? raw.items : []) {
    const task = input.tasks.find((t) => t.id === it?.id);
    if (!task || seen.has(task.id)) continue;
    seen.add(task.id);
    items.push({
      id: task.id,
      why: clip(it.why, 140),
      ruleIds: (Array.isArray(it.ruleIds) ? it.ruleIds : []).filter((id) => input.rules.some((r) => r.id === id)).slice(0, 5),
    });
    if (items.length >= 12) break;
  }
  const minutes = items.reduce((n, it) => n + (input.tasks.find((t) => t.id === it.id)?.estimateMin ?? 20), 0);
  return { message: clip(raw?.message, 200), items, totalMinutes: minutes };
}

// ---------- the request handler (dependencies injected so it can be tested) ----------
export async function handle(req, deps) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method', message: 'Method not allowed' });

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const user = jwt ? await deps.getUser(jwt) : null;
  if (!user) return json(401, { error: 'auth', message: 'צריך להתחבר מחדש.' });
  if (deps.allowedEmails.length && !deps.allowedEmails.includes(lower(user.email || ''))) {
    return json(403, { error: 'forbidden', message: 'ה-AI עדיין לא זמין לחשבון הזה.' });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_request', message: 'בקשה לא תקינה.' }); }
  const action = body?.action;
  if (action !== 'suggest' && action !== 'plan') return json(400, { error: 'bad_request', message: 'פעולה לא מוכרת.' });

  const input = action === 'suggest' ? cleanSuggestInput(body) : cleanPlanInput(body);
  if (!input.tasks.length) return json(400, { error: 'no_tasks', message: 'לא נבחרו משימות.' });

  try { await deps.takeQuota(jwt, deps.dailyLimit); }
  catch (e) {
    if (/quota/i.test(e?.message || '')) return json(429, { error: 'quota', message: `הגעת למגבלה היומית (${deps.dailyLimit} בקשות). נסי שוב מחר.` });
    return json(500, { error: 'quota_check', message: 'לא הצלחתי לבדוק את מגבלת השימוש.' });
  }

  try {
    if (action === 'suggest') {
      const raw = await deps.callModel({ model: deps.modelFast, system: SYSTEM_SUGGEST, tool: TOOL_SUGGEST, user: JSON.stringify(input) });
      return json(200, { action, ...validateSuggest(raw, input) });
    }
    const raw = await deps.callModel({ model: deps.modelSmart, system: SYSTEM_PLAN, tool: TOOL_PLAN, user: JSON.stringify(input) });
    return json(200, { action, ...validatePlan(raw, input) });
  } catch (e) {
    console.error('model call failed', e?.message);
    return json(502, { error: 'model', message: 'ה-AI לא הצליח לענות כרגע. נסי שוב בעוד רגע.' });
  }
}

// ---------- Deno wiring ----------
if (typeof Deno !== 'undefined') {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const env = (k, d = '') => Deno.env.get(k) || d;
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY');

  const deps = {
    allowedEmails: env('AI_ALLOWED_EMAILS').split(',').map((s) => lower(s.trim())).filter(Boolean),
    dailyLimit: Math.max(1, parseInt(env('AI_DAILY_LIMIT', '40'), 10) || 40),
    modelFast: env('AI_MODEL_FAST', 'claude-haiku-4-5-20251001'),
    modelSmart: env('AI_MODEL_SMART', 'claude-sonnet-5-5'),
    async getUser(jwt) {
      const { data, error } = await createClient(url, anon).auth.getUser(jwt);
      return error ? null : data.user;
    },
    async takeQuota(jwt, max) {
      const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
      const { error } = await db.rpc('take_ai_quota', { max_per_day: max });
      if (error) throw new Error(error.message);
    },
    async callModel({ model, system, tool, user }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model, max_tokens: 4096, system,
          tools: [tool], tool_choice: { type: 'tool', name: tool.name },
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = await res.json();
      const block = (data.content || []).find((c) => c.type === 'tool_use');
      if (!block) throw new Error('no tool output');
      return block.input;
    },
  };
  Deno.serve((req) => handle(req, deps));
}
