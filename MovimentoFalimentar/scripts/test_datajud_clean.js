async function testDataJudCleanQuery() {
  const apiKey = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
  const url = 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search';

  const body = {
    size: 20,
    query: {
      bool: {
        must: [
          { terms: { 'classe.codigo': [108, 111, 115, 128, 12055, 12056, 12192, 12217] } }
        ]
      }
    },
    sort: [{ dataHoraUltimaAtualizacao: 'desc' }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `APIKey ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  console.log('Status:', res.status);
  const data = await res.json();
  const hits = data?.hits?.hits || [];
  console.log('Total hits retornados:', hits.length);
  for (const h of hits.slice(0, 5)) {
    console.log('Processo:', h._source?.numeroProcesso);
    console.log('Classe:', h._source?.classe?.nome);
    console.log('Data última atualização:', h._source?.dataHoraUltimaAtualizacao);
    console.log('Órgão:', h._source?.orgaoJulgador?.nome);
  }
}

testDataJudCleanQuery();
