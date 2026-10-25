import React, { useEffect, useRef, useState } from 'react';
import { uid, flush, getSyncState } from './store.js';
import { listAttachments, uploadImage, deleteAttachment } from './cloud.js';

// Images attached to a task. Files are shrunk in the browser, stored in a private bucket,
// and shown through short-lived signed links.
export default function Attachments({ taskId, userId }) {
  const [items, setItems] = useState(null); // null = loading
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);
  const input = useRef(null);

  const load = () => listAttachments(taskId).then(setItems).catch(() => { setItems([]); setErr('לא הצלחתי לטעון את התמונות.'); });
  useEffect(() => { load(); }, [taskId]);

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      // the task must exist on the server before a picture can point to it
      if (!(await flush())) throw new Error(`המשימה עדיין לא נשמרה בשרת (${getSyncState().error || 'שגיאת שמירה'})`);
      for (const f of files) await uploadImage(f, taskId, userId, uid());
      await load();
    } catch (ex) {
      console.error('image upload failed', ex);
      setErr(ex.message?.includes('אינה תמונה') ? ex.message : `ההעלאה נכשלה: ${ex.message || ex.error || 'שגיאה לא ידועה'}`);
    }
    setBusy(false);
  };
  const remove = async (a) => {
    if (!confirm('למחוק את התמונה?')) return;
    try { await deleteAttachment(a); setItems(items.filter((x) => x.id !== a.id)); }
    catch { setErr('המחיקה נכשלה. נסי שוב.'); }
  };

  return (
    <div className="field">תמונות
      <div className="thumbs">
        {(items || []).map((a) => (
          <div className="thumb" key={a.id}>
            <img src={a.url} alt={a.name} loading="lazy" onClick={() => setView(a)} />
            <button className="thumb-del" title="מחיקה" onClick={() => remove(a)}>✕</button>
          </div>
        ))}
        <button className="thumb add" disabled={busy} onClick={() => input.current.click()}>{busy ? '⏳' : '📷＋'}</button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      {items === null && <span className="hint">טוענת…</span>}
      {err && <p className="err">{err}</p>}
      {view && (
        <div className="lightbox" onClick={() => setView(null)}>
          <img src={view.url} alt={view.name} />
        </div>
      )}
    </div>
  );
}
