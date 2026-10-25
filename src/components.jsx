import React, { useState } from 'react';
import { actions, PALETTE, addStatusOptions, autoOptionIcon } from './store.js';
import { EMOJI_SETS, firstEmoji } from './emojis.js';
import { WHEN_KINDS, whenInfo } from './when.js';

export const PRIORITY = {
  1: { label: 'דחוף', cls: 'p1' },
  2: { label: 'חשוב', cls: 'p2' },
  3: { label: 'יכול לחכות', cls: 'p3' },
};

export function Check({ done, onChange, big }) {
  return (
    <button
      className={`check ${done ? 'on' : ''} ${big ? 'big' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-label={done ? 'בטל סימון' : 'סמן כבוצע'}
    >
      {done && <svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

export function PriorityBadge({ p, onClick }) {
  if (!p) return null;
  return <span className={`pbadge ${PRIORITY[p].cls}`} onClick={onClick}>{PRIORITY[p].label}</span>;
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const optLabel = (o) => `${o.icon ? `${o.icon} ` : ''}${o.label}`;

// Add one option (a new status / tag) to a select or tags column without opening the column editor
function QuickOptionModal({ tableId, col, kind, onDone, onClose }) {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const save = () => {
    if (!label.trim()) return;
    const id = actions.addOption(tableId, col.id, { label: label.trim(), icon: icon || autoOptionIcon(label) });
    onDone(id);
    onClose();
  };
  return (
    <Modal title={`${kind} חדש/ה ב"${col.name}"`} onClose={onClose}>
      <div className="row">
        <IconPicker value={icon} auto={autoOptionIcon(label)} autoLabel="✨ אוטומטי לפי השם" onChange={setIcon} />
        <input className="title-input" autoFocus value={label} placeholder="שם" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </div>
      <div className="modal-foot"><span className="grow" /><button className="btn primary" disabled={!label.trim()} onClick={save}>הוספה</button></div>
    </Modal>
  );
}

// Several tags per task, toggled on/off; new tags can be created right here
function TagsModal({ col, task, onClose }) {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('');
  const sel = Array.isArray(task.vals[col.id]) ? task.vals[col.id] : [];
  const toggle = (id) => actions.setVal(task.id, col.id, sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const add = () => {
    if (!label.trim()) return;
    const id = actions.addOption(task.tableId, col.id, { label: label.trim(), icon: icon || autoOptionIcon(label) });
    actions.setVal(task.id, col.id, [...sel, id]);
    setLabel(''); setIcon('');
  };
  return (
    <Modal title={`${col.name}: ${task.title}`} onClose={onClose}>
      <div className="chips">
        {(col.options || []).map((o) => (
          <button key={o.id} className={`tag-chip ${sel.includes(o.id) ? 'on' : ''}`} style={{ background: sel.includes(o.id) ? o.color : undefined }} onClick={() => toggle(o.id)}>
            {optLabel(o)}
          </button>
        ))}
        {!(col.options || []).length && <p className="hint">עדיין אין תגיות. הוסיפי את הראשונה למטה.</p>}
      </div>
      <div className="field">תגית חדשה
        <div className="row">
          <IconPicker value={icon} auto={autoOptionIcon(label)} autoLabel="✨ אוטומטי לפי השם" onChange={setIcon} />
          <input value={label} placeholder="למשל: דחוף לשבת" onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn soft small" disabled={!label.trim()} onClick={add}>הוסיפי</button>
        </div>
      </div>
      <div className="modal-foot"><span className="grow" /><button className="btn primary" onClick={onClose}>סגור</button></div>
    </Modal>
  );
}

// ✨ = this value was set by AI and the user has not changed or approved it yet
export const AiMark = ({ title = 'הוצע על ידי AI' }) => <span className="ai-mark" title={title}>✨</span>;
export const hasAi = (t) => {
  const a = t.ai || {};
  return !!(a.priority || a.estimate || a.parent || a.when || (a.tags || []).length || Object.keys(a.vals || {}).length);
};

// Editable cell for a custom column
export function Cell({ col, task }) {
  const [modal, setModal] = useState(false);
  const v = task.vals[col.id];
  const set = (x) => actions.setVal(task.id, col.id, x);
  if (col.type === 'checkbox') return <Check done={!!v} onChange={() => set(!v)} />;
  if (col.type === 'select') {
    const o = (col.options || []).find((x) => x.id === v);
    const change = (e) => (e.target.value === '__new' ? setModal(true) : set(e.target.value));
    return (
      <>
        <label className={`pill-select ${task.ai?.vals?.[col.id] ? 'ai-set' : ''}`} style={{ background: o ? o.color : 'transparent' }}>
          <select value={v || ''} onChange={change}>
            <option value="">—</option>
            {(col.options || []).map((x) => <option key={x.id} value={x.id}>{optLabel(x)}</option>)}
            <option value="__new">＋ הוספת אפשרות חדשה…</option>
          </select>
          <span>{task.ai?.vals?.[col.id] && <AiMark />}{o ? optLabel(o) : '＋'}</span>
        </label>
        {modal && <QuickOptionModal tableId={task.tableId} col={col} kind="סטטוס" onDone={set} onClose={() => setModal(false)} />}
      </>
    );
  }
  if (col.type === 'tags') {
    const chosen = (Array.isArray(v) ? v : []).map((id) => (col.options || []).find((x) => x.id === id)).filter(Boolean);
    return (
      <>
        <button className="tags-cell" onClick={() => setModal(true)}>
          {chosen.map((o) => {
            const ai = (task.ai?.tags || []).includes(o.id);
            return <span key={o.id} className={`tag ${ai ? 'ai-set' : ''}`} style={{ background: o.color }}>{ai && <AiMark />}{optLabel(o)}</span>;
          })}
          <span className="tag add">＋</span>
        </button>
        {modal && <TagsModal col={col} task={task} onClose={() => setModal(false)} />}
      </>
    );
  }
  if (col.type === 'date') return <input className="cell-input" type="date" value={v || ''} onChange={(e) => set(e.target.value)} />;
  if (col.type === 'number') return <input className="cell-input" type="number" value={v ?? ''} onChange={(e) => set(e.target.value)} />;
  return <input className="cell-input" value={v || ''} onChange={(e) => set(e.target.value)} />;
}

// Priority: a built-in column (empty is fine)
export function PriorityCell({ task }) {
  const p = task.priority;
  return (
    <label className={`pill-select ${p ? PRIORITY[p].cls : ''} ${task.ai?.priority ? 'ai-set' : ''}`}>
      <select value={p || ''} onChange={(e) => actions.updateTask(task.id, { priority: e.target.value ? +e.target.value : null })}>
        <option value="">—</option>
        {[1, 2, 3].map((k) => <option key={k} value={k}>{PRIORITY[k].label}</option>)}
      </select>
      <span>{task.ai?.priority && <AiMark />}{p ? PRIORITY[p].label : '＋'}</span>
    </label>
  );
}

// Estimated minutes (a built-in column; empty is fine)
export const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} ש׳` : `${m} דק׳`);
export function EstimateCell({ task }) {
  const set = (e) => {
    const n = e.target.value === '' ? null : Math.max(0, Math.min(1440, Math.round(+e.target.value)));
    actions.updateTask(task.id, { estimateMin: Number.isNaN(n) ? null : n });
  };
  return (
    <div className={`est ${task.ai?.estimate ? 'ai-set' : ''}`}>
      {task.ai?.estimate && <AiMark />}
      <input type="number" min="0" max="1440" step="5" inputMode="numeric" placeholder="—" value={task.estimateMin ?? ''} onChange={set} aria-label="זמן משוער בדקות" />
      <span className="unit">דק׳</span>
    </div>
  );
}

export const COL_TYPES = [
  ['text', 'טקסט'], ['select', 'בחירה'], ['date', 'תאריך'], ['number', 'מספר'], ['checkbox', 'תיבת סימון'], ['tags', 'תגיות (כמה בחירות)'],
];

const STATUS_TEMPLATE = [
  { label: 'חקירה', icon: '🔍', color: PALETTE[2] },
  { label: 'החלטה', icon: '⚖️', color: PALETTE[4] },
  { label: 'השקעה', icon: '🚀', color: PALETTE[1] },
];
const newOptId = () => Math.random().toString(36).slice(2, 8);

const hasOptions = (t) => t === 'select' || t === 'tags';

export function ColumnModal({ table, col, onClose }) {
  const [name, setName] = useState(col?.name || '');
  const [type, setType] = useState(col?.type || 'text');
  const [options, setOptions] = useState(col?.options || []);
  const [err, setErr] = useState('');
  const isNew = !col;
  const isTags = (isNew ? type : col.type) === 'tags';

  const setOpt = (id, p) => setOptions(options.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const addOpt = () => setOptions([...options, { id: newOptId(), label: isTags ? 'תגית חדשה' : 'אפשרות חדשה', icon: '', color: PALETTE[options.length % PALETTE.length] }]);
  const moveOpt = (i, d) => {
    const next = [...options];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setOptions(next);
  };
  const useTemplate = () => {
    setType('select');
    if (!name.trim()) setName('סטטוס');
    setOptions(STATUS_TEMPLATE.map((o) => ({ ...o, id: newOptId() })));
  };
  const save = () => {
    // a missing name is filled from the type instead of silently doing nothing
    const nm = name.trim() || (isNew ? COL_TYPES.find(([k]) => k === type)[1].replace(/ \(.*\)/, '') : '');
    if (!nm) { setErr('צריך לתת שם לעמודה.'); return; }
    const clean = options.filter((o) => o.label.trim()).map((o) => (isTags ? { ...o, icon: o.icon || autoOptionIcon(o.label) } : o));
    if (isNew) actions.addColumn(table.id, { name: nm, type, ...(hasOptions(type) ? { options: clean } : {}) });
    else actions.updateColumn(table.id, col.id, { name: nm, ...(hasOptions(col.type) ? { options: clean } : {}) });
    onClose();
  };
  return (
    <Modal title={isNew ? 'עמודה חדשה' : 'עריכת עמודה'} onClose={onClose}>
      {isNew && (
        <button className="btn soft template-btn" onClick={useTemplate}>⚡ תבנית סטטוס: 🔍 חקירה · ⚖️ החלטה · 🚀 השקעה</button>
      )}
      <label className="field">שם העמודה
        <input autoFocus value={name} placeholder={isNew ? 'למשל: תגיות' : ''} onChange={(e) => { setName(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      {isNew && (
        <div className="field">סוג
          <div className="chips">
            {COL_TYPES.map(([k, l]) => <button key={k} className={`chip ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{l}</button>)}
          </div>
        </div>
      )}
      {hasOptions(type) && (
        <div className="field">{type === 'tags' ? 'התגיות' : 'אפשרויות'} (אפשר להשאיר משימה בלי בחירה)
          {options.map((o, i) => (
            <div className="opt-row" key={o.id}>
              <div className="row">
                <IconPicker value={o.icon || ''} auto={isTags ? autoOptionIcon(o.label) : ''} autoLabel={isTags ? '✨ אוטומטי לפי השם' : '✕ בלי אייקון'} onChange={(e) => setOpt(o.id, { icon: e })} />
                <input className="title-input" value={o.label} onChange={(e) => setOpt(o.id, { label: e.target.value })} />
                <button className="icon-btn" title="למעלה" disabled={i === 0} onClick={() => moveOpt(i, -1)}>▲</button>
                <button className="icon-btn" title="למטה" disabled={i === options.length - 1} onClick={() => moveOpt(i, 1)}>▼</button>
                <button className="icon-btn" title="מחיקה" onClick={() => setOptions(options.filter((x) => x.id !== o.id))}>🗑</button>
              </div>
              <div className="row swatches">
                {PALETTE.map((c) => (
                  <button key={c} className={`swatch small ${o.color === c ? 'on' : ''}`} style={{ background: c }} aria-label="צבע" onClick={() => setOpt(o.id, { color: c })} />
                ))}
              </div>
            </div>
          ))}
          <div className="row wrap">
            <button className="btn soft small template-btn" onClick={addOpt}>＋ אפשרות חדשה</button>
            <button className="btn soft small template-btn" onClick={() => { const next = [...options]; addStatusOptions(next); setOptions(next); }}>⚡ הוסף: 🔍 חקירה · ⚖️ החלטה · 🚀 השקעה</button>
          </div>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="modal-foot">
        {!isNew && <button className="btn danger" onClick={() => { if (confirm('למחוק את העמודה?')) { actions.deleteColumn(table.id, col.id); onClose(); } }}>מחיקה</button>}
        <span className="grow" />
        <button className="btn primary" onClick={save}>שמירה</button>
      </div>
    </Modal>
  );
}

// Big emoji grid with category tabs and a free-text box (type, paste, or use the Windows emoji keyboard: Win + .)
const segs = (str) => [...new Intl.Segmenter('he', { granularity: 'grapheme' }).segment(str)].map((x) => x.segment);
export function EmojiGrid({ onPick, autoLabel, onAuto, autoOn }) {
  const [cat, setCat] = useState(0);
  const [custom, setCustom] = useState('');
  const useCustom = () => { const e = firstEmoji(custom); if (e) { onPick(e); setCustom(''); } };
  return (
    <div className="emoji-grid">
      {autoLabel && <button className={`pick-auto ${autoOn ? 'on' : ''}`} onClick={onAuto}>{autoLabel}</button>}
      <div className="cat-tabs">
        {EMOJI_SETS.map(([icon, name], i) => (
          <button key={name} title={name} className={cat === i ? 'on' : ''} onClick={() => setCat(i)}>{icon}</button>
        ))}
      </div>
      <div className="cat-name">{EMOJI_SETS[cat][1]}</div>
      <div className="pick-grid">
        {segs(EMOJI_SETS[cat][2]).map((e, i) => <button key={e + i} onClick={() => onPick(e)}>{e}</button>)}
      </div>
      <div className="row custom-emoji">
        <input value={custom} placeholder="הקלידי או הדביקי כל אמוג'י" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && useCustom()} />
        <button className="btn soft small" onClick={useCustom}>בחרי</button>
      </div>
    </div>
  );
}

// Icon button + popover. `value` is the chosen icon ('' = automatic), `auto` is the guessed one (null = no auto mode).
export function IconPicker({ value, auto, onChange, autoLabel = '✨ אוטומטי לפי התוכן' }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <span className="icon-pick">
      <button className="icon-face" title="שינוי אייקון" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{value || auto || '＋'}</button>
      {open && (
        <>
          <div className="pick-scrim" onClick={(e) => { e.stopPropagation(); close(); }} />
          <div className="pick-pop" onClick={(e) => e.stopPropagation()}>
            <EmojiGrid
              onPick={(e) => { onChange(e); close(); }}
              autoLabel={auto != null ? autoLabel : null}
              autoOn={!value}
              onAuto={() => { onChange(''); close(); }}
            />
          </div>
        </>
      )}
    </span>
  );
}

// ---------- "when": today / this week / next week / soon / a date ----------
export function WhenChips({ task, onDone }) {
  const info = whenInfo(task);
  const activeKey = !task.whenKind ? null : task.whenKind === 'date' && info.eff === 'date' ? 'date' : info.eff;
  const pick = (kind) => { actions.setWhen(task.id, task.whenKind && info.eff === kind && task.whenKind !== 'date' ? null : kind); onDone?.(); };
  const chip = (on) => `chip ${on ? 'on' : ''}`;
  return (
    <div className="when-chips">
      {WHEN_KINDS.map(([k, label, emoji]) => (
        <button key={k} className={chip(activeKey === k)} onClick={() => pick(k)}>{emoji} {label}</button>
      ))}
      <label className={`${chip(task.whenKind === 'date')} date-chip`}>
        🗓️ <input type="date" value={task.whenKind === 'date' ? task.whenDate || '' : ''}
          onChange={(e) => { actions.setWhen(task.id, e.target.value ? 'date' : null, e.target.value); onDone?.(); }} />
      </label>
      {task.whenKind && <button className="chip" onClick={() => { actions.setWhen(task.id, null); onDone?.(); }}>✕ בלי מועד</button>}
    </div>
  );
}

export function WhenBadge({ task }) {
  const i = whenInfo(task);
  if (!i.kind) return null;
  return <span className={`when-pill small ${i.overdue ? 'overdue' : `w-${i.eff}`}`}>{i.overdue ? '⚠️ באיחור: ' : `${i.emoji} `}{i.label}</span>;
}

// table cell: a pill that opens the quick buttons
export function WhenCell({ task }) {
  const [open, setOpen] = useState(false);
  const i = whenInfo(task);
  return (
    <span className="icon-pick">
      <button className={`when-pill ${i.overdue ? 'overdue' : i.eff ? `w-${i.eff}` : ''} ${task.ai?.when ? 'ai-set' : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        {task.ai?.when && <AiMark />}
        {i.kind ? `${i.overdue ? '⚠️ ' : `${i.emoji} `}${i.label}` : '＋'}
      </button>
      {open && (
        <>
          <div className="pick-scrim" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="pick-pop when-pop" onClick={(e) => e.stopPropagation()}>
            {i.overdue && <p className="err when-late">המועד עבר. בחרי מועד חדש:</p>}
            <WhenChips task={task} onDone={() => setOpen(false)} />
          </div>
        </>
      )}
    </span>
  );
}
