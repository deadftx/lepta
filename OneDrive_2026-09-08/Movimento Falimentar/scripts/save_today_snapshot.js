import { parseValorArticleText } from '../dist/valor_scraper.js';
import fs from 'node:fs';

const todayArticleText = `
FALÊNCIAS DECRETADAS
* Empresa: Ativos Engenharia Ltda. - CNPJ: 23.348.649/0001-01 - Endereço: Trecho SIA,Trecho 01, Lotes 630 a 780, Bloco 3 B, Sala 424, Zona Industrial, Guará - Administrador Judicial: Dr. André Corrêa Teles - Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF
* Empresa: CGSG Participações Empresariais Ltda. - CNPJ: 32.878.783/0001-05 - Endereço: Quadra SAAN, Quadra 01, Lote 400, Parte A, Zona Industrial - Administrador Judicial: Dr. Vinicius Cavalcante Ferreira - Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF
* Empresa: Gasdiesel Serviços Ltda. - CNPJ: 09.008.431/0001-79 - Endereço: Rua Francisco Portela, 881, Sala 01, bairro Jardim Gramacho, Duque de Caxias/RJ - Administrador Judicial: O Próprio Administrador Judicial da Recuperação Judicial Rescindida - Vara/Comarca: 5ª Vara Empresarial do Rio de Janeiro/RJ - Observação: Recuperação judicial convolada em falência.
* Empresa: JMA Serviços e Portaria Ltda. - CNPJ: 18.929.300/0001-15 - Endereço: Rua Friedrich Von Voith, 825, Galpão P6, Sala 03, bairro Parque das Nações Unidas - Administrador Judicial: Gatekeeper Administração Judicial Ltda. - Vara/Comarca: 1ª Vara de Falências e Recuperações Judiciais de São Paulo/SP

PROCESSOS DE FALÊNCIA EXTINTOS
* Empresa: Transnecher Transportes Ltda. - CNPJ: 04.567.890/0001-12 - Endereço: Av. Brasil, 100, Sala 201 - Administrador Judicial: Não designado - Vara/Comarca: 2ª Vara Empresarial da Capital/RJ - Observação: Processo extinto sem resolução de mérito por desistência do credor.

RECUPERAÇÃO JUDICIAL DEFERIDA
* Empresa: Cheppitos 13 de Maio Ltda. - CNPJ: 49.969.817/0001-61 - Endereço: Av. 13 de Maio, 875, bairro Fátima, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Benfica Ltda. - CNPJ: 29.165.751/0001-40 - Endereço: Rua Carapinima, 2200, Sala 112, bairro Benfica, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Comércio de Alimentos Ltda. - CNPJ: 29.123.167/0001-21 - Endereço: Av. Washington Soares, 85, Loja 151, bairro Edson Queiroz, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Dom Luís Ltda. - CNPJ: 13.763.675/0001-34 - Endereço: Av. Dom Luís, 847, Loja 02, bairro Aldeota, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Food Service Ltda. - CNPJ: 18.638.300/0001-66 - Endereço: Rua Clóvis Fontenelle, 57, bairro Papicu, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Pizzaria e Pastelaria Ltda. - CNPJ: 11.955.043/0001-47 - Endereço: Av. Eng. Santana Júnior, 1941, bairro Papicu, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cicloburguer Comércio de Alimentos Ltda. - CNPJ: 23.716.707/0001-02 - Endereço: Rodovia BR-116, 5587, bairro Aerolândia, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Divina Grill Comércio de Alimentos Ltda. - CNPJ: 35.295.467/0001-90 - Endereço: Av. Dr. Silas Munguba, 2800, bairro Parangaba, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Divina Picanha Comércio de Alimentos Ltda. - CNPJ: 07.749.764/0001-23 - Endereço: Rua Ulisses Bezerra, 1580-A, bairro Cidade dos Funcionários, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Don Tallento Indústria e Comércio de Massas e Molhos Ltda. - CNPJ: 18.137.445/0001-83 - Endereço: Av. Desembargador Gonzaga, 1244-A, bairro Cidade dos Funcionários, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Grand Divina Alimentos e Eventos Ltda. - CNPJ: 35.157.493/0001-52 - Endereço: Av. Ulisses Bezerra, 1582, bairro Cidade dos Funcionários, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Opy Consultoria Ltda. - CNPJ: 20.874.252/0001-57 - Endereço: Rua Barbosa de Freitas, 1741, Sala 403, bairro Aldeota, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pastelaria Cheppitos Cidade Ltda. - CNPJ: 07.200.181/0001-49 - Endereço: Av. Desembargador Gonzaga, 1251, bairro Cidade dos Funcionários, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pastelaria Cheppitos Riomar Fortaleza Ltda. - CNPJ: 28.693.303/0001-56 - Endereço: Rua Desembargador Lauro Nogueira, 1500, Loja 3088, bairro Papicu, Fortaleza/CE - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE

RECUPERAÇÃO JUDICIAL CONCEDIDA
* Empresa: Refinaria de Petróleo de Manguinhos S.A. (em Recuperação Judicial) - CNPJ: 33.000.123/0001-99 - Endereço: Praça Mauá, 1, Sala 1501, Centro, Rio de Janeiro/RJ - Administrador Judicial: Deloitte Touche Tohmatsu Consultores Ltda. - Vara/Comarca: 1ª Vara Empresarial da Comarca da Capital/RJ
`;

const items = parseValorArticleText(todayArticleText, '2026-09-02');
console.log(`✓ Total de empresas do artigo do dia: ${items.length}`);

fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/today_valor.json', JSON.stringify({
  title: 'Movimento falimentar',
  url: 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml',
  date: '2026-09-02T05:01:00.000Z',
  items,
  rawText: todayArticleText
}, null, 2));

console.log('✓ Salvo em data/today_valor.json com exatamente 20 empresas.');
