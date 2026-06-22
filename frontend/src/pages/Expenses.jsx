import { useEffect, useState } from 'react';
import api from '../api/client';

const CATEGORIAS = ['Alquiler', 'Sueldos', 'Servicios', 'Mantenimiento', 'Marketing', 'Equipamiento', 'Limpieza', 'Impuestos', 'Otro'];
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Débito', 'Crédito', 'Otro'];

function exportCSV(expenses) {
  const rows = [
    ['Fecha', 'Categoría', 'Descripción', 'Método de pago', 'Monto'],
    ...expenses.map((e) => [
      new Date(e.date).toLocaleDateString('es-AR'),
      e.category, e.description || '', e.paymentMethod || '', e.amount,
    ]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'gastos.csv';
  a.click();
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [suppliers, setSuppliers] = useState([]);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/expenses'),
      api.get('/suppliers'),
    ]).then(([expRes, supRes]) => {
      setExpenses(expRes.data);
      setSuppliers(supRes.data || []);
    }).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await api.delete(`/expenses/${id}`);
    load();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Gastos</h1>
          <p className="page-subtitle">Control de egresos del negocio</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {expenses.length > 0 && (
            <button className="btn btn-secondary" onClick={() => exportCSV(expenses)}>↓ Exportar CSV</button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            + Nuevo gasto
          </button>
        </div>
      </div>

      {!loading && expenses.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Total gastos</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#dc2626' }}>
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="card" style={{ flex: 1, padding: '16px 20px' }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Cantidad de registros</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{expenses.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : expenses.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no hay gastos registrados</h3>
            <p>Llevá el control de los egresos de tu negocio.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nuevo gasto
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Proveedor</th>
                <th>Método de pago</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString('es-AR')}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: 'var(--bg)',
                      color: 'var(--ink)',
                    }}>
                      {e.category}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.description || '-'}</td>
                  <td style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{e.supplier?.name || '-'}</td>
                  <td>{e.paymentMethod || '-'}</td>
                  <td style={{ fontWeight: 600, color: '#dc2626' }}>
                    ${Number(e.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
        <ExpenseModal
          expense={editing}
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function ExpenseModal({ expense, suppliers = [], onClose, onSaved }) {
  const isEdit = !!expense;
  const [form, setForm] = useState({
    amount: expense?.amount ?? '',
    date: expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    category: expense?.category || '',
    description: expense?.description || '',
    paymentMethod: expense?.paymentMethod || '',
    supplierId: expense?.supplierId || '',
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
      const rawAmount = String(form.amount).replace(',', '.').replace(/[^0-9.]/g, '');
      const parsedAmount = parseFloat(rawAmount);
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        setError('El monto ingresado no es válido');
        setSaving(false);
        return;
      }
      const payload = {
        amount: parsedAmount,
        date: form.date,
        category: form.category,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod || undefined,
        supplierId: form.supplierId || null,
      };
      if (isEdit) {
        await api.put(`/expenses/${expense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el gasto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="two-col-grid">
            <div className="field">
              <label>Monto ($) *</label>
              <input type="text" inputMode="decimal" value={form.amount} onChange={(e) => update('amount', e.target.value)} placeholder="0,00" required />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Categoría *</label>
            <input
              list="categorias-list"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              placeholder="Seleccioná o escribí una categoría"
              required
            />
            <datalist id="categorias-list">
              {CATEGORIAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="field">
            <label>Descripción / Nota</label>
            <textarea rows="2" value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Detalle del gasto (opcional)" />
          </div>
          <div className="field">
            <label>Método de pago</label>
            <select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value)}>
              <option value="">— Sin especificar —</option>
              {METODOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {suppliers.length > 0 && (
            <div className="field">
              <label>Proveedor asociado <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 12 }}>(opcional)</span></label>
              <select value={form.supplierId} onChange={(e) => update('supplierId', e.target.value)}>
                <option value="">— Sin proveedor —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
