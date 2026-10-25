// The "when" field of a task: today · this week · next week · soon · a specific date.
// Pure date logic (no React, no database) so it can be tested on its own.
// Weeks run Sunday to Saturday (Israel). A relative choice ("this week") is remembered together with the
// day it was chosen (whenDate), so that later we can tell when it has run out.

export const WHEN_KINDS = [
  ['today', 'היום', '☀️'],
  ['week', 'השבוע', '📅'],
  ['next', 'בשבוע הבא', '⏭️'],
  ['soon', 'בקרוב', '🔜'],
];

const pad = (n) => String(n).padStart(2, '0');
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayStr = () => fmt(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
export const weekStart = (s) => { const d = parse(s); d.setDate(d.getDate() - d.getDay()); return fmt(d); }; // the Sunday

const shortDate = (s) => { const [, m, d] = s.split('-'); return `${+d}/${+m}`; };

// What a task's "when" means right now.
// eff: 'today' | 'week' | 'next' | 'soon' | 'date' | null   (the effective period, relative to today)
// overdue: the chosen period has passed and the task is not done
// rank: for sorting, smaller = more pressing (0 overdue, 1 today, 2 this week, 3 next week, 4 later/soon, 5 none)
export function whenInfo(t, today = todayStr()) {
  const none = { kind: null, eff: null, label: '', emoji: '', overdue: false, rank: 5 };
  const kind = t.whenKind;
  if (!kind) return none;
  const done = !!t.done;
  const thisWeek = weekStart(today);
  const nextWeek = addDays(thisWeek, 7);
  const make = (eff, label, emoji, overdue, rank) => ({ kind, eff, label, emoji, overdue: overdue && !done, rank: overdue && !done ? 0 : rank });

  if (kind === 'soon') return make('soon', 'בקרוב', '🔜', false, 4);

  if (kind === 'today') {
    const anchor = t.whenDate || today;
    return anchor < today ? make('today', 'היום', '☀️', true, 1) : make('today', 'היום', '☀️', false, 1);
  }

  if (kind === 'week' || kind === 'next') {
    const anchor = t.whenDate || today;
    const period = kind === 'week' ? weekStart(anchor) : addDays(weekStart(anchor), 7);
    if (period < thisWeek) return make(kind === 'week' ? 'week' : 'next', kind === 'week' ? 'השבוע' : 'בשבוע הבא', kind === 'week' ? '📅' : '⏭️', true, 2);
    if (period === thisWeek) return make('week', 'השבוע', '📅', false, 2); // "next week" has rolled into the current week
    return make('next', 'בשבוע הבא', '⏭️', false, 3);
  }

  if (kind === 'date' && t.whenDate) {
    const d = t.whenDate;
    if (d < today) return make('date', shortDate(d), '🗓️', true, 2);
    if (d === today) return make('today', 'היום', '☀️', false, 1);
    if (weekStart(d) === thisWeek) return make('week', shortDate(d), '🗓️', false, 2);
    if (weekStart(d) === nextWeek) return make('next', shortDate(d), '🗓️', false, 3);
    return make('date', shortDate(d), '🗓️', false, 4);
  }
  return none;
}

// Which fields to store when the user picks a "when". kind null clears it.
export function whenFields(kind, date, today = todayStr()) {
  if (!kind) return { whenKind: null, whenDate: null, today: false };
  if (kind === 'date') return { whenKind: 'date', whenDate: date || today, today: false };
  if (kind === 'soon') return { whenKind: 'soon', whenDate: null, today: false };
  return { whenKind: kind, whenDate: today, today: kind === 'today' };
}

// Filter chips: 'today' | 'week' (today included) | 'next' | 'soon' | 'overdue' | 'none'
export function matchesWhen(t, key, today = todayStr()) {
  const i = whenInfo(t, today);
  if (key === 'none') return !t.whenKind;
  if (key === 'overdue') return i.overdue;
  if (i.overdue) return false;
  if (key === 'today') return i.eff === 'today';
  if (key === 'week') return i.eff === 'today' || i.eff === 'week';
  if (key === 'next') return i.eff === 'next';
  if (key === 'soon') return i.eff === 'soon';
  return false;
}
