import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ── FAQ ─────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    keywords: ['agregar cliente', 'agrego cliente', 'agrego un cliente', 'nuevo cliente', 'cargar cliente', 'crear cliente'],
    q: '¿Cómo agrego un cliente?',
    a: 'Andá a Clientes en el menú → tocá "Nuevo cliente" → completá nombre y teléfono → Guardar.\n\nTambién podés importar muchos clientes a la vez con el botón "Importar CSV".',
  },
  {
    keywords: ['importar cliente', 'importo clientes', 'importo cliente', 'importar csv', 'subir clientes', 'cargar masivo', 'importar desde'],
    q: '¿Cómo importo clientes desde un archivo?',
    a: 'En Clientes → botón "Importar CSV". El archivo debe tener columnas: nombre, telefono, email, dni.\n\nPodés descargar una plantilla de ejemplo desde ese mismo botón.',
  },
  {
    keywords: ['exportar', 'descargar datos', 'exportar csv', 'exportar clientes'],
    q: '¿Puedo exportar mis datos?',
    a: 'Sí. En Clientes podés exportar la lista a CSV con el botón "Exportar CSV". En Reportes también podés exportar los datos filtrados.',
  },
  {
    keywords: ['inscribir', 'inscribo', 'inscripcion', 'inscripción', 'inscribir cliente', 'inscribo un cliente', 'membresía', 'membresia', 'inscribir en'],
    q: '¿Cómo inscribo un cliente en una actividad?',
    a: 'Entrá a la ficha del cliente → sección Inscripciones → "Nueva inscripción" → elegí la actividad, el monto y la fecha de vencimiento → Guardar.\n\nEl sistema genera las cuotas automáticamente cada mes.',
  },
  {
    keywords: ['historial de pago', 'historial pagos', 'ver pagos', 'pagos del cliente'],
    q: '¿Cómo veo el historial de pagos?',
    a: 'Entrá a la ficha del cliente → hacé clic en "Estado de cuenta". Ahí vas a ver todos los pagos con fecha, actividad y método. Podés filtrar por rango de fechas e imprimirlo.',
  },
  {
    keywords: ['registrar pago', 'registro un pago', 'registro pago', 'confirmar cobro', 'cobrar cuota', 'marcar pagado'],
    q: '¿Cómo registro un pago?',
    a: 'En Cobranza → pestaña "⏳ Pendientes" → buscá al cliente → clic en "✅ Confirmar cobro".\n\nIngresá el monto y el método de pago (efectivo, transferencia, etc.) y listo.',
  },
  {
    keywords: ['cuota vencida', 'cuotas vencidas', 'mora', 'deuda', 'quien debe', 'vencidos'],
    q: '¿Cómo veo los clientes con cuotas vencidas?',
    a: 'En Cobranza → pestaña "⏳ Pendientes". Los clientes con cuotas vencidas aparecen destacados en rojo.\n\nEl Dashboard también muestra un KPI con el total de cuotas vencidas.',
  },
  {
    keywords: ['recordatorio whatsapp', 'enviar whatsapp', 'mandar whatsapp', 'recordatorio por whats'],
    q: '¿Cómo envío un recordatorio por WhatsApp?',
    a: 'En Cobranza → pestaña "📱 Recordatorios" → filtrá por 1, 3 o 7 días → hacé clic en "📱 Enviar" al lado del cliente.\n\nSe abre WhatsApp con el mensaje ya escrito listo para mandar.',
  },
  {
    keywords: ['plantilla whatsapp', 'plantilla de mensaje', 'configurar mensaje', 'configuro el mensaje', 'configuro mensaje', 'texto whatsapp', 'mensaje whatsapp'],
    q: '¿Cómo configuro el mensaje de WhatsApp?',
    a: 'En Ajustes → Plantillas de WhatsApp. Podés personalizar el texto con variables:\n• {nombre} → nombre del cliente\n• {actividad} → nombre de la actividad\n• {vencimiento} → fecha de vencimiento\n• {negocio} → nombre de tu negocio',
  },
  {
    keywords: ['crear actividad', 'creo una actividad', 'creo actividad', 'nueva actividad', 'agregar actividad', 'que actividades'],
    q: '¿Cómo creo una actividad?',
    a: 'Andá a Actividades → "Nueva actividad" → ingresá el nombre (ej: Musculación) y el precio mensual → Guardar.\n\nDesde ahí también podés ver los clientes inscriptos en esa actividad.',
  },
  {
    keywords: ['turno', 'agenda', 'cita', 'reserva', 'agendar', 'nuevo turno'],
    q: '¿Cómo agrego un turno en la agenda?',
    a: 'Andá a Agenda en el menú → hacé clic en el día y horario deseado → elegí el cliente y el servicio → Guardar.\n\nDesde el detalle del turno también podés enviar un recordatorio por WhatsApp al cliente.',
  },
  {
    keywords: ['reporte', 'informe', 'estadistica', 'estadística', 'generar reporte', 'ver reporte'],
    q: '¿Cómo genero un reporte?',
    a: 'En el menú → Reportes. Tenés 6 tipos de reportes:\n• Ingresos por período\n• Gastos\n• Clientes activos\n• Deuda total\n• Rendimiento por actividad\n• Y más\n\nFiltrá por fechas y exportá a CSV.',
  },
  {
    keywords: ['dashboard', 'inicio', 'panel', 'kpi', 'resumen general'],
    q: '¿Qué muestra el Dashboard?',
    a: 'El Dashboard muestra los KPIs principales: ingresos del mes, gastos, resultado, cuotas vencidas y gráficos de tendencia.\n\nPodés filtrar por período y personalizar los widgets desde el ícono ⚙️ en la esquina.',
  },
  {
    keywords: ['agregar empleado', 'agrego un empleado', 'agrego empleado', 'nuevo empleado', 'crear empleado', 'cargar empleado'],
    q: '¿Cómo agrego un empleado?',
    a: 'Andá a Empleados en el menú → "Nuevo empleado" → completá los datos → Guardar.\n\nDesde Nómina podés registrar los pagos de sueldos mes a mes.',
  },
  {
    keywords: ['pago de sueldo', 'pagar sueldo', 'liquidacion', 'liquidación', 'nomina', 'nómina'],
    q: '¿Cómo registro un pago de sueldo?',
    a: 'Andá a Nómina en el menú → seleccioná el mes → buscá al empleado → ingresá el monto y el método de pago → Guardar.\n\nPodés ver el historial de pagos por empleado desde ahí.',
  },
  {
    keywords: ['registrar gasto', 'registro un gasto', 'registro gasto', 'nuevo gasto', 'cargar gasto', 'agregar gasto'],
    q: '¿Cómo registro un gasto?',
    a: 'En Gastos → "Nuevo gasto" → ingresá la descripción, monto y categoría. Si el gasto es de un proveedor podés asociarlo.\n\nLos gastos aparecen en los reportes y en el Dashboard.',
  },
  {
    keywords: ['agregar proveedor', 'agrego un proveedor', 'agrego proveedor', 'nuevo proveedor', 'crear proveedor', 'cargar proveedor'],
    q: '¿Cómo agrego un proveedor?',
    a: 'Andá a Proveedores en el menú → "Nuevo proveedor" → ingresá nombre, teléfono y datos de contacto → Guardar.\n\nDesde la ficha del proveedor podés ver todos los gastos asociados y su cuenta corriente.',
  },
  {
    keywords: ['logo', 'cambiar logo', 'datos del negocio', 'nombre del negocio', 'telefono negocio'],
    q: '¿Cómo cambio el logo o datos del negocio?',
    a: 'Andá a Ajustes → sección "Datos del negocio" → cargá tu logo y actualizá el nombre, teléfono y rubro → Guardar.\n\nEl logo aparece en el encabezado de la app y en los documentos.',
  },
  {
    keywords: ['varios usuarios', 'agregar usuario', 'nuevo usuario', 'colaborador', 'contraseña', 'acceso para'],
    q: '¿Puedo tener varios usuarios?',
    a: 'Sí. En Ajustes → Usuarios podés agregar colaboradores con distintos roles:\n• Administrador: acceso completo\n• Empleado: acceso limitado\n\nCada uno tiene su propio email y contraseña.',
  },
  {
    keywords: ['trial', 'prueba gratis', 'periodo de prueba', 'cuando vence', 'suscripcion', 'suscripción', 'mercadopago', 'pagar plan'],
    q: '¿Qué pasa cuando vence el período de prueba?',
    a: 'Tenés 15 días gratis desde el registro. Al vencer, la cuenta se suspende hasta que actives una suscripción.\n\nPodés suscribirte desde Ajustes → Facturación → "Suscribirse con MercadoPago".',
  },
];

