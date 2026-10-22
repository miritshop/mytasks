import React, { useState } from 'react';
import { actions, useStore, groupIcon, autoGroupIcon, groupOptions, buildSplitPrompt, parseSplit, descendantIds, overloaded, SPLIT_LIMIT } from './store.js';
import { Modal, IconPicker } from './components.jsx';

// Banner shown above a list when some place holds more than SPLIT_LIMIT tasks
export function SplitBanner({ tableId, onSplit }) {
  const s = useStore();
  const items = overloaded(s, tableId);
  if (!items.length) return null;
  return (
    <div className="split-banner">
      {items.map((o) => (
        <div className="row" key={o.key}>
          <span className="grow">🧩 ב"{o.name}" יש {o.count} משימות. כדאי לפצל לקטגוריות כדי שיהיה פחות עומס.</span>
          <button className="btn primary small" onClick={() => onSplit(o.parentId)}>הציעי פיצול</button>
          <button className="btn soft small" onClick={() => onSplit(o.parentId, true)}>✋ בעצמי</button>
          <button className="icon-btn" title="לא עכשיו" onClick={() => actions.dismissSplit(o.key, o.count)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// Split a list/category into new categories. Either paste Claude's proposal, or build the split by hand.
const blankGroups = () => [
  { title: 'קטגוריה 1', icon: '', taskIds: [] },
  { title: 'קטגוריה 2', icon: '', taskIds: [] },
];

export function SplitModal({ tableId, parentId, manual, onClose }) {
  const s = useStore();
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [groups, setGroups] = useState(manual ? blankGroups() : null);
  const where = parentId ? s.tasks[parentId]?.title : s.tables[tableId]?.name;
  const direct = Object.values(s.tasks)
    .filter((t) => t.tableId === tableId && !t.isGroup && (t.parentId || null) === (parentId || null))
    .sort((a, b) => a.createdAt - b.createdAt);

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildSplitPrompt(tableId, parentId)); setCopied(true); setErr(''); }
    catch { setErr('לא הצלחתי להעתיק. נסי שוב.'); }
  };
  const read = (txt) => {
    try { setGroups(parseSplit(txt, tableId, parentId)); setErr(''); }
    catch { setErr('לא הצלחתי לקרוא את התשובה. ודאי שהעתקת את כל התשובה של Claude.'); }
  };
  const pasteAndRead = async () => {
    try { read(await navigator.clipboard.readText()); }
    catch { setErr('הדפדפן לא אפשר לקרוא מהלוח. הדביקי ידנית בתיבה למטה.'); }
  };

  const setG = (i, p) => setGroups(groups.map((g, k) => (k === i ? { ...g, ...p } : g)));
  const assign = (id, to) => setGroups(groups.map((g, k) => {
    const rest = g.taskIds.filter((x) => x !== id);
    return { ...g, taskIds: k === to ? [...rest, id] : rest };
  }));
  const placed = new Set(groups ? groups.flatMap((g) => g.taskIds) : []);
  const loose = direct.filter((t) => !placed.has(t.id));
  const valid = groups && groups.some((g) => g.title.trim() && g.taskIds.length);
  const apply = () => { actions.applySplit(tableId, parentId, groups); onClose(); };
  const picker = (id, current) => (
    <select className="list-select" value={current} onChange={(e) => assign(id, e.target.value === 'none' ? -1 : +e.target.value)}>
      {groups.map((x, k) => <option key={k} value={k}>{groupIcon(x)} {x.title}</option>)}
      <option value="none">ללא קטגוריה</option>
    </select>
  );

  return (
    <Modal title={`🧩 פיצול "${where}"`} onClose={onClose} wide>
      {!groups ? (
        <>
          <p className="lead">Claude יחלק את המשימות לשתי קטגוריות לפי הנושא שלהן, ולפני שזה נכנס תוכלי לשנות הכל.</p>
          <ol className="steps">
            <li><b>1. העתקי את המשימות</b><button className="btn primary" onClick={copy}>{copied ? '✓ הועתק!' : '📋 העתק'}</button></li>
            <li><b>2. בצ'אט עם Claude</b> הדביקי (Ctrl+V) ושלחי.</li>
            <li>
              <b>3. העתיקי את התשובה של Claude, וחזרי לכאן</b>
              <button className="btn primary" onClick={pasteAndRead}>📥 הדבק מהלוח</button>
              <details className="paste-box"><summary>או הדביקי ידנית</summary>
                <textarea rows={4} value={reply} placeholder='{"groups": [...]}' onChange={(e) => { setReply(e.target.value); setErr(''); }} />
                <button className="btn soft small" disabled={!reply.trim()} onClick={() => read(reply)}>הצג את ההצעה</button>
              </details>
            </li>
          </ol>
          {err && <p className="err">{err}</p>}
          <div className="modal-foot">
            <span className="grow" />
            <button className="btn soft" onClick={() => setGroups(blankGroups())}>✋ אפצל בעצמי</button>
          </div>
        </>
      ) : (
        <>
          <p className="lead">אפשר לשנות שמות ואייקונים, להוסיף קטגוריות ולשבץ כל משימה. משימה בלי קטגוריה נשארת במקומה.</p>
          {groups.map((g, i) => (
            <div className="prop-group" key={i}>
              <div className="row">
                <IconPicker value={g.icon} auto={autoGroupIcon(g.title)} onChange={(e) => setG(i, { icon: e })} />
                <input className="title-input" value={g.title} onChange={(e) => setG(i, { title: e.target.value })} />
                <button className="icon-btn" title="הסר קטגוריה" onClick={() => setGroups(groups.filter((_, k) => k !== i))}>✕</button>
              </div>
              {g.taskIds.length === 0 && <p className="hint">עדיין אין כאן משימות. שבצי אותן מהרשימה למטה.</p>}
              {g.taskIds.map((id) => (
                <div className="row prop-task" key={id}>
                  <span className="grow">{s.tasks[id]?.title}</span>
                  {picker(id, i)}
                </div>
              ))}
            </div>
          ))}
          <button className="btn soft small" onClick={() => setGroups([...groups, { title: `קטגוריה ${groups.length + 1}`, icon: '', taskIds: [] }])}>＋ קטגוריה נוספת</button>
          {loose.length > 0 && (
            <div className="prop-group loose">
              <b>עוד לא שובצו ({loose.length})</b>
              {loose.map((t) => (
                <div className="row prop-task" key={t.id}>
                  <span className="grow">{t.title}</span>
                  <select className="list-select" value="none" onChange={(e) => e.target.value !== 'none' && assign(t.id, +e.target.value)}>
                    <option value="none">בחרי קטגוריה…</option>
                    {groups.map((x, k) => <option key={k} value={k}>{groupIcon(x)} {x.title}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div className="modal-foot">
            <button className="btn soft" onClick={() => setGroups(null)}>חזרה</button>
            <span className="grow" />
            <button className="btn primary" disabled={!valid} onClick={apply}>✨ החל את הפיצול</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function GroupModal({ id, onClose, onSplit }) {
  const s = useStore();
  const g = s.tasks[id];
  if (!g) return null;
  const kids = Object.values(s.tasks).filter((t) => t.parentId === id);
  const all = descendantIds(s, id).filter((x) => !s.tasks[x].isGroup);
  const direct = kids.filter((t) => !t.isGroup).length;
  const siblings = Object.values(s.tasks).filter((t) => t.tableId === g.tableId && !t.isGroup && (t.parentId || null) === (g.parentId || null));

  return (
    <Modal title="קטגוריה" onClose={onClose}>
      <div className="row">
        <IconPicker value={g.icon === '📁' ? '' : g.icon} auto={autoGroupIcon(g.title)} onChange={(e) => actions.updateTask(id, { icon: e })} />
        <input className="title-input" value={g.title} onChange={(e) => actions.updateTask(id, { title: e.target.value })} />
      </div>
      <label className="field inline">בתוך
        <select className="list-select" value={g.parentId || ''} onChange={(e) => actions.reparent(id, e.target.value || null)}>
          <option value="">🏠 ראשי ברשימה</option>
          {groupOptions(s, g.tableId, id).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {siblings.length > 0 && (
        <div className="field">הוסיפי משימות קיימות לקטגוריה (לחיצה מעבירה)
          <div className="chips">
            {siblings.map((t) => <button key={t.id} className="chip" onClick={() => actions.reparent(t.id, id)}>＋ {t.title}</button>)}
          </div>
        </div>
      )}
      <p className="lead">{all.length} משימות בתוך הקטגוריה הזו ({direct} ישירות)</p>
      <div className="row wrap">
        <button className="btn soft" onClick={() => { actions.addTask(g.tableId, 'משימה חדשה', { parentId: id }); onClose(); }}>＋ משימה בתוכה</button>
        <button className="btn soft" onClick={() => { actions.addGroup(g.tableId, id); onClose(); }}>＋ קטגוריה בתוכה</button>
        {direct >= 2 && <button className="btn soft" onClick={() => { onClose(); onSplit(id); }}>🧩 פצלי לקטגוריות</button>}
      </div>
      {direct > SPLIT_LIMIT && <p className="reason">יש כאן הרבה משימות, כדאי לפצל 🙂</p>}
      {all.length === 0 && siblings.length === 0 && <p className="lead">הקטגוריה ריקה. הוסיפי משימה בתוכה, או העבירי אליה משימות דרך השדה "בקטגוריה" בחלון המשימה.</p>}
      <div className="modal-foot">
        <button className="btn danger" onClick={() => {
          if (confirm(`למחוק את "${g.title}" ואת כל מה שבתוכה (${all.length} משימות)?`)) { actions.deleteTask(id); onClose(); }
        }}>🗑 מחיקה עם התוכן</button>
        <button className="btn soft" onClick={() => { actions.ungroup(id); onClose(); }}>פירוק (המשימות נשארות)</button>
        <span className="grow" />
        <button className="btn primary" onClick={onClose}>סגור</button>
      </div>
    </Modal>
  );
}
