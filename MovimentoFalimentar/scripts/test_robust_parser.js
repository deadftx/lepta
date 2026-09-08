export function parseValorArticleTextRobust(text, publicationDate, articleUrl) {
  const items = [];
  let currentClasse = 'FALÊNCIAS DECRETADAS';

  // Pré-processamento: normalizar quebras de linha
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Dividir em blocos por cabeçalhos ou marcadores de empresa
  const lines = cleanText.split('\n');
  let currentBlock = [];

  function processBlock(blockLines, classe) {
    if (blockLines.length === 0) return;
    const fullBlockText = blockLines.join(' ').replace(/\s+/g, ' ').trim();
    if (fullBlockText.length < 5) return;

    // Verificar se tem Empresa ou CNPJ
    const empresaMatch = fullBlockText.match(/(?:Empresa|Requerente|Requerida|Devedora):\s*([^–-]+?)(?:\s*[-–]\s*|\s*CNPJ:|\s*Endereço:|\s*Administrador:|\s*Vara:|$)/i);
    const cnpjMatch = fullBlockText.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) || fullBlockText.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    const enderecoMatch = fullBlockText.match(/Endereço:\s*([^–-]+?)(?:\s*[-–]\s*Administrador|\s*[-–]\s*Vara|\s*[-–]\s*Obs|\s*Administrador:|\s*Vara:|\s*Observação:|$)/i);
    const adminMatch = fullBlockText.match(/Administrador\s+Judicial:\s*([^–-]+?)(?:\s*[-–]\s*Vara|\s*[-–]\s*Obs|\s*Vara:|\s*Observação:|$)/i);
    const varaMatch = fullBlockText.match(/Vara(?:\/Comarca)?:\s*([^–-]+?)(?:\s*[-–]\s*Obs|\s*Observação:|$)/i);
    const obsMatch = fullBlockText.match(/Observa[cç][aã]o:\s*(.+)$/i);

    let empresaNome = empresaMatch ? empresaMatch[1].trim() : '';
    if (!empresaNome && blockLines[0].includes('Empresa:')) {
      const firstLine = blockLines[0].trim();
      empresaNome = firstLine.replace(/^[•\*\-\s]*Empresa:\s*/i, '').split(/[-–]|CNPJ:/i)[0].trim();
    } else if (!empresaNome && blockLines[0].startsWith('*')) {
      empresaNome = blockLines[0].replace(/^[•\*\-\s]+/, '').split(/[-–]|CNPJ:/i)[0].trim();
    }

    if (empresaNome || cnpjMatch) {
      items.push({
        empresa: empresaNome || 'Empresa Identificada no Valor Econômico',
        cnpj: cnpjMatch ? cnpjMatch[1] : null,
        endereco: enderecoMatch ? enderecoMatch[1].trim() : null,
        administradorJudicial: adminMatch ? adminMatch[1].trim() : null,
        varaComarca: varaMatch ? varaMatch[1].trim() : 'Publicado no Valor Econômico',
        classe,
        tribunal: 'VALOR',
        tribunalNome: 'Valor Econômico',
        dataAjuizamento: publicationDate || new Date().toISOString(),
        dataCaptura: new Date().toISOString(),
        fonte: 'Valor Econômico (valor.globo.com)',
        processo: `VALOR-${(publicationDate || new Date().toISOString()).slice(0, 10).replace(/[^0-9]/g, '')}-${items.length + 1}`,
        raw: {
          originalText: fullBlockText,
          articleUrl,
          observacao: obsMatch ? obsMatch[1].trim() : null
        }
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const upper = rawLine.toUpperCase();

    // Detecção de Subtítulos de Seção
    if (upper.includes('FALÊNCIAS DECRETADAS') || upper.includes('FALENCIAS DECRETADAS')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'FALÊNCIAS DECRETADAS';
      continue;
    } else if (upper.includes('PROCESSOS DE FALÊNCIA EXTINTOS') || upper.includes('PROCESSOS DE FALENCIA EXTINTOS') || upper.includes('FALÊNCIA EXTINTA')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'PROCESSOS DE FALÊNCIA EXTINTOS';
      continue;
    } else if (upper.includes('RECUPERAÇÃO JUDICIAL DEFERIDA') || upper.includes('RECUPERACAO JUDICIAL DEFERIDA') || upper.includes('PROCESSAMENTO DEFERIDO')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'RECUPERAÇÃO JUDICIAL DEFERIDA';
      continue;
    } else if (upper.includes('RECUPERAÇÃO JUDICIAL CONCEDIDA') || upper.includes('RECUPERACAO JUDICIAL CONCEDIDA')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
      continue;
    } else if (upper.includes('CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL') || upper.includes('CUMPRIMENTO DE RECUPERACAO')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
      continue;
    } else if (upper.includes('RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS') || upper.includes('RECUPERACOES EXTRAJUDICIAIS CONCEDIDAS') || upper.includes('RECUPERAÇÃO EXTRAJUDICIAL') || upper.includes('RECUPERACAO EXTRAJUDICIAL')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS';
      continue;
    } else if (upper.includes('PEDIDOS DE FALÊNCIA') || upper.includes('PEDIDOS DE FALENCIA') || upper.includes('FALÊNCIA REQUERIDA')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'PEDIDOS DE FALÊNCIA';
      continue;
    } else if (upper.includes('PEDIDOS DE RECUPERAÇÃO JUDICIAL') || upper.includes('PEDIDOS DE RECUPERACAO JUDICIAL')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'PEDIDOS DE RECUPERAÇÃO JUDICIAL';
      continue;
    } else if (upper.includes('EDITAIS DE CREDORES') || upper.includes('EDITAL DE CREDORES') || upper.includes('RELAÇÃO DE CREDORES')) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [];
      currentClasse = 'EDITAIS DE CREDORES';
      continue;
    }

    // Início de nova empresa
    const isNewCompanyStart = /^(?:[\*•\-]\s*)?(?:Empresa|Requerente|Requerida|Devedora):/i.test(rawLine) ||
                              (rawLine.startsWith('*') && (rawLine.includes('Ltda') || rawLine.includes('S.A.') || rawLine.includes('S/A') || rawLine.includes('Eireli')));

    if (isNewCompanyStart) {
      processBlock(currentBlock, currentClasse);
      currentBlock = [rawLine];
    } else {
      currentBlock.push(rawLine);
    }
  }

  processBlock(currentBlock, currentClasse);
  return items;
}

// Teste com exemplo real multi-linhas copiado do site
const samplePastedText = `
FALÊNCIAS DECRETADAS

* Empresa: CGSG Participações Empresariais Ltda.
  CNPJ: 32.878.783/0001-05
  Endereço: Quadra SAAN, Quadra 01, Lote 400, Parte A, Zona Industrial
  Administrador Judicial: Dr. Vinicius Cavalcante Ferreira
  Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF

* Empresa: Gasdiesel Serviços Ltda.
  CNPJ: 09.008.431/0001-79
  Endereço: Rua Francisco Portela, 881, Sala 01, bairro Jardim Gramacho, Duque de Caxias/RJ
  Administrador Judicial: O Próprio Administrador Judicial da Recuperação Judicial Rescindida
  Vara/Comarca: 5ª Vara Empresarial do Rio de Janeiro/RJ
  Observação: Recuperação judicial convolada em falência.

* Empresa: JMA Serviços e Portaria Ltda.
  CNPJ: 18.929.300/0001-15
  Endereço: Rua Friedrich Von Voith, 825, Galpão P6, Sala 03, bairro Parque das Nações Unidas
  Administrador Judicial: Gatekeeper Administração Judicial Ltda.
  Vara/Comarca: 1ª Vara de Falências e Recuperações Judiciais de São Paulo/SP

RECUPERAÇÃO JUDICIAL DEFERIDA

* Empresa: Cheppitos Comércio de Alimentos Ltda.
  CNPJ: 29.123.167/0001-21
  Endereço: Av. Washington Soares, 85, Loja 151, bairro Edson Queiroz, Fortaleza/CE
  Administrador Judicial: Dr. Marcelo Cals
  Vara/Comarca: 1ª Vara Empresarial de Fortaleza/CE
`;

const res = parseValorArticleTextRobust(samplePastedText, '2026-09-02');
console.log('Total empresas parseadas no teste robusto:', res.length);
res.forEach((r, i) => console.log(`${i+1}. [${r.classe}] ${r.empresa} (${r.cnpj}) - ${r.varaComarca}`));
