import React, { useEffect, useRef, useState } from 'react';
import { actions, useStore, guessIcon, descendantIds, autoGroupIcon } from './store.js';
import { resolveDrop } from './dnd.js';
import { Check, Cell, ColumnModal, PriorityCell, EstimateCell, WhenCell, IconPicker, AiMark, hasAi } from './components.jsx';

export default function TableView({ tableId, openTask, onSplit, onAi }) {
  const s = useStore();
  const table = s.tables[tableId];
  const [title, setTitle] = useState('');
  const [colModal, setColModal] = useState(null); // null | 'new' | column

  // ---- drag and drop (pointer based, so it works with a mouse and with a finger) ----
  const [drag, setDrag] = useState(null); // { id, sx, sy, x, y, started, overId }
  const dragRef = useRef(null);
  const tasksRef = useRef(s.tasks);
  tasksRef.current = s.tasks;
  const setDragBoth = (d) => { dragRef.current = d; setDrag(d); };
  const startDrag = (e, id) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    setDragBoth({ id, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, started: false, overId: null });
  };
  useEffect(() => {
    if (!drag) return undefined;
    const content = document.querySelector('.content');
    let lastY = 0;
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const started = d.started || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6; // small moves are just clicks
      const el = started ? document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-rowid],[data-rootzone]') : null;
      const overId = el ? (el.dataset.rootzone !== undefined ? 'root' : el.dataset.rowid) : null;
      lastY = e.clientY;
      setDragBoth({ ...d, x: e.clientX, y: e.clientY, started, overId });
    };
    const up = () => {
      const d = dragRef.current;
      if (d?.started && d.overId) {
        const r = resolveDrop(tasksRef.current, d.id, d.overId);
        if (r.ok && !r.noop) {
          actions.reparent(d.id, r.parentId);
          if (r.parentId) actions.updateTask(r.parentId, { collapsed: false }); // open the folder so the result is visible
        }
      }
      setDragBoth(null);
    };
    const cancel = () => setDragBoth(null);
    const esc = (e) => { if (e.key === 'Escape') setDragBoth(null); };
    const scroller = setInterval(() => { // scroll when the pointer is near the top or bottom edge
      if (!content || !dragRef.current?.started) return;
      if (lastY < 90) content.scrollBy(0, -14); else if (lastY > window.innerHeight - 90) content.scrollBy(0, 14);
    }, 30);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', esc);
    document.body.classList.add('is-dragging');
    return () => {
      clearInterval(scroller);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', esc);
      document.body.classList.remove('is-dragging');
    };
  }, [!!drag]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!table) return null;

  const dropRes = drag?.started && drag.overId ? resolveDrop(s.tasks, drag.id, drag.overId) : null;
  const destId = dropRes?.ok && !dropRes.noop ? dropRes.parentId : undefined; // undefined: nowhere valid, null: main list
  const destName = destId === undefined ? '' : destId === null ? 'הרשימה הראשית' : s.tasks[destId]?.title || '';
  const dragged = drag?.started ? s.tasks[drag.id] : null;
  const rowCls = (id, base = '') => [base,
    dragged && drag.id === id ? 'dragging-row' : '',
    destId === id ? 'drop-dest' : '',
    dropRes && !dropRes.ok && drag.overId === id ? 'drop-bad' : ''].filter(Boolean).join(' ');
  const handle = (id) => <span className="drag-handle" title="גרירה להעברה" onPointerDown={(e) => startDrag(e, id)}>⠿</span>;

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
          <tr className={rowCls(t.id, 'group-row')} data-rowid={t.id}>
            <td colSpan={table.columns.length + 5} style={pad}>
              <div className="row">
                {handle(t.id)}
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
        <tr className={rowCls(t.id, t.done ? 'done' : '')} data-rowid={t.id}>
          <td className="title-cell" style={pad}>
            <div className="row">
              {handle(t.id)}
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
      {dragged && (
        <>
          <div className={`root-zone ${destId === null ? 'active' : ''} ${dropRes && !dropRes.ok && drag.overId === 'root' ? 'bad' : ''}`} data-rootzone>
            ⬆ שחררי כאן כדי להוציא מתיקייה (לרשימה הראשית)
          </div>
          <div className={`drag-ghost ${dropRes && !dropRes.ok ? 'bad' : ''}`} style={{ left: drag.x + 14, top: drag.y + 14 }}>
            {dragged.isGroup ? '📁' : '📝'} {dragged.title}
            {destId !== undefined && <b> ← {destName}</b>}
            {dropRes && !dropRes.ok && <b> ✕</b>}
          </div>
        </>
      )}
      {colModal && <ColumnModal table={table} col={colModal === 'new' ? null : colModal} onClose={() => setColModal(null)} />}
    </div>
  );
}
