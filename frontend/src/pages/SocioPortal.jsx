import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

const statusLabels = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
};

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

// TODO: mock temporal — reemplazar por GET /api/portal/:token cuando Braian
// tenga el endpoint del backend listo. La forma de este objeto es la que se
// acordó como contrato de esa respuesta.
const mockSocio = {
  socio: {
    name: 'Martina Gómez',
    phone: '+54 9 11 5555-1234',
    email: 'martina@example.com',
  },
  business: {
    name: 'Gestumio Fitness',
  },
  enrollments: [
    {
      id: 'enr_1',
      activity: { name: 'Musculación' },
      amountDue: 15000,
      discount: 0,
      dueDate: '2026-07-10',
      paymentStatus: 'pending',
      bonificada: false,
    },
    {
      id: 'enr_2',
      activity: { name: 'Yoga' },
      amountDue: 8000,
      discount: 1000,
      dueDate: '2026-06-28',
      paymentStatus: 'overdue',
      bonificada: false,
    },
  ],
  payments: [
    { id: 'pay_1', date: '2026-06-01', label: 'Musculación', amount: 15000, method: 'Efectivo' },
    { id: 'pay_2', date: '2026-05-01', label: 'Yoga', amount: 8000, method: 'Transferencia' },
  ],
  upcomingAppointments: [
    { id: 'appt_1', date: '2026-07-03', startTime: '18:00', endTime: '19:00', service: { name: 'Clase de Yoga' } },
  ],
  balance: 21000,
};

const SECTIONS = [
  { key: 'inicio', label: 'Inicio', icon: '🏠' },
  { key: 'perfil', label: 'Mi Perfil', icon: '👤' },
  { key: 'actividades', label: 'Mis Actividades', icon: '📋' },
  { key: 'turnos', label: 'Mis Turnos', icon: '📅' },
  { key: 'pagos', label: 'Historial de Pagos', icon: '💳' },
];

export default function SocioPortal() {
  const { token } = useParams();
  const [socioData, setSocioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('inicio');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTurnoModal, setShowTurnoModal] = useState(false);

  useEffect(() => {
    // TODO: reemplazar por fetch real al backend usando `token`.
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      setSocioData(mockSocio);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [token]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function selectSection(key) {
    setActiveSection(key);
    setMenuOpen(false);
  }

  if (loading) {
    return (
      <div className="page-spinner">
        <div className="spinner spinner-lg"></div>
        <span>Cargando...</span>
      </div>
    );
  }

  if (error || !socioData) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-soft)' }}>No pudimos cargar tu portal. Pedile un nuevo link al negocio.</p>
      </div>
    );
  }

  const { business } = socioData;

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">
          <span /><span /><span />
        </button>
        <span className="mobile-brand">{business.name}</span>
      </header>

      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">{business.name}</div>
          <button className="sidebar-close-btn" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu">✕</button>
        </div>

        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => selectSection(s.key)}
            className={`sidebar-link${activeSection === s.key ? ' active' : ''}`}
            style={{ width: '100%', background: 'none', border: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 15 }}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}

        <div className="sidebar-footer">
          <span style={{ fontSize: 11, opacity: 0.5, letterSpacing: '0.03em' }}>Portal del Socio</span>
        </div>
      </aside>

      <main className="main">
        {activeSection === 'inicio' && <InicioSection socioData={socioData} onGoTo={selectSection} />}
        {activeSection === 'perfil' && <PerfilSection socio={socioData.socio} />}
        {activeSection === 'actividades' && <ActividadesSection enrollments={socioData.enrollments} />}
        {activeSection === 'turnos' && (
          <TurnosSection
            appointments={socioData.upcomingAppointments}
            onSolicitarTurno={() => setShowTurnoModal(true)}
          />
        )}
        {activeSection === 'pagos' && <PagosSection payments={socioData.payments} />}
      </main>

      {showTurnoModal && <SolicitarTurnoModal onClose={() => setShowTurnoModal(false)} />}
    </div>
  );
}