// ── Normalizar texto para comparación sin tildes ─────────────────────────────
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function findAnswer(text) {
  const q = normalize(text);
  // Buscar la coincidencia más específica (keyword más larga que matchea)
  let bestMatch = null;
  let bestLen = 0;
  for (const entry of FAQ) {
    for (const kw of entry.keywords) {
      const kwNorm = normalize(kw);
      if (q.includes(kwNorm) && kwNorm.length > bestLen) {
        bestMatch = entry;
        bestLen = kwNorm.length;
      }
    }
  }
  return bestMatch;
}

// ── Sugerencias por sección ──────────────────────────────────────────────────
const SUGGESTIONS_BY_ROUTE = {
  '/': [
    '¿Qué muestra el Dashboard?',
    '¿Cómo veo los clientes con cuotas vencidas?',
    '¿Cómo genero un reporte?',
    '¿Cómo registro un pago?',
  ],
  '/clientes': [
    '¿Cómo agrego un cliente?',
    '¿Cómo importo clientes desde un archivo?',
    '¿Puedo exportar mis datos?',
    '¿Cómo inscribo un cliente en una actividad?',
  ],
  '/clientes/:id': [
    '¿Cómo inscribo un cliente en una actividad?',
    '¿Cómo registro un pago?',
    '¿Cómo veo el historial de pagos?',
    '¿Cómo envío un recordatorio por WhatsApp?',
  ],
  '/cobranza': [
    '¿Cómo registro un pago?',
    '¿Cómo envío un recordatorio por WhatsApp?',
    '¿Cómo veo los clientes con cuotas vencidas?',
    '¿Cómo configuro el mensaje de WhatsApp?',
  ],
  '/actividades': [
    '¿Cómo creo una actividad?',
    '¿Cómo inscribo un cliente en una actividad?',
    '¿Cómo agrego un empleado?',
  ],
  '/agenda': [
    '¿Cómo agrego un turno en la agenda?',
    '¿Cómo envío un recordatorio por WhatsApp?',
    '¿Cómo configuro el mensaje de WhatsApp?',
  ],
  '/gastos': [
    '¿Cómo registro un gasto?',
    '¿Cómo agrego un proveedor?',
    '¿Cómo genero un reporte?',
  ],
  '/reportes': [
    '¿Cómo genero un reporte?',
    '¿Puedo exportar mis datos?',
    '¿Qué muestra el Dashboard?',
  ],
  '/empleados': [
    '¿Cómo agrego un empleado?',
    '¿Cómo registro un pago de sueldo?',
    '¿Cómo creo una actividad?',
  ],
  '/liquidaciones': [
    '¿Cómo registro un pago de sueldo?',
    '¿Cómo agrego un empleado?',
  ],
  '/proveedores': [
    '¿Cómo agrego un proveedor?',
    '¿Cómo registro un gasto?',
    '¿Cómo genero un reporte?',
  ],
  '/ajustes': [
    '¿Cómo cambio el logo o datos del negocio?',
    '¿Puedo tener varios usuarios?',
    '¿Cómo configuro el mensaje de WhatsApp?',
    '¿Qué pasa cuando vence el período de prueba?',
  ],
  '/precios': [
    '¿Cómo creo una actividad?',
    '¿Cómo inscribo un cliente en una actividad?',
    '¿Cómo genero un reporte?',
  ],
  '/caja': [
    '¿Cómo registro un gasto?',
    '¿Cómo genero un reporte?',
    '¿Qué muestra el Dashboard?',
  ],
  '/sedes': [
    '¿Cómo agrego un empleado?',
    '¿Cómo creo una actividad?',
  ],
  '/horarios': [
    '¿Cómo creo una actividad?',
    '¿Cómo agrego un turno en la agenda?',
    '¿Cómo agrego un empleado?',
  ],
  '/asistencias': [
    '¿Cómo agrego un empleado?',
    '¿Cómo creo una actividad?',
  ],
};

