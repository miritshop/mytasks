import { useSyncExternalStore } from 'react';
import * as cloud from './cloud.js';

// RFC 4122 v4 UUID (the database uses uuid keys). Works on plain http too, unlike crypto.randomUUID.
export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const PALETTE = ['#FFD9C9', '#D9F2E6', '#DCE6FF', '#FFE6F0', '#FFF1BF', '#E7DDFF', '#D7F1F7'];
export const TABLE_COLORS = ['#7C6CF0', '#FF8E72', '#4FC79B', '#5B9DF5', '#F06FA0', '#F2B632'];

const opt = (label, i) => ({ id: uid(), label, color: PALETTE[i % PALETTE.length] });

const newTask = (tableId, title, extra = {}) => ({
  id: uid(), tableId, parentId: null, title, done: false, today: false, priority: null, note: '',
  reason: '', vals: {}, links: [], subTableId: null, pos: null, createdAt: Date.now(), ...extra,
});

function seed() {
  const c = { status: uid(), due: uid(), who: uid(), cost: uid() };
  const status = ['לא התחלתי', 'בתהליך', 'חכה לתשובה'].map(opt);
  const who = ['אני', 'בן/בת זוג', 'ילדים'].map(opt);
  const home = uid(), work = uid(), kids = uid(), bdTable = uid();
  const tasks = {};
  const add = (x) => (tasks[x.id] = x);
  const a = add(newTask(home, 'לסדר את המטבח', { today: true, priority: 2, vals: { [c.status]: status[1].id, [c.due]: todayStr() } }));
  add(newTask(home, 'להוציא כביסה', { parentId: a.id, done: true }));
  add(newTask(home, 'לשטוף כלים', { parentId: a.id }));
  add(newTask(home, 'להזמין תור לרופא', { today: true, priority: 1, vals: { [c.status]: status[0].id, [c.due]: todayStr() } }));
  add(newTask(home, 'קניות לשבת', { vals: { [c.who]: who[1].id }, links: [a.id] }));
  add(newTask(home, 'לשלם חשבון חשמל', { priority: 1, vals: { [c.due]: todayStr() } }));
  add(newTask(work, 'לענות למיילים', { today: true }));
  add(newTask(work, 'להכין הצעת מחיר'));
  const bd = add(newTask(kids, 'יום הולדת לנועה', { vals: { [c.due]: todayStr() }, subTableId: bdTable }));
  add(newTask(kids, 'להזמין עוגה', { parentId: bd.id }));
  add(newTask(kids, 'רשימת אורחים', { parentId: bd.id }));
  const cols = { guest: uid(), rsvp: uid(), gift: uid() };
  const rsvp = ['מגיעים', 'לא מגיעים', 'לא ענו'].map(opt);
  ['משפחת כהן', 'דנה ויואב', 'סבתא'].forEach((n, i) =>
    add(newTask(bdTable, n, { vals: { [cols.rsvp]: rsvp[i].id, [cols.guest]: String(2 + i) } })));
  return {
    tableOrder: [home, work, kids],
    tables: {
      [home]: { id: home, name: 'בית', emoji: '🏡', color: TABLE_COLORS[0], parentTaskId: null, columns: [
        { id: c.status, name: 'סטטוס', type: 'select', options: status },
        { id: c.due, name: 'תאריך', type: 'date' },
        { id: c.who, name: 'מי?', type: 'select', options: who },
      ] },
      [work]: { id: work, name: 'עבודה', emoji: '💼', color: TABLE_COLORS[3], parentTaskId: null, columns: [
        { id: c.status, name: 'סטטוס', type: 'select', options: status },
        { id: c.due, name: 'תאריך', type: 'date' },
        { id: c.cost, name: 'סכום ₪', type: 'number' },
      ] },
      [kids]: { id: kids, name: 'ילדים', emoji: '🧸', color: TABLE_COLORS[4], parentTaskId: null, columns: [
        { id: c.due, name: 'תאריך', type: 'date' },
      ] },
      [bdTable]: { id: bdTable, name: 'אורחים ליום הולדת', emoji: '🎂', color: TABLE_COLORS[5], parentTaskId: bd.id, columns: [
        { id: cols.guest, name: 'כמה אנשים', type: 'number' },
        { id: cols.rsvp, name: 'אישור הגעה', type: 'select', options: rsvp },
        { id: cols.gift, name: 'קיבלנו מתנה', type: 'checkbox' },
      ] },
    },
    tasks,
    ui: { tableId: home, view: 'today' },
  };
}

