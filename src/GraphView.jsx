import React, { useRef, useState } from 'react';
import { actions, useStore, taskIcon, groupIcon, descendantIds } from './store.js';
import { Check, PriorityBadge } from './components.jsx';

const W = 190, H = 64, GAP_X = 260, GAP_Y = 88;

function edgePath(a, b) {
  const ac = { x: a.x + W / 2, y: a.y + H / 2 }, bc = { x: b.x + W / 2, y: b.y + H / 2 };
  const dx = bc.x - ac.x, dy = bc.y - ac.y;
  let p1, p2, c1, c2;
  if (Math.abs(dx) * 0.5 > Math.abs(dy)) {
    const r = dx > 0;
    p1 = { x: r ? a.x + W : a.x, y: ac.y }; p2 = { x: r ? b.x : b.x + W, y: bc.y };
    c1 = { x: (p1.x + p2.x) / 2, y: p1.y }; c2 = { x: (p1.x + p2.x) / 2, y: p2.y };
  } else {
    const d = dy > 0;
    p1 = { x: ac.x, y: d ? a.y + H : a.y }; p2 = { x: bc.x, y: d ? b.y : b.y + H };
    c1 = { x: p1.x, y: (p1.y + p2.y) / 2 }; c2 = { x: p2.x, y: (p1.y + p2.y) / 2 };
  }
  return `M${p1.x},${p1.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
}

export default function GraphView({ tableId, openTask }) {
  const s = useStore();
  const table = s.tables[tableId];
  const [drag, setDrag] = useState(null); // {id, x, y}
  const [linkFrom, setLinkFrom] = useState(null);
  const start = useRef(null);
  if (!table) return null;

  const tasks = Object.values(s.tasks).filter((t) => t.tableId === tableId);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const kids = (key) => tasks
    .filter((t) => (t.parentId || 'root') === key)
    .sort((a, b) => (b.isGroup ? 1 : 0) - (a.isGroup ? 1 : 0) || a.createdAt - b.createdAt);

  // Tidy tree layout: collapsed categories hide everything beneath them
  const auto = {};
  const visible = [];
  let leaf = 0;
  const place = (key, depth) => {
    const t = byId[key];
    const list = t && t.isGroup && t.gCollapsed ? [] : kids(key);
    let y;
    if (!list.length) y = leaf++;
    else { const ys = list.map((c) => place(c.id, depth + 1)); y = (ys[0] + ys[ys.length - 1]) / 2; }
    if (t) visible.push(t);
    auto[key] = { x: 40 + depth * GAP_X, y: 40 + y * GAP_Y };
    return y;
  };
  place('root', 0);

  const pos = { root: auto.root };
  visible.forEach((t) => { pos[t.id] = drag && drag.id === t.id ? drag : t.pos || auto[t.id]; });
  const maxX = Math.max(800, ...Object.values(pos).map((p) => p.x + W + 120));
  const maxY = Math.max(500, ...Object.values(pos).map((p) => p.y + H + 120));
  const hiddenCount = (t) => descendantIds(s, t.id).filter((i) => !s.tasks[i].isGroup).length;

  const onDown = (e, t) => {
    if (e.target.closest('button, .check')) return;
    if (linkFrom) { actions.toggleLink(linkFrom, t.id); setLinkFrom(null); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: pos[t.id].x, y: pos[t.id].y, moved: false };
    setDrag({ id: t.id, x: pos[t.id].x, y: pos[t.id].y });
  };
  const onMove = (e, t) => {
    const st = start.current;
    if (!st || !drag || drag.id !== t.id) return;
    const dx = e.clientX - st.px, dy = e.clientY - st.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) st.moved = true;
    setDrag({ id: t.id, x: Math.max(0, st.x + dx), y: Math.max(0, st.y + dy) });
  };
  const onUp = (e, t) => {
    const st = start.current;
    if (!st) return;
    start.current = null;
    if (st.moved && drag) actions.setPos(t.id, Math.round(drag.x), Math.round(drag.y));
    else openTask(t.id);
    setDrag(null);
  };

  const edges = [];
  visible.forEach((t) => {
    const from = t.parentId && pos[t.parentId] ? pos[t.parentId] : pos.root;
    edges.push({ k: `p${t.id}`, a: from, b: pos[t.id], tree: true });
    t.links.forEach((l) => pos[l] && edges.push({ k: `${t.id}-${l}`, a: pos[t.id], b: pos[l] }));
  });

  const hasGroups = tasks.some((t) => t.isGroup);

  return (
    <div className="graph-wrap">
      <div className="graph-bar">
        <button className="btn soft" onClick={() => openTask(actions.addTask(tableId, 'משימה חדשה'))}>＋ משימה</button>
        <button className="btn soft" onClick={() => openTask(actions.addGroup(tableId, null))}>📁 קטגוריה</button>
        {hasGroups && <button className="btn soft small" onClick={() => actions.setGroupsCollapsed(tableId, !tasks.some((t) => t.isGroup && t.gCollapsed))}>
          {tasks.some((t) => t.isGroup && t.gCollapsed) ? 'פתחי הכל' : 'סגרי הכל'}</button>}
        <button className="btn soft small" onClick={() => actions.resetLayout(tableId)}>סידור אוטומטי</button>
        {linkFrom
          ? <span className="hint on">בחרי משימה לחבר אליה <button className="link" onClick={() => setLinkFrom(null)}>ביטול</button></span>
          : <span className="hint">קו דק = שייך ל · חץ סגול = קישור (🔗) · ▾ פותח/סוגר קטגוריה · גררי כדי להזיז</span>}
      </div>
      <div className="canvas" style={{ direction: 'ltr' }}>
        <div style={{ position: 'relative', width: maxX, height: maxY }}>
          <svg width={maxX} height={maxY} style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#7C6CF0" />
              </marker>
            </defs>
            {edges.map((e) => (
              <path key={e.k} d={edgePath(e.a, e.b)} fill="none"
                stroke={e.tree ? '#D5D0F2' : '#7C6CF0'} strokeWidth={e.tree ? 2 : 2.6}
                markerEnd={e.tree ? undefined : 'url(#arr)'} />
            ))}
          </svg>

          <div className="node hub" style={{ left: pos.root.x, top: pos.root.y, width: W, height: H, direction: 'rtl', background: table.color }}>
            <span className="hub-icon">{table.emoji}</span>
            <div className="node-title">{table.name}</div>
          </div>

          {visible.map((t) => {
            const g = t.isGroup;
            return (
              <div key={t.id}
                className={`node ${g ? 'group' : ''} ${t.done ? 'done' : ''} ${linkFrom === t.id ? 'linking' : ''} ${linkFrom && linkFrom !== t.id ? 'target' : ''}`}
                style={{ left: pos[t.id].x, top: pos[t.id].y, width: W, height: H, direction: 'rtl', borderColor: table.color }}
                onPointerDown={(e) => onDown(e, t)} onPointerMove={(e) => onMove(e, t)} onPointerUp={(e) => onUp(e, t)}>
                {g
                  ? <button className="mini toggle" title={t.gCollapsed ? 'פתח' : 'סגור'} onClick={() => actions.updateTask(t.id, { gCollapsed: !t.gCollapsed })}>{t.gCollapsed ? '◂' : '▾'}</button>
                  : <Check done={t.done} onChange={() => actions.toggleDone(t.id)} />}
                <div className="node-body">
                  <div className="node-title">{g ? `📁 ${groupIcon(t)} ` : `${taskIcon(t)} `}{t.title}</div>
                  {g && t.gCollapsed ? <span className="count">{hiddenCount(t)} משימות</span> : <PriorityBadge p={t.priority} />}
                </div>
                {t.subTableId && (
                  <button className="mini" title="פתח טבלה" onClick={() => actions.setUI({ tableId: t.subTableId })}>📂</button>
                )}
                <button className="mini" title="חבר לאחר" onClick={() => setLinkFrom(linkFrom === t.id ? null : t.id)}>🔗</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
