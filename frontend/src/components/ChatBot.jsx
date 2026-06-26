import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// ── FAQ completo ─────────────────────────────────────────────────────────────
const FAQ = [
  // ── CLIENTES ──────────────────────────────────────────────────────────────
  {
    id: 'add-client',
    keywords: ['agregar cliente','agrego cliente','agrego un cliente','nuevo cliente','cargar cliente','crear cliente','como agrego'],
    q: '¿Cómo agrego un cliente?',
    a: 'Andá a Clientes en el menú → tocá "Nuevo cliente" → completá nombre y teléfono → Guardar.\n\nTambién podés importar muchos clientes a la vez con el botón "Importar CSV".',
  },
  {
    id: 'edit-client',
    keywords: ['editar cliente','edito cliente','modificar cliente','cambiar datos cliente','actualizar cliente'],
    q: '¿Cómo edito un cliente?',
    a: 'En Clientes → hacé clic en el nombre del cliente para abrir su ficha → botón "Editar" arriba a la derecha → modificá los datos → Guardar.',
  },
  {
    id: 'deactivate-client',
    keywords: ['dar de baja cliente','doy de baja cliente','eliminar cliente','borrar cliente','desactivar cliente','baja cliente'],
    q: '¿Cómo doy de baja un cliente?',
    a: 'En Clientes → abrí la ficha del cliente → botón "Dar de baja". El cliente queda inactivo pero su historial se conserva.\n\nPodés reactivarlo desde el mismo lugar cuando quieras.',
  },
  {
    id: 'import-clients',
    keywords: ['importar cliente','importo clientes','importar csv','subir clientes','cargar masivo','importar desde archivo'],
    q: '¿Cómo importo clientes desde un archivo?',
    a: 'En Clientes → botón "Importar CSV". El archivo debe tener columnas: nombre, telefono, email, dni.\n\nPodés descargar una plantilla de ejemplo desde ese mismo botón.',
  },
  {
    id: 'export-clients',
    keywords: ['exportar','descargar datos','exportar csv','exportar clientes','exportar lista'],
    q: '¿Puedo exportar mis datos?',
    a: 'Sí. En Clientes → botón "Exportar CSV". En Reportes también podés exportar datos filtrados por fecha.',
  },
  {
    id: 'client-photo',
    keywords: ['foto cliente','avatar','imagen cliente','foto perfil','subir foto'],
    q: '¿Cómo le agrego una foto al cliente?',
    a: 'Abrí la ficha del cliente → hacé clic en el círculo del avatar → seleccioná una imagen desde tu dispositivo → se guarda automáticamente.',
  },
  {
    id: 'client-notes',
    keywords: ['nota cliente','notas del cliente','agregar nota cliente','comentario cliente'],
    q: '¿Puedo agregar notas a un cliente?',
    a: 'Sí. En la ficha del cliente → sección "Notas" → escribí tu nota y guardá. Podés agregar tantas notas como quieras con fecha y hora automática.',
  },
  {
    id: 'client-birthday',
    keywords: ['cumpleaños','cumpleanos','fecha nacimiento','nacimiento cliente'],
    q: '¿Dónde guardo la fecha de nacimiento del cliente?',
    a: 'En la ficha del cliente → campo "Fecha de nacimiento". El sistema muestra un aviso en el Dashboard cuando un cliente cumple años ese mes.',
  },
  {
    id: 'client-account',
    keywords: ['estado de cuenta','cuenta corriente cliente','historial pagos','ver pagos del cliente','imprimir estado'],
    q: '¿Cómo veo el estado de cuenta de un cliente?',
    a: 'En la ficha del cliente → botón "Estado de cuenta". Muestra todos los pagos con fecha, monto, actividad y método.\n\nPodés filtrar por rango de fechas e imprimirlo.',
  },
  // ── INSCRIPCIONES / COBRANZA ───────────────────────────────────────────────
  {
    id: 'enroll',
    keywords: ['inscribir','inscribo','inscripcion','inscripción','inscribir cliente','membresia','membresía','inscribir en actividad'],
    q: '¿Cómo inscribo un cliente en una actividad?',
    a: 'Ficha del cliente → sección Inscripciones → "Nueva inscripción" → elegí la actividad, el monto y la fecha de vencimiento → Guardar.\n\nEl sistema genera las cuotas automáticamente cada mes.',
  },
  {
    id: 'edit-quota',
    keywords: ['editar cuota','edito cuota','modificar cuota','cambiar monto cuota','actualizar cuota'],
    q: '¿Cómo edito una cuota?',
    a: 'En Cobranza → pestaña "⏳ Pendientes" → buscá la cuota → ícono ✏️ → modificá monto o fecha de vencimiento → Guardar.',
  },
  {
    id: 'confirm-payment',
    keywords: ['registrar pago','registro pago','confirmar cobro','cobrar cuota','marcar pagado','registrar cobro'],
    q: '¿Cómo registro un pago?',
    a: 'En Cobranza → pestaña "⏳ Pendientes" → buscá al cliente → clic en "✅ Confirmar cobro" → ingresá monto y método de pago → Guardar.',
  },
  {
    id: 'overdue',
    keywords: ['cuota vencida','cuotas vencidas','mora','deuda','quien debe','vencidos','atrasado'],
    q: '¿Cómo veo los clientes con cuotas vencidas?',
    a: 'En Cobranza → pestaña "⏳ Pendientes". Los clientes con cuotas vencidas aparecen en rojo.\n\nEl Dashboard también muestra el total de cuotas vencidas en tiempo real.',
  },
  {
    id: 'wa-reminder',
    keywords: ['recordatorio whatsapp','enviar whatsapp','mandar whatsapp','recordatorio por whats','mensaje whatsapp cliente'],
    q: '¿Cómo envío un recordatorio por WhatsApp?',
    a: 'En Cobranza → pestaña "📱 Recordatorios" → filtrá por 1, 3 o 7 días → hacé clic en "📱 Enviar" al lado del cliente.\n\nSe abre WhatsApp con el mensaje ya redactado listo para enviar.',
  },
  {
    id: 'wa-template',
    keywords: ['plantilla whatsapp','plantilla de mensaje','configurar mensaje wa','texto whatsapp','configurar whatsapp'],
    q: '¿Cómo configuro el mensaje de WhatsApp?',
    a: 'En Ajustes → Plantillas de WhatsApp. Personalizá el texto con variables:\n• {nombre} → nombre del cliente\n• {actividad} → actividad\n• {vencimiento} → fecha de vencimiento\n• {negocio} → tu negocio',
  },
  {
    id: 'auto-renew',
    keywords: ['renovar cuota','renovacion automatica','renovación automática','renovar mes','generar cuotas','cuotas del mes'],
    q: '¿Cómo se renuevan las cuotas cada mes?',
    a: 'En Cobranza → botón "Renovar mes" (esquina superior derecha). Genera automáticamente las cuotas del mes siguiente para todos los inscriptos activos.\n\nTambién se ejecuta automáticamente desde el Dashboard.',
  },
  {
    id: 'other-income',
    keywords: ['otro ingreso','otros ingresos','ingreso manual','ingreso extra','ingreso adicional'],
    q: '¿Cómo registro un ingreso que no es de cuota?',
    a: 'En Cobranza → pestaña "Otros ingresos" → "Nuevo ingreso" → ingresá descripción y monto → Guardar.\n\nEstos ingresos aparecen en los reportes junto a las cuotas.',
  },
  // ── ACTIVIDADES / SERVICIOS ────────────────────────────────────────────────
  {
    id: 'new-activity',
    keywords: ['crear actividad','creo actividad','nueva actividad','agregar actividad','nueva clase','crear clase'],
    q: '¿Cómo creo una actividad?',
    a: 'Andá a Actividades/Servicios → "Nueva actividad" → ingresá el nombre (ej: Musculación) y el precio mensual → Guardar.\n\nDesde ahí podés ver los clientes inscriptos en esa actividad.',
  },
  {
    id: 'edit-activity',
    keywords: ['editar actividad','edito actividad','modificar actividad','cambiar precio actividad'],
    q: '¿Cómo edito una actividad?',
    a: 'En Actividades/Servicios → hacé clic en la actividad → botón "Editar" → modificá nombre o precio → Guardar.',
  },
  {
    id: 'deactivate-activity',
    keywords: ['dar de baja actividad','doy de baja actividad','eliminar actividad','desactivar actividad','baja actividad'],
    q: '¿Cómo doy de baja una actividad?',
    a: 'En Actividades/Servicios → abrí la actividad → botón "Dar de baja". Los clientes inscriptos no se afectan, solo se oculta para nuevas inscripciones.',
  },
  {
    id: 'price-grid',
    keywords: ['grilla de precios','precio por actividad','actualizar precios','cambiar precios masivo','lista de precios'],
    q: '¿Cómo actualizo los precios de mis actividades?',
    a: 'En el menú → Grilla de precios. Podés ver y editar los precios de todas las actividades en un solo lugar y aplicar un aumento porcentual a todas a la vez.',
  },
  {
    id: 'quick-job',
    keywords: ['trabajo rapido','trabajo rápido','servicio puntual','cobro puntual','trabajo sin inscripcion'],
    q: '¿Puedo cobrar un servicio puntual sin inscripción mensual?',
    a: 'Sí. En Actividades/Servicios → pestaña "Trabajos" → "Nuevo trabajo". Ingresá el cliente, descripción y monto.\n\nEste cobro aparece en Cobranza y en los reportes.',
  },
  // ── AGENDA ────────────────────────────────────────────────────────────────
  {
    id: 'new-appointment',
    keywords: ['turno','agenda','cita','reserva','agendar','nuevo turno','agregar turno','crear turno'],
    q: '¿Cómo agrego un turno en la agenda?',
    a: 'En Agenda → hacé clic en el día y horario → elegí el cliente y el servicio → Guardar.\n\nDesde el detalle del turno también podés enviar un recordatorio por WhatsApp.',
  },
  {
    id: 'edit-appointment',
    keywords: ['editar turno','modificar turno','cambiar turno','reprogramar turno'],
    q: '¿Cómo edito o reprogramo un turno?',
    a: 'En Agenda → hacé clic en el turno → botón "Editar" → modificá la fecha, hora o cliente → Guardar.',
  },
  {
    id: 'delete-appointment',
    keywords: ['eliminar turno','borrar turno','cancelar turno','borrar cita'],
    q: '¿Cómo cancelo un turno?',
    a: 'En Agenda → hacé clic en el turno → botón "Eliminar". El turno se borra del calendario.',
  },
  {
    id: 'wa-appointment',
    keywords: ['recordatorio turno whatsapp','avisar turno','recordar turno','whatsapp turno agenda'],
    q: '¿Cómo mando un recordatorio de turno por WhatsApp?',
    a: 'En Agenda → hacé clic en el turno → botón "📱 Recordatorio WA". Se abre WhatsApp con un mensaje pre-armado con la fecha y hora del turno.',
  },
  // ── EMPLEADOS / LEGAJOS ────────────────────────────────────────────────────
  {
    id: 'new-employee',
    keywords: ['agregar empleado','nuevo empleado','crear empleado','cargar empleado','agrego empleado','legajo'],
    q: '¿Cómo agrego un empleado?',
    a: 'En el menú → Legajos → "Nuevo empleado" → completá los datos (nombre, teléfono, puesto) → Guardar.',
  },
  {
    id: 'edit-employee',
    keywords: ['editar empleado','edito empleado','modificar empleado','actualizar datos empleado'],
    q: '¿Cómo edito los datos de un empleado?',
    a: 'En Legajos → hacé clic en el empleado → botón "Editar" → modificá los datos → Guardar.',
  },
  {
    id: 'salary',
    keywords: ['pago de sueldo','pagar sueldo','liquidacion','liquidación','nomina','nómina','sueldo','salario'],
    q: '¿Cómo registro un pago de sueldo?',
    a: 'En Liquidaciones → seleccioná el mes → buscá al empleado → ingresá el monto y el método de pago → Guardar.\n\nPodés ver el historial de pagos por empleado.',
  },
  {
    id: 'attendance',
    keywords: ['asistencia','asistencias','control de presencia','fichar','registro asistencia','tomar asistencia'],
    q: '¿Cómo registro asistencias de empleados?',
    a: 'En el menú → Asistencias → seleccioná el empleado y la fecha → marcá entrada y salida.\n\nPodés ver el resumen mensual de cada empleado.',
  },
  {
    id: 'schedule-employee',
    keywords: ['horario empleado','horarios','turno empleado','horario de trabajo','asignar horario'],
    q: '¿Cómo asigno horarios a un empleado?',
    a: 'En el menú → Horarios → seleccioná el empleado → asigná los días y horarios de trabajo → Guardar.',
  },
  // ── GASTOS / PROVEEDORES ───────────────────────────────────────────────────
  {
    id: 'new-expense',
    keywords: ['registrar gasto','registro gasto','nuevo gasto','cargar gasto','agregar gasto','gasto nuevo'],
    q: '¿Cómo registro un gasto?',
    a: 'En Gastos → "Nuevo gasto" → ingresá descripción, monto y categoría. Podés asociarlo a un proveedor.\n\nLos gastos aparecen en reportes y en el Dashboard.',
  },
  {
    id: 'expense-categories',
    keywords: ['categoria gasto','categorias gastos','tipo de gasto','clasificar gasto'],
    q: '¿Qué categorías de gastos hay?',
    a: 'Las categorías disponibles son: Alquiler, Servicios, Sueldos, Mantenimiento, Marketing, Insumos y Otros.\n\nSe asignan al crear o editar cada gasto.',
  },
  {
    id: 'new-supplier',
    keywords: ['agregar proveedor','nuevo proveedor','crear proveedor','cargar proveedor','agrego proveedor'],
    q: '¿Cómo agrego un proveedor?',
    a: 'En Proveedores → "Nuevo proveedor" → nombre, teléfono y datos de contacto → Guardar.\n\nDesde la ficha del proveedor podés ver todos los gastos asociados y su cuenta corriente.',
  },
  {
    id: 'supplier-account',
    keywords: ['cuenta corriente proveedor','historial proveedor','deuda proveedor','pagos proveedor'],
    q: '¿Cómo veo la cuenta corriente de un proveedor?',
    a: 'En Proveedores → hacé clic en el proveedor → sección "Cuenta corriente". Muestra todos los gastos asociados con sus fechas y montos, filtrable por fecha.',
  },
  // ── CAJA DIARIA ───────────────────────────────────────────────────────────
  {
    id: 'daily-cash',
    keywords: ['caja diaria','caja del dia','apertura caja','cierre caja','arqueo','efectivo en caja'],
    q: '¿Cómo funciona la Caja Diaria?',
    a: 'En el menú → Caja Diaria. Registrá la apertura con el monto inicial, luego los movimientos del día (ingresos y egresos) y cerrá con el arqueo final.\n\nQueda el historial de cada día.',
  },
  // ── REPORTES ──────────────────────────────────────────────────────────────
  {
    id: 'reports',
    keywords: ['reporte','informe','estadistica','estadística','generar reporte','ver reporte','reportes'],
    q: '¿Cómo genero un reporte?',
    a: 'En el menú → Reportes. Tenés varios tipos:\n• Ingresos por período\n• Gastos por categoría\n• Rendimiento por actividad\n• Retención de clientes\n• Resumen general\n\nFiltrá por fechas y exportá a CSV.',
  },
  {
    id: 'report-filter',
    keywords: ['filtrar reporte','filtro de fechas reporte','rango de fechas reporte','periodo reporte'],
    q: '¿Cómo filtro los reportes por fechas?',
    a: 'En Reportes → desplegable con opciones: Último mes, 3 meses, 6 meses, 12 meses.\n\nTambién podés ingresar un rango de fechas personalizado con los campos "Desde" y "Hasta".',
  },
  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    keywords: ['dashboard','inicio','panel','kpi','resumen general','pantalla inicio'],
    q: '¿Qué muestra el Dashboard?',
    a: 'El Dashboard muestra los KPIs principales: ingresos del mes, gastos, resultado neto, cuotas vencidas y gráficos de tendencia.\n\nPodés personalizar los widgets desde el ícono ⚙️.',
  },
  {
    id: 'dashboard-widgets',
    keywords: ['personalizar dashboard','configurar widgets','ocultar widget','mostrar widget'],
    q: '¿Cómo personalizo el Dashboard?',
    a: 'En el Dashboard → ícono ⚙️ (esquina superior derecha) → activá o desactivá los widgets que querés ver.\n\nPodés mostrar/ocultar: ingresos, gastos, cuotas vencidas, cumpleaños, gráficos y más.',
  },
  // ── AJUSTES ───────────────────────────────────────────────────────────────
  {
    id: 'business-data',
    keywords: ['datos del negocio','nombre del negocio','telefono negocio','rubro negocio','editar negocio'],
    q: '¿Cómo actualizo los datos de mi negocio?',
    a: 'En Ajustes → sección "Datos del negocio" → actualizá nombre, teléfono y rubro → Guardar.',
  },
  {
    id: 'logo',
    keywords: ['logo','cambiar logo','subir logo','imagen negocio','logo de la empresa'],
    q: '¿Cómo cambio el logo?',
    a: 'En Ajustes → sección "Datos del negocio" → hacé clic en el logo actual → seleccioná una imagen → se actualiza automáticamente en toda la app.',
  },
  {
    id: 'users',
    keywords: ['varios usuarios','agregar usuario','nuevo usuario','colaborador','rol usuario','acceso para otro'],
    q: '¿Puedo tener varios usuarios?',
    a: 'Sí. En Ajustes → Usuarios → "Nuevo usuario" → ingresá email y elegí rol:\n• Administrador: acceso total\n• Empleado: acceso limitado\n\nCada uno tiene su propio login.',
  },
  {
    id: 'dark-mode',
    keywords: ['modo oscuro','dark mode','modo claro','cambiar tema','tema oscuro'],
    q: '¿Cómo activo el modo oscuro?',
    a: 'En Ajustes → sección "Apariencia" → activá el interruptor de Modo Oscuro.\n\nEl cambio aplica de inmediato en toda la app.',
  },
  {
    id: 'branches',
    keywords: ['sede','sedes','sucursal','sucursales','agregar sede','nueva sede'],
    q: '¿Cómo manejo múltiples sedes?',
    a: 'En el menú → Sedes → "Nueva sede" → ingresá nombre y dirección → Guardar.\n\nPodés asignar empleados y actividades a cada sede.',
  },
  // ── FACTURACIÓN / TRIAL ───────────────────────────────────────────────────
  {
    id: 'trial',
    keywords: ['trial','prueba gratis','periodo de prueba','cuando vence','dias gratis','15 dias'],
    q: '¿Cuánto dura el período de prueba?',
    a: 'El período de prueba es de 15 días gratis desde que te registrás. Podés usar todas las funciones sin restricciones.\n\nAl vencer, la cuenta se suspende hasta activar una suscripción.',
  },
  {
    id: 'subscription',
    keywords: ['suscripcion','suscripción','mercadopago','pagar plan','facturacion','facturación','activar plan','contratar'],
    q: '¿Cómo activo mi suscripción?',
    a: 'En Ajustes → Facturación → "Suscribirse con MercadoPago". El pago es mensual y se procesa de forma segura por MercadoPago.',
  },
  // ── GENERAL ───────────────────────────────────────────────────────────────
  {
    id: 'manual',
    keywords: ['manual','instructivo','guia','guía','como usar','ayuda','documentacion'],
    q: '¿Hay un manual de la aplicación?',
    a: 'Sí. En Ajustes → "Descargar manual" para bajar el PDF completo.\n\nTambién está disponible en la página principal de Gestumio.',
  },
  {
    id: 'global-search',
    keywords: ['buscar','busqueda','búsqueda','buscador','encontrar cliente','buscar cliente','buscar en app'],
    q: '¿Cómo busco algo rápidamente?',
    a: 'Usá el buscador en la barra superior (ícono 🔍). Busca en tiempo real entre clientes, actividades y más desde cualquier sección.',
  },
  {
    id: 'print',
    keywords: ['imprimir','impresion','impresión','pdf imprimir','estado de cuenta imprimir'],
    q: '¿Puedo imprimir o exportar documentos?',
    a: 'Sí. El Estado de cuenta del cliente tiene un botón "🖨️ Imprimir" que abre el diálogo de impresión con un formato limpio (sin menú ni botones).\n\nEn Reportes también podés exportar a CSV.',
  },
  {
    id: 'contact',
    keywords: ['contacto','soporte','ayuda tecnica','problema','error','falla','no funciona'],
    q: '¿Cómo contacto al soporte?',
    a: 'Escribinos a contacto@gestumio.app 📧\n\nTambién podés comunicarte directamente por WhatsApp desde la página de Gestumio. Respondemos a la brevedad.',
  },
];

