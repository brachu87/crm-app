import { useState, useEffect } from 'react'
import api from '../api/client'
import { useSectionPerms } from '../config/permissions'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon-Sun display order

const colorMap = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'
]

export default function Horarios() {
  const can = useSectionPerms('horarios')
  const [schedules, setSchedules] = useState([])
  const [activities, setActivities] = useState([])
  const [employees, setEmployees] = useState([])
  const [branches, setBranches] = useState([])
  const [filterBranch, setFilterBranch] = useState('')
  const [filterActivity, setFilterActivity] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ activityId: '', employeeId: '', branchId: '', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', maxCapacity: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const params = {}
    if (filterBranch) params.branchId = filterBranch
    if (filterActivity) params.activityId = filterActivity
    const [s, a, e, b] = await Promise.all([
      api.get('/schedules', { params }),
      api.get('/activities'),
      api.get('/employees'),
      api.get('/branches')
    ])
    setSchedules(s.data)
    setActivities(a.data)
    setEmployees(e.data)
    setBranches(b.data)
  }

  useEffect(() => { load() }, [filterBranch, filterActivity])

  const openNew = (day) => {
    setForm({ activityId: activities[0]?.id || '', employeeId: '', branchId: '', dayOfWeek: day ?? 1, startTime: '08:00', endTime: '09:00', maxCapacity: '' })
    setModal('new')
  }
  const openEdit = s => {
    setForm({ activityId: s.activityId, employeeId: s.employeeId || '', branchId: s.branchId || '', dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, maxCapacity: s.maxCapacity ?? '' })
    setModal(s)
  }

  const save = async () => {
    if (!form.activityId) return
    setSaving(true)
    try {
      const body = { ...form, dayOfWeek: Number(form.dayOfWeek), maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null, employeeId: form.employeeId || null, branchId: form.branchId || null }
      if (modal === 'new') await api.post('/schedules', body)
      else await api.put(`/schedules/${modal.id}`, body)
      await load()
      setModal(null)
    } finally { setSaving(false) }
  }

  const del = async s => {
    if (!window.confirm('¿Eliminar este horario?')) return
    await api.delete(`/schedules/${s.id}`)
    load()
  }

  // Group by day
  const byDay = {}
  WEEK_ORDER.forEach(d => { byDay[d] = [] })
  schedules.forEach(s => { if (byDay[s.dayOfWeek]) byDay[s.dayOfWeek].push(s) })
  // Sort each day by startTime
  WEEK_ORDER.forEach(d => byDay[d].sort((a, b) => a.startTime.localeCompare(b.startTime)))

  // Activity color index
  const actColorIdx = {}
  activities.forEach((a, i) => { actColorIdx[a.id] = i % colorMap.length })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Horarios</h1>
          <p className="page-subtitle">Grilla semanal de clases y actividades</p>
        </div>
        {can.editar && <button className="btn btn-primary" onClick={() => openNew()}>+ Nuevo horario</button>}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {branches.length > 0 && (
          <select className="field-input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ minWidth: 0, width: '100%' }}>
            <option value="">Todas las sedes</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <select className="field-input" value={filterActivity} onChange={e => setFilterActivity(e.target.value)} style={{ minWidth: 0, width: '100%' }}>
          <option value="">Todas las actividades</option>
          {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Weekly grid - desktop */}
      <div className="schedule-grid">
        {WEEK_ORDER.map(day => (
          <div key={day} className="schedule-col">
            <div className="schedule-day-header">
              <span className="day-full">{DAYS[day]}</span>
              <span className="day-short">{DAYS_SHORT[day]}</span>
              {can.editar && <button className="add-slot-btn" onClick={() => openNew(day)} title="Agregar horario">+</button>}
            </div>
            <div className="schedule-slots">
              {byDay[day].length === 0 ? (
                <div className="empty-slot">Sin clases</div>
              ) : byDay[day].map(s => (
                <div key={s.id} className="schedule-card" style={{ borderLeft: `4px solid ${colorMap[actColorIdx[s.activityId] ?? 0]}` }}>
                  <div className="sc-time">{s.startTime} – {s.endTime}</div>
                  <div className="sc-activity">{s.activity?.name}</div>
                  {s.employee && <div className="sc-employee">👤 {s.employee.name}</div>}
                  {s.branch && <div className="sc-branch">🏢 {s.branch.name}</div>}
                  {s.maxCapacity && <div className="sc-capacity">👥 cupo {s.maxCapacity}</div>}
                  <div className="sc-actions">
                    {can.editar && <button onClick={() => openEdit(s)}>✏️</button>}
                    {can.editar && <button onClick={() => del(s)}>🗑️</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'new' ? 'Nuevo horario' : 'Editar horario'}</h2>
            <div className="two-col-grid">
              <div className="field">
                <label>Actividad *</label>
                <select value={form.activityId} onChange={e => setForm(f => ({ ...f, activityId: e.target.value }))}>
                  <option value="">Seleccioná</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Día</label>
                <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}>
                  {WEEK_ORDER.map(d => <option key={d} value={d}>{DAYS[d]}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Hora inicio</label>
                <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="field">
                <label>Hora fin</label>
                <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div className="field">
                <label>Instructor / Empleado</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Sede</label>
                <select value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
                  <option value="">Sin sede</option>
                  {branches.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Cupo máximo</label>
                <input type="number" min="1" value={form.maxCapacity} onChange={e => setForm(f => ({ ...f, maxCapacity: e.target.value }))} placeholder="Sin límite" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.activityId}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
