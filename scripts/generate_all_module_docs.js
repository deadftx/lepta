import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BROWSER_PATH = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;

// Definição completa das documentações dos módulos
const MODULES_DOCS = [
  {
    dir: 'src/internal/modules/home',
    title: 'Home & Dashboard Intranet',
    route: '/dashboard',
    permission: 'Autenticado (Todos os Usuários)',
    summary: 'Central unificada e ponto de entrada operacional dos colaboradores da Lepta Capital.',
    purpose: `O módulo Home (/dashboard) consolida a visão operacional do usuário autenticado no sistema. Atua como um cockpit operacional que exibe métricas diárias, atalhos rápidos de navegação personalizada de acordo com os grupos/alçadas do usuário, alertas pendentes de aprovação e indicadores do mercado financeiro em tempo real.`,
    businessRules: [
      'Personalização por Perfil: A visualização de cards de atalho obedece rigorosamente às permissões cadastradas para o usuário ou grupos aos quais pertence.',
      'Sinalização de Pendências: Notifica colaboradores se existirem solicitações de pagamento pendentes sob sua alçada ou solicitações rejeitadas para revisão.',
      'Auditoria de Conexão: Registra evento de login e envia heartbeat de presença a cada 30 segundos enquanto a aba estiver ativa.',
      'Acesso Rápido aos Módulos: Redirecionamento direto para telas de esteira de crédito, compras, jurídico e financeiro.'
    ],
    dbTables: [
      { name: 'usuarios_lepta', desc: 'Dados do usuário autenticado, alçadas e grupos.' },
      { name: 'compras_requisicoes', desc: 'Contagem e status de solicitações financeiras pendentes/em aberto.' },
      { name: 'monitor_user_sessions', desc: 'Registro de sessão ativa, telemetria e heartbeat.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/auth/me', desc: 'Valida token JWT e carrega permissões e dados cadastrais do usuário.' },
      { method: 'GET', endpoint: '/api/purchases/requests/stats', desc: 'Obtém estatísticas de requisições financeiras para cards de alerta.' },
      { method: 'POST', endpoint: '/api/monitor/heartbeat', desc: 'Envia ping periódico de presença (pathname e timestamp).' }
    ],
    uiUx: `Design baseado em cards translúcidos (glassmorphism) sobre fundo escuro (#0a0e1a). Cabeçalho com ticker de cotações financeiras, avatar do usuário, sino de notificações Web Push e atalho global Ctrl+K para busca instantânea de qualquer tela do sistema. Responsivo para celulares e tablets sem quebra de grid.`,
    engineeringDetails: `Comunicação com service worker para notificações em segundo plano. Validação de atualização de chunk em caso de novo deploy no servidor.`
  },
  {
    dir: 'src/internal/modules/calendario',
    title: 'Calendário Corporativo & Marketing',
    route: '/marketing',
    permission: 'Permissão 6 (Marketing / Calendário)',
    summary: 'Agendamento e acompanhamento de postagens, campanhas e eventos de comunicação institucional.',
    purpose: `Permite ao time de Marketing e Comunicação organizar a grade de publicações, campanhas institucionais e cronogramas de disparos de comunicados da Lepta Capital. Evita sobreposição de postagens e oferece controle visual de datas e temas.`,
    businessRules: [
      'Status de Publicação: Eventos transitam entre Planejado, Em Produção, Aprovado e Publicado.',
      'Bloqueio de Edição Passada: Eventos com mais de 30 dias passados são marcados como somente-leitura.',
      'Filtro por Canal: Permite separar por canais de veiculação (LinkedIn, Instagram, Comunicado Interno, E-mail Marketing).'
    ],
    dbTables: [
      { name: 'marketing_events', desc: 'Tabela de eventos, datas de agendamento, títulos, canais e responsáveis.' },
      { name: 'usuarios_lepta', desc: 'Vínculo do responsável pela publicação.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/marketing/events', desc: 'Retorna a lista de eventos com filtro por mês e ano.' },
      { method: 'POST', endpoint: '/api/marketing/events', desc: 'Cadastra um novo evento no cronograma com data e canal.' },
      { method: 'PUT', endpoint: '/api/marketing/events/:id', desc: 'Edita status ou remarca data de postagem.' },
      { method: 'DELETE', endpoint: '/api/marketing/events/:id', desc: 'Remove evento cancelado.' }
    ],
    uiUx: `Visão mensal interativa com grade de dias e destaque para o dia corrente. Cores diferenciadas por canal (LinkedIn = azul, Instagram = gradiente roxo, etc.). Modal para inserção rápida com validação de campos obrigatórios.`,
    engineeringDetails: `Cálculo puramente em memória no frontend do calendário gregoriano sem bibliotecas pesadas, reduzindo o bundle. Sincronização via API REST.`
  },
  {
    dir: 'src/internal/modules/financeiro/processar-extrato',
    title: 'Processar Extrato Bancário',
    route: '/financeiro/extratos',
    permission: 'Permissão 7.1 (Financeiro - Extratos)',
    summary: 'Leitura, importação e conciliação automática de extratos bancários (OFX, Excel e PDF).',
    purpose: `Centraliza o upload e processamento de extratos bancários das contas correntes da Lepta Capital e fundos geridos. Realiza parser inteligente de lançamentos de crédito/débito, associando tarifas, liquidações de títulos e transferências aos devidos centros de custo e cedentes.`,
    businessRules: [
      'Eliminação de Duplicidade: Transações são identificadas por hash do banco + data + valor + documento (FITID) para impedir importação duplicada.',
      'Classificação Automática: Expressões regulares pré-configuradas identificam tarifas bancárias, juros, TED, PIX e repasses.',
      'Conciliação com Títulos: Localiza duplicatas liquidadas na data e abate dos saldos em aberto.'
    ],
    dbTables: [
      { name: 'finance_transactions', desc: 'Armazena cada lançamento individual do extrato com data, histórico e valor.' },
      { name: 'finance_accounts', desc: 'Contas bancárias cadastradas (banco, agência, conta).' },
      { name: 'finance_categories', desc: 'Plano de contas e categorias de receitas e despesas.' }
    ],
    apis: [
      { method: 'POST', endpoint: '/api/finance/upload-statement', desc: 'Upload multipart/form-data do arquivo de extrato (OFX/XLSX).' },
      { method: 'GET', endpoint: '/api/finance/statements', desc: 'Lista lançamentos importados com filtros de data e status de conciliação.' },
      { method: 'POST', endpoint: '/api/finance/reconcile', desc: 'Executa conciliação manual ou aprovação em lote.' }
    ],
    uiUx: `Área de drag-and-drop de arquivos com barra de progresso. Grid de conferência comparando lançamento bancário x previsão do sistema com badges coloridos de conciliação (Conciliado, Divergente, Não Encontrado).`,
    engineeringDetails: `Uso de exceljs e streams para processar arquivos com dezenas de milhares de linhas sem estourar o limite de memória do Node.js.`
  },
  {
    dir: 'src/internal/modules/financeiro/grafeno',
    title: 'Integração LEPTA x Grafeno',
    route: '/financeiro/grafeno',
    permission: 'Permissão 7.2 (Financeiro - Grafeno)',
    summary: 'Monitoramento de contas escrow e conciliação em tempo real com a API da Grafeno.',
    purpose: `Conecta os sistemas da Lepta diretamente à infraestrutura de pagamentos e contas gráficas da Grafeno. Permite auditar saldos, transações em tempo real e processar webhooks de liquidações instantâneas.`,
    businessRules: [
      'Assinatura de Webhooks: Todos os payloads recebidos da Grafeno são validados com secret HMAC antes da persistência.',
      'Idempotência Operacional: IDs de transação da Grafeno são únicos; eventos repetidos são descartados com log de auditoria.',
      'Sincronização Forçada: Permite solicitar via interface um sync sob demanda para obter o saldo pontual.'
    ],
    dbTables: [
      { name: 'grafeno_transacoes', desc: 'Espelho de todas as movimentações recebidas via API/Webhooks da Grafeno.' },
      { name: 'grafeno_webhooks', desc: 'Log de todos os payloads recebidos com status de processamento.' },
      { name: 'grafeno_config', desc: 'Tokens e chaves de integração da conta escrow.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/finance/grafeno/balance', desc: 'Consulta saldo consolidado e disponível na Grafeno.' },
      { method: 'GET', endpoint: '/api/finance/grafeno/transactions', desc: 'Lista transações filtradas por data e tipo (Crédito/Débito).' },
      { method: 'POST', endpoint: '/api/finance/grafeno/sync', desc: 'Dispara sincronização manual contra a API Grafeno.' },
      { method: 'POST', endpoint: '/api/finance/grafeno/webhook', desc: 'Endpoint receptor de eventos da Grafeno.' }
    ],
    uiUx: `Cards com saldo em tempo real, status do webhook (Online/Offline) e tabela com filtro rápido por tipo de movimentação. Botão de exportação em planilha.`,
    engineeringDetails: `Armazenamento de logs de auditoria em SQLite para rastreabilidade jurídica de cada centavo movimentado na conta escrow.`
  },
  {
    dir: 'src/internal/modules/financeiro/central-pagamentos',
    title: 'Central de Pagamentos & Despesas',
    route: '/financeiro/reembolsos-despesas',
    permission: 'Permissão 7.4 (Financeiro - Central de Pagamentos)',
    summary: 'Execução financeira de requisições, reembolsos e boletos corporativos aprovados.',
    purpose: `Etapa final da esteira de compras e pagamentos. Recebe as solicitações de compras e reembolsos que já foram integralmente aprovadas pelos diretores ou pelo jurídico e disponibiliza as informações bancárias (PIX, boleto, transferência) para liquidação pelo time de tesouraria.`,
    businessRules: [
      'Garantia de Aprovação Prévia: Somente requisições no status APROVADO são elegíveis para pagamento na esteira.',
      'Comprovante Obrigatório: A liquidação exige o anexo do comprovante bancário ou confirmação de ID de transação.',
      'Notificação ao Solicitante: O colaborador que solicitou o reembolso recebe aviso imediato via push e e-mail no momento do pagamento.'
    ],
    dbTables: [
      { name: 'compras_requisicoes', desc: 'Atualização do status de pagamento (PAGO, PENDENTE_PAGAMENTO).' },
      { name: 'compras_requisicoes_itens', desc: 'Itens individuais com dados bancários e chaves PIX.' },
      { name: 'compras_anexos', desc: 'Comprovantes de pagamento anexados pela tesouraria.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/requests/approved', desc: 'Retorna requisições aprovadas prontas para pagamento.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/pay', desc: 'Marca a requisição como paga com data e comprovante.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/attachments', desc: 'Upload do comprovante de transferência bancária.' }
    ],
    uiUx: `Lista de pagamentos agrupados por data de vencimento. Botão com um clique para "Copiar Chave PIX". Exibição de valores totais e modais para confirmação de pagamento.`,
    engineeringDetails: `Atualizações atômicas em transações do SQLite para evitar que duas pessoas do financeiro marquem o mesmo pagamento simultaneamente.`
  },
  {
    dir: 'src/internal/modules/financeiro/calendario-pagamentos',
    title: 'Calendário de Pagamentos',
    route: '/financeiro/calendario-pagamentos',
    permission: 'Permissão 7.5 (Financeiro - Calendário de Pagamentos)',
    summary: 'Visão cronológica de despesas fixas, parcelamentos e vencimentos programados.',
    purpose: `Fornece previsibilidade de fluxo de caixa para a diretoria financeira, exibindo todos os pagamentos e parcelas de compras agrupados nos dias do mês em que ocorrerá o débito.`,
    businessRules: [
      'Agrupamento por Vencimento: Compras parceladas são desmembradas em suas respectivas datas futuras.',
      'Visão de Desembolso: Totalização diária do montante financeiro exigido para cobrir os compromissos.',
      'Alerta de Vencimento no Dia: Destaque visual para pagamentos que vencem na data de hoje.'
    ],
    dbTables: [
      { name: 'compras_requisicoes_parcelas', desc: 'Tabela de parcelas com data de vencimento, número da parcela e valor.' },
      { name: 'compras_requisicoes', desc: 'Dados do fornecedor, centro de custo e solicitante.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/calendar', desc: 'Retorna parcelas e requisições agendadas no mês/ano selecionado.' }
    ],
    uiUx: `Visualização em calendário clássico com badges de valor total por dia. Ao clicar no dia, abre drawer lateral listando fornecedor, valor, forma de pagamento e status de cada item.`,
    engineeringDetails: `Filtragem performática indexada por data_vencimento no SQLite.`
  },
  {
    dir: 'src/internal/modules/intelligence/analise-clientes',
    title: 'Análise de Clientes (Lepta Intelligence)',
    route: '/intelligence/analise-clientes',
    permission: 'Permissão 8.1 (Intelligence - Análise de Clientes)',
    summary: 'Avaliação profunda de cedentes e sacados, histórico de operações, concentração e limites.',
    purpose: `Módulo central de análise cadastral e financeira da carteira de clientes. Permite que a mesa de crédito visualize faturamento, limites aprovados, histórico de duplicatas operadas e nível de risco.`,
    businessRules: [
      'Regra de Concentração: Alerta quando um único sacado ultrapassa o percentual máximo seguro da carteira do cedente.',
      'Atualização de Score: Combina dados históricos do banco SQLite com informações da API Unltd / SmartFactor.',
      'Verificação de Restrições: Identifica apontamentos cadastrais antes da concessão de novo limite.'
    ],
    dbTables: [
      { name: 'clientes_cadastro', desc: 'Cadastro detalhado do cliente com dados societários, CNPJ e limite.' },
      { name: 'operacoes', desc: 'Histórico de operações de crédito e antecipação de recebíveis.' },
      { name: 'cedentes', desc: 'Relação de cedentes e fundos vinculados.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/clients', desc: 'Lista clientes com suporte a busca textual, CNPJ e status.' },
      { method: 'GET', endpoint: '/api/intelligence/clients/:id', desc: 'Retorna ficha cadastral completa com sócios e limites.' },
      { method: 'GET', endpoint: '/api/intelligence/clients/:id/concentration', desc: 'Calcula índices de concentração da carteira.' }
    ],
    uiUx: `Dashboard com KPIs de limite total vs. tomado, gráfico de distribuição de sacados (Recharts) e abas para dados cadastrais, operações ativas e garantias.`,
    engineeringDetails: `Consultas otimizadas com agregações diretas no banco de dados para rápida renderização em clientes com milhares de títulos.`
  },
  {
    dir: 'src/internal/modules/intelligence/cadastro-clientes',
    title: 'Cadastro de Clientes',
    route: '/intelligence/cadastro-clientes',
    permission: 'Permissão 8.2 (Intelligence - Cadastro de Clientes)',
    summary: 'Inserção, atualização e manutenção cadastral de clientes PJ e PF.',
    purpose: `Gerencia o ciclo de vida do cadastro de novos proponentes a operações de crédito na Lepta Capital, registrando dados societários, fiscais, bancários e documentações constitutivas.`,
    businessRules: [
      'Validação de CNPJ/CPF: Validação algorítmica estrita de dígitos verificadores.',
      'Campos Obrigatórios: Razão social, CNPJ, faturamento anual e endereço completo com CEP.',
      'Auditoria de Alteração: Gravação de quem modificou o cadastro e data da última alteração.'
    ],
    dbTables: [
      { name: 'clientes_cadastro', desc: 'Registro cadastral completo com colunas estruturadas.' }
    ],
    apis: [
      { method: 'POST', endpoint: '/api/intelligence/clients', desc: 'Insere novo cliente após validação de duplicidade de CNPJ.' },
      { method: 'PUT', endpoint: '/api/intelligence/clients/:id', desc: 'Atualiza dados cadastrais existentes.' }
    ],
    uiUx: `Formulário em steps com validação em tempo real e máscaras de CNPJ, CEP e telefone. Feedback imediato em caso de CNPJ já existente.`,
    engineeringDetails: `Prevenção contra SQL Injection com parâmetros preparados em todas as queries.`
  },
  {
    dir: 'src/internal/modules/intelligence/analise-riscos',
    title: 'Análise de Riscos',
    route: '/intelligence/analise-riscos',
    permission: 'Permissão 8.3 (Intelligence - Análise de Riscos)',
    summary: 'Matriz de risco de crédito, ratings e cálculo de perda esperada.',
    purpose: `Auxilia os analistas de risco a determinar o rating de crédito (de AAA até D) de cada operação e empresa, ponderando garantias reais, histórico de liquidação e saúde financeira.`,
    businessRules: [
      'Matriz de Classificação: Cruzamento de tempo de fundação, faturamento comprovado e histórico de pontualidade.',
      'Sinalização de Risco Crítico: Bloqueio automático de limite caso ocorra protesto de valor expressivo.',
      'Revisão Periódica: Alerta para revisão de risco a cada 6 meses.'
    ],
    dbTables: [
      { name: 'clientes_cadastro', desc: 'Leitura de limites e faturamento.' },
      { name: 'BASE_NPL', desc: 'Consulta a atrasos históricos de títulos.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/risk-matrix', desc: 'Retorna parâmetros da matriz e distribuição de risco da carteira.' },
      { method: 'POST', endpoint: '/api/intelligence/risk-rating', desc: 'Registra novo parecer de rating emitido por analista.' }
    ],
    uiUx: `Indicadores coloridos de rating (Verde, Amarelo, Vermelho). Gráficos de dispersão de risco x retorno.`,
    engineeringDetails: `Cálculos probabilísticos executados no backend para garantir consistência de regras entre web e relatórios.`
  },
  {
    dir: 'src/internal/modules/intelligence/npl',
    title: 'Gestão de NPL (Non-Performing Loans)',
    route: '/intelligence/npl',
    permission: 'Permissão 8.4 (Intelligence - NPL)',
    summary: 'Controle de títulos inadimplentes, carteiras em atraso e esteira de cobrança contenciosa.',
    purpose: `Monitora a inadimplência ativa da Lepta Capital. Classifica os títulos vencidos por faixas de atraso (Aging: 1-30, 31-60, 61-90, 90+ dias) e direciona os casos para cobrança administrativa ou judicial.`,
    businessRules: [
      'Classificação por Aging: Atualização diária das faixas com base na data de vencimento x data corrente.',
      'Provisão para Devedores Duvidosos (PDD): Percentual de provisão escalonado conforme a faixa de atraso.',
      'Histórico de Acordos: Registro de renegociações e termos de confissão de dívida.'
    ],
    dbTables: [
      { name: 'BASE_NPL', desc: 'Tabela principal com todos os títulos em atraso, sacado, cedente e dias de mora.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/npl/summary', desc: 'Totalizadores e KPIs por faixa de aging.' },
      { method: 'GET', endpoint: '/api/intelligence/npl/items', desc: 'Lista detalhada de títulos com filtros de cedente, sacado e valor.' }
    ],
    uiUx: `Filtros rápidos no topo, cards com volume financeiro em cada faixa de dias de atraso e tabela com ações rápidas para abrir ocorrência.`,
    engineeringDetails: `Job noturno que sincroniza a base de atrasados e recalcula juros e multas contratuais automaticamente.`
  },
  {
    dir: 'src/internal/modules/intelligence/esteira-comite',
    title: 'Esteira de Comitê de Crédito',
    route: '/intelligence/esteira-comite',
    permission: 'Permissão 8.5 (Intelligence - Esteira de Comitê)',
    summary: 'Deliberação colegiada de limites de crédito com votos e pareceres de membros do comitê.',
    purpose: `Automatiza as reuniões de comitê de crédito da Lepta Capital. Os analistas submetem propostas de aumento de limite ou novas operações, e os membros do comitê registram seus votos com parecer fundamentado.`,
    businessRules: [
      'Quórum Mínimo: Propostas exigem quantidade mínima de votos favoráveis para aprovação automática.',
      'Poder de Veto: Membros executivos têm poder de veto fundamentado.',
      'Imutabilidade dos Pareceres: Uma vez registrado o voto, não pode ser alterado para fins de governança e auditoria.'
    ],
    dbTables: [
      { name: 'comite_propostas', desc: 'Propostas de crédito com valor solicitado, cliente, garantias e status.' },
      { name: 'comite_votos', desc: 'Registro de cada voto individual (Favorável, Desfavorável, Abstenção) e parecer.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/committee/pipeline', desc: 'Retorna propostas em pauta na esteira.' },
      { method: 'POST', endpoint: '/api/intelligence/committee/vote', desc: 'Submete voto do membro autenticado.' },
      { method: 'POST', endpoint: '/api/intelligence/committee/finalize', desc: 'Encerra a deliberação gerando ata assinada.' }
    ],
    uiUx: `Quadro estilo Kanban ou lista de pautas. Indicador visual do progresso de votos de cada membro. Modal para digitação do parecer técnico.`,
    engineeringDetails: `Controle de concorrência com travas otimistas para encerramento de pauta.`
  },
  {
    dir: 'src/internal/modules/intelligence/consulta-smartfactor',
    title: 'Consulta SmartFactor',
    route: '/intelligence/consulta-smartfactor',
    permission: 'Permissão 8.6 (Intelligence - Consulta SmartFactor)',
    summary: 'Cruzamento e pesquisa avançada de cedentes e sacados na base SmartFactor.',
    purpose: `Permite consultar a base de dados histórica do ecossistema SmartFactor para verificar se determinado CNPJ já operou com outras empresas do grupo, qual o histórico de pontualidade e volumes transacionados.`,
    businessRules: [
      'Busca por Raiz de CNPJ: Permite localizar matriz e filiais para verificar endividamento consolidado.',
      'Limitação de Visualização: Dados sensíveis de taxas praticadas são restritos aos perfis de liderança.'
    ],
    dbTables: [
      { name: 'BASE_SMARTFACTOR', desc: 'Tabela com registros agregados da base de inteligência SmartFactor.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/smartfactor/query', desc: 'Executa pesquisa por CNPJ ou Razão Social com paginação.' }
    ],
    uiUx: `Barra de pesquisa rápida com histórico recente, chips de filtro rápido e cards de resultado com status operacional.`,
    engineeringDetails: `Índices textuais em SQLite para consultas instantâneas em centenas de milhares de linhas.`
  },
  {
    dir: 'src/internal/modules/intelligence/cadastro-gerentes',
    title: 'Cadastro de Gerentes de Contas',
    route: '/intelligence/cadastro-gerentes',
    permission: 'Permissão 8.7 (Intelligence - Cadastro de Gerentes)',
    summary: 'Gestão da equipe comercial e vinculação de carteiras de cedentes a gerentes.',
    purpose: `Cadastra os gerentes comerciais e associa cada cedente da carteira ao respectivo gerente para fins de comissionamento, acompanhamento de metas e direcionamento de relatórios.`,
    businessRules: [
      'Exclusividade de Carteira: Cada cedente pode estar vinculado a um único gerente principal em determinado período.',
      'Histórico de Atribuição: Alterações de gerência registram log para auditoria de comissões.'
    ],
    dbTables: [
      { name: 'gerentes', desc: 'Cadastro de gerentes comerciais (nome, e-mail, telefone, meta).' },
      { name: 'gerentes_contas', desc: 'Vínculo N:N entre gerentes e cedentes operados.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/intelligence/managers', desc: 'Lista gerentes e quantidade de clientes sob sua gestão.' },
      { method: 'POST', endpoint: '/api/intelligence/managers', desc: 'Cadastra novo gerente comercial.' },
      { method: 'POST', endpoint: '/api/intelligence/managers/assign', desc: 'Vincula clientes à carteira do gerente.' }
    ],
    uiUx: `Tabela com avatar do gerente, barra de meta atingida e botão de gestão de carteira que abre lista de clientes para seleção em lote.`,
    engineeringDetails: `Atualizações em lote dentro de transação SQLite para migração rápida de carteira entre gerentes.`
  },
  {
    dir: 'src/internal/modules/administrativo/solicitacoes-financeiras',
    title: 'Solicitações Financeiras & Compras',
    route: '/administrativo/compras',
    permission: 'Permissão 11.1 (Compras - Solicitações)',
    summary: 'Workflow completo de requisições de compras, reembolsos, contratação de serviços e alçadas de aprovação.',
    purpose: `Esteira corporativa de aquisições e despesas da Lepta Capital. Permite que qualquer colaborador submeta pedidos de compra ou reembolsos, anexando notas fiscais, orçamentos e dados bancários. O pedido passa automaticamente pela alçada de aprovação configurada (Diretoria / Master / Jurídico) antes de seguir para pagamento.`,
    businessRules: [
      'Multi-Itens em Solicitação Única: Uma requisição pode agregar múltiplos itens com diferentes categorias, fornecedores e formas de pagamento.',
      'Alçadas de Decisão: Apenas usuários cadastrados como Aprovadores enxergam e decidem solicitações de outros colaboradores; usuários comuns visualizam apenas as suas.',
      'Segurança de Alçadas: Aprovadores jurídicos decidem exclusivamente requisições cabíveis ao jurídico.',
      'Categorias e Alocação: Destino configurável entre Centro de Custo, Empresa e Cliente (com exclusão do legado Departamento).',
      'Campos de Observação Formatáveis: Observações adicionais preservam parágrafos, quebras de linha e dados bancários/PIX para clareza da tesouraria.',
      'Auditoria de Ciclo de Vida: Gravação de quem aprovou, negou ou retornou para revisão com justificativa obrigatória.',
      'Notificações Instantâneas: Envio de Web Push e e-mail em cada mudança de status.'
    ],
    dbTables: [
      { name: 'compras_requisicoes', desc: 'Registro master da requisição (código, solicitante, status, total, observações, aprovador).' },
      { name: 'compras_requisicoes_itens', desc: 'Itens discriminados com fornecedor, valor, quantidade, tipo de destino e chave PIX.' },
      { name: 'compras_anexos', desc: 'Notas fiscais, boletos e cotações anexadas.' },
      { name: 'compras_mensagens', desc: 'Histórico de mensagens e chat interno sobre a requisição.' },
      { name: 'compras_papeis_usuarios', desc: 'Controle de alçada de aprovadores.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/requests', desc: 'Lista solicitações com paginação, busca e filtros de status.' },
      { method: 'POST', endpoint: '/api/purchases/requests', desc: 'Criação de nova solicitação com suporte a múltiplos itens e anexos.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/approve', desc: 'Aprova solicitação avançando para o financeiro.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/reject', desc: 'Nega solicitação com justificativa obrigatória.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/revision', desc: 'Retorna solicitação ao solicitante para correção.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/archive', desc: 'Arquiva manualmente solicitações (exclusivo Master).' }
    ],
    uiUx: `Layout 100% responsivo estilo aplicação mobile/desktop. Abas dedicadas: Fila de Aprovação, Solicitações Revisadas, Nova Solicitação, Minhas Solicitações e Arquivadas. Modais ricos para visualização detalhada de anexos e cópia rápida de chave PIX.`,
    engineeringDetails: `Validação dupla de permissões no backend (JWT payload e checagem de banco em tempo real). Sanitização de arquivos no upload com multer.`
  },
  {
    dir: 'src/internal/modules/administrativo/configuracao-aprovadores',
    title: 'Configuração de Aprovadores',
    route: '/administrativo/configuracao-compras',
    permission: 'Permissão 11.2 (Compras - Configuração)',
    summary: 'Definição de alçadas de aprovação, papéis e limites de compras corporativas.',
    purpose: `Permite aos administradores e Master configurar quem são os aprovadores das solicitações financeiras gerais. Um usuário sem papel de aprovador não visualiza solicitações alheias, garantindo total privacidade e segregação de funções.`,
    businessRules: [
      'Segregação de Papéis: O usuário pode ser configurado como "Aprovador" ou "Usuário Padrão".',
      'Herança por Grupo: Suporte a atribuição de alçada a grupos corporativos inteiros.',
      'Acesso Restrito: Apenas usuários Master ou com permissão 11.2 podem acessar esta tela de configuração.'
    ],
    dbTables: [
      { name: 'compras_papeis_usuarios', desc: 'Vínculo do ID do usuário com o papel de APROVADOR.' },
      { name: 'compras_papeis_grupos', desc: 'Vínculo de grupos de usuários autorizados a aprovar.' },
      { name: 'usuarios_lepta', desc: 'Listagem de usuários ativos para configuração.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/config/roles', desc: 'Lista usuários e seus papéis no fluxo de compras.' },
      { method: 'POST', endpoint: '/api/purchases/config/roles', desc: 'Salva atribuição de aprovador para um usuário ou grupo.' },
      { method: 'DELETE', endpoint: '/api/purchases/config/roles/:userId', desc: 'Revoga papel de aprovador de um usuário.' }
    ],
    uiUx: `Tabela moderna com busca instantânea de colaboradores. Toggle ou botão de alternância clara entre "Aprovador" e "Padrão". Feedback imediato por Toast.`,
    engineeringDetails: `Invalidação em tempo real do cache de alçadas no backend após cada atualização.`
  },
  {
    dir: 'src/internal/modules/administrativo/agendar-sala-reuniao',
    title: 'Agendamento de Salas de Reunião',
    route: '/administrativo/salas-reuniao',
    permission: 'Permissão 11.3 (Administrativo - Salas de Reunião)',
    summary: 'Reserva de salas físicas, controle de conflitos de horário e alertas automáticos.',
    purpose: `Organiza a utilização das salas de reunião da sede da Lepta Capital. Garante que duas equipes não reservem a mesma sala no mesmo horário e dispara alertas via Web Push quando faltar 10 minutos para o início do agendamento.`,
    businessRules: [
      'Detecção de Conflito: O sistema rejeita reservas que apresentem sobreposição de horário na mesma sala.',
      'Cancelamento Antecipado: O organizador ou Master pode liberar o horário da sala.',
      'Alerta de 10 Minutos: Um serviço em segundo plano roda a cada minuto no backend e envia push notification quando o relógio atinge T-10 min do início do agendamento.'
    ],
    dbTables: [
      { name: 'salas_reuniao_agendamentos', desc: 'Reservas contendo sala_id, data, horario_inicio, horario_fim, titulo e usuario_id.' },
      { name: 'salas_reuniao_alertas_10min', desc: 'Tabela de controle para evitar disparo duplicado de alertas.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/administrative/meeting-rooms/bookings', desc: 'Retorna agendamentos por data selecionada.' },
      { method: 'POST', endpoint: '/api/administrative/meeting-rooms/bookings', desc: 'Cria reserva após checar ausência de conflito.' },
      { method: 'DELETE', endpoint: '/api/administrative/meeting-rooms/bookings/:id', desc: 'Cancela a reserva liberando o horário.' }
    ],
    uiUx: `Visualizador de salas com grade temporal de 30 em 30 minutos. Cores de disponibilidade (Verde = Livre, Vermelho = Ocupada). Modal para inclusão de pauta e participantes.`,
    engineeringDetails: `Rotina cron no Node.js que avalia alertas pendentes a cada 60s com garantia de envio único.`
  },
  {
    dir: 'src/internal/modules/confirmacao/analise-confirmacao',
    title: 'Análise de Confirmação',
    route: '/confirmacao/analise',
    permission: 'Permissão 10.2 (Confirmação - Análise)',
    summary: 'Checagem de lastro de duplicatas, contato com sacados e gravação de evidências operacionais.',
    purpose: `Etapa crucial de esteira operacional para mitigação de fraudes. Os analistas de confirmação contatam os sacados para verificar a entrega de mercadoria ou prestação de serviços referente às notas fiscais antecipadas.`,
    businessRules: [
      'Evidência de Lastro: Cada título deve receber status (Confirmado, Divergência, Não Atende, Em Aberto).',
      'Anexo de Áudio/E-mail: Permite registrar e armazenar gravações telefônicas ou e-mails de aceite do sacado.',
      'Liberação para Liquidação: Somente borderôs com lastro 100% confirmado são liberados para desembolso.'
    ],
    dbTables: [
      { name: 'confirmacoes_titulos', desc: 'Status de confirmação de cada título operado.' },
      { name: 'confirmacoes_historico', desc: 'Log de contatos realizados, data, hora e operador.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/confirmation/analysis', desc: 'Carrega lista de títulos pendentes de confirmação.' },
      { method: 'POST', endpoint: '/api/confirmation/verify', desc: 'Registra o parecer de confirmação com observações.' }
    ],
    uiUx: `Tabela densa e produtiva para operadores, atalhos de teclado para confirmação rápida e visualizador integrado de documentos.`,
    engineeringDetails: `Integração com serviços de gravação e armazenamento de evidências com hashes SHA-256.`
  },
  {
    dir: 'src/internal/modules/cobranca/analise-vencidos',
    title: 'Análise de Vencidos (Cobrança)',
    route: '/cobranca/analise-vencidos',
    permission: 'Permissão 12.1 (Cobrança - Análise de Vencidos)',
    summary: 'Régua de cobrança ativa, acompanhamento de títulos em aberto e relatórios operacionais.',
    purpose: `Permite ao time de cobrança contatar sacados de títulos em atraso, registrando acordos, promessas de pagamento e emitindo boletos com atualização de encargos moratórios.`,
    businessRules: [
      'Cálculo de Juros e Multa: Aplicação diária da taxa de permanência contratual e multa sobre o principal.',
      'Agendamento de Retorno: Permite agendar data para novo contato caso o sacado solicite prazo.',
      'Exportação Operacional: Geração de planilhas para envio a escritórios de cobrança terceirizados.'
    ],
    dbTables: [
      { name: 'cobranca_titulos', desc: 'Títulos vencidos em cobrança.' },
      { name: 'cobranca_ocorrencias', desc: 'Registro de contatos e promessas de pagamento.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/cobranca/overdue', desc: 'Lista títulos vencidos agrupados por sacado ou cedente.' },
      { method: 'POST', endpoint: '/api/cobranca/occurrence', desc: 'Registra ocorrência de contato telefônico ou por e-mail.' }
    ],
    uiUx: `Visão resumida com valor total em atraso, número de sacados inadimplentes e filtros por faixa de dias de mora.`,
    engineeringDetails: `Uso de rotinas em lote para recalcular o valor atualizado da dívida em frações de segundo.`
  },
  {
    dir: 'src/internal/modules/juridico/aprovacao-pagamentos',
    title: 'Aprovação de Pagamentos Jurídicos',
    route: '/juridico/aprovacao-pagamentos',
    permission: 'Permissão 13.1 (Jurídico - Aprovação)',
    summary: 'Parecer e deliberação de despesas jurídicas, custas processuais e honorários advocatícios.',
    purpose: `Módulo especializado para o departamento Jurídico avaliar e aprovar solicitações de pagamento relacionadas a processos, perícias, custas judiciais e honorários, garantindo conformidade com a estratégia do contencioso.`,
    businessRules: [
      'Acesso Segmentado: Aprovadores jurídicos enxergam apenas requisições cabíveis ao jurídico e suas próprias requisições.',
      'Validação de Guia: Exige conferência do código de barras da guia de custas ou dados da sociedade de advogados.',
      'Parecer Fundamentado: Em caso de negativa ou devolução para revisão, é obrigatória a justificativa legal.'
    ],
    dbTables: [
      { name: 'compras_requisicoes', desc: 'Consulta e atualização de solicitações sob alçada jurídica.' },
      { name: 'compras_papeis_juridico', desc: 'Tabela de aprovadores autorizados do jurídico.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/requests/legal', desc: 'Retorna requisições destinadas à esteira jurídica.' },
      { method: 'POST', endpoint: '/api/purchases/requests/:id/approve', desc: 'Aprova despesa jurídica encaminhando à tesouraria.' }
    ],
    uiUx: `Interface corporativa sóbria com destaques para anexos de guias processuais, número do processo e status da decisão.`,
    engineeringDetails: `Garantia de isolamento de dados: usuários sem permissão 13.1 não conseguem interceptar as requisições jurídicas.`
  },
  {
    dir: 'src/internal/modules/juridico/configuracao-aprovadores-juridicos',
    title: 'Configuração de Aprovadores Jurídicos',
    route: '/juridico/configuracao-aprovadores',
    permission: 'Permissão 13.2 (Jurídico - Configuração de Aprovadores)',
    summary: 'Gestão de usuários autorizados a emitir deliberações em pagamentos do departamento jurídico.',
    purpose: `Painel de governança que permite selecionar quais advogados e membros do time jurídico possuem poder de aprovação sobre pagamentos jurídicos.`,
    businessRules: [
      'Filtro por Acesso Jurídico: Apenas colaboradores que já possuem acesso ao módulo Jurídico são listados como elegíveis para aprovação jurídica.',
      'Segregação de Alçadas: Aprovadores jurídicos não aprovam solicitações gerais de compras, mantendo a autonomia departamental.'
    ],
    dbTables: [
      { name: 'compras_papeis_juridico', desc: 'Tabela com os IDs dos usuários aprovadores jurídicos.' },
      { name: 'usuarios_lepta', desc: 'Relação de usuários com credencial jurídica.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/purchases/config/legal-roles', desc: 'Lista usuários elegíveis e status de aprovação jurídica.' },
      { method: 'POST', endpoint: '/api/purchases/config/legal-roles', desc: 'Define ou remove o papel de aprovador jurídico.' }
    ],
    uiUx: `Grid simplificado com foto, e-mail e botão direto para alternar entre "Aprovador Jurídico" e "Membro Padrão".`,
    engineeringDetails: `Persistência atômica com validação de permissão de administrador no backend.`
  },
  {
    dir: 'src/internal/modules/mesa-operacoes/analise-operacao',
    title: 'Análise de Operação (Mesa de Operações)',
    route: '/mesa-operacoes/analise',
    permission: 'Permissão 14.1 (Mesa - Análise de Operação)',
    summary: 'Análise técnica de borderôs, consulta de número bancário via Bitfin e exportação CNAB 400.',
    purpose: `Coração operacional da Lepta Capital. Permite que os operadores da mesa analisem propostas de borderô, auditem número bancário via integração direta com a API da Bitfin, verifiquem limites e exportem arquivos de remessa bancária no padrão CNAB 400 posições.`,
    businessRules: [
      'Consulta Bitfin: Extrai detalhes dos títulos (nosso número, vencimento, valor, número bancário) para homologação com o banco.',
      'Exportação CNAB 400: Gera arquivo de remessa padronizado de 400 posições para Bradesco e bancos parceiros com modal de confirmação.',
      'Aprovação da Mesa: Bloqueia exportação se existirem títulos com CEP inválido ou divergência de valor.'
    ],
    dbTables: [
      { name: 'operacoes', desc: 'Tabela de operações de crédito e borderôs em análise.' },
      { name: 'operacoes_titulos', desc: 'Detalhamento de cada duplicata/título pertencente ao borderô.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/operations/analysis', desc: 'Carrega borderôs e títulos pendentes de processamento.' },
      { method: 'POST', endpoint: '/api/operations/bitfin/query', desc: 'Consulta externa à API Bitfin para obtenção do número bancário.' },
      { method: 'POST', endpoint: '/api/operations/export-cnab', desc: 'Gera e baixa o arquivo CNAB 400 posições.' }
    ],
    uiUx: `Modal de exportação CNAB que se sobrepõe com prioridade à tela de detalhes, badges de status de conferência e botões de ação rápida.`,
    engineeringDetails: `Parser e formatador de texto posicional com preenchimento exato de 400 caracteres por linha, cálculo de DV e zeros à esquerda.`
  },
  {
    dir: 'src/internal/modules/mesa-operacoes/validar-ceps',
    title: 'Validação de CEPs (CNAB)',
    route: '/mesa-operacoes/validar-ceps',
    permission: 'Permissão 14.2 (Mesa - Validar CEPs)',
    summary: 'Saneamento cadastral de endereços e CEPs para evitar rejeição de remessas bancárias.',
    purpose: `Varre os cadastros de sacados e cedentes contidos em lotes de títulos para detectar CEPs zerados, incompletos ou inexistentes nos Correios antes do envio ao banco.`,
    businessRules: [
      'Formato Obrigatório: O CEP deve conter exatamente 8 dígitos numéricos válidos.',
      'Higienização Automática: Remove pontos, traços e espaços.',
      'Bloqueio Preventivo: Alerta os operadores para corrigir o CEP no cadastro antes de gerar a remessa.'
    ],
    dbTables: [
      { name: 'clientes_cadastro', desc: 'Consulta e atualização de CEPs dos clientes.' },
      { name: 'operacoes_titulos', desc: 'Verificação dos endereços dos sacados nos títulos.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/operations/validate-ceps', desc: 'Identifica títulos ou sacados com inconsistência de CEP.' },
      { method: 'PUT', endpoint: '/api/operations/update-cep', desc: 'Permite retificar o CEP diretamente pela interface operacional.' }
    ],
    uiUx: `Painel de alertas com visualizador de CEPs divergentes e botão de correção inline sem necessidade de navegar até o cadastro geral.`,
    engineeringDetails: `Integração opcional com serviços de busca de logradouro por CEP com fallback local.`
  },
  {
    dir: 'src/internal/modules/mesa-operacoes/relatorio-diario',
    title: 'Relatório Diário de Operações',
    route: '/mesa-operacoes/relatorio-diario',
    permission: 'Permissão 14.3 (Mesa - Relatório Diário)',
    summary: 'Consolidação diária de volumes operados, taxas médias, deságio e títulos liquidados.',
    purpose: `Gera a fotografia diária das operações concluídas pela mesa para envio aos gestores e comitê de investimentos ao final do expediente.`,
    businessRules: [
      'Totalização Diária: Somatório de volume nominal, valor líquido liberado, taxa média ponderada e deságio retido.',
      'Agrupamento por Fundo: Segregação entre os fundos FIDC operados pela gestora.',
      'Fechamento de Caixa: Registro do horário de fechamento do relatório diário.'
    ],
    dbTables: [
      { name: 'operacoes', desc: 'Agregação das operações finalizadas na data corrente.' },
      { name: 'fundos', desc: 'Parâmetros dos fundos de investimento envolvidos.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/operations/daily-report', desc: 'Retorna consolidação do dia com suporte a filtros de data e fundo.' },
      { method: 'POST', endpoint: '/api/operations/daily-report/export', desc: 'Exporta relatório formatado em planilha Excel (.xlsx).' }
    ],
    uiUx: `Gráficos de volumetria diária, cards com taxas médias e tabela analítica de borderôs com botão para download imediato do relatório.`,
    engineeringDetails: `Uso do exceljs com formatação corporativa de células, cabeçalhos Lepta e fórmulas automáticas de soma e média ponderada.`
  },
  {
    dir: 'src/internal/modules/banco-de-dados',
    title: 'Gestão do Banco de Dados SQLite',
    route: '/banco-de-dados',
    permission: 'Permissão 9 (Banco de Dados / Master)',
    summary: 'Auditoria de integridade, volumetria de tabelas, execução de backups e sincronização com a API Unltd.',
    purpose: `Painel de administração técnica da infraestrutura de dados da Lepta. Permite monitorar o tamanho do arquivo SQLite, quantidade de linhas por tabela, status do job de sincronização periódica e disparo de backups.`,
    businessRules: [
      'Acesso Restrito: Exclusivo para usuários com permissão 9 ou role MASTER.',
      'Integridade Referencial: Execução de comandos PRAGMA foreign_keys e integrity_check.',
      'Sincronização Unltd: Histórico de execuções com log de registros inseridos e atualizados.'
    ],
    dbTables: [
      { name: 'API_SYNC_EXECUCOES', desc: 'Histórico de sincronizações de dados da API externa Unltd.' },
      { name: 'databaseTables', desc: 'Metadados e contagens estruturais de tabelas do banco de dados.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/database/status', desc: 'Retorna tamanho do arquivo .sqlite, contagem de tabelas e status.' },
      { method: 'POST', endpoint: '/api/database/sync-now', desc: 'Dispara sincronização manual com a API Unltd.' },
      { method: 'POST', endpoint: '/api/database/backup', desc: 'Gera cópia consistente do banco de dados.' }
    ],
    uiUx: `Cards com indicadores de saúde do banco, tabela com lista de todas as tabelas e quantidade de registros, e log em tempo real do sync.`,
    engineeringDetails: `Execução segura do driver better-sqlite3 em modo WAL (Write-Ahead Logging) para alta performance de leitura e concorrência.`
  },
  {
    dir: 'src/internal/modules/dashboards',
    title: 'Dashboards Executivos',
    route: '/dashboards',
    permission: 'Permissão 5 (Dashboards)',
    summary: 'Visualização analítica integrada de KPIs, relatórios de Power BI e gráficos de performance.',
    purpose: `Ambiente de inteligência visual para a alta gestão e investidores acompanharem os principais indicadores de desempenho da operação da Lepta Capital.`,
    businessRules: [
      'Segurança de Embed: Integração segura com relatórios de Power BI via tokens temporários.',
      'Filtros Globais: Capacidade de selecionar períodos e fundos para ajuste de todos os gráficos.'
    ],
    dbTables: [
      { name: 'power_bi_dashboards', desc: 'Configuração dos dashboards integrados, links e permissões.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/dashboards/list', desc: 'Retorna lista de dashboards disponíveis para o perfil do usuário.' }
    ],
    uiUx: `Layout imersivo com opções de tela cheia, seleção de abas de dashboards e transições suaves de carregamento.`,
    engineeringDetails: `Carregamento assíncrono de iframes com sandbox seguro e tratamento de erros de conexão.`
  },
  {
    dir: 'src/internal/modules/business-intelligence/movimento-falimentar',
    title: 'Movimento Falimentar (Business Intelligence)',
    route: '/bi/movimento-falimentar',
    permission: 'Permissão 4.1 (BI - Movimento Falimentar)',
    summary: 'Varredura de diários de justiça e identificação de recuperações judiciais e falências de clientes.',
    purpose: `Módulo de inteligência jurídica preventiva. Realiza a varredura contínua de publicações judiciais em busca de processos de recuperação judicial, falência e autofalência envolvendo CNPJs de cedentes e sacados da carteira da Lepta.`,
    businessRules: [
      'Alerta Crítico: Emissão imediata de aviso à diretoria quando detectada publicação de deferimento de RJ.',
      'Histórico de Eventos: Armazenamento da data da publicação, vara cível, número do processo e teor do despacho.',
      'Bloqueio Preventivo: Marcação do cliente como "Em Recuperação" impedindo novas operações sem aprovação especial.'
    ],
    dbTables: [
      { name: 'rj_events', desc: 'Registro dos eventos falimentares capturados com processo e texto.' },
      { name: 'scans', desc: 'Histórico de varreduras executadas pelo robô coletor.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/bi/movimento-falimentar/events', desc: 'Lista ocorrências falimentares com filtros por empresa e período.' },
      { method: 'POST', endpoint: '/api/bi/movimento-falimentar/scan', desc: 'Dispara nova varredura nos diários oficiais.' }
    ],
    uiUx: `Tabela com badges de gravidade (Recuperação Judicial, Falência Decretada, Convocação de Credores) e modal para leitura da íntegra do despacho judicial.`,
    engineeringDetails: `Robô coletor com tratamento de regex para extração estruturada de número de processo CNJ e CNPJ.`
  },
  {
    dir: 'src/internal/modules/administracao/permissoes',
    title: 'Gestão de Permissões e Acessos',
    route: '/permissions',
    permission: 'Role MASTER',
    summary: 'Matriz granular de controle de acesso (RBAC) por funcionalidade e código numérico.',
    purpose: `Central de governança de segurança do LeptaSys. Permite ao usuário MASTER habilitar ou revogar permissões granulares para cada usuário ou grupo do sistema, controlando a visibilidade de menus e execução de endpoints.`,
    businessRules: [
      'Controle Baseado em Códigos (RBAC): Cada módulo possui código específico (ex: 11.1 = Compras, 7.1 = Extratos, 13.1 = Jurídico).',
      'Precedência de Master: Usuários com role MASTER possuem acesso total irrestrito.',
      'Herança de Permissões: O usuário herda todas as permissões concedidas aos grupos dos quais faz parte.'
    ],
    dbTables: [
      { name: 'usuarios_lepta', desc: 'Coluna permissions_json armazenando array de permissões atribuídas.' },
      { name: 'grupos_usuarios', desc: 'Permissões atribuídas no nível de grupo corporativo.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/permissions/matrix', desc: 'Carrega matriz de todos os usuários x permissões cadastradas.' },
      { method: 'POST', endpoint: '/api/permissions/update', desc: 'Salva novas permissões atribuídas a determinado usuário.' }
    ],
    uiUx: `Matriz interativa com checkboxes rápidos por grupo funcional, busca de usuários e salvamento em lote.`,
    engineeringDetails: `Middleware de autenticação no backend (requirePermission) que checa a existência do código de permissão no array do usuário antes de processar qualquer rota protegida.`
  },
  {
    dir: 'src/internal/modules/administracao/criar-usuario',
    title: 'Criar Usuário Corporativo',
    route: '/permissions/create-user',
    permission: 'Role MASTER',
    summary: 'Provisionamento de novas contas de colaboradores, definição de senhas e grupos iniciais.',
    purpose: `Permite cadastrar novos colaboradores no sistema, definindo nome de usuário, e-mail institucional @lepta.com.br, papel inicial e grupos de trabalho.`,
    businessRules: [
      'Unicidade de E-mail e Username: Não é permitido duplicar logins no sistema.',
      'Senha Segura: Hash com bcrypt antes da persistência no banco.',
      'Primeiro Acesso: O usuário é compelido a alterar a senha inicial no primeiro login.'
    ],
    dbTables: [
      { name: 'usuarios_lepta', desc: 'Inserção de novos registros com status ATIVO.' }
    ],
    apis: [
      { method: 'POST', endpoint: '/api/users/create', desc: 'Cria credencial do novo colaborador com validação de formato e hashing de senha.' }
    ],
    uiUx: `Formulário moderno com indicadores de força de senha e seleção de grupos iniciais.`,
    engineeringDetails: `Hash criptográfico SHA-256 e Bcrypt com salt para proteção contra vazamento de credenciais.`
  },
  {
    dir: 'src/internal/modules/administracao/grupos',
    title: 'Configurar Grupos Corporativos',
    route: '/permissions/groups',
    permission: 'Role MASTER',
    summary: 'Criação de grupos funcionais (Mesa, Jurídico, Financeiro, Diretoria) e atribuição de membros.',
    purpose: `Organiza os usuários em equipes funcionais para simplificar a concessão em lote de permissões e direcionamento de fluxos de aprovação.`,
    businessRules: [
      'Vinculação Flexível: Um colaborador pode pertencer a múltiplos grupos simultaneamente.',
      'Auditoria de Membros: Rastreia a data e o administrador que incluiu cada usuário no grupo.'
    ],
    dbTables: [
      { name: 'grupos', desc: 'Cadastro de grupos (nome, descrição, permissões padrão).' },
      { name: 'grupos_membros', desc: 'Vínculo N:N entre usuários e grupos.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/groups', desc: 'Lista grupos cadastrados e total de membros em cada um.' },
      { method: 'POST', endpoint: '/api/groups', desc: 'Cria novo grupo corporativo.' },
      { method: 'POST', endpoint: '/api/groups/members', desc: 'Adiciona ou remove colaboradores do grupo.' }
    ],
    uiUx: `Cards de grupos com lista de avatares dos membros e gaveta lateral para seleção de colaboradores.`,
    engineeringDetails: `Atualizações transacionais no banco de dados com integridade referencial em cascata.`
  },
  {
    dir: 'src/internal/modules/administracao/configuracao-email',
    title: 'Configuração de E-mail & Notificações',
    route: '/permissions/email-config',
    permission: 'Role MASTER',
    summary: 'Configuração de envio de e-mails corporativos via Microsoft Entra ID (OAuth) ou SMTP, e regras de disparo por evento.',
    purpose: `Controla a infraestrutura de comunicação por e-mail da Lepta Capital. Permite alternar entre o envio seguro via Microsoft Graph API (Microsoft 365 / Entra ID) ou servidor SMTP corporativo. Define para quais destinatários e usuários do sistema cada evento corporativo deve disparar notificações automáticas.`,
    businessRules: [
      'Métodos de Envio: Suporte duplo a Microsoft Entra ID (Recomendado com OAuth 2.0 Client Credentials) e SMTP clássico com TLS.',
      'Eventos Parametrizáveis: Configuração individual por evento (ex: Nova Solicitação de Compra, Aprovação pela Diretoria, Negada pela Diretoria, Retorno para Revisão, Conclusão de Pagamento pelo Financeiro).',
      'Destinatários Flexíveis: Combina usuários cadastrados no sistema com e-mails avulsos e opção de notificar o solicitante da requisição.',
      'Proteção contra Quebra de UI: Elementos de seleção e inputs com largura controlada (min-width: 0) para perfeito alinhamento visual.',
      'Validação de Conexão: Botão para envio de e-mail de teste antes de ativar a configuração.'
    ],
    dbTables: [
      { name: 'configuracao_email', desc: 'Credenciais de conexão (Entra ID: tenant_id, client_id, client_secret / SMTP: host, port, user, pass).' },
      { name: 'configuracao_email_fluxo', desc: 'Regras de quais e-mails e usuários recebem notificações de cada evento.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/email/config', desc: 'Retorna parâmetros atuais de conexão e fluxos de e-mail configurados.' },
      { method: 'POST', endpoint: '/api/email/config', desc: 'Salva novas credenciais e regras de envio por evento.' },
      { method: 'POST', endpoint: '/api/email/test', desc: 'Dispara e-mail de teste imediato para validar conectividade.' }
    ],
    uiUx: `Interface moderna com seletor de método de envio em cards destacados, visualizador de status de consentimento administrativo do Microsoft Entra ID, grid de eventos com chips de destinatários e botões de inclusão inline com contenção visual rigorosa.`,
    engineeringDetails: `Uso de nodemailer e biblioteca de autenticação da Microsoft (@azure/msal-node / fetch OAuth) com renovação automática de access token em segundo plano.`
  },
  {
    dir: 'src/internal/modules/monitor',
    title: 'Monitor de Presença & Telemetria',
    route: '/monitor',
    permission: 'Role MASTER',
    summary: 'Auditoria de usuários conectados em tempo real, tempo de sessão, rotas navegadas e erros do sistema.',
    purpose: `Painel de telemetria operacional em tempo real para a equipe de tecnologia. Permite visualizar quais colaboradores estão online neste instante, em qual tela estão trabalhando, tempo de inatividade e eventuais erros de runtime capturados.`,
    businessRules: [
      'Critério de Presença: O usuário é considerado "Online" se enviou heartbeat nos últimos 60 segundos; "Ausente" entre 60s e 5 minutos; "Offline" após 5 minutos.',
      'Privacidade & Auditoria: Registra unicamente a rota (/administrativo/compras, /mesa-operacoes/analise) e timestamp para auditoria de segurança.',
      'Registro de Erros: Falhas de JavaScript e rejeições de promises não tratadas são capturadas e exibidas no log do monitor.'
    ],
    dbTables: [
      { name: 'monitor_user_sessions', desc: 'Último heartbeat de cada usuário, rota ativa e timestamp.' },
      { name: 'site_analytics_hits', desc: 'Contagem de acessos por módulo para análise de volumetria.' },
      { name: 'monitor_system_errors', desc: 'Logs de erros capturados pelo SystemErrorBoundary.' }
    ],
    apis: [
      { method: 'GET', endpoint: '/api/monitor/sessions', desc: 'Retorna lista de colaboradores online, status e módulo ativo.' },
      { method: 'GET', endpoint: '/api/monitor/analytics', desc: 'Estatísticas de uso e distribuição de acessos por rota.' },
      { method: 'POST', endpoint: '/api/monitor/heartbeat', desc: 'Endpoint de recepção do ping periódico de presença (30s).' }
    ],
    uiUx: `Grid de status com pulso verde para usuários online em tempo real, avatar, módulo atual e tempo de sessão ativa. Painel de erros com stack trace recolhível.`,
    engineeringDetails: `Otimização de escrita no banco de dados através de upsert (INSERT OR REPLACE) para suportar dezenas de heartbeats simultâneos sem overhead de I/O.`
  }
];

