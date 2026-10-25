import React, { useMemo, useState } from 'react';
import { actions, useStore, getState, groupIcon, autoOptionIcon } from './store.js';
import { Modal, Check, PRIORITY } from './components.jsx';
import { suggest, buildSuggestPayload, tagColumnOf } from './ai.js';

const MAX = 25;
const missing = (t, col) => t.estimateMin == null || !t.priority || (col && !(Array.isArray(t.vals[col.id]) && t.vals[col.id].length));

// Pick tasks -> ask the AI -> review and fix every suggestion -> apply (marked with ✨)
export default function SuggestModal({ tableId, onClose }) {
  const s = useStore();
  const table = s.tables[tableId];
  const col = tagColumnOf(table);
  const tasks = useMemo(
    () => Object.values(s.tasks).filter((t) => t.tableId === tableId && !t.isGroup && !t.done).sort((a, b) => a.createdAt - b.createdAt),
    [s.tasks, tableId],
  );
  const [step, setStep] = useState('select'); // select | loading | review
  const [sel, setSel] = useState(() => new Set(tasks.filter((t) => missing(t, col)).slice(0, MAX).map((t) => t.id)));
  const [err, setErr] = useState('');
  const [rows, setRows] = useState({}); // taskId -> editable proposal
  const [order, setOrder] = useState([]);

  const toggle = (id) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id); else if (n.size < MAX) n.add(id);
    setSel(n);
  };

  const run = async () => {
    setErr(''); setStep('loading');
    try {
      const payload = buildSuggestPayload(getState(), [...sel]);
      const res = await suggest(payload);
      const next = {};
      res.items.forEach((it) => {
        next[it.id] = {
          include: true,
          estimateMin: it.estimateMin ?? '',
          priority: it.priority ?? '',
          tagIds: it.tagOptionIds,
          newTags: it.newTags.map((label) => ({ label, on: true })),
          category: it.categoryId || (it.newCategory ? `new:${it.newCategory}` : ''),
          reason: it.reason, ruleIds: it.ruleIds,
        };
      });
      if (!res.items.length) throw new Error('ה-AI לא החזיר הצעות. נסי שוב.');
      setRows(next); setOrder(res.items.map((i) => i.id)); setStep('review');
    } catch (e) {
      setErr(e.message); setStep('select');
    }
  };

  const setRow = (id, p) => setRows({ ...rows, [id]: { ...rows[id], ...p } });
  const included = order.filter((id) => rows[id]?.include);

  const apply = () => {
    actions.applyAiSuggestions(included.map((id) => {
      const r = rows[id];
      const newCat = r.category.startsWith('new:') ? r.category.slice(4) : null;
      return {
        id,
        estimateMin: r.estimateMin === '' ? null : +r.estimateMin,
        priority: r.priority === '' ? null : +r.priority,
        tagOptionIds: r.tagIds,
        newTags: r.newTags.filter((x) => x.on).map((x) => x.label),
        categoryId: newCat || !r.category ? null : r.category,
        newCategory: newCat,
      };
    }));
    onClose();
  };

  // ---------- step 1: choose tasks ----------
  if (step !== 'review') {
    return (
      <Modal title={`✨ הצעות AI: ${table.emoji} ${table.name}`} onClose={onClose} wide>
        <p className="lead">בחרי משימות, וה-AI יציע לכל אחת זמן, עדיפות, תגיות וקטגוריה, קודם כל מתוך מה שכבר קיים ברשימה שלך. תוכלי לתקן הכל לפני שזה נכנס.</p>
        {!col && (
          <div className="ai-banner">
            אין לרשימה הזו עמודת תגיות, ולכן לא יוצעו תגיות.
            <button className="btn soft small" onClick={() => actions.addColumn(tableId, { name: 'תגיות', type: 'tags' })}>🏷️ הוספת עמודת תגיות</button>
          </div>
        )}
        <div className="row wrap sel-bar">
          <button className="link" onClick={() => setSel(new Set(tasks.slice(0, MAX).map((t) => t.id)))}>בחרי הכל</button>
          <button className="link" onClick={() => setSel(new Set(tasks.filter((t) => missing(t, col)).slice(0, MAX).map((t) => t.id)))}>רק אלה שחסר בהם משהו</button>
          <button className="link" onClick={() => setSel(new Set())}>נקי</button>
          <span className="grow" />
          <span className="count">{sel.size}/{MAX}</span>
        </div>
        <div className="sel-list">
          {tasks.map((t) => (
            <label className="sel-row" key={t.id}>
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="grow">{t.title}</span>
              {missing(t, col) && <span className="count">חסר</span>}
            </label>
          ))}
          {!tasks.length && <p className="empty">אין משימות פתוחות ברשימה.</p>}
        </div>
        {err && <p className="err">{err}</p>}
        <div className="modal-foot">
          <span className="grow" />
          <button className="btn primary" disabled={!sel.size || step === 'loading'} onClick={run}>
            {step === 'loading' ? '⏳ חושבת…' : `✨ הצעות ל-${sel.size} משימות`}
          </button>
        </div>
      </Modal>
    );
  }

  // ---------- step 2: review ----------
  const groups = Object.values(s.tasks).filter((t) => t.tableId === tableId && t.isGroup);
  const ruleText = (id) => s.rules[id]?.text || '';
  return (
    <Modal title="✨ ההצעות. אפשר לתקן הכל" onClose={onClose} wide>
      <p className="lead">מה שתאשרי יסומן ב-<span className="ai-mark">✨</span> במשימות, כדי שיהיה ברור מה נקבע אוטומטית. <b>🆕</b> = ה-AI מציע משהו חדש, כי לא מצא התאמה ברשימה שלך.</p>
      {order.map((id) => {
        const t = s.tasks[id];
        const r = rows[id];
        if (!t || !r) return null;
        const free = (col?.options || []).filter((o) => !r.tagIds.includes(o.id));
        return (
          <div className={`sug-card ${r.include ? '' : 'off'}`} key={id}>
            <div className="row">
              <Check done={r.include} onChange={() => setRow(id, { include: !r.include })} />
              <b className="grow">{t.title}</b>
            </div>
            <div className="sug-grid">
              <label>זמן (דק׳)
                <input type="number" min="1" max="480" step="5" value={r.estimateMin} onChange={(e) => setRow(id, { estimateMin: e.target.value })} />
              </label>
              <label>עדיפות
                <select value={r.priority} onChange={(e) => setRow(id, { priority: e.target.value })}>
                  <option value="">—</option>
                  {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
                </select>
              </label>
              <label>קטגוריה
                <select value={r.category} onChange={(e) => setRow(id, { category: e.target.value })}>
                  <option value="">ללא שינוי</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{groupIcon(g)} {g.title}</option>)}
                  {r.category.startsWith('new:') && <option value={r.category}>🆕 {r.category.slice(4)}</option>}
                </select>
              </label>
            </div>
            {col && (
              <div className="chips sug-tags">
                {r.tagIds.map((oid) => {
                  const o = col.options.find((x) => x.id === oid);
                  return o && <button key={oid} className="tag-chip on" style={{ background: o.color }} title="הסרה"
                    onClick={() => setRow(id, { tagIds: r.tagIds.filter((x) => x !== oid) })}>{o.icon ? `${o.icon} ` : ''}{o.label} ✕</button>;
                })}
                {r.newTags.map((nt, i) => (
                  <button key={nt.label} className={`tag-chip new ${nt.on ? 'on' : ''}`} title="חדש: לחיצה מפעילה או מבטלת"
                    onClick={() => setRow(id, { newTags: r.newTags.map((x, k) => (k === i ? { ...x, on: !x.on } : x)) })}>
                    🆕 {autoOptionIcon(nt.label) ? `${autoOptionIcon(nt.label)} ` : ''}{nt.label}
                  </button>
                ))}
                {free.length > 0 && (
                  <select className="list-select add-tag" value="" onChange={(e) => e.target.value && setRow(id, { tagIds: [...r.tagIds, e.target.value] })}>
                    <option value="">＋ תגית קיימת…</option>
                    {free.map((o) => <option key={o.id} value={o.id}>{o.icon ? `${o.icon} ` : ''}{o.label}</option>)}
                  </select>
                )}
              </div>
            )}
            {(r.reason || r.ruleIds.length > 0) && (
              <div className="sug-why">
                {r.reason && <span>💡 {r.reason}</span>}
                {r.ruleIds.map((rid) => ruleText(rid) && <span key={rid} className="rule-badge" title={ruleText(rid)}>📏 {ruleText(rid).slice(0, 28)}</span>)}
              </div>
            )}
          </div>
        );
      })}
      <div className="modal-foot">
        <button className="btn soft" onClick={() => setStep('select')}>חזרה</button>
        <span className="grow" />
        <button className="btn primary" disabled={!included.length} onClick={apply}>✨ החלי על {included.length} משימות</button>
      </div>
    </Modal>
  );
}
