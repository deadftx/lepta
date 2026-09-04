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
      { id: '7.4', name: 'Central de Pagamentos' },
      { id: '7.5', name: 'Calendário de Pagamentos' }
    ]
  },
  {
    id: '8',
    name: 'Lepta Intelligence',
    children: [
      { id: '8.1', name: 'Análise de Clientes' },
      { id: '8.2', name: 'Cadastro de Clientes' },
      { id: '8.3', name: 'Análise de Riscos' },
      { id: '8.4', name: 'NPL' },
      { id: '8.5', name: 'Esteira de Comitê' },
      { id: '8.6', name: 'Consulta SmartFactor' },
      { id: '8.7', name: 'Cadastro de Gerentes' }
    ]
  },
  {
    id: '10',
    name: 'Confirmação',
    children: [
      { id: '10.1', name: 'Sistema de Confirmação' },
      { id: '10.2', name: 'Análise de Confirmação' }
    ]
  },
  {
    id: '11',
    name: 'Administrativo',
    children: [
      { id: '11.1', name: 'Solicitações Financeiras' },
      { id: '11.2', name: 'Configuração de Esteira de Compras' },
      { id: '11.3', name: 'Agendar Sala de Reunião' }
    ]
  },
  {
    id: '12',
    name: 'Cobrança',
    children: [
      { id: '12.1', name: 'Análise de Vencidos' }
    ]
  },
  {
    id: '13',
    name: 'Jurídico',
    children: [
      { id: '13.1', name: 'Aprovação de Pagamentos' }
    ]
  },
  {
    id: '14',
    name: 'Mesa de Operação',
    children: [
      { id: '14.1', name: 'Análise de Operação' },
      { id: '14.2', name: 'Validar CEPs' }
    ]
  },
  { id: '9', name: 'Banco de Dados' },
  { id: '5', name: 'Dashboards' },
  { id: '4', name: 'Business Intelligence' }
];

const legacyChildren: Record<string, string[]> = {
  '7': ['7.1', '7.2', '7.4', '7.5'],
  '8': ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7'],
  '10': ['10.1', '10.2'],
  '11': ['11.1', '11.2', '11.3'],
  '12': ['12.1'],
  '14': ['14.1', '14.2']
};

export const allPermissionIds = permissionGroups.flatMap(group =>
  group.children ? [group.id, ...group.children.map(child => child.id)] : [group.id]
);

export const normalizePermissions = (permissions: string[] = []) => {
  const normalized = new Set(permissions);
  Object.entries(legacyChildren).forEach(([parentId, childIds]) => {
    if (normalized.has(parentId)) childIds.forEach(id => normalized.add(id));
  });
  return [...normalized].filter(id => allPermissionIds.includes(id));
};

export const hasPermission = (user: User | null, permissionId: string) => {
  if (!user) return false;
  if (user.role === 'MASTER') return true;

  // 1. Verifica permissões diretas ou já combinadas no objeto do usuário
  const perms = normalizePermissions(user.permissions);
  if (perms.includes(permissionId)) return true;
  if (permissionId === '8.6' && (perms.includes('8.1') || perms.includes('8'))) return true;

  // 2. Fallback resiliente: verifica grupos cacheados no navegador
  try {
    const cachedGroups = localStorage.getItem('lepta_groups_cache');
    if (cachedGroups) {
      const groups = JSON.parse(cachedGroups);
      if (Array.isArray(groups)) {
        const uId = String(user.id);
        const uEmail = (user.email || '').toLowerCase().trim();
        const uGrpId = String(user.groupId || user.group_id || '');

        for (const g of groups) {
          if (!g) continue;
          const matchById = uGrpId && String(g.id) === uGrpId;
          const matchByList = Array.isArray(g.userIds) && g.userIds.some((x: any) => {
            const str = String(x).toLowerCase().trim();
            return str === uId.toLowerCase() || (uEmail && str === uEmail);
          });

          if (matchById || matchByList) {
            const groupPerms = normalizePermissions(g.permissions || []);
            if (groupPerms.includes(permissionId)) return true;
            if (permissionId === '8.6' && (groupPerms.includes('8.1') || groupPerms.includes('8'))) return true;
          }
        }
      }
    }
  } catch {}

  return false;
};

export const hasAnyPermission = (user: User | null, permissionIds: string[]) =>
  user?.role === 'MASTER' || permissionIds.some(id => hasPermission(user, id));
