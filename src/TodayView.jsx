import React, { useState } from 'react';
import { actions, useStore, todayStr, guessIcon, taskIcon } from './store.js';
import { Check, PriorityBadge, IconPicker, fmtMinutes, WhenBadge } from './components.jsx';
import { whenInfo } from './when.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'בוקר טוב' : h < 18 ? 'צהריים טובים' : 'ערב טוב';
};

export default function TodayView({ openTask, openBrain, onPlan }) {
  const s = useStore();
  const [title, setTitle] = useState('');
  const [listId, setListId] = useState(null);
  const [icon, setIcon] = useState('');
  const all = Object.values(s.tasks);
  // today's plan from the AI (if any): order and a short reason for each task
  const plan = s.ui.plan && s.ui.plan.date === todayStr() ? s.ui.plan : null;
  const planIdx = (id) => { const i = plan ? plan.items.findIndex((x) => x.id === id) : -1; return i < 0 ? 1e6 : i; };
  const whyOf = (id) => plan?.items.find((x) => x.id === id)?.why || '';
  const overdue = all.filter((t) => !t.isGroup && whenInfo(t).overdue).sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const focus = all.filter((t) => t.today && !whenInfo(t).overdue).sort((a, b) => planIdx(a.id) - planIdx(b.id));
  const doneN = focus.filter((t) => t.done).length;
  const pct = focus.length ? Math.round((doneN / focus.length) * 100) : 0;

  const dueSoon = (t) => ['today'].includes(whenInfo(t).eff) || Object.entries(t.vals).some(([cid, v]) => {
    const col = s.tables[t.tableId]?.columns.find((c) => c.id === cid);
    return col?.type === 'date' && v && v <= todayStr();
  });
  const suggestions = all
    .filter((t) => !t.isGroup && !t.today && !t.done && !whenInfo(t).overdue && (!t.parentId || s.tasks[t.parentId]?.isGroup))
    .sort((a, b) => (dueSoon(b) - dueSoon(a)) || (whenInfo(a).rank - whenInfo(b).rank) || ((a.priority || 9) - (b.priority || 9)))
    .slice(0, 6);

  const add = () => {
    if (!title.trim()) return;
    const tableId = s.tables[listId] && !s.tables[listId].parentTaskId ? listId : s.tableOrder[0];
    actions.addTask(tableId, title.trim(), { today: true, icon });
    setTitle('');
    setIcon('');
  };

  const Card = ({ t }) => {
    const subs = all.filter((x) => x.parentId === t.id);
    return (
      <div className={`focus-card ${t.done ? 'done' : ''}`} onClick={() => openTask(t.id)}>
        <Check done={t.done} onChange={() => actions.toggleDone(t.id)} big />
        <IconPicker value={t.icon} auto={guessIcon(t.title)} onChange={(i) => actions.updateTask(t.id, { icon: i })} />
        <div className="grow">
          <div className="focus-title">{t.title}</div>
          <div className="meta">
            <span>{s.tables[t.tableId]?.emoji} {s.tables[t.tableId]?.name}</span>
            {subs.length > 0 && <span>· {subs.filter((x) => x.done).length}/{subs.length} תת-משימות</span>}
            <PriorityBadge p={t.priority} />
            {t.estimateMin != null && <span>· ~{fmtMinutes(t.estimateMin)}</span>}
          </div>
          {whyOf(t.id) && <div className="reason ai-why">✨ {whyOf(t.id)}</div>}
          {t.reason && <div className="reason">💡 {t.reason}</div>}
        </div>
        <button className="icon-btn" title="הסר מהיום" onClick={(e) => { e.stopPropagation(); actions.updateTask(t.id, { today: false }); }}>✕</button>
      </div>
    );
  };

  return (
    <div className="today">
      <div className="hello">
        <div>
          <h1>{greeting()} 🌞</h1>
          <p>{focus.length ? `${doneN} מתוך ${focus.length} הושלמו. את עושה מעולה!` : 'בואי נבחר 1–3 דברים חשובים להיום.'}</p>
        </div>
        <div className="ring" style={{ '--pct': pct }}><span>{pct}%</span></div>
      </div>

      {s.brainMessage && (
        <div className="brain-msg">
          <span>🧠 {s.brainMessage}</span>
          <button className="icon-btn" onClick={actions.dismissBrain}>✕</button>
        </div>
      )}

      {plan && (
        <div className="brain-msg plan-msg">
          <span>✨ {plan.message || 'התוכנית של היום'}</span>
          <button className="icon-btn" title="ביטול התוכנית" onClick={actions.clearPlan}>✕</button>
        </div>
      )}

      <button className="btn plan" onClick={onPlan}>✨ תכנני לי את היום</button>
      <button className="btn brain" onClick={openBrain}>🧠 בקשי מ-Claude לתעדף בשבילך (העתק-הדבק)</button>

      {overdue.length > 0 && (
        <>
          <h2>⚠️ באיחור: מה עושים?</h2>
          <div className="stack">
            {overdue.map((t) => (
              <div className="overdue-card" key={t.id}>
                <div className="row">
                  <span className="grow res-title" onClick={() => openTask(t.id)}>{taskIcon(t)} {t.title} <WhenBadge task={t} /></span>
                </div>
                <div className="row wrap">
                  <button className="btn soft small" onClick={() => actions.setWhen(t.id, 'today')}>☀️ להיום</button>
                  <button className="btn soft small" onClick={() => actions.setWhen(t.id, 'week')}>📅 להשבוע</button>
                  <button className="btn soft small" onClick={() => actions.setWhen(t.id, 'soon')}>🔜 לבקרוב</button>
                  <button className="btn soft small" onClick={() => actions.setWhen(t.id, null)}>בלי מועד</button>
                  <button className="btn primary small" onClick={() => actions.toggleDone(t.id)}>✓ בוצע</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>המיקוד שלי להיום</h2>
      <div className="stack">
        {focus.map((t) => <Card key={t.id} t={t} />)}
        <div className="row add-row card">
          <IconPicker value={icon} auto={guessIcon(title)} onChange={setIcon} />
          <input value={title} placeholder="הוסיפי משימה להיום…" onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <select className="list-select" value={s.tables[listId] ? listId : s.tableOrder[0]} onChange={(e) => setListId(e.target.value)} aria-label="רשימה">
            {s.tableOrder.map((id) => <option key={id} value={id}>{s.tables[id].emoji} {s.tables[id].name}</option>)}
          </select>
          <button className="btn primary small" onClick={add}>הוסף</button>
        </div>
      </div>

      {s.ui.hideSuggest && (
        <button className="link show-sug" onClick={() => actions.setUI({ hideSuggest: false })}>הצג רעיונות נוספים</button>
      )}
      {!s.ui.hideSuggest && suggestions.length > 0 && (
        <>
          <div className="row sug-head">
            <h2 className="grow">אולי גם…</h2>
            <button className="link" onClick={() => actions.setUI({ hideSuggest: true })}>הסתר</button>
          </div>
          <div className="stack">
            {suggestions.map((t) => (
              <div className="suggest" key={t.id}>
                <span className="grow">{taskIcon(t)} {t.title} <PriorityBadge p={t.priority} /><WhenBadge task={t} />{dueSoon(t) && <span className="pbadge p1">להיום</span>}</span>
                <button className="btn soft small" onClick={() => actions.updateTask(t.id, { today: true })}>⭐ להיום</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
