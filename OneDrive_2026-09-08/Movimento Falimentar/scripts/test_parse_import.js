import { parseValorArticleText } from '../dist/valor_scraper.js';

const sampleText = `
FALÊNCIAS DECRETADAS
* Empresa: CGSG Participações Empresariais Ltda. - CNPJ: 32.878.783/0001-05 - Endereço: Quadra SAAN, Quadra 01, Lote 400 - Administrador Judicial: Dr. Vinicius Cavalcante Ferreira - Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF
* Empresa: Ativos Engenharia Ltda. - CNPJ: 23.348.649/0001-01 - Endereço: Trecho SIA, Lotes 630 a 780 - Administrador Judicial: Dr. André Corrêa Teles - Vara/Comarca: Vara de Falências do DF

RECUPERAÇÃO JUDICIAL DEFERIDA
* Empresa: Cheppitos Comércio de Alimentos Ltda. - CNPJ: 29.123.167/0001-21 - Endereço: Av. Washington Soares, 85 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
`;

const items = parseValorArticleText(sampleText, '2026-09-02');
console.log('Itens parseados:', items.length);
items.forEach(i => console.log(`- [${i.classe}] ${i.empresa} (${i.cnpj})`));
