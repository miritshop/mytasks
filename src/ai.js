import { supabase } from './supabase.js';
import { todayStr } from './store.js';

// Talking to the "ai" Edge Function (see supabase/functions/ai). The Anthropic key lives only there.

async function call(body) {
  const { data, error } = await supabase.functions.invoke('ai', { body });
  if (!error) return data;
  let msg = 'משהו השתבש. נסי שוב.';
  if (error.name === 'FunctionsFetchError') msg = 'אין חיבור לשרת ה-AI. בדקי את האינטרנט.';
  else if (error.context?.status === 404) msg = 'פונקציית ה-AI עוד לא פורסמה בפרויקט הזה.';
  else {
    try { const j = await error.context.json(); if (j?.message) msg = j.message; } catch {}
  }
  throw new Error(msg);
}

export const suggest = (payload) => call({ action: 'suggest', ...payload });
export const plan = (payload) => call({ action: 'plan', ...payload });

// ---------- building the requests from the app state ----------
export const tagColumnOf = (table) => table?.columns.find((c) => c.type === 'tags') || null;

export function activeRules(state) {
  return (state.ruleOrder || []).map((id) => state.rules[id])
    .filter((r) => r && r.enabled && r.text.trim())
    .map((r) => ({ id: r.id, text: r.text.trim(), listId: r.listId || null }));
}

const groupTitleOf = (state, t) => {
  const p = state.tasks[t.parentId];
  return p?.isGroup ? p.title : null;
};
const tagLabels = (state, t) => {
  const col = tagColumnOf(state.tables[t.tableId]);
  if (!col) return [];
  const v = t.vals[col.id];
  return (Array.isArray(v) ? v : []).map((id) => (col.options || []).find((o) => o.id === id)?.label).filter(Boolean);
};

export function buildSuggestPayload(state, taskIds) {
  const tasks = taskIds.map((id) => state.tasks[id]).filter((t) => t && !t.isGroup);
  const listIds = [...new Set(tasks.map((t) => t.tableId))];
  const lists = listIds.map((id) => {
    const table = state.tables[id];
    const col = tagColumnOf(table);
    return {
      id, name: table.name,
      tagColumn: col ? { id: col.id, name: col.name, options: (col.options || []).map((o) => ({ id: o.id, label: o.label })) } : null,
      groups: Object.values(state.tasks).filter((t) => t.tableId === id && t.isGroup).map((g) => ({ id: g.id, title: g.title })),
    };
  });
  return {
    lists,
    rules: activeRules(state),
    tasks: tasks.map((t) => ({
      id: t.id, listId: t.tableId, title: t.title, note: t.note || '', category: groupTitleOf(state, t),
      current: { estimateMin: t.estimateMin ?? null, priority: t.priority ?? null, tags: tagLabels(state, t) },
    })),
  };
}

// earliest date found in a task's date columns (a rough "due date")
const dueOf = (state, t) => {
  const cols = state.tables[t.tableId]?.columns.filter((c) => c.type === 'date') || [];
  const dates = cols.map((c) => t.vals[c.id]).filter(Boolean).sort();
  return dates[0] || null;
};

export function buildPlanPayload(state, { hours, energy, context }) {
  const open = Object.values(state.tasks).filter((t) => !t.isGroup && !t.done);
  const rank = (t) => [dueOf(state, t) || '9999', t.priority || 9];
  open.sort((a, b) => { const x = rank(a), y = rank(b); return x[0].localeCompare(y[0]) || x[1] - y[1]; });
  return {
    date: todayStr(), hours, energy, context,
    rules: activeRules(state),
    tasks: open.slice(0, 80).map((t) => ({
      id: t.id, title: t.title, list: state.tables[t.tableId]?.name || '', category: groupTitleOf(state, t),
      priority: t.priority ?? null, estimateMin: t.estimateMin ?? null, due: dueOf(state, t), today: !!t.today, note: t.note || '',
    })),
  };
}
