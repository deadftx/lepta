import Database from 'better-sqlite3';
import { ensureBaseNplTable, createNplRecord } from '../server/internal/modules/intelligence/npl/nplService.js';

const db = new Database('./database.sqlite');
ensureBaseNplTable(db);

const count = db.prepare('SELECT COUNT(*) as c FROM BASE_NPL').get()?.c || 0;
console.log(`Registros atuais em BASE_NPL: ${count}`);

if (count === 0) {
  console.log('Inserindo registros demonstrativos em BASE_NPL...');

  const sampleRecords = [
    {
      cedente: 'Indústria e Comércio de Cereais Bom de Gosto Ltda',
      cedenteCnpj: '08.089.064/0001-12',
      credoresDeInteresse: 'Banco Itaú BBA, Banco Santander, Banco do Brasil',
      creditoRj: 4500000.00,
      classe: 'III - Quirografário',
      creditoExecucao: 850000.00,
      extraconcursalNaoAjuizado: 250000.00,
      vpl: 3200000.00,
      porcentagemDeQuorum: 18.5,
      valorConsiderado: 3800000.00,
      observacoes: 'Negociação avançada de aquisição de carteira com desconto de 45%. Habilitação confirmada em AGC.',
      entrada: '15/01/2026',
      processo: '1004582-14.2025.8.26.0100',
      estado: 'SP',
      indicacao: 'Parceiro Estratégico Capital',
      contatoBancoFornecedor: 'Roberto Lima (Gerente Corporate Itaú)',
      advDaEmpresa: 'Dr. Marcos Albuquerque (OAB/SP 123.456)',
      telefoneDoAdvogado: '(11) 98765-4321',
      telefoneDoDevedor: '(11) 3456-7890',
      advDoCredor: 'Dra. Patricia Mendes (OAB/SP 654.321)',
      administradorJudicial: 'Alvarez & Marsal Administração Judicial',
      faseDoProcesso: 'Assembleia Geral de Credores (AGC)',
      contatoDevedor: 'Carlos Eduardo (Diretor Financeiro)',
      propostaReal: 2100000.00,
      propostaParceiro: 2300000.00,
      valorDeSaidaCliente: 2600000.00,
      resultadoBruto: 500000.00,
      imposto: 45000.00,
      valorParceiro: 100000.00,
      resultadoLiquido: 355000.00,
      statusDaNegociacao: 'Proposta Firme',
      dataRetorno: '15/09/2026',
      gestor: 'Arthur Feltrin',
      observacoes1: 'Documentação do plano de recuperação judicial validada pelo comitê de risco.',
      hiperlink: 'https://lepta.com.br/docs/bom_de_gosto_npl_dossie.pdf',
      ramoDeAtividade: 'Agronegócio e Cereais',
      socios: 'Carlos Eduardo Silveira, Mariana Silveira',
      garantia: 'Imóvel rural matriculado sob nº 45.890 no CRI de Ribeirão Preto/SP',
      fluxoDePagamento: 'Entrada de 30% e 12 parcelas mensais corrigidas por CDI',
      valorFinalDaOperacao: 2600000.00,
      valorRetidoFidc: 260000.00
    },
    {
      cedente: 'Agropecuária Vale do Sol S/A',
      cedenteCnpj: '14.234.567/0001-88',
      credoresDeInteresse: 'Bradesco, Rabobank, Syngenta',
      creditoRj: 8200000.00,
      classe: 'II - Garantia Real',
      creditoExecucao: 1200000.00,
      extraconcursalNaoAjuizado: 400000.00,
      vpl: 6100000.00,
      porcentagemDeQuorum: 24.2,
      valorConsiderado: 7500000.00,
      observacoes: 'Crédito com garantia pignoratícia de safra futura e penhor de maquinário agrícola.',
      entrada: '02/02/2026',
      processo: '0023419-55.2024.8.13.0024',
      estado: 'MG',
      indicacao: 'Mesa de Originação Agro',
      contatoBancoFornecedor: 'Fabio Santos (Bradesco Corporate Uberlândia)',
      advDaEmpresa: 'Dr. Leonardo Vasconcelos (OAB/MG 78.910)',
      telefoneDoAdvogado: '(31) 99876-1234',
      telefoneDoDevedor: '(34) 3211-9988',
      advDoCredor: 'Dr. Guilherme Rezende (OAB/SP 333.222)',
      administradorJudicial: 'KPMG Corporate Recovery',
      faseDoProcesso: 'Quadro Geral de Credores Homologado',
      contatoDevedor: 'Renato Guimarães (Sócio Fundador)',
      propostaReal: 4200000.00,
      propostaParceiro: 4600000.00,
      valorDeSaidaCliente: 5200000.00,
      resultadoBruto: 1000000.00,
      imposto: 90000.00,
      valorParceiro: 200000.00,
      resultadoLiquido: 710000.00,
      statusDaNegociacao: 'Em Negociação',
      dataRetorno: '20/09/2026',
      gestor: 'Sebastiao Neto',
      observacoes1: 'Laudo de avaliação dos imóveis e garantias concluído por perito independente.',
      hiperlink: 'https://lepta.com.br/docs/vale_do_sol_dossie.pdf',
      ramoDeAtividade: 'Pecuária de Corte e Grãos',
      socios: 'Renato Guimarães, Juliana Guimarães',
      garantia: 'Fazenda Santa Maria (850 hectares em Uberaba/MG)',
      fluxoDePagamento: 'Pagamento semestral pós-colheita em 4 parcelas',
      valorFinalDaOperacao: 5200000.00,
      valorRetidoFidc: 520000.00
    },
    {
      cedente: 'Metalúrgica Imperial do Sul Eireli',
      cedenteCnpj: '03.888.999/0001-44',
      credoresDeInteresse: 'Banco Safra, Caixa Econômica Federal',
      creditoRj: 2100000.00,
      classe: 'III - Quirografário',
      creditoExecucao: 450000.00,
      extraconcursalNaoAjuizado: 0,
      vpl: 1400000.00,
      porcentagemDeQuorum: 12.0,
      valorConsiderado: 1800000.00,
      observacoes: 'Cessão de crédito de fornecedores industriais com deságio de 60%.',
      entrada: '10/03/2026',
      processo: '5001234-92.2025.8.21.0001',
      estado: 'RS',
      indicacao: 'Rede de Fomentos do Sul',
      contatoBancoFornecedor: 'Luciana Freitas (Safra Empresas)',
      advDaEmpresa: 'Dr. Rodrigo Fagundes (OAB/RS 44.555)',
      telefoneDoAdvogado: '(51) 98122-3344',
      telefoneDoDevedor: '(51) 3344-5566',
      advDoCredor: 'Dr. Marcelo Becker (OAB/RS 77.888)',
      administradorJudicial: 'Brizola e Japur Administração Judicial',
      faseDoProcesso: 'Negociação Prévia de Plano Modificativo',
      contatoDevedor: 'Henrique Becker (CEO)',
      propostaReal: 950000.00,
      propostaParceiro: 1050000.00,
      valorDeSaidaCliente: 1200000.00,
      resultadoBruto: 250000.00,
      imposto: 22500.00,
      valorParceiro: 50000.00,
      resultadoLiquido: 177500.00,
      statusDaNegociacao: 'ACP Curto Prazo',
      dataRetorno: '10/09/2026',
      gestor: 'Arthur Feltrin',
      observacoes1: 'Aguardando validação da cessão pelos sócios avalistas.',
      hiperlink: 'https://lepta.com.br/docs/metalurgica_imperial_npl.pdf',
      ramoDeAtividade: 'Indústria Metalmecânica',
      socios: 'Henrique Becker, Paulo Becker',
      garantia: 'Galpão industrial em Caxias do Sul/RS avaliado em R$ 3.5M',
      fluxoDePagamento: '12 parcelas mensais fixas',
      valorFinalDaOperacao: 1200000.00,
      valorRetidoFidc: 120000.00
    }
  ];

  for (const item of sampleRecords) {
    createNplRecord(db, item, { username: 'seed_system' });
  }

  console.log(`✅ ${sampleRecords.length} registros demonstrativos criados em BASE_NPL com sucesso!`);
} else {
  console.log(`BASE_NPL já possui ${count} registros.`);
}
