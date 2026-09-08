export function parseValorArticleText(text, publicationDate, articleUrl) {
  const items = [];
  
  // As categorias do Valor Econômico geralmente aparecem em caixa alta:
  // FALÊNCIAS DECRETADAS, PROCESSOS DE FALÊNCIA EXTINTOS, RECUPERAÇÃO JUDICIAL DEFERIDA, RECUPERAÇÃO JUDICIAL CONCEDIDA, PEDIDOS DE FALÊNCIA, PEDIDOS DE RECUPERAÇÃO JUDICIAL, etc.
  let currentClasse = 'Falência Decretada';
  
  // Dividir por parágrafos ou quebras de linha
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const upper = line.toUpperCase();
    
    // Identificação de cabeçalhos de classe
    if (upper.includes('FALÊNCIAS DECRETADAS') || upper.includes('FALENCIAS DECRETADAS')) {
      currentClasse = 'Falência Decretada';
      continue;
    } else if (upper.includes('PROCESSOS DE FALÊNCIA EXTINTOS') || upper.includes('PROCESSOS DE FALENCIA EXTINTOS') || upper.includes('FALÊNCIA EXTINTA')) {
      currentClasse = 'Processos de Falência Extintos';
      continue;
    } else if (upper.includes('RECUPERAÇÃO JUDICIAL DEFERIDA') || upper.includes('RECUPERACAO JUDICIAL DEFERIDA') || upper.includes('PROCESSAMENTO DEFERIDO')) {
      currentClasse = 'Recuperação Judicial Deferida';
      continue;
    } else if (upper.includes('RECUPERAÇÃO JUDICIAL CONCEDIDA') || upper.includes('RECUPERACAO JUDICIAL CONCEDIDA')) {
      currentClasse = 'Recuperação Judicial Concedida';
      continue;
    } else if (upper.includes('PEDIDOS DE FALÊNCIA') || upper.includes('PEDIDOS DE FALENCIA') || upper.includes('FALÊNCIA REQUERIDA')) {
      currentClasse = 'Requerimentos de Falência';
      continue;
    } else if (upper.includes('PEDIDOS DE RECUPERAÇÃO JUDICIAL') || upper.includes('PEDIDOS DE RECUPERACAO JUDICIAL')) {
      currentClasse = 'Pedidos de Recuperação Judicial';
      continue;
    } else if (upper.includes('RECUPERAÇÃO EXTRAJUDICIAL') || upper.includes('RECUPERACAO EXTRAJUDICIAL')) {
      currentClasse = 'Recuperação Extrajudicial';
      continue;
    } else if (upper.includes('EDITAIS DE CREDORES') || upper.includes('EDITAL DE CREDORES') || upper.includes('RELAÇÃO DE CREDORES')) {
      currentClasse = 'Editais de Credores';
      continue;
    }

    // Identificação de blocos de empresa
    // Padrão 1: "Empresa: ... - CNPJ: ... - Endereço: ... - Administrador Judicial: ... - Vara/Comarca: ..."
    // Padrão 2: "* Empresa: ... \n CNPJ: ..."
    if (line.includes('Empresa:') || line.includes('CNPJ:') || /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(line)) {
      const empresaMatch = line.match(/(?:Empresa|Requerente|Requerida|Devedora):\s*([^–-]+?)(?:\s*[-–]\s*|\s*CNPJ:|\s*Endereço:|$)/i);
      const cnpjMatch = line.match(/CNPJ:\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i) || line.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      const enderecoMatch = line.match(/Endereço:\s*([^–-]+?)(?:\s*[-–]\s*Administrador|\s*[-–]\s*Vara|\s*[-–]\s*Obs|$)/i);
      const adminMatch = line.match(/Administrador\s+Judicial:\s*([^–-]+?)(?:\s*[-–]\s*Vara|\s*[-–]\s*Obs|$)/i);
      const varaMatch = line.match(/Vara(?:\/Comarca)?:\s*([^–-]+?)(?:\s*[-–]\s*Obs|$)/i);
      const obsMatch = line.match(/Observa[cç][aã]o:\s*(.+)$/i);

      let empresaNome = empresaMatch ? empresaMatch[1].trim() : '';
      if (!empresaNome && line.startsWith('* Empresa:')) {
        empresaNome = line.replace(/^\*\s*Empresa:\s*/, '').split('-')[0].trim();
      }

      if (empresaNome || cnpjMatch) {
        items.push({
          empresa: empresaNome || 'Empresa Identificada no Valor Econômico',
          cnpj: cnpjMatch ? cnpjMatch[1] : null,
          endereco: enderecoMatch ? enderecoMatch[1].trim() : null,
          administradorJudicial: adminMatch ? adminMatch[1].trim() : null,
          varaComarca: varaMatch ? varaMatch[1].trim() : 'Publicado no Valor Econômico',
          observacao: obsMatch ? obsMatch[1].trim() : null,
          classe: currentClasse,
          dataAjuizamento: publicationDate || new Date().toISOString(),
          dataCaptura: new Date().toISOString(),
          fonte: 'Valor Econômico (valor.globo.com)',
          processo: `VALOR-${publicationDate ? publicationDate.slice(0, 10).replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items.length + 1}`,
          raw: { originalText: line, articleUrl }
        });
      }
    }
  }

  return items;
}

const sampleText = `
FALÊNCIAS DECRETADAS

Empresa: CGSG Participações Empresariais Ltda. - CNPJ: 32.878.783/0001-05 - Endereço: Quadra SAAN, Quadra 01, Lote 400, Parte A, Zona Industrial - Administrador Judicial: Dr. Vinicius Cavalcante Ferreira - Vara/Comarca: Vara de Falências e Recuperações Judiciais do Distrito Federal, Brasília/DF

Empresa: Gasdiesel Serviços Ltda. - CNPJ: 09.008.431/0001-79 - Endereço: Rua Francisco Portela, 881, Sala 01, bairro Jardim Gramacho, Duque de Caxias/RJ - Administrador Judicial: O Próprio Administrador Judicial da Recuperação Judicial Rescindida - Vara/Comarca: 5ª Vara Empresarial do Rio de Janeiro/RJ - Observação: Recuperação judicial convolada em falência.

RECUPERAÇÃO JUDICIAL DEFERIDA

Empresa: Magdala & Santos Ltda. - CNPJ: 07.990.780/0001-03 - Endereço: Av. Xinguara, 100 - Administrador Judicial: AJ Capital - Vara/Comarca: 2ª Vara Cível de Xinguara/PA
`;

const parsed = parseValorArticleText(sampleText, '2026-09-01T08:00:00Z', 'https://valor.globo.com');
console.log('Parsed items sample:');
console.log(JSON.stringify(parsed, null, 2));
