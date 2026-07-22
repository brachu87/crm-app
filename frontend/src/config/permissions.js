import { useAuth } from '../context/AuthContext';

// Árbol completo de permisos por módulo (cada módulo subdividido en sus funciones)
export const PERMISSION_TREE = [
  {
    key: 'clientes', label: 'Clientes', icon: '👤',
    actions: [
      { key: 'ver',      label: 'Ver listado' },
      { key: 'ver_ficha',label: 'Ver ficha / detalle' },
      { key: 'crear',    label: 'Agregar cliente' },
      { key: 'editar',   label: 'Editar datos' },
      { key: 'baja',     label: 'Dar de baja / reactivar' },
      { key: 'cuenta',   label: 'Cuenta corriente / pagos' },
      { key: 'foto',     label: 'Cambiar foto' },
      { key: 'exportar', label: 'Exportar CSV' },
      { key: 'importar', label: 'Importar Excel' },
    ],
  },
  {
    key: 'actividades', label: 'Actividades/Servicios', icon: '🏃',
    actions: [
      { key: 'ver',    label: 'Ver listado' },
      { key: 'crear',  label: 'Crear actividad/servicio' },
      { key: 'editar', label: 'Editar' },
      { key: 'baja',   label: 'Activar / desactivar' },
      { key: 'inscribir', label: 'Inscribir clientes' },
    ],
  },
  {
    key: 'agenda', label: 'Agenda / Turnos', icon: '📅',
    actions: [
      { key: 'ver',         label: 'Ver agenda' },
      { key: 'crear',       label: 'Agendar turno' },
      { key: 'editar',      label: 'Editar turno' },
      { key: 'eliminar',    label: 'Cancelar / eliminar turno' },
      { key: 'recordatorio',label: 'Enviar recordatorio WhatsApp' },
    ],
  },
  {
    key: 'cobranza', label: 'Cobranza', icon: '💳',
    actions: [
      { key: 'ver',         label: 'Ver cobranza' },
      { key: 'cobrar',      label: 'Registrar pago' },
      { key: 'editar_cuota',label: 'Editar cuota' },
      { key: 'eliminar',    label: 'Eliminar inscripción' },
      { key: 'renovar',     label: 'Renovar cuotas del mes' },
      { key: 'otros',       label: 'Registrar otros ingresos' },
      { key: 'facturar',    label: 'Facturar al cobrar' },
      { key: 'recordatorio',label: 'Enviar recordatorio / recibo WhatsApp' },
    ],
  },
  {
    key: 'caja', label: 'Caja del día', icon: '🏦',
    actions: [
      { key: 'ver',    label: 'Ver movimientos' },
      { key: 'crear',  label: 'Registrar movimiento' },
      { key: 'cerrar', label: 'Abrir / cerrar caja' },
    ],
  },
  {
    key: 'gastos', label: 'Gastos', icon: '💸',
    actions: [
      { key: 'ver',      label: 'Ver gastos' },
      { key: 'crear',    label: 'Registrar gasto' },
      { key: 'escanear', label: 'Cargar con IA (foto/PDF)' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
      { key: 'libro_iva',label: 'Exportar Libro IVA (compras)' },
      { key: 'importar', label: 'Importar Excel/CSV' },
      { key: 'exportar', label: 'Exportar Excel/CSV/PDF' },
    ],
  },
  {
    key: 'proveedores', label: 'Proveedores', icon: '🏭',
    actions: [
      { key: 'ver',      label: 'Ver listado' },
      { key: 'crear',    label: 'Agregar proveedor' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
      { key: 'cuenta',   label: 'Ver cuenta corriente' },
      { key: 'exportar', label: 'Exportar CSV' },
      { key: 'importar', label: 'Importar Excel' },
    ],
  },
  {
    key: 'empleados', label: 'Equipo (Legajos)', icon: '👥',
    actions: [
      { key: 'ver',      label: 'Ver legajos' },
      { key: 'crear',    label: 'Agregar empleado' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
      { key: 'exportar', label: 'Exportar CSV' },
      { key: 'importar', label: 'Importar Excel' },
    ],
  },
  {
    key: 'asistencias', label: 'Asistencias', icon: '🕒',
    actions: [
      { key: 'ver',       label: 'Ver asistencias' },
      { key: 'registrar', label: 'Registrar asistencia' },
    ],
  },
  {
    key: 'liquidaciones', label: 'Liquidaciones', icon: '🧾',
    actions: [
      { key: 'ver',     label: 'Ver liquidaciones' },
      { key: 'generar', label: 'Generar liquidación' },
      { key: 'pagar',   label: 'Marcar como pagada' },
    ],
  },
  {
    key: 'horarios', label: 'Horarios', icon: '📆',
    actions: [
      { key: 'ver',    label: 'Ver horarios' },
      { key: 'editar', label: 'Editar horarios' },
    ],
  },
  {
    key: 'reportes', label: 'Reportes', icon: '📊',
    actions: [
      { key: 'ver',      label: 'Ver reportes' },
      { key: 'exportar', label: 'Exportar PDF' },
    ],
  },
  {
    key: 'precios', label: 'Grilla de precios', icon: '💰',
    actions: [
      { key: 'ver',    label: 'Ver precios' },
      { key: 'editar', label: 'Editar precios' },
    ],
  },
  {
    key: 'sedes', label: 'Sedes', icon: '📍',
    actions: [
      { key: 'ver',      label: 'Ver sedes' },
      { key: 'crear',    label: 'Agregar sede' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
    ],
  },
  {
    key: 'usuarios', label: 'Usuarios y permisos', icon: '🔑',
    actions: [
      { key: 'ver',      label: 'Ver usuarios' },
      { key: 'crear',    label: 'Crear usuario' },
      { key: 'editar',   label: 'Editar / permisos' },
      { key: 'eliminar', label: 'Eliminar usuario' },
    ],
  },
  {
    key: 'auditoria', label: 'Historial de actividad', icon: '📜',
    actions: [ { key: 'ver', label: 'Ver historial' } ],
  },
  {
    key: 'comprobantes', label: 'Facturación AFIP', icon: '🧾',
    actions: [
      { key: 'ver',      label: 'Ver comprobantes' },
      { key: 'emitir',   label: 'Emitir factura' },
      { key: 'notas',    label: 'Notas de crédito/débito' },
      { key: 'libro_iva',label: 'Exportar Libro IVA (ventas)' },
      { key: 'config',   label: 'Configurar AFIP' },
    ],
  },
  {
    key: 'facturacion', label: 'Suscripción / Plan', icon: '💠',
    actions: [
      { key: 'ver',      label: 'Ver estado del plan' },
      { key: 'gestionar',label: 'Gestionar pago / renovar' },
    ],
  },
  {
    key: 'configuracion', label: 'Configuración (Ajustes)', icon: '⚙️',
    actions: [
      { key: 'negocio',       label: 'Datos y logo del negocio' },
      { key: 'whatsapp',      label: 'Conexión de WhatsApp' },
      { key: 'calendar',      label: 'Google Calendar' },
      { key: 'reservas',      label: 'Reservas online' },
      { key: 'cobros_online', label: 'Cobros online (Mercado Pago)' },
      { key: 'telegram',      label: 'Bot de Telegram' },
    ],
  },
];

// Mapa ruta -> módulo (para filtrar el menú lateral por permiso 'ver')
export const ROUTE_MODULE = {
  '/clientes': 'clientes',
  '/actividades': 'actividades',
  '/agenda': 'agenda',
  '/proveedores': 'proveedores',
  '/empleados': 'empleados',
  '/asistencias': 'asistencias',
  '/liquidaciones': 'liquidaciones',
  '/horarios': 'horarios',
  '/cobranza': 'cobranza',
  '/caja': 'caja',
  '/reportes': 'reportes',
  '/gastos': 'gastos',
  '/precios': 'precios',
  '/sedes': 'sedes',
  '/comprobantes': 'comprobantes',
  '/historial': 'auditoria',
};

/**
 * Hook para verificar permisos de acciones específicas en un módulo.
 * Owners y admins siempre tienen acceso total.
 * Si permissions es null → sin restricciones (acceso total).
 * Si permissions es array → solo las acciones listadas.
 *
 * Formato:  ['clientes.ver', 'clientes.editar', ...]
 * Compat:   ['/clientes', ...]  (formato viejo de rutas → acceso total al módulo)
 */
export function useSectionPerms(section) {
  const { user } = useAuth();

  function can(action) {
    if (!user) return false;
    if (user.role === 'owner' || user.role === 'admin') return true;
    const perms = user.permissions;
    if (!perms) return true; // sin restricciones (owner/admin/staff con permisos nulos)
    if (perms.includes(`${section}.${action}`)) return true;
    if (perms.includes('/' + section)) return true; // compat formato viejo
    return false;
  }

  const tree = PERMISSION_TREE.find(p => p.key === section);
  const result = {};
  if (tree) tree.actions.forEach(a => { result[a.key] = can(a.key); });
  return result;
}

/**
 * ¿El usuario puede ver/entrar a un módulo? (permiso '<modulo>.ver')
 * Usado por el menú lateral. Owner/admin o sin restricciones → true.
 */
export function canViewModule(user, moduleKey) {
  if (!user) return false;
  const perms = user.permissions;
  if (!perms) return true; // sin restricciones
  if (perms.includes(`${moduleKey}.ver`)) return true;
  if (perms.includes('/' + moduleKey)) return true; // compat
  return false;
}
