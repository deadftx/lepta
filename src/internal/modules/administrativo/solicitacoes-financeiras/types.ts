export type TipoDestino = 'DEPARTAMENTO' | 'CENTRO_DE_CUSTO' | 'EMPRESA' | 'CLIENTE';

export type CategoriaSolicitacao = 'Insumos' | 'Visita' | 'Reembolso' | 'Festas' | 'Aniversários' | 'Eventos' | 'Outros';

export const DEPARTAMENTOS_PADRAO = [
  'Tecnologia',
  'Administrativo',
  'Marketing',
  'Financeiro',
  'Cobrança',
  'Mesa de Operações',
  'Jurídico',
  'Comercial',
  'Limpeza'
] as const;

export const CATEGORIAS_PADRAO: CategoriaSolicitacao[] = [
  'Insumos',
  'Visita',
  'Reembolso',
  'Festas',
  'Aniversários',
  'Eventos',
  'Outros'
];

export const REEMBOLSO_SUBCATEGORIAS = [
  'ALIMENTAÇÃO',
  'COMBUSTIVEL',
  'ESTACIONAMENTO',
  'PEDAGIO',
  'HOSPEDAGEM',
  'KILOMETRAGEM',
  'PASSAGEM',
  'TÁXI',
  'LOCACAO DE VEICULOS',
  'CARTORIO',
  'CORREIO',
  'MATERIAL DE ESCRITORIO',
  'MATERIAL DE LIMPEZA',
  'MAT INFORMATICA E INTERNET',
  'SERVICOS ADVOCATICIOS',
  'AUDITORES INDEPENDENTES',
  'SERVICOS TERCERIZADOS',
  'MULTA DE TRANSITO',
  'CURSO PROFISSIONALIZANTE',
  'MATERIAL PARA TREINAMENTO',
  'BRINDES',
  'TAXAS DIVERSAS',
  'OUTROS'
] as const;

export type ReembolsoSubcategoria = typeof REEMBOLSO_SUBCATEGORIAS[number];

export type EmpresaPagadora =
  | 'INDIFERENTE'
  | 'Lepta Consultora'
  | 'Lepta Gestora'
  | 'Lepta Securitizadora'
  | 'BDM'
  | 'Lepta Metais'
  | 'LeptaHub';

export const EMPRESAS_PAGADORAS: EmpresaPagadora[] = [
  'INDIFERENTE',
  'Lepta Consultora',
  'Lepta Gestora',
  'Lepta Securitizadora',
  'BDM',
  'Lepta Metais',
  'LeptaHub'
];

export interface PurchaseItemForm {
  id?: string;
  categoria: CategoriaSolicitacao;
  subcategoria_reembolso?: string;
  km_rodado?: number;
  tipo_destino: TipoDestino;
  empresa_pagadora: EmpresaPagadora;
  departamento_centro_custo: string;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: 'PIX' | 'BOLETO' | 'CREDITO';
  quantidade_parcelas: number;
  produto_servico: string;
  valor: number;
  valorDisplay: string;
  quantidade: number;
  observacoes?: string;
  chave_pix?: string;
}

export interface PurchaseItem {
  id?: string;
  requisicao_id?: string;
  numero_item?: number;
  tipo_destino: TipoDestino;
  empresa_pagadora?: EmpresaPagadora;
  departamento_centro_custo: string;
  categoria: CategoriaSolicitacao;
  subcategoria_reembolso?: string;
  km_rodado?: number;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: string;
  quantidade_parcelas: number;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes?: string;
  chave_pix?: string;
  created_at?: string;
}

export interface PurchaseMessage {
  id: string;
  requisicao_id: string;
  autor_id: string;
  autor_nome: string;
  autor_role: 'APROVADOR' | 'REQUISITANTE';
  mensagem: string;
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  numero: number;
  tipo_destino?: TipoDestino;
  empresa_pagadora?: EmpresaPagadora;
  categoria?: string;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: string;
  quantidade_parcelas: number;
  departamento_centro_custo: string;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes: string;
  chave_pix?: string;
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'PAGAMENTO_PAUSADO' | 'NEGADO' | 'PAGO' | 'REVISAO' | 'SOLICITACAO_CONCLUIDA';
  data_pagamento?: string | null;
  datas_parcelas?: string | null;
  pausado_em?: string | null;
  pausado_por_id?: string | null;
  pausado_por_nome?: string | null;
  motivo_pausa?: string | null;
  status_anterior?: string | null;
  parcelas?: any[];
  arquivado?: number;
  arquivado_manualmente?: number;
  arquivado_por?: string | null;
  arquivado_em?: string | null;
  motivo_arquivamento?: string | null;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  aprovador_id: string | null;
  aprovador_nome: string | null;
  motivo_decisao: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  total_mensagens?: number;
  total_itens?: number;
  total_anexos?: number;
  itens?: PurchaseItem[];
  mensagens?: PurchaseMessage[];
}