function InicioSection({ socioData, onGoTo }) {
  const { socio, enrollments, upcomingAppointments, balance } = socioData;
  const nextDue = [...enrollments]
    .filter((e) => e.paymentStatus !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
  const nextAppointment = upcomingAppointments[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hola, {socio.name.split(' ')[0]}</h1>
          <p className="page-subtitle">Este es el resumen de tu cuenta.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Saldo</p>
        <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: balance > 0 ? '#dc2626' : '#10b981' }}>
          {balance > 0 ? `Debés ${formatMoney(balance)}` : balance < 0 ? `A favor ${formatMoney(Math.abs(balance))}` : 'Al día ✓'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <button
          onClick={() => onGoTo('actividades')}
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Próxima cuota</p>
          {nextDue ? (
            <>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{nextDue.activity.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                Vence {formatDate(nextDue.dueDate)} · <span className={`pill pill-${nextDue.paymentStatus}`}>{statusLabels[nextDue.paymentStatus]}</span>
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>Estás al día con tus cuotas.</p>
          )}
        </button>

        <button
          onClick={() => onGoTo('turnos')}
          className="card"
          style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
        >
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Próximo turno</p>
          {nextAppointment ? (
            <>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{nextAppointment.service.name}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                {formatDate(nextAppointment.date)} · {nextAppointment.startTime} a {nextAppointment.endTime}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)' }}>No tenés turnos próximos.</p>
          )}
        </button>
      </div>
    </div>
  );
}

function PerfilSection({ socio }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mi Perfil</h1>
          <p className="page-subtitle">Tus datos de contacto.</p>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <InfoField label="Nombre" value={socio.name} />
          <InfoField label="Teléfono" value={socio.phone || 'Sin teléfono'} />
          <InfoField label="Email" value={socio.email || 'Sin email'} />
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14 }}>{value}</p>
    </div>
  );
}

function ActividadesSection({ enrollments }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mis Actividades</h1>
          <p className="page-subtitle">Tus cuotas y su estado.</p>
        </div>
      </div>
      {enrollments.length === 0 ? (
        <div className="card">
          <div className="empty-state"><h3>No estás inscripto en ninguna actividad</h3></div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Monto</th>
                <th>Vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td>{e.activity.name}</td>
                  <td>{formatMoney(Math.max(0, e.amountDue - (e.discount || 0)))}</td>
                  <td>{formatDate(e.dueDate)}</td>
                  <td><span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function TurnosSection({ appointments, onSolicitarTurno }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mis Turnos</h1>
          <p className="page-subtitle">Tus próximos turnos.</p>
        </div>
        <button className="btn btn-primary" onClick={onSolicitarTurno}>+ Solicitar turno</button>
      </div>
      {appointments.length === 0 ? (
        <div className="card">
          <div className="empty-state"><h3>No tenés turnos próximos</h3></div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Horario</th>
                <th>Servicio</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td>{formatDate(a.date)}</td>
                  <td>{a.startTime} - {a.endTime}</td>
                  <td>{a.service.name}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

function PagosSection({ payments }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Historial de Pagos</h1>
          <p className="page-subtitle">Todos tus pagos registrados.</p>
        </div>
      </div>
      <div className="card">
        {payments.length === 0 ? (
          <div className="empty-state"><h3>Sin pagos registrados</h3></div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.date)}</td>
                  <td>{p.label}</td>
                  <td style={{ fontWeight: 600, color: '#10b981' }}>+{formatMoney(p.amount)}</td>
                  <td>{p.method || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// TODO: hoy no envía nada a un backend real — Braian tiene que definir el
// endpoint (ej. POST /api/portal/:token/turnos) y reemplazar este submit mock.
function SolicitarTurnoModal({ onClose }) {
  const addToast = useToast();
  const [form, setForm] = useState({ date: '', time: '', notes: '' });
  const [sending, setSending] = useState(false);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      addToast('Solicitud de turno enviada (demo, todavía no llega al negocio)', 'success');
      onClose();
    }, 400);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h2>Solicitar turno</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Fecha preferida</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </div>
          <div className="field">
            <label>Horario preferido</label>
            <input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} required />
          </div>
          <div className="field">
            <label>Notas (opcional)</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ej: primera clase, consulta..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? 'Enviando...' : 'Enviar solicitud'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