// ── Normalizar sin tildes ────────────────────────────────────────────────────
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function findAnswer(text) {
  const q = normalize(text);
  let best = null, bestLen = 0;
  for (const entry of FAQ) {
    for (const kw of entry.keywords) {
      const kwN = normalize(kw);
      if (q.includes(kwN) && kwN.length > bestLen) {
        best = entry;
        bestLen = kwN.length;
      }
    }
  }
  return best;
}

// ── Menús contextuales por sección ──────────────────────────────────────────
const MENU_BY_ROUTE = {
  '/': ['¿Qué muestra el Dashboard?','¿Cómo personalizo el Dashboard?','¿Cómo veo los clientes con cuotas vencidas?','¿Cómo registro un pago?'],
  '/clientes': ['¿Cómo agrego un cliente?','¿Cómo importo clientes desde un archivo?','¿Cómo inscribo un cliente en una actividad?','¿Cómo veo el estado de cuenta de un cliente?'],
  '/clientes/:id': ['¿Cómo inscribo un cliente en una actividad?','¿Cómo registro un pago?','¿Cómo veo el estado de cuenta de un cliente?','¿Cómo le agrego una foto al cliente?'],
  '/cobranza': ['¿Cómo registro un pago?','¿Cómo envío un recordatorio por WhatsApp?','¿Cómo veo los clientes con cuotas vencidas?','¿Cómo se renuevan las cuotas cada mes?'],
  '/actividades': ['¿Cómo creo una actividad?','¿Cómo edito una actividad?','¿Cómo actualizo los precios de mis actividades?','¿Puedo cobrar un servicio puntual sin inscripción mensual?'],
  '/agenda': ['¿Cómo agrego un turno en la agenda?','¿Cómo edito o reprogramo un turno?','¿Cómo mando un recordatorio de turno por WhatsApp?','¿Cómo cancelo un turno?'],
  '/gastos': ['¿Cómo registro un gasto?','¿Qué categorías de gastos hay?','¿Cómo agrego un proveedor?','¿Cómo genero un reporte?'],
  '/reportes': ['¿Cómo genero un reporte?','¿Cómo filtro los reportes por fechas?','¿Puedo exportar mis datos?','¿Qué muestra el Dashboard?'],
  '/empleados': ['¿Cómo agrego un empleado?','¿Cómo edito los datos de un empleado?','¿Cómo registro un pago de sueldo?','¿Cómo asigno horarios a un empleado?'],
  '/liquidaciones': ['¿Cómo registro un pago de sueldo?','¿Cómo agrego un empleado?','¿Cómo registro asistencias de empleados?'],
  '/asistencias': ['¿Cómo registro asistencias de empleados?','¿Cómo asigno horarios a un empleado?','¿Cómo agrego un empleado?'],
  '/horarios': ['¿Cómo asigno horarios a un empleado?','¿Cómo agrego un turno en la agenda?','¿Cómo agrego un empleado?'],
  '/proveedores': ['¿Cómo agrego un proveedor?','¿Cómo veo la cuenta corriente de un proveedor?','¿Cómo registro un gasto?'],
  '/caja': ['¿Cómo funciona la Caja Diaria?','¿Cómo registro un gasto?','¿Cómo genero un reporte?'],
  '/precios': ['¿Cómo actualizo los precios de mis actividades?','¿Cómo creo una actividad?','¿Cómo inscribo un cliente en una actividad?'],
  '/sedes': ['¿Cómo manejo múltiples sedes?','¿Cómo agrego un empleado?','¿Cómo creo una actividad?'],
  '/ajustes': ['¿Cómo actualizo los datos de mi negocio?','¿Cómo cambio el logo?','¿Puedo tener varios usuarios?','¿Cómo configuro el mensaje de WhatsApp?'],
};

