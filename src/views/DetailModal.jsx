import { useState } from "react";
import { TC, LINKS, INITIAL_ENTRIES } from "../data/constants";

export default function DetailModal({ entry, onClose, onDelete, onUpdate }) {
  if (!entry) return null;
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editContent, setEditContent] = useState(entry.content);
  const [editType, setEditType] = useState(entry.type);
  const [editTags, setEditTags] = useState((entry.tags || []).join(', '));
  const cfg = TC[editType] || TC.note;
  const related = LINKS.filter(l => l.from === entry.id || l.to === entry.id).map(l => ({
    ...l,
    other: INITIAL_ENTRIES.find(e => e.id === (l.from === entry.id ? l.to : l.from)),
    dir: l.from === entry.id ? '→' : '←',
  }));
  const skip = new Set(['category', 'status']);
  const meta = Object.entries(entry.metadata || {}).filter(([k]) => !skip.has(k));
  const inp = { padding: '10px 14px', background: '#0f0f23', border: '1px solid #4ECDC440', borderRadius: 10, color: '#ddd', fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

  const handleSave = async () => {
    setSaving(true);
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    await onUpdate(entry.id, { title: editTitle, content: editContent, type: editType, tags });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000CC', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={editing ? undefined : onClose}>
      <div style={{ background: '#16162a', borderRadius: 16, maxWidth: 600, width: '100%', maxHeight: '85vh', overflow: 'auto', border: `1px solid ${cfg.c}40` }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #2a2a4a', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 24 }}>{cfg.i}</span><span style={{ fontSize: 11, color: cfg.c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>{editType}</span></div>
            {!editing && <h2 style={{ margin: 0, fontSize: 22, color: '#EAEAEA', fontWeight: 700 }}>{editTitle}</h2>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {!editing && onDelete && <button onClick={async () => { setDeleting(true); await onDelete(entry.id); }} disabled={deleting} style={{ padding: '6px 14px', background: deleting ? '#1a1a2e' : '#FF6B3520', border: '1px solid #FF6B3540', borderRadius: 8, color: deleting ? '#555' : '#FF6B35', fontSize: 12, fontWeight: 600, cursor: deleting ? 'default' : 'pointer' }}>{deleting ? 'Deleting...' : 'Delete'}</button>}
            {!editing && onUpdate && <button onClick={() => setEditing(true)} style={{ padding: '6px 14px', background: '#4ECDC420', border: '1px solid #4ECDC440', borderRadius: 8, color: '#4ECDC4', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>}
            <button onClick={editing ? () => setEditing(false) : onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 24, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        {editing ? (
          <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Title</label><input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={inp} /></div>
            <div><label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Type</label>
              <select value={editType} onChange={e => setEditType(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {['note','person','place','idea','contact','document','reminder','color','decision'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Content</label><textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} /></div>
            <div><label style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Tags <span style={{ color: '#555', fontWeight: 400, textTransform: 'none' }}>(comma separated)</span></label><input value={editTags} onChange={e => setEditTags(e.target.value)} style={inp} placeholder="tag1, tag2, tag3" /></div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 12, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !editTitle.trim()} style={{ flex: 2, padding: 12, background: editTitle.trim() ? 'linear-gradient(135deg, #4ECDC4, #45B7D1)' : '#1a1a2e', border: 'none', borderRadius: 10, color: editTitle.trim() ? '#0f0f23' : '#444', fontSize: 13, fontWeight: 700, cursor: editTitle.trim() ? 'pointer' : 'default' }}>{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px 28px' }}>
            <p style={{ color: '#bbb', fontSize: 14, lineHeight: 1.7, margin: 0 }}>{editContent}</p>
            {meta.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', marginTop: 12 }}>
              {meta.map(([k, v]) => <div key={k} style={{ fontSize: 12 }}><span style={{ color: '#888', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}: </span><span style={{ color: '#ccc' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>)}
            </div>}
            {editTags.split(',').map(t => t.trim()).filter(Boolean).length > 0 && <div style={{ marginTop: 16 }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{editTags.split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} style={{ fontSize: 11, color: cfg.c, background: cfg.c + '15', padding: '4px 12px', borderRadius: 20 }}>{t}</span>)}</div></div>}
            {related.length > 0 && <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #2a2a4a' }}>
              <p style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase' }}>Connections</p>
              {related.map((r, i) => r.other && <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#ffffff05', borderRadius: 8, marginBottom: 4, fontSize: 13 }}>
                <span>{TC[r.other.type]?.i}</span><span style={{ color: '#999' }}>{r.dir}</span><span style={{ color: '#ccc', flex: 1 }}>{r.other.title}</span><span style={{ color: '#666', fontSize: 11, fontStyle: 'italic' }}>{r.rel}</span>
              </div>)}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}
