import { supabase } from './supabase.js';

// Everything that talks to the database lives here: converting between the app's state shape and
// table rows, loading, pushing only what changed, and image attachments. store.js orchestrates.

const PAGE = 1000;

// ---------- state <-> rows ----------
export const listRow = (t, position) => ({
  id: t.id, name: t.name, emoji: t.emoji || '', color: t.color || '', position,
  parent_task_id: t.parentTaskId || null, columns: t.columns || [],
});
export const taskRow = (t) => ({
  id: t.id, list_id: t.tableId, parent_id: t.parentId || null, title: t.title || '',
  is_group: !!t.isGroup, done: !!t.done, today: !!t.today, priority: t.priority || null,
  note: t.note || '', reason: t.reason || '', icon: t.icon || '',
  vals: t.vals || {}, links: t.links || [], sub_list_id: t.subTableId || null, pos: t.pos || null,
  collapsed: !!t.collapsed, g_collapsed: !!t.gCollapsed,
  estimate_min: t.estimateMin ?? null, ai: t.ai || {},
  when_kind: t.whenKind || null, when_date: t.whenDate || null,
  created_at: new Date(t.createdAt || Date.now()).toISOString(),
});
const tableFrom = (r) => ({
  id: r.id, name: r.name, emoji: r.emoji, color: r.color, parentTaskId: r.parent_task_id, columns: r.columns || [],
});
const taskFrom = (r) => ({
  id: r.id, tableId: r.list_id, parentId: r.parent_id, title: r.title, done: r.done, today: r.today,
  priority: r.priority, note: r.note, reason: r.reason, icon: r.icon, vals: r.vals || {}, links: r.links || [],
  subTableId: r.sub_list_id, pos: r.pos, createdAt: Date.parse(r.created_at),
  ...(r.is_group ? { isGroup: true } : {}), collapsed: r.collapsed, gCollapsed: r.g_collapsed,
  estimateMin: r.estimate_min ?? null, ai: r.ai || {}, whenKind: r.when_kind || null, whenDate: r.when_date || null,
});
export const ruleRow = (r, position) => ({
  id: r.id, list_id: r.listId || null, text: r.text || '', enabled: r.enabled !== false, position,
});
const ruleFrom = (r) => ({ id: r.id, listId: r.list_id, text: r.text, enabled: r.enabled });

// The settings that sync to the server (the rest of `ui` stays on this device)
export const settingsOf = (s) => ({
  hideSuggest: !!s.ui.hideSuggest, splitDismiss: s.ui.splitDismiss || {},
  migrations: s.migrations || {}, plan: s.ui.plan || null, initialized: true,
});

// ---------- loading ----------
async function fetchAllRows(table, order) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

export async function fetchAll() {
  // the database must have the v2 columns/tables (supabase/schema.sql); otherwise saving would fail later
  const probe = await supabase.from('tasks').select('estimate_min,ai,when_kind,when_date').limit(1);
  const probe2 = await supabase.from('ai_rules').select('id').limit(1);
  if (probe.error || probe2.error) throw new Error('SCHEMA_OUTDATED');
  const [lists, tasks, settings, rules] = await Promise.all([
    fetchAllRows('lists', 'position'),
    fetchAllRows('tasks', 'created_at'),
    supabase.from('user_settings').select('data').maybeSingle(),
    fetchAllRows('ai_rules', 'position'),
  ]);
  if (settings.error) throw settings.error;
  const tables = Object.fromEntries(lists.map((r) => [r.id, tableFrom(r)]));
  return {
    tableOrder: lists.filter((r) => !r.parent_task_id).map((r) => r.id),
    tables,
    tasks: Object.fromEntries(tasks.map((r) => [r.id, taskFrom(r)])),
    rules: Object.fromEntries(rules.map((r) => [r.id, ruleFrom(r)])),
    ruleOrder: rules.map((r) => r.id),
    settings: settings.data?.data || null,
  };
}

