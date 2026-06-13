import { useEffect, useState } from 'react';
import api from '../api/client';

const PRIORITY_CONFIG = {
  high: { label: 'Alta', bg: '#fee2e2', color: '#991b1b' },
  normal: { label: 'Normal', bg: '#dbeafe', color: '#1e40af' },
  low: { label: 'Baja', bg: '#f3f4f6', color: '#374151' },
};

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('pending'); // pending | completed | all

  function load() {
    setLoading(true);
    api.get('/notes').then((res) => setNotes(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleComplete(note) {
    await api.put(`/notes/${note.id}`, { completed: !note.completed });
    load();
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta nota?')) return;
    await api.delete(`/notes/${id}`);
    load();
  }

  const filtered = notes.filter((n) => {
    if (filter === 'pending') return !n.completed;
    if (filter === 'completed') return n.completed;
    return true;
  });

  const pendingCount = notes.filter((n) => !n.completed).length;
  const overdueCount = notes.filter((n) => !n.completed && n.dueDate && new Date(n.dueDate) < new Date()).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agenda / Notas</h1>
          <p className="page-subtitle">Recordatorios y tareas pendientes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
          + Nueva nota
        </button>
      </div>

      {overdueCount > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠️</span>
          <span style={{ fontSize: 14, color: '#92400e' }}>
            Tenés <strong>{overdueCount}</strong> {overdueCount === 1 ? 'tarea vencida' : 'tareas vencidas'}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['pending', 'completed', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: 'none',
              background: filter === f ? 'var(--primary)' : '#f3f4f6',
              color: filter === f ? 'white' : '#374151',
            }}
          >
            {f === 'pending' ? `Pendientes (${pendingCount})` : f === 'completed' ? 'Completadas' : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>{filter === 'completed' ? 'No hay tareas completadas' : 'No hay tareas pendientes'}</h3>
            {filter === 'pending' && (
              <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
                + Nueva nota
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((note) => {
            const isOverdue = !note.completed && note.dueDate && new Date(note.dueDate) < new Date();
            const pCfg = PRIORITY_CONFIG[note.priority] || PRIORITY_CONFIG.normal;
            return (
              <div
                key={note.id}
                className="card"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  opacity: note.completed ? 0.6 : 1,
                  borderLeft: `4px solid ${isOverdue ? '#ef4444' : note.priority === 'high' ? '#f59e0b' : '#e5e7eb'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={note.completed}
                  onChange={() => toggleComplete(note)}
                  style={{ marginTop: 3, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      textDecoration: note.completed ? 'line-through' : 'none',
                      color: note.completed ? '#9ca3af' : '#111827',
                    }}>
                      {note.title}
                    </span>
                    <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, background: pCfg.bg, color: pCfg.color }}>
                      {pCfg.label}
                    </span>
                    {isOverdue && (
                      <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, background: '#fee2e2', color: '#991b1b' }}>
                        ⚠ Vencida
                      </span>
                    )}
                  </div>
                  {note.content && (
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{note.content}</p>
                  )}
                  {note.dueDate && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: isOverdue ? '#ef4444' : '#9ca3af' }}>
                      📅 Vence: {new Date(note.dueDate).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(note); setShowModal(true); }}>Editar</button>
                  <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => handleDelete(note.id)}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NoteModal
          note={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function NoteModal({ note, onClose, onSaved }) {
  const isEdit = !!note;
  const [form, setForm] = useState({
    title: note?.title || '',
    content: note?.content || '',
    dueDate: note?.dueDate ? note.dueDate.slice(0, 10) : '',
    priority: note?.priority || 'normal',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
      };
      if (isEdit) {
        await api.put(`/notes/${note.id}`, payload);
      } else {
        await api.post('/notes', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar nota' : 'Nueva nota'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Título *</label>
            <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="¿Qué hay que hacer?" required />
          </div>
          <div className="field">
            <label>Detalle</label>
            <textarea rows="3" value={form.content} onChange={(e) => update('content', e.target.value)} placeholder="Descripción o contexto adicional..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Fecha límite</label>
              <input type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Prioridad</label>
              <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear nota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
