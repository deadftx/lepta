function isSectionHeader(line) {
  const norm = line
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase().trim();

  // Não é cabeçalho se contiver marcadores de dados, pontuação de frase ou for longo
  if (norm.includes('EMPRESA:') || norm.includes('CNPJ:') || norm.includes('ENDERECO:') || 
      norm.includes('ADMINISTRADOR') || norm.includes('VARA') || norm.includes('COMARCA:') || 
      norm.includes('OBSERVACAO:') || norm.includes('OBS:') || norm.includes('REQUERENTE:') ||
      norm.includes('DEVEDOR') || norm.includes('PROCESSO Nº') || norm.includes('PROCESSO N.') ||
      norm.includes('DESISTENCIA') || norm.includes('CONFORME') || norm.includes('TERMOS') ||
      norm.length > 60) {
    return null;
  }

  // Subtítulos Oficiais exatos
  if (norm.includes('CUMPRIMENTO') && (norm.includes('RECUPERAC') || norm.includes('PLANO'))) {
    return 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
  }
  if (norm.includes('EXTRAJUDICIAL') || norm.includes('EXTRAJUDICIAIS')) {
    return 'RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS';
  }
  if (norm.includes('PEDIDO') && (norm.includes('RECUPERAC') || norm.includes('RJ'))) {
    return 'PEDIDOS DE RECUPERAÇÃO JUDICIAL';
  }
  if (norm.includes('PEDIDO') && (norm.includes('FALENC') || norm.includes('AUTOFALENC'))) {
    return 'PEDIDOS DE FALÊNCIA';
  }
  if (/^(?:[-–•*#\s]*)(?:PROCESSO[S]?\s+DE\s+FALENCIA\s+EXTINTO[S]?|FALENCIA[S]?\s+EXTINTA[S]?)/.test(norm)) {
    return 'PROCESSOS DE FALÊNCIA EXTINTOS';
  }
  if (/^(?:[-–•*#\s]*)(?:FALENCIA[S]?\s+DECRETADA[S]?|DECRETO\s+DE\s+FALENCIA)/.test(norm)) {
    return 'FALÊNCIAS DECRETADAS';
  }
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+DEFERIDA[S]?|PROCESSAMENTO\s+DEFERIDO)/.test(norm) ||
      (norm.includes('RECUPERAC') && norm.includes('DEFERID') && !norm.includes('CUMPRIMENTO'))) {
    return 'RECUPERAÇÃO JUDICIAL DEFERIDA';
  }
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+CONCEDIDA[S]?|RECUPERAC[AO|OES]+\s+CONCEDIDA[S]?|HOMOLOGAC[AO|OES]+\s+DE\s+RECUPERAC)/.test(norm) ||
      (norm.includes('RECUPERAC') && (norm.includes('CONCEDID') || norm.includes('HOMOLOGAD')) && !norm.includes('CUMPRIMENTO'))) {
    return 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
  }
  if (/^(?:[-–•*#\s]*)(?:EDITAI[S]?\s+DE\s+CREDORES|RELAC[AO|OES]+\s+DE\s+CREDORES)/.test(norm)) {
    return 'EDITAIS DE CREDORES';
  }

  return null;
}

console.log('1. RECUPERAÇÕES JUDICIAIS CONCEDIDAS:', isSectionHeader('RECUPERAÇÕES JUDICIAIS CONCEDIDAS'));
console.log('2. RECUPERAÇÃO JUDICIAL CONCEDIDA:', isSectionHeader('RECUPERAÇÃO JUDICIAL CONCEDIDA'));
console.log('3. EDITAIS DE CREDORES:', isSectionHeader('EDITAIS DE CREDORES'));
console.log('4. Frase sobre credor na observação:', isSectionHeader('Observação: Processo extinto sem resolução por desistência do credor.'));
console.log('5. CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL:', isSectionHeader('CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL'));
