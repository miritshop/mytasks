import React, { useState } from 'react';
import { actions, buildBrainPrompt, applyBrainPlan } from './store.js';
import { Modal } from './components.jsx';

export default function BrainModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const [err, setErr] = useState('');
  const [backup, setBackup] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(buildBrainPrompt()); setCopied(true); }
    catch { setErr('לא הצלחתי להעתיק. נסי שוב.'); }
  };
  const pasteAndApply = async () => {
    try { applyBrainPlan(await navigator.clipboard.readText()); onClose(); actions.setUI({ view: 'today' }); }
    catch { setErr('לא הצלחתי לקרוא את התשובה מהלוח. ודאי שהעתקת את כל התשובה של Claude, או הדביקי ידנית.'); }
  };
  const apply = () => {
    try { applyBrainPlan(reply); onClose(); actions.setUI({ view: 'today' }); }
    catch { setErr('לא הצלחתי לקרוא את התשובה. ודאי שהדבקת את ה-JSON כולו.'); }
  };
  const exportFile = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([actions.exportJSON()], { type: 'application/json' }));
    a.download = 'my-tasks-backup.json';
    a.click();
  };
  const importFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => { try { actions.importJSON(t); onClose(); } catch { setErr('קובץ לא תקין'); } });
  };

  return (
    <Modal title="🧠 המוח של Claude" onClose={onClose}>
      <p className="lead">Claude עוזר/ת לך להחליט מה חשוב, מה קל להתחיל ממנו, ומה אפשר לדחות.</p>
      <ol className="steps">
        <li>
          <b>העתיקי את המשימות שלך</b>
          <button className="btn primary" onClick={copy}>{copied ? '✓ הועתק!' : '📋 העתק לבקשה'}</button>
        </li>
        <li><b>הדביקי בשיחה עם Claude</b> (בחלון הצ'אט) ושלחי.</li>
        <li>
          <b>העתיקי את התשובה של Claude, וחזרי לכאן</b>
          <button className="btn primary" onClick={pasteAndApply}>📥 הדבק מהלוח והחל</button>
          <details className="paste-box"><summary>או הדביקי ידנית</summary>
            <textarea rows={4} value={reply} placeholder='{"message": "...", "focus": [...]}' onChange={(e) => { setReply(e.target.value); setErr(''); }} />
            <button className="btn soft small" disabled={!reply.trim()} onClick={apply}>החל</button>
          </details>
        </li>
      </ol>
      {err && <p className="err">{err}</p>}
      <div className="modal-foot">
        <button className="link" onClick={() => setBackup(!backup)}>גיבוי ונתונים</button>
      </div>
      {backup && (
        <div className="row wrap">
          <button className="btn soft small" onClick={exportFile}>⬇ ייצוא גיבוי</button>
          <label className="btn soft small">⬆ ייבוא<input type="file" accept="application/json" hidden onChange={importFile} /></label>
          <button className="btn danger small" onClick={() => { if (confirm('לאפס הכל לנתוני הדגמה?')) { actions.reset(); onClose(); } }}>איפוס</button>
        </div>
      )}
    </Modal>
  );
}