export const STATUS_OPTIONS = [
  { label: 'חקירה', icon: '🔍', color: PALETTE[2] },
  { label: 'החלטה', icon: '⚖️', color: PALETTE[4] },
  { label: 'השקעה', icon: '🚀', color: PALETTE[1] },
];
// adds any missing option (matched by label); never removes or renames anything
export const addStatusOptions = (options) => {
  STATUS_OPTIONS.forEach((o) => {
    if (!options.some((x) => x.label === o.label)) options.push({ id: uid(), ...o });
  });
};
// one-time, additive data migrations (flags live in state.migrations, which syncs with the account)
function migrate(s) {
  if (!s.migrations?.statusOptions) {
    Object.values(s.tables).forEach((t) => t.columns.forEach((c) => {
      if (c.type === 'select' && c.name === 'סטטוס') { c.options = c.options || []; addStatusOptions(c.options); }
    }));
    s.migrations = { ...s.migrations, statusOptions: true };
  }
  return s;
}

// ---------- state + cloud sync ----------
// The app works on one in-memory `state`. Every change goes through commit(), which updates the screen
// at once and then (debounced) writes only what changed to the database (see cloud.js).
const EMPTY = () => ({ tableOrder: [], tables: {}, tasks: {}, ui: { tableId: null, view: 'today' } });
let state = EMPTY();
let synced = EMPTY(); // what the server is known to hold
let userId = null;
const subs = new Set();

let syncState = { status: 'idle', error: '' }; // idle | saving | error
const syncSubs = new Set();
const setSync = (p) => { syncState = { ...syncState, ...p }; syncSubs.forEach((f) => f()); };
export const getSyncState = () => syncState;
export const useSyncStatus = () =>
  useSyncExternalStore((cb) => { syncSubs.add(cb); return () => syncSubs.delete(cb); }, () => syncState);

// Which list/view is open is per device, not per account
const uiKey = () => `mypa-ui-${userId}`;
const readLocalUI = () => { try { return JSON.parse(localStorage.getItem(uiKey())) || {}; } catch { return {}; } };
const saveLocalUI = () => {
  if (!userId) return;
  try { localStorage.setItem(uiKey(), JSON.stringify({ tableId: state.ui.tableId, view: state.ui.view })); } catch {}
};

let timer = null;
let flushing = null;
let again = false;
const schedule = () => { clearTimeout(timer); timer = setTimeout(flush, 500); };

export function flush() {
  clearTimeout(timer);
  if (!userId) return Promise.resolve(true);
  if (flushing) { again = true; return flushing; }
  const run = async () => {
    try {
      do {
        again = false;
        const snapshot = state;
        const ops = cloud.diff(synced, snapshot);
        if (!ops.empty) { setSync({ status: 'saving' }); await cloud.push(ops, userId); }
        synced = snapshot;
      } while (again || synced !== state);
      setSync({ status: 'idle', error: '' });
      return true;
    } catch (e) {
      console.error('save failed', e);
      setSync({ status: 'error', error: e?.message || '' });
      timer = setTimeout(flush, 5000); // keep trying until it goes through
      return false;
    }
  };
  // Clear `flushing` only AFTER it has been assigned. (Clearing it inside run() broke saving for good
  // whenever there was nothing to save: the body finished synchronously, before the assignment.)
  flushing = run().finally(() => { flushing = null; });
  return flushing;
}