const DEFAULT_MENU = [
  '¿Cómo agrego un cliente?',
  '¿Cómo registro un pago?',
  '¿Cómo envío un recordatorio por WhatsApp?',
  '¿Cómo creo una actividad?',
  '¿Cómo genero un reporte?',
];

function getMenu(pathname) {
  if (MENU_BY_ROUTE[pathname]) return MENU_BY_ROUTE[pathname];
  if (pathname.startsWith('/clientes/')) return MENU_BY_ROUTE['/clientes/:id'];
  if (pathname.startsWith('/proveedores/')) return MENU_BY_ROUTE['/proveedores'];
  if (pathname.startsWith('/actividades/')) return MENU_BY_ROUTE['/actividades'];
  return DEFAULT_MENU;
}

const WELCOME = '¡Hola! 👋 Soy el asistente de Gestumio.\n¿Sobre qué querés saber?';

// ── Componente ───────────────────────────────────────────────────────────────
export default function ChatBot() {
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: 'bot', text: WELCOME, showMenu: true }]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const [lastRoute, setLastRoute] = useState(location.pathname);
  const bottomRef = useRef(null);

  const menu = getMenu(location.pathname);

  // Reset al cambiar de sección
  useEffect(() => {
    if (location.pathname !== lastRoute) {
      setLastRoute(location.pathname);
      setMessages([{ from: 'bot', text: WELCOME, showMenu: true }]);
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
        : 'No encontré una respuesta para eso 🤔\n\nProbá eligiendo una de las opciones del menú, o escribinos a contacto@gestumio.app 📧';
      setTyping(false);
      setMessages(m => [...m, { from: 'bot', text: response, showMenu: true }]);
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
        aria-label="Ayuda"
        className="support-chat-launcher"
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
        <div className="support-chat-panel" style={{
          position: 'fixed', bottom: 86, right: 24, zIndex: 8000,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '75vh', overflow: 'hidden',
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
              <div style={{ fontWeight: 700, fontSize: 14 }}>Asistente Gestumio</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>● En línea</div>
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}>
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

                {/* Menú después de respuesta del bot */}
                {m.from === 'bot' && m.showMenu && (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {menu.map((s, j) => (
                      <button key={j} onClick={() => sendMessage(s)} style={{
                        textAlign: 'left', padding: '7px 11px', borderRadius: 10,
                        border: '1px solid var(--primary)', background: 'transparent',
                        color: 'var(--primary)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                        lineHeight: 1.4,
                      }}>{s}</button>
                    ))}
                  </div>
                )}
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
