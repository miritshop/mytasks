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
// kind: what the user chose. eff: the time bucket the task falls in today:
//   'today' | 'week' | 'next' | 'soon' | 'date' | null
// overdue: the chosen time has passed and the task is not done.
// dateText: the target date to show next to "next week" / "soon" (they carry a real date, see whenFields).
// rank: for sorting, smaller = more pressing (0 overdue, 1 today, 2 this week, 3 next week, 4 later, 5 none).
export function whenInfo(t, today = todayStr()) {
  const none = { kind: null, eff: null, label: '', emoji: '', overdue: false, rank: 5, dateText: '' };
  const kind = t.whenKind;
  if (!kind) return none;
  const done = !!t.done;
  const thisWeek = weekStart(today);
  const nextWeek = addDays(thisWeek, 7);
  const make = (eff, label, emoji, overdue, rank, dateText = '') =>
    ({ kind, eff, label, emoji, overdue: overdue && !done, rank: overdue && !done ? 0 : rank, dateText });

  if (kind === 'today') {
    const anchor = t.whenDate || today;
    return make('today', 'היום', '☀️', anchor < today, 1);
  }

  // "this week" remembers the day it was chosen and ends on that week's Saturday
  if (kind === 'week') {
    const anchor = t.whenDate || today;
    const period = weekStart(anchor);
    if (period < thisWeek) return make('week', 'השבוע', '📅', true, 2);
    return make('week', 'השבוע', '📅', false, 2);
  }

  // everything else carries a target date: a chosen date, or "next week" (+7 days) / "soon" (+14 days)
  const target = kind === 'date' ? t.whenDate
    : kind === 'next' ? (t.whenDate || addDays(today, 7))
    : kind === 'soon' ? (t.whenDate || addDays(today, 14)) : null;
  if (!target) return none;
  const shown = kind === 'date' ? '' : shortDate(target);
  const own = kind === 'next' ? ['בשבוע הבא', '⏭️'] : kind === 'soon' ? ['בקרוב', '🔜'] : [shortDate(target), '🗓️'];

  if (target < today) return make('date', own[0], own[1], true, 2, shown);
  if (target === today) return make('today', 'היום', '☀️', false, 1);
  const ws = weekStart(target);
  if (ws === thisWeek) return kind === 'date' ? make('week', own[0], own[1], false, 2) : make('week', 'השבוע', '📅', false, 2, shown);
  if (ws === nextWeek) return make('next', own[0], own[1], false, 3, shown);
  return make('date', own[0], own[1], false, 4, shown);
}

// Which fields to store when the user picks a "when". kind null clears it.
// "next week" gets a date a week from today, "soon" a date two weeks from today (they can be edited afterwards).
export function whenFields(kind, date, today = todayStr()) {
  if (!kind) return { whenKind: null, whenDate: null, today: false };
  if (kind === 'date') return { whenKind: 'date', whenDate: date || today, today: false };
  if (kind === 'next') return { whenKind: 'next', whenDate: addDays(today, 7), today: false };
  if (kind === 'soon') return { whenKind: 'soon', whenDate: addDays(today, 14), today: false };
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
  if (key === 'soon') return t.whenKind === 'soon';
  return false;
}