function commit(fn) {
  const d = structuredClone(state);
  fn(d);
  state = d;
  saveLocalUI();
  subs.forEach((f) => f());
  schedule();
}
export const getState = () => state;
export const useStore = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);

// ids of the old browser-only data are short random strings; the database needs UUIDs
function remapIds(s) {
  const map = {};
  [...Object.keys(s.tables), ...Object.keys(s.tasks)].forEach((id) => { map[id] = uid(); });
  const out = { tableOrder: s.tableOrder.map((i) => map[i]).filter(Boolean), tables: {}, tasks: {}, migrations: s.migrations || {},
    ui: { ...s.ui, tableId: map[s.ui?.tableId] || null } };
  Object.values(s.tables).forEach((t) => {
    out.tables[map[t.id]] = { ...t, id: map[t.id], parentTaskId: map[t.parentTaskId] || null };
  });
  Object.values(s.tasks).forEach((t) => {
    if (!map[t.tableId]) return;
    out.tasks[map[t.id]] = { ...t, id: map[t.id], tableId: map[t.tableId], parentId: map[t.parentId] || null,
      links: (t.links || []).map((l) => map[l]).filter(Boolean), subTableId: map[t.subTableId] || null };
  });
  return out;
}

const readLegacy = () => {
  try { const s = JSON.parse(localStorage.getItem('mypa-v1')); return s && s.tables && s.tasks ? s : null; } catch { return null; }
};

function buildState(data, ui = {}) {
  const tableId = data.tables[ui.tableId] ? ui.tableId : data.tableOrder[0] || null;
  return {
    tableOrder: data.tableOrder, tables: data.tables, tasks: data.tasks, migrations: data.settings?.migrations || {},
    ui: { tableId, view: ui.view || 'today', hideSuggest: !!data.settings?.hideSuggest, splitDismiss: data.settings?.splitDismiss || {} },
  };
}

// Load the signed-in user's data. A brand-new account gets the old browser data (if any) or the demo data.
export async function startSession(id) {
  userId = id;
  let data = await cloud.fetchAll();
  let next;
  let imported = false;
  let fresh = !data.settings && !data.tableOrder.length;
  // Two tabs opening a new account at once must not both fill it (that duplicated everything)
  if (fresh && !(await cloud.claimInit(id))) { data = await cloud.fetchAll(); fresh = false; }
  if (fresh) {
    const legacy = readLegacy();
    imported = !!legacy;
    next = legacy ? remapIds(legacy) : seed();
    next.ui = { ...next.ui, ...(readLocalUI().view ? readLocalUI() : {}) };
    synced = { ...EMPTY(), noSettings: true };
  } else {
    next = buildState(data, readLocalUI());
    synced = { ...structuredClone(next), noSettings: !data.settings };
  }
  state = migrate(next);
  saveLocalUI();
  subs.forEach((f) => f());
  setSync({ status: 'idle', error: '' });
  schedule();
  return { imported };
}

export async function endSession() {
  if (userId) { try { await flush(); } catch {} }
  clearTimeout(timer);
  userId = null;
  state = EMPTY();
  synced = EMPTY();
  subs.forEach((f) => f());
}

// Pick up changes made from another device (only when nothing is waiting to be saved)
async function refresh() {
  if (!userId || flushing || synced !== state) return;
  try {
    const server = buildState(await cloud.fetchAll(), state.ui);
    if (synced !== state || cloud.diff(server, state).empty) return;
    if (state.brainMessage) server.brainMessage = state.brainMessage;
    state = synced = server;
    subs.forEach((f) => f());
  } catch {}
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  window.addEventListener('online', () => { if (syncState.status === 'error') flush(); });
  window.addEventListener('beforeunload', (e) => {
    if (userId && (flushing || synced !== state)) { e.preventDefault(); e.returnValue = ''; }
  });
}