function generateMarkdown(mod) {
  let md = `# Documentação de Engenharia de Software: ${mod.title}\n\n`;
  md += `> **Módulo do Sistema:** ${mod.title}  \n`;
  md += `> **Rota no Sistema:** \`${mod.route}\`  \n`;
  md += `> **Nível de Acesso:** \`${mod.permission}\`  \n`;
  md += `> **Data de Atualização:** Março/2026 | Versão 2.4.0\n\n`;
  md += `---\n\n`;

  md += `## 1. Visão Geral & Finalidade\n\n`;
  md += `${mod.purpose}\n\n`;
  md += `**Resumo Executivo:** ${mod.summary}\n\n`;

  md += `## 2. Regras de Negócio e Políticas Operacionais\n\n`;
  for (const rule of mod.businessRules) {
    md += `- **${rule.split(':')[0]}:** ${rule.split(':').slice(1).join(':').trim()}\n`;
  }
  md += `\n`;

  md += `## 3. Engenharia de Banco de Dados (SQLite)\n\n`;
  md += `O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:\n\n`;
  md += `| Tabela | Descrição e Finalidade no Módulo |\n`;
  md += `|---|---|\n`;
  for (const table of mod.dbTables) {
    md += `| \`${table.name}\` | ${table.desc} |\n`;
  }
  md += `\n`;

  md += `## 4. Endpoints de API & Integrações Backend\n\n`;
  md += `Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:\n\n`;
  md += `| Método | Endpoint | Descrição da Operação |\n`;
  md += `|---|---|---|\n`;
  for (const api of mod.apis) {
    md += `| \`${api.method}\` | \`${api.endpoint}\` | ${api.desc} |\n`;
  }
  md += `\n`;

  md += `## 5. Especificações de UI/UX & Usabilidade\n\n`;
  md += `${mod.uiUx}\n\n`;

  md += `## 6. Arquitetura Técnica & Detalhes de Engenharia\n\n`;
  md += `${mod.engineeringDetails}\n\n`;
  md += `---\n`;
  md += `*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*\n`;

  return md;
}

