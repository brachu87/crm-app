import { useState, useRef, useEffect } from 'react';

const FAQ = [
  {
    keywords: ['cliente', 'agregar cliente', 'nuevo cliente', 'cargar cliente'],
    q: '¿Cómo agrego un cliente?',
    a: 'Andá a Clientes en el menú → tocá el botón "Nuevo cliente" → completá nombre y teléfono → Guardar. También podés importar muchos clientes a la vez desde un archivo CSV con el botón "Importar CSV".',
  },
  {
    keywords: ['pago', 'cobrar', 'registrar pago', 'cuota', 'cobro'],
    q: '¿Cómo registro un pago?',
    a: 'En Cobranza → pestaña Pendientes → buscá al cliente → clic en "✅ Confirmar cobro". Podés ingresar el monto, el método de pago (efectivo, transferencia, etc.) y se guarda automáticamente.',
  },
  {
    keywords: ['actividad', 'crear actividad', 'nueva actividad', 'deporte', 'clase'],
    q: '¿Cómo creo una actividad?',
    a: 'Andá a Actividades → "Nueva actividad" → ingresá el nombre (ej: Musculación) y el precio mensual → Guardar. Desde ahí también podés inscribir clientes a esa actividad.',
  },
  {
    keywords: ['inscribir', 'inscripcion', 'inscripción', 'inscribir cliente', 'membresía', 'membresia'],
    q: '¿Cómo inscribo un cliente en una actividad?',
    a: 'Entrá a la ficha del cliente → sección Inscripciones → "Nueva inscripción" → elegí la actividad, el monto y la fecha de vencimiento → Guardar. El sistema genera las cuotas automáticamente cada mes.',
  },
  {
    keywords: ['whatsapp', 'recordatorio', 'mensaje', 'notificacion', 'notificación'],
    q: '¿Cómo envío un recordatorio por WhatsApp?',
    a: 'En Cobranza → pestaña "📱 Recordatorios" → filtrá por 1, 3 o 7 días → hacé clic en "📱 Enviar" al lado del cliente. Se abre WhatsApp con el mensaje ya escrito. Podés editar el mensaje en Ajustes → Plantillas de WhatsApp.',
  },
  {
    keywords: ['turno', 'agenda', 'cita', 'reserva', 'calendario'],
    q: '¿Cómo agrego un turno en la agenda?',
    a: 'Andá a Agenda (ícono de calendario en el menú) → hacé clic en el día y horario deseado → elegí el cliente y el servicio → Guardar. Los turnos aparecen en el calendario y podés ver el detalle haciendo clic sobre ellos.',
  },
  {
    keywords: ['reporte', 'reportes', 'informe', 'estadistica', 'estadística'],
    q: '¿Cómo genero un reporte?',
    a: 'En el menú → Reportes. Podés ver ingresos por período, clientes activos, gastos, deuda total y más. Filtrá por fechas y exportá a CSV si necesitás los datos en Excel.',
  },
  {
    keywords: ['empleado', 'empleados', 'staff', 'personal', 'nomina', 'nómina'],
    q: '¿Cómo agrego un empleado?',
    a: 'Andá a Empleados en el menú → "Nuevo empleado" → completá los datos → Guardar. Desde Nómina podés registrar los pagos de sueldos mes a mes.',
  },
  {
    keywords: ['gasto', 'gastos', 'egreso', 'proveedor', 'proveedores'],
    q: '¿Cómo registro un gasto?',
    a: 'En Gastos → "Nuevo gasto" → ingresá la descripción, monto, categoría y si tenés un proveedor asociado. Los gastos se reflejan en los reportes y en el Dashboard.',
  },
  {
    keywords: ['logo', 'imagen', 'negocio', 'ajustes', 'configuracion', 'configuración'],
    q: '¿Cómo cambio el logo o los datos del negocio?',
    a: 'Andá a Ajustes (ícono ⚙️ en el menú) → sección Datos del negocio → cargá tu logo y actualizá el nombre, teléfono y rubro → Guardar.',
  },
  {
    keywords: ['exportar', 'descargar', 'csv', 'excel', 'backup'],
    q: '¿Puedo exportar mis datos?',
    a: 'Sí. En Clientes podés exportar la lista a CSV con el botón "Exportar CSV". En Reportes también podés exportar los datos filtrados. Para un backup completo, contactá soporte.',
  },
  {
    keywords: ['importar', 'importar csv', 'subir clientes', 'cargar masivo'],
    q: '¿Cómo importo clientes desde un archivo?',
    a: 'En Clientes → botón "Importar CSV". El archivo debe tener columnas: nombre, telefono, email, dni. Podés descargar una plantilla de ejemplo desde ese mismo botón.',
  },
  {
    keywords: ['vencido', 'vencidos', 'mora', 'deuda', 'cuotas vencidas'],
    q: '¿Cómo veo los clientes con cuotas vencidas?',
    a: 'En Cobranza → pestaña "⏳ Pendientes". Los clientes con cuotas vencidas aparecen destacados en rojo. También el Dashboard muestra un KPI de cuotas vencidas con el total.',
  },
  {
    keywords: ['plantilla', 'template', 'mensaje whatsapp', 'texto whatsapp'],
    q: '¿Cómo configuro el mensaje de WhatsApp?',
    a: 'En Ajustes → Plantillas de WhatsApp. Podés personalizar el mensaje usando variables: {nombre}, {actividad}, {vencimiento}, {negocio}. Ese mensaje se usa en todos los recordatorios de Cobranza y en la Agenda.',
  },
  {
    keywords: ['trial', 'prueba', 'periodo', 'período', 'suscripcion', 'suscripción', 'pagar', 'plan'],
    q: '¿Qué pasa cuando vence el período de prueba?',
    a: 'Tenés 15 días gratis. Al vencer, la cuenta se suspende hasta que actives una suscripción. Podés hacerlo desde Ajustes → Facturación → "Suscribirse con MercadoPago".',
  },
  {
    keywords: ['usuario', 'usuarios', 'contraseña', 'password', 'acceso', 'cuenta'],
    q: '¿Puedo tener varios usuarios?',
    a: 'Sí. En Ajustes → Usuarios podés agregar colaboradores con distintos roles: administrador o empleado. Cada uno tiene su propio usuario y contraseña.',
  },
  {
    keywords: ['dashboard', 'inicio', 'resumen', 'kpi'],
    q: '¿Qué muestra el Dashboard?',
    a: 'El Dashboard muestra los KPIs clave: ingresos del mes, gastos, resultado, cuotas vencidas y gráficos de tendencia. Podés filtrar por período y personalizar los widgets desde el ícono ⚙️ en la esquina.',
  },
];

