import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { ExportMenu } from '../lib/dataIO';

const STATUS_LABELS = { present: 'Presente', absent: 'Ausente', late: 'Tardanza', half: 'Medio día' };
const STATUS_COLORS = { present: '#10b981', absent: '#ef4444', late: '#f59e0b', half: '#6366f1' };
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon, to: sun };
}
function toISO(d) { return d.toISOString().split('T')[0]; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtMoney(n) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0); }
function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [weekStart, setWeekStart] = useState(() => { const { from } = getWeekRange(new Date()); return toISO(from); });
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'shift'
  const [editModal, setEditModal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/employees').then(r => {
      const active = r.data.filter(e => e.active !== false);
      setEmployees(active);
      if (active.length > 0 && !selectedEmp) setSelectedEmp(active[0]);
    });
  }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => toISO(addDays(new Date(weekStart + 'T12:00:00'), i)));

  const load = useCallback(() => {
    if (!selectedEmp) return;
    const from = weekDays[0];
    const to = weekDays[6];
    setLoading(true);
    Promise.all([
      api.get(`/attendance?employeeId=${selectedEmp.id}&from=${from}&to=${to}T23:59:59`),
      api.get(`/schedules?employeeId=${selectedEmp.id}`),
    ]).then(([attR, schR]) => {
      setAttendances(attR.data);
      setSchedules(schR.data || []);
    }).finally(() => setLoading(false));
  }, [selectedEmp, weekStart]);

  useEffect(() => { load(); }, [load]);

  function getAtt(dateStr, scheduleId) {
    return attendances.find(a =>
      toISO(new Date(a.date)) === dateStr &&
      (scheduleId ? a.classScheduleId === scheduleId : !a.classScheduleId)
    );
  }

  async function quickMark(dateStr, status, scheduleId, existingId) {
    const hoursWorked = status === 'absent' ? 0 : status === 'half' ? 4 : scheduleId ? calcShiftHours(scheduleId) : 8;
    if (existingId) {
      const updated = await api.put(`/attendance/${existingId}`, { status, hoursWorked });
      setAttendances(prev => prev.map(a => a.id === existingId ? updated.data : a));
    } else {
      const created = await api.post('/attendance', {
        employeeId: selectedEmp.id, date: dateStr, status, hoursWorked,
        classScheduleId: scheduleId || undefined,
      });
      setAttendances(prev => [...prev, created.data]);
    }
  }

  function calcShiftHours(scheduleId) {
    const sch = schedules.find(s => s.id === scheduleId);
    if (!sch) return 1;
    const [sh, sm] = sch.startTime.split(':').map(Number);
    const [eh, em] = sch.endTime.split(':').map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }

  function getShiftsForDay(dayIndex) {
    return schedules.filter(s => s.dayOfWeek === dayIndex);
  }

  const totalHours = attendances.reduce((s, a) => s + (a.status !== 'absent' ? a.hoursWorked : 0), 0);
  const presentCount = attendances.filter(a => a.status !== 'absent').length;

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Asistencias</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 20, fontSize: 14 }}>Registrá la asistencia y horas trabajadas de cada empleado</p>

      {/* Employee selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {employees.map(e => (
          <button key={e.id} onClick={() => setSelectedEmp(e)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '2px solid',
              borderColor: selectedEmp?.id === e.id ? 'var(--accent)' : 'var(--border)',
              background: selectedEmp?.id === e.id ? 'var(--accent)' : 'var(--surface)',
              color: selectedEmp?.id === e.id ? '#fff' : 'var(--ink)',
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}>{e.name}</button>
        ))}
      </div>

      {selectedEmp && (
        <>
          {/* Employee pay info */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Tipo de pago</span><br /><strong>{selectedEmp.payType === 'hourly' ? 'Por hora' : 'Sueldo fijo'}</strong></div>
            <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>Frecuencia</span><br /><strong>{{ weekly: 'Semanal', biweekly: 'Quincenal', monthly: 'Mensual' }[selectedEmp.payFrequency] || selectedEmp.payFrequency}</strong></div>
            <div><span style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedEmp.payType === 'hourly' ? 'Valor hora' : 'Sueldo'}</span><br /><strong>{fmtMoney(selectedEmp.salary)}</strong></div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Esta semana</span><br />
              <strong style={{ color: '#10b981' }}>{totalHours.toFixed(1)} hs · {presentCount} días</strong>
            </div>
          </div>

          {/* Week navigation + view toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(toISO(addDays(new Date(weekStart + 'T12:00:00'), -7)))}>← Sem. anterior</button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {fmtDate(weekDays[0])} — {fmtDate(weekDays[6])}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(toISO(addDays(new Date(weekStart + 'T12:00:00'), 7)))}>Sem. siguiente →</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setWeekStart(toISO(getWeekRange(new Date()).from))}>Hoy</button>
            {selectedEmp && attendances.length > 0 && (
              <ExportMenu
                rows={attendances}
                filename={`asistencias-${selectedEmp.name || ''}`}
                title={`Asistencias — ${selectedEmp.name || ''}`}
                columns={[
                  { header: 'Fecha', value: (a) => a.date ? new Date(a.date).toLocaleDateString('es-AR') : '' },
                  { header: 'Empleado', value: () => selectedEmp?.name || '' },
                  { header: 'Turno', value: (a) => a.classSchedule ? `${a.classSchedule.activity?.name || ''} ${a.classSchedule.startTime || ''}-${a.classSchedule.endTime || ''}`.trim() : 'General' },
                  { header: 'Estado', value: (a) => ({ present: 'Presente', absent: 'Ausente', half: 'Medio día', late: 'Tarde', holiday: 'Feriado' }[a.status] || a.status || '') },
                  { header: 'Horas', value: (a) => a.hoursWorked ?? '' },
                  { header: 'Notas', value: (a) => a.notes || '' },
                ]}
              />
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {['day', 'shift'].map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: viewMode === m ? 'var(--accent)' : 'var(--surface)', color: viewMode === m ? '#fff' : 'var(--ink)' }}>
                  {m === 'day' ? 'Por día' : 'Por turno'}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Cargando...</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekDays.map((dateStr, idx) => {
                const dayLabel = DAYS[new Date(dateStr + 'T12:00:00').getDay()];
                const dayNum = new Date(dateStr + 'T12:00:00').getDate();
                const isToday = dateStr === toISO(new Date());

                if (viewMode === 'shift') {
                  const dayShifts = getShiftsForDay(new Date(dateStr + 'T12:00:00').getDay());
                  return (
                    <div key={dateStr}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, marginTop: idx > 0 ? 8 : 0 }}>
                        {dayLabel} {dayNum}{isToday ? ' · Hoy' : ''}
                      </div>
                      {dayShifts.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>Sin turnos asignados</div>
                      ) : dayShifts.map(sch => {
                        const att = getAtt(dateStr, sch.id);
                        return (
                          <DayRow key={sch.id} label={`${sch.activity?.name || 'Actividad'} ${sch.startTime}–${sch.endTime}`}
                            att={att} dateStr={dateStr} scheduleId={sch.id}
                            onQuick={quickMark} onEdit={setEditModal} />
                        );
                      })}
                    </div>
                  );
                }

                // Day mode
                const att = getAtt(dateStr, null);
                return (
                  <DayRow key={dateStr}
                    label={`${dayLabel} ${dayNum}${isToday ? ' · Hoy' : ''}`}
                    att={att} dateStr={dateStr} scheduleId={null}
                    onQuick={quickMark} onEdit={setEditModal} bold />
                );
              })}
            </div>
          )}
        </>
      )}

      {editModal && (
        <EditModal record={editModal} onClose={() => setEditModal(null)}
          onSave={async (data) => {
            const updated = await api.put(`/attendance/${editModal.id}`, data);
            setAttendances(prev => prev.map(a => a.id === editModal.id ? updated.data : a));
            setEditModal(null);
          }} />
      )}
    </div>
  );
}

function DayRow({ label, att, dateStr, scheduleId, onQuick, onEdit, bold }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      flexWrap: 'wrap',
    }}>
      <span style={{ minWidth: 130, fontSize: 13, fontWeight: bold ? 700 : 500 }}>{label}</span>
      {att ? (
        <>
          <span style={{ background: STATUS_COLORS[att.status] + '22', color: STATUS_COLORS[att.status], padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
            {STATUS_LABELS[att.status]}
          </span>
          {att.status !== 'absent' && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{att.hoursWorked}h</span>}
          {att.notes && <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>{att.notes}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {Object.keys(STATUS_LABELS).filter(s => s !== att.status).map(s => (
              <button key={s} onClick={() => onQuick(dateStr, s, scheduleId, att.id)}
                style={{ padding: '2px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11, color: STATUS_COLORS[s], fontWeight: 600 }}>
                {STATUS_LABELS[s]}
              </button>
            ))}
            <button onClick={() => onEdit(att)} style={{ padding: '2px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 11 }}>✏️</button>
          </div>
        </>
      ) : (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Object.keys(STATUS_LABELS).map(s => (
            <button key={s} onClick={() => onQuick(dateStr, s, scheduleId, null)}
              style={{ padding: '2px 8px', borderRadius: 8, border: `1px solid ${STATUS_COLORS[s]}`, background: 'transparent', cursor: 'pointer', fontSize: 11, color: STATUS_COLORS[s], fontWeight: 600 }}>
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditModal({ record, onClose, onSave }) {
  const [status, setStatus] = useState(record.status);
  const [hours, setHours] = useState(record.hoursWorked);
  const [notes, setNotes] = useState(record.notes || '');
  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3 style={{ marginBottom: 16 }}>Editar asistencia</h3>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Estado</span>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input" style={{ marginTop: 4 }}>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Horas trabajadas</span>
          <input type="number" min="0" max="24" step="0.5" value={hours} onChange={e => setHours(e.target.value)} className="input" style={{ marginTop: 4 }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nota</span>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input" style={{ marginTop: 4 }} placeholder="Opcional..." />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSave({ status, hoursWorked: parseFloat(hours), notes })}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