function generateHtml(mod) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${mod.title} - Documentação Técnica (Lepta Capital)</title>
  <style>
    @page {
      size: A4;
      margin: 1.8cm 1.5cm;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
    }
    .header-banner {
      border-bottom: 3px solid #0284c7;
      padding-bottom: 12px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-left h1 {
      color: #0f172a;
      font-size: 20pt;
      margin: 0 0 4px 0;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .header-left p {
      color: #64748b;
      margin: 0;
      font-size: 10pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #94a3b8;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-item label {
      font-size: 7.5pt;
      text-transform: uppercase;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .meta-item span {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
    }
    h2 {
      color: #0369a1;
      font-size: 13pt;
      font-weight: 750;
      border-bottom: 1.5px solid #e0f2fe;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 10px 0;
      text-align: justify;
    }
    ul {
      margin: 0 0 16px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 6px;
    }
    li strong {
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px 0;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      background: #f1f5f9;
      color: #0369a1;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 9pt;
      border: 1px solid #e2e8f0;
    }
    .footer-note {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 8.5pt;
      color: #94a3b8;
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 8pt;
    }
    .badge-get { background: #e0f2fe; color: #0369a1; }
    .badge-post { background: #dcfce7; color: #15803d; }
    .badge-put { background: #fef3c7; color: #b45309; }
    .badge-delete { background: #fee2e2; color: #b91c1c; }
  </style>
</head>
<body>

  <div class="header-banner">
    <div class="header-left">
      <p>Lepta Capital • LeptaSys Engenharia de Software</p>
      <h1>${mod.title}</h1>
    </div>
    <div class="header-right">
      <strong>DOCUMENTAÇÃO TÉCNICA</strong><br>
      Versão 2.4.0 • 2026
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <label>Rota de Acesso</label>
      <span><code>${mod.route}</code></span>
    </div>
    <div class="meta-item">
      <label>Alçada / Permissão</label>
      <span>${mod.permission}</span>
    </div>
    <div class="meta-item">
      <label>Diretório do Módulo</label>
      <span><code>${mod.dir}</code></span>
    </div>
  </div>

  <h2>1. Visão Geral & Finalidade</h2>
  <p>${mod.purpose}</p>
  <p><strong>Resumo Operacional:</strong> ${mod.summary}</p>

  <h2>2. Regras de Negócio e Políticas Operacionais</h2>
  <ul>
    ${mod.businessRules.map(r => {
      const parts = r.split(':');
      const title = parts[0];
      const desc = parts.slice(1).join(':');
      return `<li><strong>${title}:</strong> ${desc.trim()}</li>`;
    }).join('\n    ')}
  </ul>

  <h2>3. Engenharia de Banco de Dados (SQLite)</h2>
  <p>O módulo realiza operações de leitura e persistência nas seguintes entidades:</p>
  <table>
    <thead>
      <tr>
        <th style="width: 32%;">Tabela</th>
        <th>Descrição & Papel Estrutural no Módulo</th>
      </tr>
    </thead>
    <tbody>
      ${mod.dbTables.map(t => `
        <tr>
          <td><code>${t.name}</code></td>
          <td>${t.desc}</td>
        </tr>
      `).join('\n      ')}
    </tbody>
  </table>

  <h2>4. Endpoints de API & Integrações Backend</h2>
  <p>Endpoints REST consumidos pelo módulo frontend e implementados no servidor Node.js / Express:</p>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Método</th>
        <th style="width: 40%;">Endpoint</th>
        <th>Descrição da Operação</th>
      </tr>
    </thead>
    <tbody>
      ${mod.apis.map(a => `
        <tr>
          <td><span class="badge badge-${a.method.toLowerCase()}">${a.method}</span></td>
          <td><code>${a.endpoint}</code></td>
          <td>${a.desc}</td>
        </tr>
      `).join('\n      ')}
    </tbody>
  </table>

  <h2>5. Especificações de UI / UX & Usabilidade</h2>
  <p>${mod.uiUx}</p>

  <h2>6. Arquitetura Técnica & Detalhes de Engenharia</h2>
  <p>${mod.engineeringDetails}</p>

  <div class="footer-note">
    Documentação técnica interna de engenharia • Confidencial Lepta Capital © 2026. Todos os direitos reservados.
  </div>

</body>
</html>`;
}

async function main() {
  console.log(`=== GERAÇÃO DE DOCUMENTAÇÃO DE ENGENHARIA (LEPTASYS) ===`);
  console.log(`Usando navegador para compilação PDF: ${BROWSER_PATH}`);
  console.log(`Total de módulos a documentar: ${MODULES_DOCS.length}\n`);

  let generatedCount = 0;

  for (const mod of MODULES_DOCS) {
    const fullDirPath = path.join(projectRoot, mod.dir);
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    const mdPath = path.join(fullDirPath, 'DOCUMENTACAO.md');
    const htmlPath = path.join(fullDirPath, 'temp_doc_print.html');
    const pdfPath = path.join(fullDirPath, 'DOCUMENTACAO.pdf');

    // 1. Gerar DOCUMENTACAO.md
    const mdContent = generateMarkdown(mod);
    fs.writeFileSync(mdPath, mdContent, 'utf8');

    // 2. Gerar HTML temporário para impressão vetorial
    const htmlContent = generateHtml(mod);
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    // 3. Executar Chrome/Edge headless para gerar o PDF
    try {
      const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
      await execFileAsync(BROWSER_PATH, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        `--print-to-pdf=${pdfPath}`,
        '--no-pdf-header-footer',
        fileUrl
      ]);
      console.log(`[OK] ${mod.title} -> ${mod.dir}/DOCUMENTACAO.pdf e .md`);
      generatedCount++;
    } catch (err) {
      console.error(`[ERRO PDF] Falha ao gerar PDF para ${mod.title}:`, err.message);
    } finally {
      if (fs.existsSync(htmlPath)) {
        try { fs.unlinkSync(htmlPath); } catch (_) {}
      }
    }
  }

  console.log(`\n=== CONCLUÍDO COM SUCESSO: ${generatedCount} de ${MODULES_DOCS.length} módulos documentados em PDF e MD! ===`);
}

main().catch(err => {
  console.error('Erro fatal na execução:', err);
  process.exit(1);
});