// ---------- helpers ----------
const removeTableInner = (d, tableId) => {
  if (!d.tables[tableId]) return;
  Object.values(d.tasks).filter((x) => x.tableId === tableId).forEach((x) => removeTaskInner(d, x.id));
  delete d.tables[tableId];
  d.tableOrder = d.tableOrder.filter((i) => i !== tableId);
  if (d.ui.tableId === tableId) d.ui.tableId = d.tableOrder[0] || null;
};
const removeTaskInner = (d, id) => {
  const t = d.tasks[id];
  if (!t) return;
  Object.values(d.tasks).filter((x) => x.parentId === id).forEach((x) => removeTaskInner(d, x.id));
  if (t.subTableId) removeTableInner(d, t.subTableId);
  delete d.tasks[id];
  Object.values(d.tasks).forEach((x) => { x.links = x.links.filter((l) => l !== id); });
};

// ---------- actions ----------
export const actions = {
  setUI: (p) => commit((d) => Object.assign(d.ui, p)),
  addTask: (tableId, title, extra = {}) => {
    const t = newTask(tableId, title, extra);
    commit((d) => { d.tasks[t.id] = t; });
    return t.id;
  },
  updateTask: (id, p) => commit((d) => { if (d.tasks[id]) Object.assign(d.tasks[id], p); }),
  setVal: (id, col, v) => commit((d) => { if (d.tasks[id]) d.tasks[id].vals[col] = v; }),
  toggleDone: (id) => commit((d) => { if (d.tasks[id]) d.tasks[id].done = !d.tasks[id].done; }),
  deleteTask: (id) => commit((d) => removeTaskInner(d, id)),
  moveTask: (id, tableId) => commit((d) => {
    const t = d.tasks[id];
    if (!t || !d.tables[tableId] || t.tableId === tableId) return;
    const move = (x) => {
      x.tableId = tableId; x.vals = {}; x.pos = null;
      Object.values(d.tasks).filter((c) => c.parentId === x.id).forEach(move);
    };
    t.parentId = null;
    move(t);
  }),
  toggleLink: (a, b) => commit((d) => {
    if (a === b || !d.tasks[a] || !d.tasks[b]) return;
    if (d.tasks[a].links.includes(b)) d.tasks[a].links = d.tasks[a].links.filter((x) => x !== b);
    else if (d.tasks[b].links.includes(a)) d.tasks[b].links = d.tasks[b].links.filter((x) => x !== a);
    else d.tasks[a].links.push(b);
  }),
  setPos: (id, x, y) => commit((d) => { if (d.tasks[id]) d.tasks[id].pos = { x, y }; }),
  addTable: (name, emoji = '📋', parentTaskId = null) => {
    const id = uid();
    commit((d) => {
      d.tables[id] = { id, name, emoji, color: TABLE_COLORS[Object.keys(d.tables).length % TABLE_COLORS.length],
        parentTaskId, columns: [{ id: uid(), name: 'תאריך', type: 'date' }] };
      if (!parentTaskId) d.tableOrder.push(id);
      else d.tasks[parentTaskId].subTableId = id;
      d.ui.tableId = id;
      d.ui.view = 'table';
    });
    return id;
  },
  updateTable: (id, p) => commit((d) => { if (d.tables[id]) Object.assign(d.tables[id], p); }),
  deleteTable: (id) => commit((d) => {
    const t = d.tables[id];
    if (!t) return;
    const parent = t.parentTaskId ? d.tasks[t.parentTaskId] : null;
    if (parent) parent.subTableId = null;
    const back = parent ? parent.tableId : null;
    removeTableInner(d, id);
    if (back) d.ui.tableId = back;
  }),
  addColumn: (tableId, col) => commit((d) => {
    d.tables[tableId].columns.push({ id: uid(), ...(col.type === 'select' || col.type === 'tags' ? { options: [] } : {}), ...col });
  }),
  updateColumn: (tableId, colId, p) => commit((d) => {
    const c = d.tables[tableId].columns.find((x) => x.id === colId);
    if (c) Object.assign(c, p);
  }),
  addOption: (tableId, colId, { label, icon = '' }) => {
    const id = uid();
    commit((d) => {
      const c = d.tables[tableId].columns.find((x) => x.id === colId);
      if (!c) return;
      c.options = c.options || [];
      c.options.push({ id, label, icon, color: PALETTE[c.options.length % PALETTE.length] });
    });
    return id;
  },
  deleteColumn: (tableId, colId) => commit((d) => {
    d.tables[tableId].columns = d.tables[tableId].columns.filter((x) => x.id !== colId);
  }),
  exportJSON: () => JSON.stringify(state, null, 2),
  importJSON: (txt) => {
    const s = JSON.parse(txt);
    if (!s.tables || !s.tasks) throw new Error('bad file');
    const fresh = remapIds(s);
    commit((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, fresh); });
  },
  reset: () => commit((d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, seed()); }),
  dismissBrain: () => commit((d) => { delete d.brainMessage; }),
};

