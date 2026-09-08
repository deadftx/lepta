async function inspectDataJudRaw() {
  const apiKey = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
  const url = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search';

  const body = {
    size: 5,
    query: {
      match_all: {}
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `APIKey ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  console.log('Status match_all TJSP:', res.status);
  const data = await res.json();
  console.log('Total hits:', data?.hits?.total);
  if (data?.hits?.hits?.length > 0) {
    console.log('Sample hit classe:', data.hits.hits[0]._source?.classe);
    console.log('Sample hit dates:', {
      dataAjuizamento: data.hits.hits[0]._source?.dataAjuizamento,
      dataHoraUltimaAtualizacao: data.hits.hits[0]._source?.dataHoraUltimaAtualizacao
    });
  }

  // Now test with classe.codigo: 108 (Recuperação Judicial)
  const bodyRj = {
    size: 5,
    query: {
      term: { 'classe.codigo': 108 }
    },
    sort: [{ dataAjuizamento: 'desc' }]
  };

  const resRj = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `APIKey ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyRj)
  });

  console.log('\nStatus classe.codigo 108 TJSP:', resRj.status);
  const dataRj = await resRj.json();
  console.log('Total hits RJ:', dataRj?.hits?.total);
  if (dataRj?.hits?.hits?.length > 0) {
    for (const h of dataRj.hits.hits) {
      console.log('--- RJ Hit ---');
      console.log('Processo:', h._source?.numeroProcesso);
      console.log('Data ajuizamento:', h._source?.dataAjuizamento);
      console.log('Data última atualização:', h._source?.dataHoraUltimaAtualizacao);
      console.log('Órgão julgador:', h._source?.orgaoJulgador?.nome);
      console.log('Partes (polos):', JSON.stringify(h._source?.polos || h._source?.dadosBasicos?.polo || []));
    }
  }
}

inspectDataJudRaw();
