async function testImportEndpoint() {
  const sampleArticleText = `
FALÊNCIAS DECRETADAS
* Empresa: Ativos Engenharia Ltda. - CNPJ: 23.348.649/0001-01 - Endereço: Trecho SIA,Trecho 01, Lotes 630 a 780, Bloco 3 B, Sala 424, Zona Industrial, Guará - Administrador Judicial: Dr. André Corrêa Teles - Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF

* Empresa: CGSG Participações Empresariais Ltda. - CNPJ: 32.878.783/0001-05 - Endereço: Quadra SAAN, Quadra 01, Lote 400 - Administrador Judicial: Dr. Vinicius Cavalcante Ferreira - Vara/Comarca: Vara de Falências do DF

RECUPERAÇÃO JUDICIAL DEFERIDA
* Empresa: Cheppitos 13 de Maio Ltda. - CNPJ: 49.969.817/0001-61 - Endereço: Av. 13 de Maio, 875 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Benfica Ltda. - CNPJ: 29.165.751/0001-40 - Endereço: Rua Carapinima, 2200 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Comércio de Alimentos Ltda. - CNPJ: 29.123.167/0001-21 - Endereço: Av. Washington Soares, 85 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Dom Luís Ltda. - CNPJ: 13.763.675/0001-34 - Endereço: Av. Dom Luís, 847 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Food Service Ltda. - CNPJ: 18.638.300/0001-66 - Endereço: Rua Clóvis Fontenelle, 57 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cheppitos Pizzaria e Pastelaria Ltda. - CNPJ: 11.955.043/0001-47 - Endereço: Av. Eng. Santana Júnior, 1941 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Cicloburguer Comércio de Alimentos Ltda. - CNPJ: 23.716.707/0001-02 - Endereço: Rodovia BR-116, 5587 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Divina Grill Comércio de Alimentos Ltda. - CNPJ: 35.295.467/0001-90 - Endereço: Av. Dr. Silas Munguba, 2800 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Divina Picanha Comércio de Alimentos Ltda. - CNPJ: 07.749.764/0001-23 - Endereço: Rua Ulisses Bezerra, 1580-A - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Don Tallento Indústria e Comércio Ltda. - CNPJ: 18.137.445/0001-83 - Endereço: Av. Desembargador Gonzaga, 1244-A - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Grand Divina Alimentos e Eventos Ltda. - CNPJ: 35.157.493/0001-52 - Endereço: Av. Ulisses Bezerra, 1582 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Opy Consultoria Ltda. - CNPJ: 20.874.252/0001-57 - Endereço: Rua Barbosa de Freitas, 1741 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pastelaria Cheppitos Cidade Ltda. - CNPJ: 07.200.181/0001-49 - Endereço: Av. Desembargador Gonzaga, 1251 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pastelaria Cheppitos Riomar Fortaleza Ltda. - CNPJ: 28.693.303/0001-56 - Endereço: Rua Desembargador Lauro Nogueira, 1500 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pastelaria Cheppitos Riomar Ltda. - CNPJ: 26.355.124/0001-83 - Endereço: Av. Sargento Hermínio Sampaio, 3100 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pizzaria e Academia Esportiva Ltda. - CNPJ: 24.343.917/0001-57 - Endereço: Av. Oliveira Paiva, 750 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: Pizzaria e Pastelaria Cheppitos Ltda. - CNPJ: 21.260.637/0001-97 - Endereço: Av. Carlos Jereissati, 100 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
* Empresa: SC Serviços Ltda. - CNPJ: 20.433.078/0001-07 - Endereço: Rua Precabura, 1110 - Administrador Judicial: Dr. Marcelo Cals - Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
`;

  console.log('Enviando texto de teste para POST /api/import-valor...');
  const res = await fetch('http://localhost:3333/api/import-valor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sampleArticleText, date: '02/09/2026' })
  });

  console.log('Status HTTP:', res.status);
  const data = await res.json();
  console.log('Resposta:', data);
}

testImportEndpoint();
