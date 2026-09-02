export interface SearchItem {
  id: string;
  title: string;
  category: string;
  breadcrumb: string[];
  path: string;
  permissionId?: string; // If null/undefined, accessible to all authenticated users
  masterOnly?: boolean;
  description: string;
  explanation?: string; // "Onde encontrar / Como acessar"
  targetElementHint?: string; // Direct hint for inside the page
  tags?: string[]; // Tags visíveis para guiar o usuário
  keywords: string[]; // Palavras-chave completas para o motor de busca inteligente
  icon: string; // Lucide icon name identifier
  badge?: string;
}

export const systemSearchItems: SearchItem[] = [
  // ==========================================
  // INTRANET / HOME
  // ==========================================
  {
    id: 'home-dashboard',
    title: 'Home & Painel Inicial',
    category: 'Intranet',
    breadcrumb: ['Intranet', 'Home'],
    path: '/dashboard',
    description: 'Página inicial com calendário institucional, próximos eventos, aniversários e feriados corporativos.',
    explanation: 'Acesse o menu Intranet > Home para visualizar comunicados e calendário corporativo.',
    tags: ['Início', 'Calendário', 'Comunicados', 'Aniversários', 'Feriados'],
    keywords: ['home', 'inicio', 'painel', 'dashboard', 'intranet', 'aniversarios', 'feriados', 'eventos', 'calendario interno', 'comunicados', 'geral'],
    icon: 'Home',
    badge: 'Geral'
  },
  {
    id: 'quick-ponto',
    title: 'Acesso Rápido: Ponto Eletrônico',
    category: 'Intranet',
    breadcrumb: ['Intranet', 'Home', 'Acessos Rápidos'],
    path: '/dashboard',
    description: 'Atalho para o registro e controle de ponto eletrônico dos colaboradores.',
    explanation: 'Localizado no cartão de "Acessos Rápidos" na tela inicial (Home).',
    targetElementHint: 'Card "Acessos Rápidos" > Ponto Eletrônico',
    tags: ['Ponto', 'Banco de Horas', 'Espelho de Ponto', 'RH'],
    keywords: ['ponto', 'ponto eletronico', 'banco de horas', 'registro de ponto', 'horas trabalhadas', 'espelho de ponto', 'rh', 'bater ponto', 'cartao ponto'],
    icon: 'Clock',
    badge: 'Atalho'
  },
  {
    id: 'quick-ti',
    title: 'Acesso Rápido: Chamados TI',
    category: 'Intranet',
    breadcrumb: ['Intranet', 'Home', 'Acessos Rápidos'],
    path: '/dashboard',
    description: 'Atalho para abertura de tickets, suporte e chamados técnicos de TI.',
    explanation: 'Localizado no cartão de "Acessos Rápidos" na tela inicial (Home).',
    targetElementHint: 'Card "Acessos Rápidos" > Chamados TI',
    tags: ['Suporte TI', 'Helpdesk', 'Abrir Chamado', 'Tecnologia'],
    keywords: ['chamados', 'ti', 'suporte', 'helpdesk', 'informatica', 'tecnologia', 'abrir chamado', 'problema', 'ticket', 'computador', 'acesso'],
    icon: 'HelpCircle',
    badge: 'Atalho'
  },

  // ==========================================
  // GRUPO MARKETING / CALENDÁRIO
  // ==========================================
  {
    id: 'mkt-calendar',
    title: 'Calendário de Marketing',
    category: 'Marketing',
    breadcrumb: ['Grupos', 'Calendário'],
    path: '/marketing',
    permissionId: '6',
    description: 'Planejamento e visualização de postagens, campanhas e ações do marketing.',
    explanation: 'Acesse Grupos > Calendário para ver a grade de campanhas e publicações.',
    tags: ['Campanhas', 'Redes Sociais', 'Postagens', 'Mídias', 'Conteúdo'],
    keywords: ['marketing', 'calendario', 'postagens', 'campanhas', 'midias', 'redes sociais', 'divulgacao', 'conteudo', 'design', 'cronograma'],
    icon: 'Calendar',
    badge: 'Menu'
  },

  // ==========================================
  // GRUPO FINANCEIRO
  // ==========================================
  {
    id: 'fin-dashboard',
    title: 'Painel Geral Financeiro',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro'],
    path: '/financeiro',
    permissionId: '7',
    description: 'Visão geral das rotinas financeiras, conciliações e indicadores de caixa.',
    explanation: 'Acesse Grupos > Financeiro para ver o dashboard com atalhos de extratos, Grafeno e despesas.',
    tags: ['Tesouraria', 'Contas', 'Fluxo de Caixa', 'Bancos'],
    keywords: ['financeiro', 'financas', 'caixa', 'bancos', 'tesouraria', 'movimentacao', 'extrato'],
    icon: 'Wallet',
    badge: 'Menu'
  },
  {
    id: 'fin-extratos',
    title: 'Processar Extrato Bancário',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro', 'Processar Extrato'],
    path: '/financeiro/extratos',
    permissionId: '7.1',
    description: 'Importação e conciliação de extratos bancários nos formatos OFX, XLSX e CSV.',
    explanation: 'Acesse Grupos > Financeiro > Processar Extrato para fazer upload e conciliação de lançamentos.',
    tags: ['OFX', 'Excel / CSV', 'Conciliação Bancária', 'Lançamentos'],
    keywords: ['extrato', 'extratos', 'processar extrato', 'ofx', 'excel', 'csv', 'bancario', 'conciliacao', 'lancamentos', 'debitos', 'creditos', 'saldo', 'importar extrato'],
    icon: 'FileSpreadsheet',
    badge: 'Submenu'
  },
  {
    id: 'fin-grafeno',
    title: 'LEPTA x GRAFENO',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro', 'LEPTA x GRAFENO'],
    path: '/financeiro/grafeno',
    permissionId: '7.2',
    description: 'Integração de contas e conciliação de movimentações da plataforma Grafeno.',
    explanation: 'Acesse Grupos > Financeiro > LEPTA x GRAFENO para conferir saldos e conciliar transações.',
    tags: ['Grafeno', 'Conta Escrow', 'Extrato Grafeno', 'Saldos'],
    keywords: ['grafeno', 'lepta x grafeno', 'conciliacao grafeno', 'conta escrow', 'movimento', 'ted', 'pix', 'transacoes grafeno', 'saldo grafeno'],
    icon: 'Landmark',
    badge: 'Submenu'
  },
  {
    id: 'fin-central-pagamentos',
    title: 'Central de Pagamentos',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro', 'Central de Pagamentos'],
    path: '/financeiro/reembolsos-despesas',
    permissionId: '7.4',
    description: 'Gestão e processamento da fila de pagamentos, liquidação de despesas e aprovações financeiras.',
    explanation: 'Acesse Grupos > Financeiro > Central de Pagamentos para gerenciar e executar pagamentos aprovados.',
    tags: ['Fila de Pagamentos', 'Liquidação', 'PIX & TED', 'Boletos', 'Contas a Pagar'],
    keywords: ['central de pagamentos', 'central pagamentos', 'pagamentos', 'pagamento', 'contas a pagar', 'contas pagar', 'liquidacao', 'liquidacoes', 'ted', 'pix', 'boletos', 'despesas aprovadas', 'fila de pagamento', 'processar pagamento', 'baixa de pagamentos', 'financeiro pagamentos'],
    icon: 'DollarSign',
    badge: 'Submenu'
  },
  {
    id: 'fin-calendario-pag',
    title: 'Calendário de Pagamentos',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro', 'Calendário de Pagamentos'],
    path: '/financeiro/calendario-pagamentos',
    permissionId: '7.5',
    description: 'Controle de fluxo de vencimentos, contas a pagar e saídas financeiras programadas.',
    explanation: 'Acesse Grupos > Financeiro > Calendário de Pagamentos para consultar os compromissos por data.',
    tags: ['Vencimentos', 'Contas a Pagar', 'Fluxo de Caixa', 'Compromissos'],
    keywords: ['calendario de pagamentos', 'pagamentos', 'contas a pagar', 'vencimento', 'fluxo de caixa', 'saidas', 'boletos', 'compromissos', 'datas de pagamento'],
    icon: 'Calendar',
    badge: 'Submenu'
  },

  // ==========================================
  // GRUPO LEPTA INTELLIGENCE
  // ==========================================
  {
    id: 'intel-clientes',
    title: 'Análise de Clientes (Cedentes & Sacados)',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Análise de Clientes'],
    path: '/intelligence/analise-clientes',
    permissionId: '8.1',
    description: 'Visão completa de carteira de clientes, detalhamento de operações por Cedente e por Sacado.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Análise de Clientes para analisar Cedentes, Sacados, UAs e faturamento.',
    tags: ['Cedentes', 'Sacados', 'Carteira', 'Faturamento', 'UAs'],
    keywords: ['analise de clientes', 'clientes', 'cedente', 'cedentes', 'sacado', 'sacados', 'carteira', 'faturamento', 'titulos', 'liquidado', 'vencido', 'aberto', 'operacoes'],
    icon: 'Users',
    badge: 'Submenu'
  },
  {
    id: 'intel-sacados',
    title: 'Consulta de Sacados (Drill-down de Carteira)',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Análise de Clientes', 'Sacados'],
    path: '/intelligence/analise-clientes',
    permissionId: '8.1',
    description: 'Consulta direta de sacados vinculados aos cedentes, concentração de dívida e histórico de títulos emitidos.',
    explanation: '👉 Para abrir os Sacados: Acesse "Lepta Intelligence > Análise de Clientes" e utilize o botão/filtro de Sacados ou clique em um Cedente para abrir o modal de Sacados e Títulos.',
    targetElementHint: 'Modal/Visão de Sacados em Análise de Clientes',
    tags: ['Sacados', 'Devedores', 'Concentração', 'Duplicatas', 'Lastro'],
    keywords: ['sacado', 'sacados', 'consulta de sacados', 'sacados por cedente', 'devedor', 'devedores', 'duplicatas sacado', 'limite sacado', 'concentracao sacado', 'lastro sacado', 'quem deve'],
    icon: 'Search',
    badge: 'Recurso / Modal'
  },
  {
    id: 'intel-grupos-economicos',
    title: 'Grupos Econômicos de Cedentes',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Análise de Clientes', 'Grupos Econômicos'],
    path: '/intelligence/analise-clientes',
    permissionId: '8.1',
    description: 'Agrupamento de empresas coligadas e controle de limite unificado por conglomerado econômico.',
    explanation: 'Acesse "Lepta Intelligence > Análise de Clientes" e ative a visualização por Grupos Econômicos.',
    targetElementHint: 'Agrupamento Econômico em Análise de Clientes',
    tags: ['Grupos Econômicos', 'Conglomerados', 'Coligadas', 'Limite Unificado'],
    keywords: ['grupo economico', 'grupos economicos', 'conglomerado', 'empresas do grupo', 'limite de grupo', 'coligadas', 'matriz e filial', 'holding'],
    icon: 'Network',
    badge: 'Recurso'
  },
  {
    id: 'intel-cadastro-clientes',
    title: 'Cadastro de Clientes',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Cadastro de Clientes'],
    path: '/intelligence/cadastro-clientes',
    permissionId: '8.2',
    description: 'Formulário completo de onboarding e cadastro de empresas (CNPJ), sócios (CPF) e faturamento.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Cadastro de Clientes para registrar novos proponentes.',
    tags: ['Onboarding', 'CNPJ', 'Sócios CPF', 'Novo Proponente'],
    keywords: ['cadastro de clientes', 'cadastrar cliente', 'novo cliente', 'cnpj', 'razao social', 'socios', 'cpf', 'onboarding', 'enquadramento', 'empresa nova'],
    icon: 'ContactRound',
    badge: 'Submenu'
  },
  {
    id: 'intel-analise-riscos',
    title: 'Análise de Riscos & Crédito',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Análise de Riscos'],
    path: '/intelligence/analise-riscos',
    permissionId: '8.3',
    description: 'Motor de crédito, cálculo de score, SCR, Serasa, DRE, Balanço Patrimonial e alçadas de limite.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Análise de Riscos para avaliar o risco de crédito de clientes.',
    tags: ['Score de Crédito', 'SCR Bacen', 'Serasa', 'Balanço & DRE', 'Rating'],
    keywords: ['analise de riscos', 'risco', 'score', 'scr', 'bacen', 'serasa', 'spc', 'balanco', 'dre', 'rating', 'limite de credito', 'parecer de risco', 'motor de credito'],
    icon: 'ShieldCheck',
    badge: 'Submenu'
  },
  {
    id: 'intel-npl',
    title: 'NPL - Gestão de Créditos Inadimplentes',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'NPL'],
    path: '/intelligence/npl',
    permissionId: '8.4',
    description: 'Acompanhamento de Non-Performing Loans, créditos podres, execução jurídica e recuperação de perdas.',
    explanation: 'Acesse Grupos > Lepta Intelligence > NPL para gerenciar operações em atraso grave e cobrança contenciosa.',
    tags: ['Inadimplência', 'Execução Jurídica', 'Crédito Podre', 'Recuperação'],
    keywords: ['npl', 'non performing loans', 'credito podre', 'inadimplencia', 'execucao', 'juridico', 'perdas', 'recuperacao de ativos', 'ajuizamento', 'processos judiciais'],
    icon: 'TrendingUp',
    badge: 'Submenu'
  },
  {
    id: 'intel-comite',
    title: 'Esteira de Comitê de Crédito',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Esteira de Comitê'],
    path: '/intelligence/esteira-comite',
    permissionId: '8.5',
    description: 'Esteira de deliberação, votação de diretores, atas de comitê e aprovações de limites de crédito.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Esteira de Comitê para pautar e votar operações.',
    tags: ['Votação de Limite', 'Diretoria', 'Atas de Comitê', 'Deliberação'],
    keywords: ['esteira de comite', 'comite', 'comite de credito', 'votacao', 'aprovacao de limite', 'deliberacao', 'atas', 'parecer tecnico', 'diretoria', 'membros do comite'],
    icon: 'ClipboardCheck',
    badge: 'Submenu'
  },
  {
    id: 'intel-smartfactor',
    title: 'Consulta SmartFactor',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Consulta SmartFactor'],
    path: '/intelligence/consulta-smartfactor',
    permissionId: '8.6',
    description: 'Consulta ao banco de dados do SmartFactor: borderôs, duplicatas, títulos, cheques e notas fiscais.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Consulta SmartFactor para pesquisar títulos e operações no SmartFactor.',
    tags: ['Borderôs', 'Duplicatas', 'Cheques', 'Chave NF-e', 'SmartFactor'],
    keywords: ['smartfactor', 'consulta smartfactor', 'bordero', 'borderos', 'duplicata', 'duplicatas', 'cheque', 'cheques', 'nfe', 'chave nfe', 'titulos smartfactor', 'operacao smart'],
    icon: 'Search',
    badge: 'Submenu'
  },
  {
    id: 'intel-gerentes',
    title: 'Cadastro de Gerentes Comerciais',
    category: 'Lepta Intelligence',
    breadcrumb: ['Grupos', 'Lepta Intelligence', 'Cadastro de Gerentes'],
    path: '/intelligence/cadastro-gerentes',
    permissionId: '8.7',
    description: 'Gestão de gerentes de contas comerciais, vínculo de carteira de clientes e metas.',
    explanation: 'Acesse Grupos > Lepta Intelligence > Cadastro de Gerentes para gerenciar os operadores comerciais.',
    tags: ['Gerentes de Contas', 'Comercial', 'Carteira', 'Metas'],
    keywords: ['cadastro de gerentes', 'gerentes', 'gerente comercial', 'carteira de gerentes', 'comercial', 'operadores', 'metas', 'superintendentes'],
    icon: 'UserCheck',
    badge: 'Submenu'
  },

  // ==========================================
  // GRUPO ADMINISTRATIVO
  // ==========================================
  {
    id: 'adm-solicitacoes-financeiras',
    title: 'Solicitações Financeiras (Reembolsos, Insumos & Compras)',
    category: 'Administrativo',
    breadcrumb: ['Grupos', 'Administrativo', 'Solicitações Financeiras'],
    path: '/administrativo/compras',
    permissionId: '11.1',
    description: 'Abertura e acompanhamento de solicitações financeiras: reembolso de despesas, insumos, viagens, visitas, eventos e compras gerais.',
    explanation: '👉 Onde pedir Reembolso e Compras: Acesse "Grupos > Administrativo > Solicitações Financeiras" para abrir solicitações de reembolso de despesas, viagens, insumos corporativos e aprovação de compras.',
    tags: ['Reembolso', 'Insumos', 'Viagens & KM', 'Compras', 'Prestação de Contas', 'Eventos'],
    keywords: [
      'reembolso', 'reembolsos', 'pedir reembolso', 'solicitar reembolso', 'reembolso de despesas', 'solicitacao de reembolso',
      'solicitacao financeira', 'solicitacoes financeiras', 'compras', 'pedido de compras', 'cotacao', 'fornecedor',
      'pagamento de compras', 'aprovacao de compras', 'despesa', 'despesas', 'insumos', 'visita', 'viagem', 'km',
      'combustivel', 'alimentacao', 'festas', 'aniversarios', 'eventos', 'adiantamento', 'ressarcimento', 'comprovante'
    ],
    icon: 'ShoppingCart',
    badge: 'Submenu'
  },
  {
    id: 'adm-reembolso-atalho',
    title: 'Solicitar Reembolso de Despesas (Atalho)',
    category: 'Administrativo',
    breadcrumb: ['Grupos', 'Administrativo', 'Solicitações Financeiras', 'Reembolso'],
    path: '/administrativo/compras',
    permissionId: '11.1',
    description: 'Abertura de pedido de ressarcimento de refeições, combustível, quilometragem, hotéis, viagens e despesas de trabalho.',
    explanation: '👉 O reembolso é solicitado em: "Administrativo > Solicitações Financeiras". Clique para ir direto ao formulário e anexar comprovantes.',
    targetElementHint: 'Solicitações Financeiras > Nova Solicitação > Categoria: Reembolso',
    tags: ['Reembolso', 'Despesas', 'Comprovantes', 'Prestação de Contas', 'Alimentação & KM'],
    keywords: [
      'reembolso', 'reembolsos', 'pedir reembolso', 'solicitar reembolso', 'ressarcimento', 'comprovante', 'nota fiscal despesa',
      'km rodado', 'combustivel', 'almoco', 'jantar', 'hotel', 'passagem', 'uber', 'taxi', 'gastos', 'prestacao de contas'
    ],
    icon: 'DollarSign',
    badge: 'Recurso / Atalho'
  },
  {
    id: 'adm-workflow',
    title: 'Configuração da Esteira de Compras',
    category: 'Administrativo',
    breadcrumb: ['Grupos', 'Administrativo', 'Configuração de Esteira de Compras'],
    path: '/administrativo/configuracao-compras',
    permissionId: '11.2',
    description: 'Definição de alçadas, aprovadores por valor e regras de fluxo de aprovação de compras.',
    explanation: 'Acesse Grupos > Administrativo > Configuração de Esteira de Compras para parametrizar regras.',
    tags: ['Alçadas', 'Aprovadores', 'Limites de Valor', 'Workflow de Compras'],
    keywords: ['configuracao de compras', 'esteira de compras', 'alcadas', 'aprovadores', 'regras de compras', 'limites de compras', 'workflow', 'hierarquia de aprovacao'],
    icon: 'SlidersHorizontal',
    badge: 'Submenu'
  },
  {
    id: 'adm-salas',
    title: 'Agendar Sala de Reunião',
    category: 'Administrativo',
    breadcrumb: ['Grupos', 'Administrativo', 'Agendar Sala de Reunião'],
    path: '/administrativo/salas-reuniao',
    permissionId: '11.3',
    description: 'Reserva e visualização de disponibilidade das salas de conferência e reunião do escritório.',
    explanation: 'Acesse Grupos > Administrativo > Agendar Sala de Reunião para reservar horários e salas.',
    tags: ['Reservar Sala', 'Reuniões', 'Horários', 'Disponibilidade', 'Conferência'],
    keywords: ['sala de reuniao', 'salas', 'agendar sala', 'reserva de sala', 'conferencia', 'reuniao', 'calendario de salas', 'marcar reuniao', 'sala de diretoria'],
    icon: 'CalendarCheck',
    badge: 'Submenu'
  },

  // ==========================================
  // GRUPO CONFIRMAÇÃO
  // ==========================================
  {
    id: 'conf-sistema',
    title: 'Sistema de Confirmação de Títulos',
    category: 'Confirmação',
    breadcrumb: ['Grupos', 'Confirmação', 'Sistema de Confirmação'],
    path: '/confirmacao/sistema',
    permissionId: '10.1',
    description: 'Checagem de lastro, contato com sacados, gravação de confirmação e validação de entrega de mercadorias/serviços.',
    explanation: 'Acesse Grupos > Confirmação > Sistema de Confirmação para checar operações e ligar para sacados.',
    tags: ['Checagem de Lastro', 'Gravação Sacados', 'Canhotos', 'Notas Fiscais'],
    keywords: ['confirmacao', 'sistema de confirmacao', 'checar titulos', 'sacados confirmacao', 'gravacao', 'lastro', 'entrega', 'canhoto', 'nota fiscal confirmada', 'checagem'],
    icon: 'ClipboardCheck',
    badge: 'Submenu'
  },
  {
    id: 'conf-analise',
    title: 'Análise de Confirmação',
    category: 'Confirmação',
    breadcrumb: ['Grupos', 'Confirmação', 'Análise de Confirmação'],
    path: '/confirmacao/analise',
    permissionId: '10.2',
    description: 'Métricas, relatórios de produtividade dos confirmadores e assertividade de checagem.',
    explanation: 'Acesse Grupos > Confirmação > Análise de Confirmação para ver os relatórios de checagem.',
    tags: ['Produtividade', 'Assertividade', 'Métricas de Checagem', 'Auditoria'],
    keywords: ['analise de confirmacao', 'produtividade confirmacao', 'relatorio confirmacao', 'auditoria de confirmacao', 'assertividade', 'indicadores confirmadores'],
    icon: 'Search',
    badge: 'Submenu'
  },

  // ==========================================
  // GRUPO COBRANÇA
  // ==========================================
  {
    id: 'cob-vencidos',
    title: 'Análise de Vencidos (Cobrança)',
    category: 'Cobrança',
    breadcrumb: ['Grupos', 'Cobrança', 'Análise de Vencidos'],
    path: '/cobranca/analise-vencidos',
    permissionId: '12.1',
    description: 'Gestão de carteira em atraso, aging list (1-30, 31-60, 61-90, 90+), histórico de cobrança e renegociação.',
    explanation: 'Acesse Grupos > Cobrança > Análise de Vencidos para cobrar títulos atrasados de sacados e cedentes.',
    tags: ['Aging List', 'Títulos em Atraso', 'Régua de Cobrança', 'Renegociação'],
    keywords: ['cobranca', 'analise de vencidos', 'titulos vencidos', 'atraso', 'aging list', 'negociacao', 'devedores', 'sacados em atraso', 'regua de cobranca', 'acordos'],
    icon: 'FileSpreadsheet',
    badge: 'Submenu'
  },

  // ==========================================
  // BANCO DE DADOS / DASHBOARDS / BI
  // ==========================================
  {
    id: 'mod-banco-dados',
    title: 'Banco de Dados & Tabelas',
    category: 'Dados & BI',
    breadcrumb: ['Grupos', 'Banco de Dados'],
    path: '/banco-de-dados',
    permissionId: '9',
    description: 'Visualização da estrutura de dados, tabelas internas e monitoramento de sincronizações.',
    explanation: 'Acesse Grupos > Banco de Dados para consultar esquemas e dados brutos.',
    tags: ['Tabelas', 'Esquema SQL', 'Sincronização UNLTD', 'Logs'],
    keywords: ['banco de dados', 'database', 'tabelas', 'sql', 'sincronizacao', 'registros', 'estrutura', 'cedentes unltd'],
    icon: 'Database',
    badge: 'Menu'
  },
  {
    id: 'mod-dashboards',
    title: 'Dashboards Executivos',
    category: 'Dados & BI',
    breadcrumb: ['Grupos', 'Dashboards'],
    path: '/dashboards',
    permissionId: '5',
    description: 'Painéis consolidados com indicadores chave de desempenho (KPIs) da operação Lepta.',
    explanation: 'Acesse Grupos > Dashboards para visualizar gráficos e métricas globais.',
    tags: ['KPIs Globais', 'Gráficos', 'Métricas', 'Visão Geral'],
    keywords: ['dashboards', 'paineis', 'kpi', 'metricas', 'graficos', 'visao geral', 'indicadores executivos'],
    icon: 'LayoutDashboard',
    badge: 'Menu'
  },
  {
    id: 'mod-bi',
    title: 'Business Intelligence (PowerBI)',
    category: 'Dados & BI',
    breadcrumb: ['Grupos', 'Business Intelligence'],
    path: '/bi',
    permissionId: '4',
    description: 'Relatórios avançados de BI, análises preditivas e painéis PowerBI embutidos.',
    explanation: 'Acesse Grupos > Business Intelligence para carregar os painéis analíticos.',
    tags: ['PowerBI', 'Analytics', 'Relatórios Executivos', 'Dashboards BI'],
    keywords: ['bi', 'business intelligence', 'powerbi', 'relatorios bi', 'analytics', 'analise profunda'],
    icon: 'Sliders',
    badge: 'Menu'
  },

  // ==========================================
  // GRUPO JURÍDICO
  // ==========================================
  {
    id: 'legal-payment-approval',
    title: 'Aprovação de Pagamentos (Jurídico)',
    category: 'Jurídico',
    breadcrumb: ['Grupos', 'Jurídico', 'Aprovação de Pagamentos'],
    path: '/juridico/aprovacao-pagamentos',
    permissionId: '13.1',
    description: 'Validação e parecer jurídico prévio para solicitações financeiras com valores iguais ou superiores a R$ 2.000,00.',
    explanation: 'Acesse Grupos > Jurídico > Aprovação de Pagamentos para analisar e emitir parecer ou anexar contratos em solicitações ≥ R$ 2.000.',
    tags: ['Jurídico', 'Aprovação ≥ 2000', 'Contratos', 'Parecer Jurídico', 'Minutas', 'Compliance'],
    keywords: [
      'juridico', 'aprovacao de pagamentos', 'aprovacao juridica', 'parecer juridico', 'analise juridica',
      'pagamento acima de 2000', 'solicitacao acima de 2000', '2000', '2 mil', 'contratos', 'minuta', 'minutas',
      'aditivo', 'conformidade', 'compliance', 'parecer', 'advogado', 'validacao juridica'
    ],
    icon: 'Scale',
    badge: 'Submenu'
  },

  // ==========================================
  // ADMINISTRAÇÃO & PERMISSÕES (MASTER)
  // ==========================================
  {
    id: 'adm-permissions',
    title: 'Gestão de Permissões de Usuários',
    category: 'Administração',
    breadcrumb: ['Administração', 'Permissões e Acessos', 'Gestão de Permissões'],
    path: '/permissions',
    masterOnly: true,
    description: 'Configuração da matriz de acessos e permissões individuais por usuário.',
    explanation: 'Acesse Administração > Permissões e Acessos > Gestão de Permissões (Apenas Administradores).',
    tags: ['Matriz de Acessos', 'Perfis', 'Liberações', 'Segurança'],
    keywords: ['permissoes', 'acessos', 'gestao de permissoes', 'matriz de acessos', 'perfis', 'liberacoes', 'master', 'bloqueio de usuario'],
    icon: 'Shield',
    badge: 'Master'
  },
  {
    id: 'adm-create-user',
    title: 'Criar Novo Usuário',
    category: 'Administração',
    breadcrumb: ['Administração', 'Permissões e Acessos', 'Criar Usuário'],
    path: '/permissions/create-user',
    masterOnly: true,
    description: 'Cadastro de novos colaboradores com definição de login, e-mail e cargo inicial.',
    explanation: 'Acesse Administração > Permissões e Acessos > Criar Usuário para adicionar colaboradores.',
    tags: ['Novo Colaborador', 'Login', 'Senha Inicial', 'Cargo'],
    keywords: ['criar usuario', 'novo usuario', 'cadastrar usuario', 'adicionar colaborador', 'novo login', 'senha inicial', 'cadastro de membro'],
    icon: 'UserPlus',
    badge: 'Master'
  },
  {
    id: 'adm-groups',
    title: 'Configurar Grupos de Permissão',
    category: 'Administração',
    breadcrumb: ['Administração', 'Permissões e Acessos', 'Configurar Grupos'],
    path: '/permissions/groups',
    masterOnly: true,
    description: 'Criação e edição de perfis de grupo para atribuição facilitada de permissões em lote.',
    explanation: 'Acesse Administração > Permissões e Acessos > Configurar Grupos para parametrizar funções.',
    tags: ['Perfis de Cargo', 'Grupos de Acesso', 'Departamentos'],
    keywords: ['grupos', 'configurar grupos', 'cargos', 'perfis de acesso', 'grupos de usuarios', 'departamentos', 'papeis'],
    icon: 'Users',
    badge: 'Master'
  },
  {
    id: 'adm-email-config',
    title: 'Configuração de E-mail (SMTP)',
    category: 'Administração',
    breadcrumb: ['Administração', 'Permissões e Acessos', 'Configuração de E-mail'],
    path: '/permissions/email-config',
    masterOnly: true,
    description: 'Parametrização do servidor SMTP para envio automático de e-mails do sistema.',
    explanation: 'Acesse Administração > Permissões e Acessos > Configuração de E-mail para configurar servidor e templates.',
    tags: ['SMTP', 'Servidor de E-mail', 'Templates', 'Notificações'],
    keywords: ['email', 'email config', 'smtp', 'servidor de email', 'envio de email', 'notificacoes automaticas', 'outlook', 'office 365', 'disparos'],
    icon: 'Mail',
    badge: 'Master'
  },
  {
    id: 'adm-monitor',
    title: 'Monitor do Sistema em Tempo Real',
    category: 'Administração',
    breadcrumb: ['Administração', 'Monitor'],
    path: '/monitor',
    masterOnly: true,
    description: 'Monitoramento ao vivo de usuários conectados, páginas acessadas e tráfego interno.',
    explanation: 'Acesse /monitor para visualizar a telemetria ao vivo de usuários ativos no sistema.',
    tags: ['Tempo Real', 'Usuários Online', 'Telemetria', 'Auditoria'],
    keywords: ['monitor', 'usuarios online', 'telemetria', 'presenca', 'heartbeat', 'tempo real', 'quem esta online', 'auditoria'],
    icon: 'ShieldAlert',
    badge: 'Master'
  }
];