const WELCOME = '¡Hola! 👋 Soy el asistente de Zentric. Puedo ayudarte con preguntas sobre cómo usar la app.\n\n¿Sobre qué querés saber?';

const SUGGESTIONS = [
  '¿Cómo agrego un cliente?',
  '¿Cómo registro un pago?',
  '¿Cómo envío un recordatorio por WhatsApp?',
  '¿Cómo creo una actividad?',
];

function findAnswer(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = FAQ.find(f =>
    f.keywords.some(k => {
      const kNorm = k.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return lower.includes(kNorm);
    })
  );
  return match || null;
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: 'bot', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, messages]);

  function sendMessage(text) {
    const userMsg = text || input.trim();
    if (!userMsg) return;
    setInput('');
    setMessages(m => [...m, { from: 'user', text: userMsg }]);
    setTyping(true);

    setTimeout(() => {
      const match = findAnswer(userMsg);
      let response;
      if (match) {
        response = match.a;
      } else {
        response = 'No encontré una respuesta para eso 🤔\n\nProbá preguntando sobre: clientes, pagos, actividades, WhatsApp, agenda, reportes o ajustes.\n\nSi no encontrás lo que buscás, escribinos a contacto@zentric.app 📧';
      }
      setTyping(false);
      setMessages(m => [...m, { from: 'bot', text: response }]);
      if (!open) setUnread(u => u + 1);
    }, 600);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <>
      {/* Burbuja flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 8000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'var(--primary)', color: '#fff',
          fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        title="Ayuda"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: 'var(--accent)', color: '#fff',
            borderRadius: '50%', width: 18, height: 18,
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread}</span>
        )}
      </button>

      {/* Panel del chat */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 24, zIndex: 8000,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '70vh', overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--primary)', color: '#fff',
            padding: '14px 16px', borderRadius: '16px 16px 0 0',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>🌿</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Asistente Zentric</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>● En línea</div>
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '9px 13px', borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.from === 'user' ? 'var(--primary)' : 'var(--surface-2, var(--bg))',
                  color: m.from === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 13, lineHeight: 1.55,
                  border: m.from === 'bot' ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {typing && (
              <div style={{ display: 'flex' }}>
                <div style={{
                  padding: '9px 14px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--surface-2, var(--bg))', border: '1px solid var(--border)',
                  fontSize: 18, letterSpacing: 2,
                }}>
                  <span style={{ animation: 'blink 1s infinite' }}>●●●</span>
                </div>
              </div>
            )}

            {/* Sugerencias — solo después del mensaje de bienvenida */}
            {messages.length === 1 && !typing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 10,
                    border: '1px solid var(--primary)', background: 'transparent',
                    color: 'var(--primary)', fontSize: 13, cursor: 'pointer',
                    fontWeight: 500,
                  }}>{s}</button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribí tu pregunta..."
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 10,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--ink)', fontSize: 13, outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: input.trim() ? 'var(--primary)' : 'var(--border)',
                color: '#fff', fontSize: 16, cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}
            >➤</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
