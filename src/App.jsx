import React, { useState } from 'react';
import { actions, useStore, useSyncStatus, getState, TABLE_COLORS } from './store.js';
import TodayView from './TodayView.jsx';
import TableView from './TableView.jsx';
import GraphView from './GraphView.jsx';
import FilterView from './FilterView.jsx';
import RulesModal from './Rules.jsx';
import SuggestModal from './SuggestModal.jsx';
import PlanModal from './PlanModal.jsx';
import TaskModal from './TaskModal.jsx';
import BrainModal from './BrainModal.jsx';
import { SplitBanner, SplitModal, GroupModal } from './CategoryModals.jsx';
import { Modal, EmojiGrid, IconPicker } from './components.jsx';


export default function App({ email, userId, imported, onSignOut }) {
  const s = useStore();
  const sync = useSyncStatus();
  const [importNote, setImportNote] = useState(imported);
  const [taskId, setTaskId] = useState(null);
  const [brain, setBrain] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [newTable, setNewTable] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [editList, setEditList] = useState(null);
  const [groupId, setGroupId] = useState(null);
  const [split, setSplit] = useState(null); // { tableId, parentId }

  const { view, tableId } = s.ui;
  const isList = view === 'table' || view === 'graph';
  const table = s.tables[tableId];
  const parent = table?.parentTaskId ? s.tasks[table.parentTaskId] : null;
  const openTask = (id) => (getState().tasks[id]?.isGroup ? setGroupId(id) : setTaskId(id));
  const go = (p) => { actions.setUI(p); setMenu(false); };

  const createTable = () => {
    if (!name.trim()) return;
    actions.addTable(name.trim(), emoji);
    setName(''); setNewTable(false); setMenu(false);
  };

  return (
    <div className="app">
      <aside className={`side ${menu ? 'open' : ''}`}>
        <div className="brand">🌈 היום שלי</div>
        <button className={`nav ${view === 'today' ? 'on' : ''}`} onClick={() => go({ view: 'today' })}>☀️ היום</button>
        <button className={`nav ${view === 'filter' ? 'on' : ''}`} onClick={() => go({ view: 'filter' })}>🔎 סינון משימות</button>
        <div className="side-label">הרשימות שלי</div>
        {s.tableOrder.map((id) => {
          const t = s.tables[id];
          const active = isList && (tableId === id || table?.parentTaskId && s.tasks[table.parentTaskId]?.tableId === id);
          return (
            <div key={id} className={`nav-wrap ${active ? 'on' : ''}`}>
              <button className={`nav grow ${active ? 'on' : ''}`} onClick={() => go({ tableId: id, view: isList ? view : 'table' })}>
                <span className="dot" style={{ background: t.color }} />{t.emoji} {t.name}
              </button>
              <button className="mini edit-list" title="עריכה / מחיקה" onClick={() => setEditList(id)}>⋯</button>
            </div>
          );
        })}
        <button className="nav add" onClick={() => setNewTable(true)}>＋ רשימה חדשה</button>
        <span className="grow" />
        <button className="nav" onClick={() => { setRulesOpen(true); setMenu(false); }}>📏 הכללים שלי</button>
        <button className="nav" onClick={() => setBrain(true)}>🧠 המוח של Claude</button>
        <div className={`sync ${sync.status}`} title={sync.error}>
          {sync.status === 'saving' && '⏳ שומרת…'}
          {sync.status === 'idle' && '✓ הכל נשמר'}
          {sync.status === 'error' && <>⚠️ לא נשמר, מנסה שוב…<br /><small dir="ltr">{sync.error}</small></>}
        </div>
        <div className="account">
          <span className="grow" dir="ltr" title={email}>{email}</span>
          <button className="link" onClick={onSignOut}>התנתקות</button>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}

      <main className="main">
        <header className="top">
          <button className="icon-btn burger" onClick={() => setMenu(true)} aria-label="תפריט">☰</button>
          {!isList || !table ? (
            <h2 className="page-title">{view === 'filter' ? '🔎 סינון משימות' : '☀️ היום'}</h2>
          ) : (
            <div className="title-block">
              {parent && (
                <button className="crumb" onClick={() => actions.setUI({ tableId: parent.tableId })}>
                  → חזרה ל: {s.tables[parent.tableId]?.name} / {parent.title}
                </button>
              )}
              <div className="row">
                <IconPicker value={table.emoji} auto={null} onChange={(e) => actions.updateTable(table.id, { emoji: e })} />
                <input className="table-name" value={table.name} onChange={(e) => actions.updateTable(table.id, { name: e.target.value })} />
              </div>
            </div>
          )}
          {isList && table && (
            <button className="icon-btn" title="עריכה / מחיקה של הרשימה" onClick={() => setEditList(table.id)}>⋯</button>
          )}
          {isList && table && (
            <div className="seg">
              <button className={view === 'table' ? 'on' : ''} onClick={() => actions.setUI({ view: 'table' })}>▦ טבלה</button>
              <button className={view === 'graph' ? 'on' : ''} onClick={() => actions.setUI({ view: 'graph' })}>◎ גרף</button>
            </div>
          )}
        </header>

        <div className="content">
          {isList && table && <SplitBanner tableId={tableId} onSplit={(parentId, manual) => setSplit({ tableId, parentId, manual })} />}
          {view === 'filter' && <FilterView openTask={openTask} />}
          {view === 'today' && <TodayView openTask={openTask} openBrain={() => setBrain(true)} onPlan={() => setPlanOpen(true)} />}
          {view === 'table' && table && <TableView tableId={tableId} openTask={openTask} onAi={() => setSuggestOpen(true)} onSplit={(parentId) => setSplit({ tableId, parentId })} />}
          {view === 'graph' && table && <GraphView tableId={tableId} openTask={openTask} />}
        </div>
      </main>

      {importNote && (
        <div className="toast" onClick={() => setImportNote(false)}>
          ✅ העברנו את המשימות שהיו שמורות בדפדפן לחשבון שלך. עכשיו הן זמינות מכל מכשיר.
        </div>
      )}
      {groupId && <GroupModal id={groupId} onClose={() => setGroupId(null)} onSplit={(parentId) => setSplit({ tableId, parentId })} />}
      {split && <SplitModal tableId={split.tableId} parentId={split.parentId} manual={split.manual} onClose={() => setSplit(null)} />}
      {taskId && <TaskModal taskId={taskId} userId={userId} onClose={() => setTaskId(null)} />}
      {suggestOpen && table && <SuggestModal tableId={tableId} onClose={() => setSuggestOpen(false)} />}
      {planOpen && <PlanModal onClose={() => setPlanOpen(false)} />}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {brain && <BrainModal onClose={() => setBrain(false)} />}
      {editList && s.tables[editList] && <ListModal id={editList} onClose={() => setEditList(null)} />}
      {newTable && (
        <Modal title="רשימה חדשה" onClose={() => setNewTable(false)}>
          <label className="field">שם
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createTable()} />
          </label>
          <div className="field">אייקון: <span className="emoji-now">{emoji}</span>
            <EmojiGrid onPick={setEmoji} />
          </div>
          <div className="modal-foot"><span className="grow" /><button className="btn primary" onClick={createTable}>יצירה</button></div>
        </Modal>
      )}
    </div>
  );
}

function ListModal({ id, onClose }) {
  const s = useStore();
  const t = s.tables[id];
  const count = Object.values(s.tasks).filter((x) => x.tableId === id).length;
  const remove = () => {
    const msg = count ? `למחוק את "${t.name}" ואת ${count} המשימות שבה? אי אפשר לשחזר.` : `למחוק את "${t.name}"?`;
    if (confirm(msg)) { actions.deleteTable(id); onClose(); }
  };
  return (
    <Modal title="עריכת רשימה" onClose={onClose}>
      <div className="row">
        <IconPicker value={t.emoji} auto={null} onChange={(e) => actions.updateTable(id, { emoji: e })} />
        <input className="title-input" value={t.name} onChange={(e) => actions.updateTable(id, { name: e.target.value })} />
      </div>
      <div className="field">צבע
        <div className="chips">
          {TABLE_COLORS.map((c) => (
            <button key={c} className={`swatch ${t.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => actions.updateTable(id, { color: c })} aria-label="צבע" />
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn danger" onClick={remove}>🗑 מחיקת הרשימה</button>
        <span className="grow" />
        <button className="btn primary" onClick={onClose}>סגור</button>
      </div>
    </Modal>
  );
}
