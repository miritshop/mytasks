import React, { useState } from 'react';
import { actions, useStore, taskIcon } from './store.js';
import { Check, PriorityBadge, PRIORITY } from './components.jsx';

// Filter every task across all lists/categories by priority, status (select columns), tags and text.
// Select columns and tag columns belong to a single list, so they are matched by column name + option label.

const optText = (o) => `${o.icon ? `${o.icon} ` : ''}${o.label}`;

// distinct "filter groups": one per select/tags column name, with the union of option labels
function buildGroups(s, scope) {
  const groups = {};
  Object.values(s.tables).forEach((t) => {
    if (scope !== 'all' && t.id !== scope) return;
    t.columns.forEach((c) => {
      if (c.type !== 'select' && c.type !== 'tags') return;
      const key = `${c.type}:${c.name}`;
      const g = (groups[key] = groups[key] || { key, name: c.name, type: c.type, options: {} });
      (c.options || []).forEach((o) => { if (!g.options[o.label]) g.options[o.label] = o; });
    });
  });
  return Object.values(groups);
}

// labels a task holds for a given group
function taskLabels(s, task, group) {
  const table = s.tables[task.tableId];
  const col = table?.columns.find((c) => c.type === group.type && c.name === group.name);
  if (!col) return [];
  const v = task.vals[col.id];
  const ids = col.type === 'tags' ? (Array.isArray(v) ? v : []) : v ? [v] : [];
  return ids.map((id) => (col.options || []).find((o) => o.id === id)).filter(Boolean);
}

const pathOf = (s, task) => {
  const parts = [];
  for (let p = s.tasks[task.parentId]; p; p = s.tasks[p.parentId]) parts.unshift(`${p.isGroup ? '📁 ' : ''}${p.title}`);
  const t = s.tables[task.tableId];
  return [`${t.emoji} ${t.name}`, ...parts].join(' › ');
};

export default function FilterView({ openTask }) {
  const s = useStore();
  const [scope, setScope] = useState('all');
  const [prio, setPrio] = useState([]); // 1 | 2 | 3 | 0 (= none)
  const [pick, setPick] = useState({}); // groupKey -> [labels]
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);

  const groups = buildGroups(s, scope);
  const toggle = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const active = prio.length + Object.values(pick).reduce((n, a) => n + a.length, 0) + (q.trim() ? 1 : 0);
  const clear = () => { setPrio([]); setPick({}); setQ(''); };

  const results = Object.values(s.tasks)
    .filter((t) => !t.isGroup && (scope === 'all' || t.tableId === scope) && (showDone || !t.done))
    .filter((t) => !prio.length || prio.includes(t.priority || 0))
    .filter((t) => groups.every((g) => {
      const want = pick[g.key] || [];
      return !want.length || taskLabels(s, t, g).some((o) => want.includes(o.label));
    }))
    .filter((t) => !q.trim() || t.title.includes(q.trim()))
    .sort((a, b) => (a.priority || 9) - (b.priority || 9) || a.createdAt - b.createdAt);

  const chip = (on, label, onClick, style) => (
    <button className={`chip ${on ? 'on' : ''}`} style={on ? style : undefined} onClick={onClick}>{label}</button>
  );

  return (
    <div className="filter-view">
      <div className="filter-panel">
        <div className="row wrap">
          <input className="search" value={q} placeholder="🔎 חיפוש לפי מילה…" onChange={(e) => setQ(e.target.value)} />
          <select className="list-select" value={scope} onChange={(e) => { setScope(e.target.value); setPick({}); }}>
            <option value="all">כל הרשימות</option>
            {s.tableOrder.map((id) => <option key={id} value={id}>{s.tables[id].emoji} {s.tables[id].name}</option>)}
          </select>
        </div>

        <div className="fgroup">
          <b>עדיפות</b>
          <div className="chips">
            {[1, 2, 3].map((p) => chip(prio.includes(p), PRIORITY[p].label, () => setPrio(toggle(prio, p))))}
            {chip(prio.includes(0), 'ללא עדיפות', () => setPrio(toggle(prio, 0)))}
          </div>
        </div>

        {groups.map((g) => (
          <div className="fgroup" key={g.key}>
            <b>{g.type === 'tags' ? '🏷️ ' : ''}{g.name}</b>
            <div className="chips">
              {Object.values(g.options).map((o) => chip((pick[g.key] || []).includes(o.label), optText(o),
                () => setPick({ ...pick, [g.key]: toggle(pick[g.key] || [], o.label) }), { background: o.color, color: '#3a3550' }))}
              {!Object.keys(g.options).length && <span className="hint">עדיין אין אפשרויות</span>}
            </div>
          </div>
        ))}

        <div className="row wrap">
          <label className="row show-done"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> כולל משימות שהושלמו</label>
          <span className="grow" />
          {active > 0 && <button className="link" onClick={clear}>נקי הכל</button>}
        </div>
      </div>

      <h2 className="result-count">{results.length} משימות</h2>
      <div className="stack">
        {results.map((t) => (
          <div className={`result-card ${t.done ? 'done' : ''}`} key={t.id} onClick={() => openTask(t.id)}>
            <Check done={t.done} onChange={() => actions.toggleDone(t.id)} />
            <span className="res-icon">{taskIcon(t)}</span>
            <div className="grow">
              <div className="res-title">{t.title}</div>
              <div className="meta">
                <span>{pathOf(s, t)}</span>
                <PriorityBadge p={t.priority} />
                {buildGroups(s, t.tableId).flatMap((g) => taskLabels(s, t, g).map((o) => (
                  <span key={g.key + o.id} className="tag" style={{ background: o.color }}>{optText(o)}</span>
                )))}
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 && <p className="empty">{active ? 'אין משימות שמתאימות לסינון הזה.' : 'אין משימות פתוחות.'}</p>}
      </div>
    </div>
  );
}
