export interface Entidade {
  id: number;
  valido?: boolean;
  documento: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  tipo?: string | null;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string | null;
    bairro?: string;
    localidade?: string;
    estado?: string;
    cep?: string;
  } | null;
}

export interface Cliente {
  id: number;
  valido?: boolean;
  entidade: Entidade;
}

export interface UnidadeAdministrativa {
  id: number;
  valido?: boolean;
  alias: string;
  empresa?: {
    documento?: string;
    nome?: string | null;
  } | null;
}

export interface ProdutoOperacional {
  descricao: string;
}

export interface ContaOperacional {
  id: number;
  valido?: boolean;
  sigla?: string;
  limite?: number | null;
  tranche?: number | null;
  cliente?: Cliente;
  unidadeAdministrativa?: UnidadeAdministrativa;
  produto?: ProdutoOperacional;
}

export interface TituloItem {
  id: number;
  numero: string;
  sigla?: string | null;
  sacado?: {
    id: number;
    entidade: Entidade;
  };
  dataDeEmissao?: string;
  dataDeCadastro?: string;
  dataDeVencimento?: string;
  valorNominal?: number;
  valorLiquido?: number;
  valorPresente?: number;
  registradoNoCobrador?: boolean;
}

export interface ItemOperacao {
  titulo: TituloItem;
  valorDeAquisicao?: number;
}

export interface Operacao {
  id: number;
  valido?: boolean;
  contaOperacional?: ContaOperacional;
  dataDeCadastro: string;
  efetivada: boolean;
  dataDeEfetivacao?: string | null;
  totalBruto: number;
  totalLiquido: number;
  quantidadeDeTitulos: number;
  coobrigacao: boolean;
  pagamento?: any;
  itens?: ItemOperacao[] | null;
}

export interface BuscaOperacoesRequest {
  id?: number;
  tipoDeData: 'Cadastro' | 'Efetivacao';
  dataInicial?: string;
  dataFinal?: string;
  documentoDoCliente?: string;
  documentoDaUnidadeAdministrativa?: string;
}

export interface DashboardStats {
  periodo: string;
  totalOperacoes: number;
  totalTitulos: number;
  volumeBruto: number;
  volumeLiquido: number;
  desagioTotal: number;
  taxaDesagioMedia: number;
  ticketMedioOperacao: number;
  ticketMedioTitulo: number;
  efetivadasQtd: number;
  efetivadasVolumeBruto: number;
  efetivadasVolumeLiquido: number;
  pendentesQtd: number;
  pendentesVolumeBruto: number;
  pendentesVolumeLiquido: number;
  taxaEfetivacaoQtd: number;
  taxaEfetivacaoVolume: number;
  comCoobrigacaoQtd: number;
  semCoobrigacaoQtd: number;
  percentualCoobrigacao: number;
  porUnidade: Record<string, { qtd: number; bruto: number; liquido: number }>;
  porProduto: Record<string, { qtd: number; bruto: number; liquido: number }>;
  timeline: Array<{
    dataOuHora: string;
    label: string;
    qtd: number;
    bruto: number;
    liquido: number;
  }>;
  topCedentes: Array<{
    nome: string;
    documento: string;
    qtd: number;
    bruto: number;
    liquido: number;
  }>;
  ultimaAtualizacao: string;
}

export interface EmpresaFalimentarItem {
  processo?: string;
  tribunal?: string;
  tribunalNome?: string;
  classe: string;
  empresa: string;
  cnpj?: string;
  endereco?: string;
  administradorJudicial?: string;
  varaComarca?: string;
  dataAjuizamento?: string;
  dataCaptura?: string;
  fonte?: string;
  raw?: {
    originalText?: string;
    observacao?: string;
  };
}
