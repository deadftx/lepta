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
  keywords: string[];
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
    keywords: ['home', 'inicio', 'painel', 'dashboard', 'intranet', 'aniversarios', 'feriados', 'eventos', 'calendario interno', 'comunicados'],
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
    keywords: ['ponto', 'ponto eletronico', 'banco de horas', 'registro de ponto', 'horas trabalhadas', 'espelho de ponto', 'rh'],
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
    keywords: ['chamados', 'ti', 'suporte', 'helpdesk', 'informatica', 'tecnologia', 'abrir chamado', 'problema', 'ticket'],
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
    keywords: ['marketing', 'calendario', 'postagens', 'campanhas', 'midias', 'redes sociais', 'divulgacao', 'conteudo'],
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
    keywords: ['financeiro', 'financas', 'caixa', 'bancos', 'tesouraria', 'movimentacao'],
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
    keywords: ['extrato', 'processar extrato', 'ofx', 'excel', 'csv', 'bancario', 'conciliacao', 'lancamentos', 'debitos', 'creditos', 'saldo'],
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
    keywords: ['grafeno', 'lepta x grafeno', 'conciliacao grafeno', 'conta escrow', 'movimento', 'ted', 'pix', 'transacoes grafeno'],
    icon: 'Landmark',
    badge: 'Submenu'
  },
  {
    id: 'fin-reembolsos',
    title: 'Reembolsos e Despesas',
    category: 'Financeiro',
    breadcrumb: ['Grupos', 'Financeiro', 'Reembolsos e Despesas'],
    path: '/financeiro/reembolsos-despesas',
    permissionId: '7.4',
    description: 'Lançamento e aprovação de pedidos de reembolso de despesas corporativas.',
    explanation: 'Acesse Grupos > Financeiro > Reembolsos e Despesas para anexar comprovantes e solicitar ressarcimentos.',
    keywords: ['reembolso', 'reembolsos', 'despesas', 'comprovantes', 'prestacao de contas', 'gastos', 'viagem', 'km', 'combustivel', 'alimentacao'],
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
    keywords: ['calendario de pagamentos', 'pagamentos', 'contas a pagar', 'vencimento', 'fluxo de caixa', 'saidas', 'boletos', 'compromissos'],
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
    explanation: 'Acesse Grupos > Lepta Intelligence > Análise de Clientes. Permite filtrar e analisar dados de Cedentes, Sacados e UAs.',
    keywords: ['analise de clientes', 'clientes', 'cedente', 'cedentes', 'sacado', 'sacados', 'carteira', 'faturamento', 'titulos', 'liquidado', 'vencido', 'aberto'],
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
    keywords: ['sacado', 'sacados', 'consulta de sacados', 'sacados por cedente', 'devedor', 'devedores', 'duplicatas sacado', 'limite sacado', 'concentracao sacado', 'lastro sacado'],
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
    keywords: ['grupo economico', 'grupos economicos', 'conglomerado', 'empresas do grupo', 'limite de grupo', 'coligadas', 'matriz e filial'],
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
    keywords: ['cadastro de clientes', 'cadastrar cliente', 'novo cliente', 'cnpj', 'razao social', 'socios', 'cpf', 'onboarding', 'enquadramento'],
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
    keywords: ['analise de riscos', 'risco', 'score', 'scr', 'bacen', 'serasa', 'spc', 'balanco', 'dre', 'rating', 'limite de credito', 'parecer de risco'],
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
    keywords: ['npl', 'non performing loans', 'credito podre', 'inadimplencia', 'execucao', 'juridico', 'perdas', 'recuperacao de ativos', 'ajuizamento'],
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
    keywords: ['esteira de comite', 'comite', 'comite de credito', 'votacao', 'aprovacao de limite', 'deliberacao', 'atas', 'parecer tecnico', 'diretoria'],
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
    keywords: ['smartfactor', 'consulta smartfactor', 'bordero', 'borderos', 'duplicata', 'duplicatas', 'cheque', 'cheques', 'nfe', 'chave nfe', 'titulos smartfactor'],
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
    keywords: ['cadastro de gerentes', 'gerentes', 'gerente comercial', 'carteira de gerentes', 'comercial', 'operadores', 'metas'],
    icon: 'UserCheck',
    badge: 'Submenu'
  },

  // ==========================================
  // GRUPO ADMINISTRATIVO
  // ==========================================
  {
    id: 'adm-compras',
    title: 'Solicitações Financeiras & Compras',
    category: 'Administrativo',
    breadcrumb: ['Grupos', 'Administrativo', 'Solicitações Financeiras'],
    path: '/administrativo/compras',
    permissionId: '11.1',
    description: 'Abertura, acompanhamento e aprovação de solicitações de compras de suprimentos, TI e serviços.',
    explanation: 'Acesse Grupos > Administrativo > Solicitações Financeiras para pedir compras e anexar cotações.',
    keywords: ['compras', 'solicitacoes financeiras', 'pedido de compras', 'cotacao', 'fornecedor', 'pagamento de compras', 'aprovacao de compras'],
    icon: 'ShoppingCart',
    badge: 'Submenu'
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
    keywords: ['configuracao de compras', 'esteira de compras', 'alcadas', 'aprovadores', 'regras de compras', 'limites de compras', 'workflow'],
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
    explanation: 'Acesse Grupos > Administrativo > Agendar Sala de Reunião para agendar horários.',
    keywords: ['sala de reuniao', 'salas', 'agendar sala', 'reserva de sala', 'conferencia', 'reuniao', 'calendario de salas'],
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
    keywords: ['confirmacao', 'sistema de confirmacao', 'checar titulos', 'sacados confirmacao', 'gravacao', 'lastro', 'entrega', 'canhoto', 'nota fiscal confirmada'],
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
    keywords: ['analise de confirmacao', 'produtividade confirmacao', 'relatorio confirmacao', 'auditoria de confirmacao', 'assertividade'],
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
    keywords: ['cobranca', 'analise de vencidos', 'titulos vencidos', 'atraso', 'aging list', 'negociacao', 'devedores', 'sacados em atraso', 'regua de cobranca'],
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
    keywords: ['banco de dados', 'database', 'tabelas', 'sql', 'sincronizacao', 'registros', 'estrutura'],
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
    keywords: ['bi', 'business intelligence', 'powerbi', 'relatorios bi', 'analytics', 'analise profunda'],
    icon: 'Sliders',
    badge: 'Menu'
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
    keywords: ['permissoes', 'acessos', 'gestao de permissoes', 'matriz de acessos', 'perfis', 'liberacoes', 'master'],
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
    keywords: ['criar usuario', 'novo usuario', 'cadastrar usuario', 'adicionar colaborador', 'novo login', 'senha inicial'],
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
    keywords: ['grupos', 'configurar grupos', 'cargos', 'perfis de acesso', 'grupos de usuarios', 'departamentos'],
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
    keywords: ['email', 'email config', 'smtp', 'servidor de email', 'envio de email', 'notificacoes automaticas', 'outlook', 'office 365'],
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
    keywords: ['monitor', 'usuarios online', 'telemetria', 'presenca', 'heartbeat', 'tempo real', 'quem esta online'],
    icon: 'ShieldAlert',
    badge: 'Master'
  }
];
