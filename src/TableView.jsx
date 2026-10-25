import React, { useState } from 'react';
import { actions, useStore, guessIcon, descendantIds, autoGroupIcon } from './store.js';
import { Check, Cell, ColumnModal, PriorityCell, EstimateCell, WhenCell, IconPicker, AiMark, hasAi } from './components.jsx';

export default function TableView({ tableId, openTask, onSplit, onAi }) {
  const s = useStore();
  const table = s.tables[tableId];
  const [title, setTitle] = useState('');
  const [colModal, setColModal] = useState(null); // null | 'new' | column
  if (!table) return null;

  const all = Object.values(s.tasks).filter((t) => t.tableId === tableId);
  // categories first, then tasks, each in creation order
  const kidsOf = (id) => all
    .filter((t) => (t.parentId || null) === id)
    .sort((a, b) => (b.isGroup ? 1 : 0) - (a.isGroup ? 1 : 0) || a.createdAt - b.createdAt);

  const add = () => {
    if (!title.trim()) return;
    actions.addTask(tableId, title.trim());
    setTitle('');
  };
  const addGroup = () => openTask(actions.addGroup(tableId, null));

  // Plain function (not a component) so inputs keep focus while typing
  const renderNode = (t, depth) => {
    const kids = kidsOf(t.id);
    const pad = { paddingInlineStart: 12 + depth * 24 };
    if (t.isGroup) {
      const tasks = descendantIds(s, t.id).map((i) => s.tasks[i]).filter((x) => !x.isGroup);
      const done = tasks.filter((x) => x.done).length;
      return (
        <React.Fragment key={t.id}>
          <tr className="group-row">
            <td colSpan={table.columns.length + 5} style={pad}>
              <div className="row">
                <button className="mini" title={t.collapsed ? 'פתח' : 'סגור'} onClick={() => actions.updateTask(t.id, { collapsed: !t.collapsed })}>{t.collapsed ? '◂' : '▾'}</button>
                <span className="folder" title="קטגוריה">📁</span>
                <IconPicker value={t.icon === '📁' ? '' : t.icon} auto={autoGroupIcon(t.title)} onChange={(i) => actions.updateTask(t.id, { icon: i })} />
                <input className="cell-input title group-title" value={t.title} onChange={(e) => actions.updateTask(t.id, { title: e.target.value })} />
                <span className="count">{done}/{tasks.length}</span>
                <button className="mini" title="הוסף משימה לקטגוריה" onClick={() => openTask(actions.addTask(tableId, 'משימה חדשה', { parentId: t.id }))}>＋</button>
                <button className="mini" title="עריכת קטגוריה" onClick={() => openTask(t.id)}>⋯</button>
              </div>
            </td>
          </tr>
          {!t.collapsed && kids.map((k) => renderNode(k, depth + 1))}
        </React.Fragment>
      );
    }
    return (
      <React.Fragment key={t.id}>
        <tr className={t.done ? 'done' : ''}>
          <td className="title-cell" style={pad}>
            <div className="row">
              <Check done={t.done} onChange={() => actions.toggleDone(t.id)} />
              <IconPicker value={t.icon} auto={guessIcon(t.title)} onChange={(i) => actions.updateTask(t.id, { icon: i })} />
              <input className="cell-input title" value={t.title} onChange={(e) => actions.updateTask(t.id, { title: e.target.value })} />
              {t.subTableId && (
                <button className="mini" title="פתח טבלה" onClick={() => actions.setUI({ tableId: t.subTableId })}>📂</button>
              )}
              {t.ai?.parent && <AiMark title="הועברה לקטגוריה על ידי AI" />}
              {hasAi(t) && <button className="mini approve" title="אישור כל הערכים שהציע ה-AI" onClick={() => actions.approveAi(t.id)}>✓</button>}
              <button className="mini" title="פרטים" onClick={() => openTask(t.id)}>⋯</button>
            </div>
          </td>
          <td><WhenCell task={t} /></td>
          <td><PriorityCell task={t} /></td>
          <td><EstimateCell task={t} /></td>
          {table.columns.map((c) => <td key={c.id}><Cell col={c} task={t} /></td>)}
          <td />
        </tr>
        {kids.map((k) => renderNode(k, depth + 1))}
      </React.Fragment>
    );
  };

  const roots = kidsOf(null);
  return (
    <div className="table-wrap">
      {onAi && <div className="table-tools"><button className="btn soft small" onClick={onAi}>✨ הצעות AI</button></div>}
      <table className="grid">
        <thead>
          <tr>
            <th className="title-cell">משימה</th>
            <th>מתי</th>
            <th>עדיפות</th>
            <th>זמן</th>
            {table.columns.map((c) => (
              <th key={c.id}><button className="th-btn" onClick={() => setColModal(c)}>{c.name} <span>▾</span></button></th>
            ))}
            <th className="add-col"><button className="mini" title="עמודה חדשה" onClick={() => setColModal('new')}>＋</button></th>
          </tr>
        </thead>
        <tbody>
          {roots.map((t) => renderNode(t, 0))}
          <tr>
            <td colSpan={table.columns.length + 5}>
              <div className="row add-row">
                <span className="plus">＋</span>
                <input value={title} placeholder="משימה חדשה… (Enter להוספה)" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
                <button className="btn soft small" onClick={addGroup}>📁 קטגוריה</button>
                {onSplit && roots.filter((r) => !r.isGroup).length >= 2 && <button className="btn soft small" onClick={() => onSplit(null)}>🧩 פצלי</button>}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      {roots.length === 0 && <p className="empty">אין עדיין משימות. התחילי מהשורה למעלה 🌱</p>}
      {colModal && <ColumnModal table={table} col={colModal === 'new' ? null : colModal} onClose={() => setColModal(null)} />}
    </div>
  );
}