// ---------- Claude "brain" bridge ----------
const PROMPT_HEAD = `אני אמא עם ADHD, ואת/ה המוח החיצוני שלי לתעדוף. להלן המשימות שלי (JSON).
בבקשה:
1) בחר/י עד 3 משימות ל"מיקוד היום" (הכי חשובות והכי קלות להתחיל).
2) תני לכל משימה פתוחה עדיפות (1=דחוף, 2=חשוב, 3=אפשר לחכות).
3) משפט קצר וחם לכל משימה שמסביר למה.
4) אם משימה גדולה - הצע/י תת-משימות קטנות.
החזר/י רק JSON בפורמט הזה, בלי טקסט נוסף:
{"message":"משפט עידוד קצר","focus":["taskId"],"priorities":[{"id":"taskId","priority":1,"reason":"..."}],"newSubtasks":[{"parentId":"taskId","title":"..."}]}

`;

export function buildBrainPrompt() {
  const s = state;
  const tables = Object.fromEntries(Object.values(s.tables).map((t) => [t.id, {
    name: t.name,
    columns: t.columns.map((c) => ({ id: c.id, name: c.name, type: c.type, options: c.options?.map((o) => ({ id: o.id, label: o.label })) })),
  }]));
  const tasks = Object.values(s.tasks).map((t) => ({
    id: t.id, table: s.tables[t.tableId]?.name, parentId: t.parentId, title: t.title, done: t.done,
    isCategory: t.isGroup || undefined, inFocusToday: t.today, priority: t.priority, note: t.note || undefined, values: t.vals, linkedTo: t.links,
  }));
  return `${PROMPT_HEAD}היום: ${todayStr()}\n${JSON.stringify({ tables, tasks }, null, 1)}`;
}

export function applyBrainPlan(txt) {
  const m = txt.match(/\{[\s\S]*\}/);
  const plan = JSON.parse(m ? m[0] : txt);
  let n = 0;
  commit((d) => {
    if (Array.isArray(plan.focus)) {
      Object.values(d.tasks).forEach((t) => { t.today = false; });
      plan.focus.forEach((id) => { if (d.tasks[id]) { d.tasks[id].today = true; n++; } });
    }
    (plan.priorities || []).forEach((p) => {
      const t = d.tasks[p.id];
      if (!t) return;
      t.priority = [1, 2, 3].includes(p.priority) ? p.priority : null;
      t.reason = p.reason || '';
    });
    (plan.newSubtasks || []).forEach((s) => {
      const par = d.tasks[s.parentId];
      if (!par || !s.title) return;
      const t = newTask(par.tableId, s.title, { parentId: par.id });
      d.tasks[t.id] = t;
    });
    d.brainMessage = plan.message || '';
  });
  return { message: plan.message || '', focus: n };
}

