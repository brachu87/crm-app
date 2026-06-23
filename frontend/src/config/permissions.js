import { useAuth } from '../context/AuthContext';

// Árbol completo de permisos por módulo
export const PERMISSION_TREE = [
  {
    key: 'clientes', label: 'Clientes', icon: '👤',
    actions: [
      { key: 'ver',      label: 'Ver listado' },
      { key: 'crear',    label: 'Agregar cliente' },
      { key: 'editar',   label: 'Editar datos' },
      { key: 'baja',     label: 'Dar de baja' },
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
      { key: 'baja',   label: 'Dar de baja' },
    ],
  },
  {
    key: 'agenda', label: 'Agenda', icon: '📅',
    actions: [
      { key: 'ver',      label: 'Ver agenda' },
      { key: 'crear',    label: 'Agendar turno' },
      { key: 'eliminar', label: 'Cancelar/eliminar turno' },
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
    key: 'proveedores', label: 'Proveedores', icon: '🏭',
    actions: [
      { key: 'ver',      label: 'Ver listado' },
      { key: 'crear',    label: 'Agregar proveedor' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
      { key: 'exportar', label: 'Exportar CSV' },
      { key: 'importar', label: 'Importar Excel' },
    ],
  },
  {
    key: 'cobranza', label: 'Cobranza', icon: '💳',
    actions: [
      { key: 'ver',         label: 'Ver cobranza' },
      { key: 'cobrar',      label: 'Registrar pago' },
      { key: 'editar_cuota', label: 'Editar cuota' },
    ],
  },
  {
    key: 'caja', label: 'Caja del día', icon: '🏦',
    actions: [
      { key: 'ver',   label: 'Ver movimientos' },
      { key: 'crear', label: 'Registrar movimiento' },
    ],
  },
  {
    key: 'gastos', label: 'Gastos', icon: '💸',
    actions: [
      { key: 'ver',      label: 'Ver gastos' },
      { key: 'crear',    label: 'Registrar gasto' },
      { key: 'editar',   label: 'Editar' },
      { key: 'eliminar', label: 'Eliminar' },
      { key: 'exportar', label: 'Exportar CSV' },
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
];

/**
 * Hook para verificar permisos de acciones específicas en un módulo.
 * Owners y admins siempre tienen acceso total.
 * Si permissions es null → sin restricciones (acceso total).
 * Si permissions es array → solo las acciones listadas.
 *
 * Formato nuevo:  ['clientes.ver', 'clientes.editar', ...]
 * Formato viejo:  ['/clientes', '/reportes', ...]  (compatibilidad)
 */
export function useSectionPerms(section) {
  const { user } = useAuth();

  function can(action) {
    if (!user) return false;
    // Owner y admin: acceso total siempre
    if (user.role === 'owner' || user.role === 'admin') return true;
    const perms = user.permissions;
    // Sin restricciones: acceso total
    if (!perms) return true;
    // Formato nuevo: 'clientes.ver'
    if (perms.includes(`${section}.${action}`)) return true;
    // Backward compat: formato viejo '/clientes' → acceso total a ese módulo
    if (perms.includes('/' + section)) return true;
    return false;
  }

  // Devuelve objeto con cada acción del módulo como propiedad booleana
  const tree = PERMISSION_TREE.find(p => p.key === section);
  const result = {};
  if (tree) tree.actions.forEach(a => { result[a.key] = can(a.key); });
  return result;
}
