import React from 'react';
import { actions, useStore } from './store.js';
import { Modal } from './components.jsx';

const EXAMPLES = [
  'משימות במטבח הן בקומה התחתונה',
  'לבשל רק כשהתינוק ער',
  'הערכות זמן נדיבות, כי אני נקטעת הרבה',
  'משימות שדורשות ריכוז עדיף בבוקר',
];

// The user's own rules for the AI. Each rule is a separate item: easy to add, change, switch off or delete.
export default function RulesModal({ onClose }) {
  const s = useStore();
  const rules = s.ruleOrder.map((id) => s.rules[id]).filter(Boolean);
  const active = rules.filter((r) => r.enabled && r.text.trim()).length;

  return (
    <Modal title="📏 הכללים שלי" onClose={onClose} wide>
      <p className="lead">
        כללים שה-AI יתחשב בהם כשהוא מעריך זמן, בוחר תגיות, קובע עדיפות ומתכנן את היום.
        כל כלל אפשר לכבות, לערוך או למחוק, ולהגביל לרשימה אחת. כל מה שה-AI קובע מסומן ב-<span className="ai-mark">✨</span>, ושינוי ידני מסיר את הסימון.
      </p>

      {rules.map((r, i) => (
        <div className={`rule-row ${r.enabled ? '' : 'off'}`} key={r.id}>
          <div className="row">
            <label className="switch" title={r.enabled ? 'פעיל' : 'כבוי'}>
              <input type="checkbox" checked={r.enabled} onChange={(e) => actions.updateRule(r.id, { enabled: e.target.checked })} />
              <span />
            </label>
            <textarea rows={1} className="rule-text" value={r.text} placeholder="כתבי כלל, למשל: לבשל רק כשהתינוק ער"
              onChange={(e) => actions.updateRule(r.id, { text: e.target.value })} />
          </div>
          <div className="row rule-meta">
            <select className="list-select" value={r.listId || ''} onChange={(e) => actions.updateRule(r.id, { listId: e.target.value || null })}>
              <option value="">חל על כל הרשימות</option>
              {s.tableOrder.map((id) => <option key={id} value={id}>רק ב: {s.tables[id].emoji} {s.tables[id].name}</option>)}
            </select>
            <span className="grow" />
            <button className="icon-btn" title="למעלה" disabled={i === 0} onClick={() => actions.moveRule(r.id, -1)}>▲</button>
            <button className="icon-btn" title="למטה" disabled={i === rules.length - 1} onClick={() => actions.moveRule(r.id, 1)}>▼</button>
            <button className="icon-btn" title="מחיקה" onClick={() => actions.deleteRule(r.id)}>🗑</button>
          </div>
        </div>
      ))}
      {!rules.length && <p className="hint">עדיין אין כללים. הוסיפי את הראשון, או בחרי דוגמה:</p>}

      <div className="chips example-chips">
        {EXAMPLES.filter((e) => !rules.some((r) => r.text === e)).map((e) => (
          <button key={e} className="chip" onClick={() => actions.addRule(e)}>＋ {e}</button>
        ))}
      </div>

      <div className="modal-foot">
        <button className="btn soft" onClick={() => actions.addRule('')}>＋ כלל חדש</button>
        <span className="grow" />
        <span className="count">{active} פעילים</span>
        <button className="btn primary" onClick={onClose}>סגור</button>
      </div>
    </Modal>
  );
}