// ---------- task icons ----------
const ICON_RULES = [
  [['בריאות', 'רפואי', 'רפואה'], '🩺'],
  [['עבודה', 'קריירה', 'לקוחות'], '💼'],
  [['תחזוקה', 'תיקונים'], '🔧'],
  [['משפחה', 'משפחת'], '👨‍👩‍👧'],
  [['בשבילי', 'אישי', 'לעצמי'], '🌸'],
  [['מטפל', 'פסיכולוג', 'טיפול רגשי', 'ייעוץ', 'יועצ'], '💬'],
  [['תוכנה', 'פיתוח', 'קוד', 'תכנות', 'באג', 'אפליקצי', 'אתר'], '💻'],
  [['טופס', 'מסמך', 'אישור', 'ביטוח', 'משרד הפנים', 'רשות', 'מכתב', 'חתימה', 'ביטוח לאומי'], '📄'],
  [['שיער', 'מספרה', 'מניקור', 'פדיקור', 'קוסמטיקאית', 'איפור', 'ציפורניים'], '💇‍♀️'],
  [['מדיטצי', 'נשימות', 'להתקלח', 'מקלחת', 'אמבטיה', 'זמן לעצמי', 'להירגע', 'רגיעה'], '🧘‍♀️'],
  [['כסף', 'הלוואה', 'תקציב', 'חיסכון', 'משכורת', 'החזר'], '💰'],
  [['דירה', 'שכירות', 'בעל הבית', 'מעבר דירה', 'משכנתא'], '🏠'],
  [['חברה', 'חברים', 'להיפגש', 'לפגוש', 'קפה עם', 'בילוי', 'מפגש'], '☕'],
  [['חתונה', 'אירוע', 'אזכרה', 'לחגוג', 'שמחה'], '🎉'],
  [['סרט', 'סדרה', 'לצפות', 'נטפליקס', 'הצגה', 'קולנוע'], '🎬'],
  [['מוזיקה', 'לנגן', 'פסנתר', 'גיטרה', 'שיר '], '🎵'],
  [['צמח', 'גינה', 'להשקות', 'פרחים'], '🌱'],
  [['תינוק', 'חיתול', 'האכלה', 'עגלה'], '🍼'],
  [['דואר', 'חבילה', 'לשלוח', 'משלוח', 'להחזיר'], '📦'],
  [['לתכנן', 'תכנון', 'לחשוב על', 'רעיון'], '💡'],
  [['רופא', 'תור', 'חיסון', 'בדיקה', 'תרופ', 'שיניים', 'מרפאה'], '🩺'],
  [['כביסה', 'לכבס', 'גיהוץ'], '🧺'],
  [['כלים', 'מטבח', 'לבשל', 'ארוחה', 'אוכל', 'ארוחת'], '🍽️'],
  [['קניות', 'סופר', 'לקנות', 'שוק', 'מכולת'], '🛒'],
  [['ניקי', 'לנקות', 'שואב', 'לסדר', 'סדר '], '🧹'],
  [['חשבון', 'לשלם', 'תשלום', 'ארנונה', 'חשמל', 'מים', 'בנק', 'משכנתא'], '💳'],
  [['מייל', 'אימייל', 'לענות', 'הודעה', 'וואטסאפ'], '✉️'],
  [['טלפון', 'להתקשר', 'שיחה', 'לחזור ל'], '📞'],
  [['יום הולדת', 'מסיבה', 'עוגה', 'אירוח', 'חג', 'מתנה'], '🎂'],
  [['גן', 'בית ספר', 'שיעורי', 'מורה', 'הורים', 'ילד', 'חוג'], '🎒'],
  [['ספורט', 'אימון', 'כושר', 'ריצה', 'הליכה', 'יוגה'], '💪'],
  [['פגישה', 'ישיבה', 'זום', 'הצעת', 'לקוח', 'פרויקט', 'דוח'], '💼'],
  [['חתול', 'חתולה', 'חתולים', 'גור חתולים'], '🐱'],
  [['כלב', 'כלבה', 'כלבים', 'לטייל עם הכלב'], '🐶'],
  [['ארנב'], '🐰'],
  [['דגים', 'אקווריום', 'דג '], '🐠'],
  [['ציפור', 'תוכי', 'קנרית'], '🐦'],
  [['סוס', 'רכיבה'], '🐴'],
  [['וטרינר', 'חיית', 'חיות'], '🐾'],
  [['נסיעה', 'טיסה', 'חופשה', 'מלון', 'טיול'], '✈️'],
  [['רכב', 'מוסך', 'טסט', 'דלק'], '🚗'],
  [['לישון', 'שינה', 'מנוחה'], '😴'],
  [['ללמוד', 'קורס', 'לקרוא', 'ספר', 'מבחן', 'בחינה', 'שיעור', 'תואר', 'לימודים'], '📚'],
  [['שמיכ', 'ארון', 'תיקון', 'לתקן', 'מנעול', 'ברז', 'נזילה', 'חשמלאי', 'שרברב'], '🔧'],
  [['לבדוק', 'לברר', 'לחפש', 'מציאת', 'להשוות'], '🔍'],
];
export const guessIcon = (title = '') => {
  const t = title.toLowerCase();
  for (const [words, icon] of ICON_RULES) if (words.some((w) => t.includes(w))) return icon;
  return '📝';
};
export const taskIcon = (t) => t.icon || guessIcon(t.title);
// Categories: automatic icon from the name ('' or the old default 📁 means automatic), 📁 when nothing matches
export const autoGroupIcon = (title = '') => { const g = guessIcon(title); return g === '📝' ? '🏷️' : g; };
export const autoOptionIcon = (label = '') => { const g = guessIcon(label); return g === '📝' ? '' : g; };
export const groupIcon = (g) => (g.icon && g.icon !== '📁' ? g.icon : autoGroupIcon(g.title));

