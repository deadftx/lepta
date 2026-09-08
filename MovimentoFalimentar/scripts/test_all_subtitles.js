import { parseValorArticleText } from '../dist/valor_scraper.js';

const sampleArticle = `
FALÊNCIAS DECRETADAS
* Empresa: Ativos Engenharia Ltda. - CNPJ: 23.348.649/0001-01 - Endereço: Trecho SIA, Lotes 630 - Administrador Judicial: Dr. André Corrêa - Vara/Comarca: Vara de Falências do DF
* Empresa: CGSG Participações Empresariais Ltda. - CNPJ: 32.878.783/0001-05 - Endereço: Quadra SAAN - Administrador Judicial: Dr. Vinicius Cavalcante - Vara/Comarca: Vara de Falências do DF

PROCESSOS DE FALÊNCIA EXTINTOS
* Empresa: Transnecher Transportes Ltda. - CNPJ: 04.567.890/0001-12 - Endereço: Av. Brasil, 100 - Administrador Judicial: Não informado - Vara/Comarca: 2ª Vara Empresarial do RJ

RECUPERAÇÃO JUDICIAL DEFERIDA
* Empresa: Cheppitos Comércio de Alimentos Ltda. - CNPJ: 29.123.167/0001-21 - Endereço: Av. Washington Soares, 85 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cicloburguer Comércio Ltda. - CNPJ: 23.716.707/0001-02 - Endereço: BR-116 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE

RECUPERAÇÃO JUDICIAL CONCEDIDA
* Empresa: Refinaria de Petróleo de Manguinhos S.A. - CNPJ: 33.000.123/0001-99 - Endereço: Praça Mauá, 1 - Administrador Judicial: Deloitte - Vara/Comarca: 1ª Vara Empresarial do RJ

CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL
* Empresa: MG Distribuidora Ltda. - CNPJ: 14.555.666/0001-77 - Endereço: Rua das Flores, 50 - Administrador Judicial: Dr. Carlos Roberto - Vara/Comarca: 3ª Vara Cível de Belo Horizonte/MG

RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS
* Empresa: Lejan Participações S.A. - CNPJ: 08.999.888/0001-33 - Endereço: Av. Paulista, 1000 - Administrador Judicial: KPMG - Vara/Comarca: 2ª Vara de Falências de SP

PEDIDOS DE FALÊNCIA
* Empresa: Distribuidora Alfa Ltda. - CNPJ: 19.888.777/0001-55 - Endereço: Rua do Comércio, 12 - Requerente: Banco do Brasil - Vara/Comarca: 1ª Vara Cível de Curitiba/PR

PEDIDOS DE RECUPERAÇÃO JUDICIAL
* Empresa: Indústria Metalúrgica Beta S.A. - CNPJ: 55.444.333/0001-22 - Endereço: Rodovia Anhanguera, km 105 - Vara/Comarca: 1ª Vara Regional de Campinas/SP
`;

const parsed = parseValorArticleText(sampleArticle, '2026-09-02');
console.log('Total de itens parseados:', parsed.length);
const categories = [...new Set(parsed.map(i => i.classe))];
console.log('Categorias e Subtítulos identificados:');
categories.forEach(c => {
  const count = parsed.filter(i => i.classe === c).length;
  console.log(`- ${c}: ${count} empresa(s)`);
});
