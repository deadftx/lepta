import type { User } from './AuthContext';

export interface PermissionItem {
  id: string;
  name: string;
}

export interface PermissionGroup extends PermissionItem {
  children?: PermissionItem[];
}

export const permissionGroups: PermissionGroup[] = [
  { id: '1', name: 'Créditos' },
  { id: '2', name: 'Análise de Riscos' },
  { id: '3', name: 'Comitê de Crédito' },
  { id: '6', name: 'Calendário' },
  {
    id: '7',
    name: 'Financeiro',
    children: [{ id: '7.1', name: 'Processar Extrato' }]
  },
  {
    id: '8',
    name: 'Lepta Intelligence',
    children: [{ id: '8.1', name: 'Análise de Clientes' }]
  },
  { id: '10', name: 'Confirmação' },
  { id: '9', name: 'Banco de Dados' },
  { id: '5', name: 'Dashboards' },
  { id: '4', name: 'Business Intelligence' }
];

const legacyChildren: Record<string, string[]> = {
  '7': ['7.1'],
  '8': ['8.1']
};

export const allPermissionIds = permissionGroups.flatMap(group =>
  group.children?.map(child => child.id) ?? [group.id]
);

export const normalizePermissions = (permissions: string[] = []) => {
  const normalized = new Set(permissions);
  Object.entries(legacyChildren).forEach(([parentId, childIds]) => {
    if (normalized.has(parentId)) childIds.forEach(id => normalized.add(id));
  });
  return [...normalized].filter(id => allPermissionIds.includes(id));
};

export const hasPermission = (user: User | null, permissionId: string) =>
  user?.role === 'MASTER' || normalizePermissions(user?.permissions).includes(permissionId);

export const hasAnyPermission = (user: User | null, permissionIds: string[]) =>
  user?.role === 'MASTER' || permissionIds.some(id => hasPermission(user, id));