// ---------- categories (groups): infinite nesting via parentId ----------
// Suggest a split once a place holds 5 or more direct tasks
export const SPLIT_LIMIT = 4;

export const descendantIds = (st, id) => {
  const out = [];
  const walk = (p) => Object.values(st.tasks).forEach((t) => { if (t.parentId === p) { out.push(t.id); walk(t.id); } });
  walk(id);
  return out;
};

// Groups of a table as a flat, indented list (for "move into" selects)
export const groupOptions = (st, tableId, excludeId = null) => {
  const skip = new Set(excludeId ? [excludeId, ...descendantIds(st, excludeId)] : []);
  const out = [];
  const walk = (parent, depth) =>
    Object.values(st.tasks)
      .filter((t) => t.tableId === tableId && t.isGroup && (t.parentId || null) === parent && !skip.has(t.id))
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((g) => { out.push({ id: g.id, label: `${'– '.repeat(depth)}${groupIcon(g)} ${g.title}` }); walk(g.id, depth + 1); });
  walk(null, 0);
  return out;
};

// Places (list root or a category) that hold more than SPLIT_LIMIT direct tasks
export const overloaded = (st, tableId) => {
  const counts = {};
  Object.values(st.tasks).forEach((t) => {
    if (t.tableId !== tableId || t.isGroup) return;
    const p = st.tasks[t.parentId];
    if (t.parentId && !(p && p.isGroup)) return; // subtasks of a task don't count
    const k = t.parentId || `root:${tableId}`;
    counts[k] = (counts[k] || 0) + 1;
  });
  return Object.entries(counts)
    .filter(([k, n]) => n > SPLIT_LIMIT && n > ((st.ui.splitDismiss || {})[k] || 0))
    .map(([k, n]) => {
      const parentId = k.startsWith('root:') ? null : k;
      return { key: k, parentId, count: n, name: parentId ? st.tasks[parentId].title : st.tables[tableId].name };
    });
};

const directTasks = (st, tableId, parentId) =>
  Object.values(st.tasks).filter((t) => t.tableId === tableId && !t.isGroup && (t.parentId || null) === (parentId || null));

