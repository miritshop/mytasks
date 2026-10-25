import React, { useState } from 'react';
import { actions, useStore, guessIcon, groupOptions } from './store.js';
import { Modal, Cell, Check, PRIORITY, IconPicker } from './components.jsx';
import Attachments from './Attachments.jsx';

export default function TaskModal({ taskId, userId, onClose }) {
  const s = useStore();
  const task = s.tasks[taskId];
  const [sub, setSub] = useState('');
  if (!task) return null;
  const table = s.tables[task.tableId];
  const subs = Object.values(s.tasks).filter((t) => t.parentId === task.id && !t.isGroup);
  const subTable = task.subTableId ? s.tables[task.subTableId] : null;

  const addSub = () => {
    if (!sub.trim()) return;
    actions.addTask(task.tableId, sub.trim(), { parentId: task.id });
    setSub('');
  };
  const openSubTable = () => {
    const id = task.subTableId || actions.addTable(`${task.title}`, '📋', task.id);
    actions.setUI({ tableId: id, view: 'table' });
    onClose();
  };

  return (
    <Modal title="פרטי משימה" onClose={onClose}>
      <div className="row">
        <Check done={task.done} onChange={() => actions.toggleDone(task.id)} big />
        <IconPicker value={task.icon} auto={guessIcon(task.title)} onChange={(i) => actions.updateTask(task.id, { icon: i })} />
        <input className="title-input" value={task.title} onChange={(e) => actions.updateTask(task.id, { title: e.target.value })} />
      </div>

      <div className="field">עדיפות
        <div className="chips">
          {[1, 2, 3].map((p) => (
            <button key={p} className={`chip ${PRIORITY[p].cls} ${task.priority === p ? 'on' : ''}`}
              onClick={() => actions.updateTask(task.id, { priority: task.priority === p ? null : p })}>{PRIORITY[p].label}</button>
          ))}
          <button className={`chip ${task.today ? 'on' : ''}`} onClick={() => actions.updateTask(task.id, { today: !task.today })}>⭐ מיקוד להיום</button>
        </div>
        {task.reason && <p className="reason">💡 {task.reason}</p>}
      </div>

      {(!task.parentId || s.tasks[task.parentId]?.isGroup) && groupOptions(s, task.tableId).length > 0 && (
        <label className="field inline">בקטגוריה
          <select className="list-select" value={task.parentId || ''} onChange={(e) => actions.reparent(task.id, e.target.value || null)}>
            <option value="">ללא (ראשי ברשימה)</option>
            {groupOptions(s, task.tableId).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      )}

      {(!task.parentId || s.tasks[task.parentId]?.isGroup) && (
        <label className="field inline">רשימה
          <select className="list-select" value={task.tableId} onChange={(e) => actions.moveTask(task.id, e.target.value)}>
            {s.tableOrder.map((id) => <option key={id} value={id}>{s.tables[id].emoji} {s.tables[id].name}</option>)}
            {!s.tableOrder.includes(task.tableId) && <option value={task.tableId}>{table.emoji} {table.name}</option>}
          </select>
        </label>
      )}

      {table.columns.map((c) => (
        <div className="field inline" key={c.id}><span>{c.name}</span><Cell col={c} task={task} /></div>
      ))}

      {!table.columns.some((c) => c.type === 'tags') && (
        <div className="field">תגיות
          <button className="btn soft template-btn" onClick={() => actions.addColumn(table.id, { name: 'תגיות', type: 'tags' })}>🏷️ הוספת תגיות</button>
        </div>
      )}

      <Attachments taskId={task.id} userId={userId} />

      <label className="field">הערה
        <textarea rows={2} value={task.note} onChange={(e) => actions.updateTask(task.id, { note: e.target.value })} />
      </label>

      <div className="field">תת-משימות
        {subs.map((t) => (
          <div className="row sub-row" key={t.id}>
            <Check done={t.done} onChange={() => actions.toggleDone(t.id)} />
            <input className="cell-input grow" value={t.title} onChange={(e) => actions.updateTask(t.id, { title: e.target.value })} />
            <button className="icon-btn" onClick={() => actions.deleteTask(t.id)}>🗑</button>
          </div>
        ))}
        <div className="row">
          <input value={sub} placeholder="הוסף תת-משימה קטנה…" onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
          <button className="btn soft" onClick={addSub}>＋</button>
        </div>
      </div>

      <div className="field">טבלה משלה
        <button className="btn soft" onClick={openSubTable}>
          {subTable ? `${subTable.emoji} פתח את "${subTable.name}"` : '➕ צור טבלה נפרדת למשימה הזו (עם עמודות משלה)'}
        </button>
      </div>

      <div className="modal-foot">
        <button className="btn danger" onClick={() => { if (confirm('למחוק את המשימה?')) { actions.deleteTask(task.id); onClose(); } }}>מחיקה</button>
        <span className="grow" />
        <button className="btn primary" onClick={onClose}>סגור</button>
      </div>
    </Modal>
  );
}
