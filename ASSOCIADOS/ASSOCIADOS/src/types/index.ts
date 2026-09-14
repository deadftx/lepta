export interface AssociadoRaw {
  [key: string]: any;
}

export interface AssociadoNormalized {
  id: string;
  nome: string;
  status: string;
  cargo?: string;
  departamento?: string;
  unidade?: string;
  dataAdmissao?: string;
  dataDesligamento?: string;
  valor?: number;
  tipoContrato?: string;
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  rawData: Record<string, any>;
}

export interface DashboardKPIs {
  totalAssociados: number;
  totalAtivos: number;
  totalInativos: number;
  taxaAtivos: number;
  mediaIdade: number;
  totalRemuneracao: number;
  mediaRemuneracao: number;
  novosPeriodo: number;
  distribuicaoStatus: { label: string; count: number; percentage: number }[];
  distribuicaoArea: { label: string; count: number; percentage: number }[];
  distribuicaoCargo: { label: string; count: number; percentage: number }[];
  distribuicaoNivelCargo: { label: string; count: number; percentage: number }[];
  evolucaoAdmissoes: { label: string; count: number }[];
  faixasValores?: { label: string; count: number }[];
}

export interface FilterOptions {
  status: string[];
  departamentos: string[];
  cargos: string[];
  unidades: string[];
  tiposContrato: string[];
}