Object.assign(actions, {
  addGroup: (tableId, parentId = null, title = 'קטגוריה חדשה', icon = '') => {
    const g = newTask(tableId, title, { parentId, isGroup: true, icon, gCollapsed: false, collapsed: false });
    commit((d) => { d.tasks[g.id] = g; });
    return g.id;
  },
  // delete the category but keep what's inside (moves up one level)
  ungroup: (id) => commit((d) => {
    const g = d.tasks[id];
    if (!g) return;
    Object.values(d.tasks).forEach((x) => { if (x.parentId === id) x.parentId = g.parentId; x.links = x.links.filter((l) => l !== id); });
    delete d.tasks[id];
  }),
  reparent: (id, parentId) => commit((d) => {
    const t = d.tasks[id];
    if (!t) return;
    if (parentId) {
      for (let p = d.tasks[parentId]; p; p = d.tasks[p.parentId]) if (p.id === id) return; // no cycles
      if (!d.tasks[parentId] || d.tasks[parentId].tableId !== t.tableId) return;
    }
    t.parentId = parentId || null;
  }),
  applySplit: (tableId, parentId, groups) => commit((d) => {
    groups.forEach((g) => {
      const ids = g.taskIds.filter((id) => d.tasks[id]);
      if (!g.title.trim() || !ids.length) return;
      const n = newTask(tableId, g.title.trim(), { parentId: parentId || null, isGroup: true, icon: g.icon || '', gCollapsed: true });
      d.tasks[n.id] = n;
      ids.forEach((id) => { d.tasks[id].parentId = n.id; });
    });
  }),
  setGroupsCollapsed: (tableId, v) => commit((d) => {
    Object.values(d.tasks).forEach((t) => { if (t.tableId === tableId && t.isGroup) t.gCollapsed = v; });
  }),
  resetLayout: (tableId) => commit((d) => {
    Object.values(d.tasks).forEach((t) => { if (t.tableId === tableId) t.pos = null; });
  }),
  dismissSplit: (key, count) => commit((d) => { d.ui.splitDismiss = { ...(d.ui.splitDismiss || {}), [key]: count }; }),
});

export function buildSplitPrompt(tableId, parentId) {
  const s = state;
  const where = parentId ? s.tasks[parentId].title : s.tables[tableId].name;
  const items = directTasks(s, tableId, parentId).map((t) => ({ id: t.id, title: t.title, note: t.note || undefined, done: t.done }));
  const existing = Object.values(s.tasks).filter((t) => t.tableId === tableId && t.isGroup && (t.parentId || null) === (parentId || null)).map((t) => t.title);
  return `אני אמא עם ADHD, ויש לי יותר מדי משימות בקטגוריה "${where}". עזרי לי לפצל אותן לבדיוק 2 קטגוריות חדשות לפי נושא או הקשר (למשל "פיתוח תוכנה" או "מציאת מטפלת"), כדי שיהיה קל לראות כל פעם רק מעט דברים.
כללים: כל משימה בקטגוריה אחת בלבד. שמות קצרים בעברית (1-3 מילים). אימוג'י אחד מתאים לכל קטגוריה. כל המשימות צריכות להשתייך לאחת משתי הקטגוריות. אל תשני את הכותרות של המשימות.${existing.length ? `\nקטגוריות שכבר קיימות באותו מקום (אפשר לא לחזור עליהן): ${existing.join(', ')}` : ''}
החזירי רק JSON בפורמט הזה, בלי טקסט נוסף:
{"groups":[{"title":"שם הקטגוריה","icon":"😀","taskIds":["id"]}]}

המשימות:
${JSON.stringify(items, null, 1)}`;
}

export function parseSplit(txt, tableId, parentId) {
  const m = txt.match(/\{[\s\S]*\}/);
  const plan = JSON.parse(m ? m[0] : txt);
  const valid = new Set(directTasks(state, tableId, parentId).map((t) => t.id));
  const used = new Set();
  const groups = (plan.groups || []).map((g) => ({
    title: String(g.title || '').trim(),
    icon: g.icon || '',
    taskIds: (g.taskIds || []).filter((id) => valid.has(id) && !used.has(id) && used.add(id)),
  })).filter((g) => g.title && g.taskIds.length);
  if (!groups.length) throw new Error('empty');
  return groups;
}