// First-run lock: only ONE browser/tab may fill a brand-new account (import old data or demo data).
// The settings row is the lock: inserting it succeeds once; any concurrent tab gets a duplicate-key error.
export async function claimInit(userId) {
  const { error } = await supabase.from('user_settings').insert({ owner: userId, data: { initialized: true } });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

// ---------- pushing changes ----------
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const depthOf = (tasks, t) => { let d = 0; for (let p = tasks[t.parentId]; p && d < 100; p = tasks[p.parentId]) d++; return d; };

// What must be written so the server matches `next`, given what it already holds (`prev`).
export function diff(prev, next) {
  const listsOf = (s) => Object.fromEntries(s.tableOrder.concat(Object.keys(s.tables).filter((id) => !s.tableOrder.includes(id)))
    .filter((id) => s.tables[id]).map((id, i) => [id, listRow(s.tables[id], s.tableOrder.includes(id) ? s.tableOrder.indexOf(id) : 1000 + i)]));
  const pl = listsOf(prev), nl = listsOf(next);
  const pt = Object.fromEntries(Object.values(prev.tasks).map((t) => [t.id, taskRow(t)]));
  const nt = Object.fromEntries(Object.values(next.tasks).map((t) => [t.id, taskRow(t)]));
  const rulesOf = (s) => Object.fromEntries((s.ruleOrder || []).filter((id) => (s.rules || {})[id])
    .map((id, i) => [id, ruleRow(s.rules[id], i)]));
  const pr = rulesOf(prev), nr = rulesOf(next);
  const ops = {
    upsertRules: Object.values(nr).filter((r) => !pr[r.id] || !same(r, pr[r.id])),
    deleteRules: Object.keys(pr).filter((id) => !nr[id]),
    upsertLists: Object.values(nl).filter((r) => !pl[r.id] || !same(r, pl[r.id])),
    deleteLists: Object.keys(pl).filter((id) => !nl[id]),
    upsertTasks: Object.values(nt).filter((r) => !pt[r.id] || !same(r, pt[r.id]))
      .sort((a, b) => depthOf(next.tasks, next.tasks[a.id]) - depthOf(next.tasks, next.tasks[b.id])),
    deleteTasks: Object.keys(pt).filter((id) => !nt[id]),
    settings: !prev.noSettings && same(settingsOf(prev), settingsOf(next)) ? null : settingsOf(next),
  };
  ops.empty = !ops.upsertRules.length && !ops.deleteRules.length && !ops.upsertLists.length && !ops.deleteLists.length && !ops.upsertTasks.length
    && !ops.deleteTasks.length && !ops.settings;
  return ops;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const check = ({ error }) => { if (error) throw error; };

export async function push(ops, userId) {
  for (const part of chunk(ops.upsertLists, 200)) check(await supabase.from('lists').upsert(part));
  for (const part of chunk(ops.upsertTasks, 200)) check(await supabase.from('tasks').upsert(part));
  for (const part of chunk(ops.upsertRules, 200)) check(await supabase.from('ai_rules').upsert(part));
  for (const part of chunk(ops.deleteRules, 100)) check(await supabase.from('ai_rules').delete().in('id', part));
  for (const part of chunk(ops.deleteTasks, 100)) {
    await removeFilesOfTasks(part); // delete image files first; rows disappear with the task (cascade)
    check(await supabase.from('tasks').delete().in('id', part));
  }
  for (const part of chunk(ops.deleteLists, 100)) {
    const { data } = await supabase.from('tasks').select('id').in('list_id', part);
    if (data?.length) await removeFilesOfTasks(data.map((r) => r.id));
    check(await supabase.from('lists').delete().in('id', part));
  }
  if (ops.settings) check(await supabase.from('user_settings').upsert({ owner: userId, data: ops.settings }, { onConflict: 'owner' }));
}

// ---------- images ----------
const BUCKET = 'task-images';

async function removeFilesOfTasks(taskIds) {
  const { data } = await supabase.from('attachments').select('path').in('task_id', taskIds);
  if (data?.length) await supabase.storage.from(BUCKET).remove(data.map((a) => a.path));
}

export async function listAttachments(taskId) {
  const { data, error } = await supabase.from('attachments').select('*').eq('task_id', taskId).order('created_at');
  if (error) throw error;
  if (!data.length) return [];
  const { data: urls, error: e2 } = await supabase.storage.from(BUCKET).createSignedUrls(data.map((a) => a.path), 3600);
  if (e2) throw e2;
  return data.map((a, i) => ({ ...a, url: urls[i]?.signedUrl || '' }));
}

// Shrink big phone photos before uploading (max side 1600px, JPEG)
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
  if (!blob) throw new Error('shrink failed');
  return blob;
}

export async function uploadImage(file, taskId, userId, newId) {
  if (!file.type.startsWith('image/')) throw new Error('הקובץ אינו תמונה.');
  const blob = await shrink(file);
  const path = `${userId}/${taskId}/${newId}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const { error } = await supabase.from('attachments').insert({ task_id: taskId, path, name: file.name, size: blob.size });
  if (error) { await supabase.storage.from(BUCKET).remove([path]); throw error; }
}

export async function deleteAttachment(att) {
  await supabase.storage.from(BUCKET).remove([att.path]);
  check(await supabase.from('attachments').delete().eq('id', att.id));
}

export async function countAttachments() {
  const { data, error } = await supabase.from('attachments').select('task_id');
  if (error) return {};
  return data.reduce((m, r) => ((m[r.task_id] = (m[r.task_id] || 0) + 1), m), {});
}
