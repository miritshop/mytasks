import React, { useEffect, useState } from 'react';
import { supabase, configured } from './supabase.js';
import { startSession, endSession } from './store.js';
import App from './App.jsx';

const ERRORS = {
  'Invalid login credentials': 'האימייל או הסיסמה לא נכונים.',
  'User already registered': 'כבר קיים חשבון עם האימייל הזה. נסי להתחבר.',
  'Email not confirmed': 'צריך לאשר את האימייל. בדקי את תיבת הדואר (גם בספאם).',
  'Password should be at least 6 characters': 'הסיסמה קצרה מדי.',
};
const niceError = (e) => {
  const m = e?.message || '';
  if (/rate limit|too many/i.test(m)) return 'יותר מדי ניסיונות. נסי שוב בעוד כמה דקות.';
  if (/fetch|network/i.test(m)) return 'אין חיבור לאינטרנט.';
  return ERRORS[m] || 'משהו השתבש. נסי שוב.';
};

function Shell({ children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand big">🌈 היום שלי</div>
        {children}
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setInfo('');
    if (mode !== 'forgot' && password.length < 8) { setErr('הסיסמה צריכה להכיל לפחות 8 תווים.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        if (!data.session) setInfo('נשלח אליך מייל אישור. לחצי על הקישור בו ואז התחברי.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo('אם קיים חשבון עם האימייל הזה, נשלח אליו קישור לאיפוס סיסמה.');
      }
    } catch (ex) {
      setErr(niceError(ex));
    }
    setBusy(false);
  };

  const title = { login: 'כניסה', signup: 'יצירת חשבון', forgot: 'איפוס סיסמה' }[mode];
  return (
    <Shell>
      <h2 className="auth-title">{title}</h2>
      <form onSubmit={submit} className="auth-form">
        <label className="field">אימייל
          <input type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {mode !== 'forgot' && (
          <label className="field">סיסמה
            <div className="row">
              <input type={show ? 'text' : 'password'} dir="ltr" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="icon-btn" title={show ? 'הסתר' : 'הצג'} onClick={() => setShow(!show)}>{show ? '🙈' : '👁'}</button>
            </div>
          </label>
        )}
        {err && <p className="err">{err}</p>}
        {info && <p className="ok-msg">{info}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'רגע…' : title}</button>
      </form>
      <div className="auth-links">
        {mode === 'login' && <>
          <button className="link" onClick={() => { setMode('signup'); setErr(''); setInfo(''); }}>אין לי חשבון, ליצור</button>
          <button className="link" onClick={() => { setMode('forgot'); setErr(''); setInfo(''); }}>שכחתי סיסמה</button>
        </>}
        {mode !== 'login' && <button className="link" onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>חזרה לכניסה</button>}
      </div>
    </Shell>
  );
}

function NewPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setErr('הסיסמה צריכה להכיל לפחות 8 תווים.'); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setErr(niceError(error)); else onDone();
  };
  return (
    <Shell>
      <h2 className="auth-title">בחירת סיסמה חדשה</h2>
      <form onSubmit={save} className="auth-form">
        <label className="field">סיסמה חדשה
          <input type="password" dir="ltr" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary">שמירה</button>
      </form>
    </Shell>
  );
}

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [recovery, setRecovery] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [imported, setImported] = useState(false);
  const userId = session?.user?.id;

  useEffect(() => {
    if (!configured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { endSession(); setReady(false); return undefined; }
    let cancelled = false;
    setLoadErr('');
    startSession(userId)
      .then((r) => { if (!cancelled) { setImported(r.imported); setReady(true); } })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setLoadErr(e.message === 'SCHEMA_OUTDATED'
          ? 'בסיס הנתונים צריך עדכון: להריץ מחדש את supabase/schema.sql ב-SQL Editor של Supabase.'
          : 'לא הצלחנו לטעון את הנתונים. בדקי חיבור לאינטרנט ונסי שוב.');
      });
    return () => { cancelled = true; };
  }, [userId]);

  if (!configured) {
    return <Shell><p className="err">חסרה הגדרת חיבור (קובץ .env). ראו את .env.example.</p></Shell>;
  }
  if (session === undefined) return <Shell><p className="lead">רגע…</p></Shell>;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen />;
  if (loadErr) {
    return <Shell><p className="err">{loadErr}</p><button className="btn primary" onClick={() => window.location.reload()}>נסי שוב</button></Shell>;
  }
  if (!ready) return <Shell><p className="lead">טוענת את המשימות שלך…</p></Shell>;
  return <App email={session.user.email} userId={userId} imported={imported} onSignOut={() => supabase.auth.signOut()} />;
}
