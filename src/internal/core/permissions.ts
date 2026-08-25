import type { User } from './AuthContext';

export interface PermissionItem {
  id: string;
  name: string;
}

export interface PermissionGroup extends PermissionItem {
  children?: PermissionItem[];
}

export const permissionGroups: PermissionGroup[] = [
  { id: '6', name: 'Calendário' },
  {
    id: '7',
    name: 'Financeiro',
    children: [
      { id: '7.1', name: 'Processar Extrato' },
      { id: '7.2', name: 'LEPTA x GRAFENO' },
      { id: '7.4', name: 'Reembolsos e Despesas' },
      { id: '7.5', name: 'Calendário de Pagamentos' }
    ]
  },
  {
    id: '8',
    name: 'Lepta Intelligence',
    children: [
      { id: '8.1', name: 'Análise de Clientes' },
      { id: '8.2', name: 'Cadastro de Clientes' },
      { id: '8.3', name: 'Análise de Riscos' }
    ]
  },
  {
    id: '10',
    name: 'Confirmação',
    children: [
      { id: '10.1', name: 'Sistema de Confirmação' }
    ]
  },
  {
    id: '11',
    name: 'Administrativo',
    children: [
      { id: '11.1', name: 'Solicitações Financeiras' },
      { id: '11.2', name: 'Configuração de Esteira de Compras' }
    ]
  },
  { id: '9', name: 'Banco de Dados' },
  { id: '5', name: 'Dashboards' },
  { id: '4', name: 'Business Intelligence' }
];

const legacyChildren: Record<string, string[]> = {
  '7': ['7.1', '7.2', '7.4', '7.5'],
  '8': ['8.1'],
  '10': ['10.1'],
  '11': ['11.1', '11.2']
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
