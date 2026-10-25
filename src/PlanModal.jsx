import React, { useState } from 'react';
import { actions, useStore, getState, taskIcon } from './store.js';
import { Modal } from './components.jsx';
import { fmtMinutes } from './components.jsx';
import { plan, buildPlanPayload, activeRules } from './ai.js';

const ENERGY = [['low', '🪫 נמוכה'], ['normal', '🙂 רגילה'], ['high', '⚡ גבוהה']];
const DEFAULT_MIN = 20; // used for tasks without an estimate (same as the server)

// "Plan my day": a few questions -> the AI picks and orders the day's tasks -> the user fixes it -> apply
export default function PlanModal({ onClose }) {
  const s = useStore();
  const [hours, setHours] = useState(3);
  const [energy, setEnergy] = useState('normal');
  const [context, setContext] = useState('');
  const [step, setStep] = useState('form'); // form | loading | review
  const [err, setErr] = useState('');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [replace, setReplace] = useState(true);
  const ruleCount = activeRules(s).length;

  const run = async () => {
    setErr(''); setStep('loading');
    try {
      const res = await plan(buildPlanPayload(getState(), { hours: +hours || 3, energy, context }));
      if (!res.items.length) throw new Error('ה-AI לא מצא מה לתכנן. בדקי שיש משימות פתוחות.');
      setItems(res.items); setMessage(res.message); setStep('review');
    } catch (e) {
      setErr(e.message); setStep('form');
    }
  };

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    setItems(n);
  };
  const total = items.reduce((n, it) => n + (s.tasks[it.id]?.estimateMin ?? DEFAULT_MIN), 0);
  const over = total > (+hours || 3) * 60;
  const ruleText = (id) => s.rules[id]?.text || '';

  if (step !== 'review') {
    return (
      <Modal title="✨ תכנני לי את היום" onClose={onClose}>
        <p className="lead">כמה שאלות קצרות, וה-AI יבחר מה למקד היום ובאיזה סדר, לפי העדיפויות, הזמנים, והכללים שלך{ruleCount ? ` (${ruleCount} פעילים)` : ''}.</p>
        <label className="field">כמה שעות יש לך היום?
          <input type="number" min="0.5" max="16" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </label>
        <div className="field">איזו אנרגיה יש לך?
          <div className="chips">
            {ENERGY.map(([k, l]) => <button key={k} className={`chip ${energy === k ? 'on' : ''}`} onClick={() => setEnergy(k)}>{l}</button>)}
          </div>
        </div>
        <label className="field">משהו שחשוב לדעת על היום (לא חובה)
          <textarea rows={2} value={context} placeholder="למשל: התינוק ער עד 11, בערב יש אורחים" onChange={(e) => setContext(e.target.value)} />
        </label>
        {err && <p className="err">{err}</p>}
        <div className="modal-foot">
          <span className="grow" />
          <button className="btn primary" disabled={step === 'loading'} onClick={run}>{step === 'loading' ? '⏳ מתכננת…' : '✨ תכנני'}</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="✨ התוכנית להיום. אפשר לתקן" onClose={onClose}>
      {message && <p className="brain-msg">🧠 {message}</p>}
      {items.map((it, i) => {
        const t = s.tasks[it.id];
        if (!t) return null;
        return (
          <div className="plan-row" key={it.id}>
            <span className="plan-n">{i + 1}</span>
            <div className="grow">
              <div className="res-title">{taskIcon(t)} {t.title} <span className="count">{t.estimateMin != null ? `~${fmtMinutes(t.estimateMin)}` : 'בלי הערכת זמן'}</span></div>
              <div className="sug-why">
                {it.why && <span>✨ {it.why}</span>}
                {it.ruleIds.map((rid) => ruleText(rid) && <span key={rid} className="rule-badge" title={ruleText(rid)}>📏 {ruleText(rid).slice(0, 28)}</span>)}
              </div>
            </div>
            <button className="icon-btn" title="למעלה" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button className="icon-btn" title="למטה" disabled={i === items.length - 1} onClick={() => move(i, 1)}>▼</button>
            <button className="icon-btn" title="הסרה" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>✕</button>
          </div>
        );
      })}
      <p className={`plan-total ${over ? 'over' : ''}`}>
        סך הכל ~{fmtMinutes(total)} מתוך {hours} שעות{over ? '. זה יותר מהזמן שיש, כדאי להוריד משימה' : ''}
      </p>
      <label className="row show-done"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> להחליף את המיקוד הקיים להיום</label>
      <div className="modal-foot">
        <button className="btn soft" onClick={() => setStep('form')}>חזרה</button>
        <span className="grow" />
        <button className="btn primary" disabled={!items.length} onClick={() => { actions.saveDayPlan({ message, items }, replace); onClose(); }}>✨ קבעי כתוכנית היום</button>
      </div>
    </Modal>
  );
}