const DEFAULT_SUGGESTIONS = [
  '¿Cómo agrego un cliente?',
  '¿Cómo registro un pago?',
  '¿Cómo envío un recordatorio por WhatsApp?',
  '¿Cómo creo una actividad?',
];

function getSuggestions(pathname) {
  if (SUGGESTIONS_BY_ROUTE[pathname]) return SUGGESTIONS_BY_ROUTE[pathname];
  if (pathname.startsWith('/clientes/')) return SUGGESTIONS_BY_ROUTE['/clientes/:id'];
  if (pathname.startsWith('/proveedores/')) return SUGGESTIONS_BY_ROUTE['/proveedores'];
  if (pathname.startsWith('/actividades/')) return SUGGESTIONS_BY_ROUTE['/actividades'];
  return DEFAULT_SUGGESTIONS;
}

const WELCOME = '¡Hola! 👋 Soy el asistente de Zentric.\nPuedo ayudarte con preguntas sobre cómo usar la app.\n\n¿Sobre qué querés saber?';

// ── Componente ───────────────────────────────────────────────────────────────
export default function ChatBot() {
  const location = useLocation();

  // todos los useState primero
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: 'bot', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastRoute, setLastRoute] = useState(location.pathname);
  const bottomRef = useRef(null);

  const suggestions = getSuggestions(location.pathname);

  // Resetear chat al cambiar de sección
  useEffect(() => {
    if (location.pathname !== lastRoute) {
      setLastRoute(location.pathname);
      setMessages([{ from: 'bot', text: WELCOME }]);
      setInput('');
      setTyping(false);
    }
  }, [location.pathname, lastRoute]);

  // Scroll al último mensaje
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, messages]);

  function sendMessage(text) {
    const userMsg = (text || input).trim();
    if (!userMsg) return;
    setInput('');
    setMessages(m => [...m, { from: 'user', text: userMsg }]);
    setTyping(true);

    setTimeout(() => {
      const match = findAnswer(userMsg);
      const response = match
        ? match.a
        : 'No encontré una respuesta para eso 🤔\n\nProbá con palabras como: cliente, pago, actividad, WhatsApp, turno, reporte, empleado, gasto, proveedor.\n\nSi seguís con dudas escribinos a contacto@zentric.app 📧';
      setTyping(false);
      setMessages(m => [...m, { from: 'bot', text: response }]);
      if (!open) setUnread(u => u + 1);
    }, 600);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const showSuggestions = messages.length === 1 && !typing;

  return (
    <>
      {/* Burbuja flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ayuda"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 8000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: 'var(--primary)', color: '#fff',
          fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
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
          maxHeight: '72vh', overflow: 'hidden',
          border: '1px solid var(--border)',
        }}>
          {/* Header */}
          <div style={{
            background: 'var(--primary)', color: '#fff',
            padding: '14px 16px', borderRadius: '16px 16px 0 0',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
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
                  maxWidth: '85%', padding: '9px 13px',
                  borderRadius: m.from === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.from === 'user' ? 'var(--primary)' : 'var(--bg)',
                  color: m.from === 'user' ? '#fff' : 'var(--ink)',
                  fontSize: 13, lineHeight: 1.6,
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
                  padding: '10px 16px', borderRadius: '14px 14px 14px 4px',
                  background: 'var(--bg)', border: '1px solid var(--border)',
                  fontSize: 16, letterSpacing: 3, color: 'var(--ink-soft)',
                }}>●●●</div>
              </div>
            )}

            {showSuggestions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    textAlign: 'left', padding: '8px 12px', borderRadius: 10,
                    border: '1px solid var(--primary)', background: 'transparent',
                    color: 'var(--primary)', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                    transition: 'background 0.15s',
                  }}>{s}</button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
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
                color: '#fff', fontSize: 16,
                cursor: input.trim() ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}
            >➤</button>
          </div>
        </div>
      )}
    </>
  );
}
