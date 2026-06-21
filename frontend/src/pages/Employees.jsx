import { useEffect, useState } from 'react';
import api from '../api/client';

const ROLES_SUGERIDOS = ['Instructor', 'Recepcionista', 'Limpieza', 'Administrativo', 'Vendedor', 'Otro'];

function exportCSV(employees) {
  const rows = [
    ['Nombre', 'Rol', 'Teléfono', 'Email', 'Sueldo', 'Fecha ingreso', 'Activo', 'Notas'],
    ...employees.map((e) => [
      e.name, e.role, e.phone || '', e.email || '',
      e.salary ?? '', new Date(e.startDate).toLocaleDateString('es-AR'),
      e.active ? 'Sí' : 'No', e.notes || '',
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'empleados.csv';
  a.click();
}

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/employees').then((res) => setEmployees(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este empleado?')) return;
    await api.delete(`/employees/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Empleados</h1>
          <p className="page-subtitle">Gestión del equipo de trabajo</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {employees.length > 0 && (
            <button className="btn btn-secondary" onClick={() => exportCSV(employees)}>↓ Exportar CSV</button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Nuevo empleado
          </button>
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : employees.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no hay empleados</h3>
            <p>Registrá a los miembros de tu equipo para llevar el control.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nuevo empleado
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Sede</th>
                <th>Actividades</th>
                <th>Teléfono</th>
                <th>Tipo pago</th>
                <th>Tarifa</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.name}</strong></td>
                  <td>{e.role}</td>
                  <td>{e.branch?.name || <span style={{color:'var(--ink-soft)'}}>-</span>}</td>
                  <td style={{fontSize:13}}>{e.activityEmployees?.length > 0 ? e.activityEmployees.map(ae => ae.activity?.name).filter(Boolean).join(', ') : <span style={{color:'var(--ink-soft)'}}>-</span>}</td>
                  <td>{e.phone || '-'}</td>
                  <td>{e.payType === 'hourly' ? 'Por hora' : e.payType === 'fixed' ? 'Fijo' : '-'}</td>
                  <td>{e.salary != null ? `$${Number(e.salary).toLocaleString('es-AR')}` : '-'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: e.active ? '#d1fae5' : '#fee2e2',
                      color: e.active ? '#065f46' : '#991b1b',
                    }}>
                      {e.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(e); setShowModal(true); }}>
                      Editar
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#dc2626' }} onClick={() => handleDelete(e.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name: employee?.name || '',
    role: employee?.role || '',
    phone: employee?.phone || '',
    email: employee?.email || '',
    salary: employee?.salary ?? '',
    payType: employee?.payType || 'hourly',
    payFrequency: employee?.payFrequency || 'monthly',
    startDate: employee?.startDate ? employee.startDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    notes: employee?.notes || '',
    active: employee?.active !== undefined ? employee.active : true,
    branchId: employee?.branchId || '',
  });
  const [branches, setBranches] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/branches').then(r => setBranches(r.data.filter(b => b.active))); }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        role: form.role,
        phone: form.phone || undefined,
        email: form.email || undefined,
        salary: form.salary !== '' ? form.salary : undefined,
        payType: form.payType,
        payFrequency: form.payFrequency,
        startDate: form.startDate,
        notes: form.notes || undefined,
        active: form.active,
        branchId: form.branchId || null,
      };
      if (isEdit) {
        await api.put(`/employees/${employee.id}`, payload);
      } else {
        await api.post('/employees', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el empleado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="field">
            <label>Rol / Puesto *</label>
            <input
              list="roles-list"
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              placeholder="Ej: Instructor, Recepcionista..."
              required
            />
            <datalist id="roles-list">
              {ROLES_SUGERIDOS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Ej: 11 5555 5555" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Tipo de pago</label>
              <select value={form.payType} onChange={e => update('payType', e.target.value)}>
                <option value="hourly">Por hora</option>
                <option value="fixed">Sueldo fijo</option>
              </select>
            </div>
            <div className="field">
              <label>Frecuencia de pago</label>
              <select value={form.payFrequency} onChange={e => update('payFrequency', e.target.value)}>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>{form.payType === 'hourly' ? 'Valor por hora ($)' : 'Sueldo fijo ($)'}</label>
              <input type="number" min="0" step="0.01" value={form.salary} onChange={(e) => update('salary', e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Fecha de ingreso</label>
              <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} />
            </div>
          </div>
          {branches.length > 0 && <div className="field">
            <label>Sede</label>
            <select value={form.branchId} onChange={e => update('branchId', e.target.value)}>
              <option value="">Sin sede</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>}
          <div className="field">
            <label>Notas</label>
            <textarea rows="2" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
          {isEdit && (
            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="active" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
              <label htmlFor="active" style={{ marginBottom: 0 }}>Empleado activo</label>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
