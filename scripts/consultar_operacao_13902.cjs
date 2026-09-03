const fs = require('fs');

let token = process.env.UNLTD_API_TOKEN || '';
if (!token && fs.existsSync('/var/www/lepta/.env')) {
  const envContent = fs.readFileSync('/var/www/lepta/.env', 'utf8');
  const match = envContent.match(/UNLTD_API_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}
if (!token && fs.existsSync('/var/www/lepta-dev/.env')) {
  const envContent = fs.readFileSync('/var/www/lepta-dev/.env', 'utf8');
  const match = envContent.match(/UNLTD_API_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error('ERRO: Token UNLTD_API_TOKEN não encontrado.');
  process.exit(1);
}

const API_BASE = 'https://lepta-backend.bit-unltd.com.br';
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `UNLTD-BackEnd ${token}`
};

async function main() {
  console.log('===============================================================');
  console.log('   DIAGNÓSTICO BITFIN API - OPERAÇÃO 13902 (SACADOS & CEPS)   ');
  console.log('===============================================================\n');

  const today = new Date().toISOString().substring(0, 10);
  const startDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  // 1. Busca operações recentes para localizar a 13902
  console.log(`🔍 [1/3] Buscando operação 13902 em /recebiveis/operacoes (${startDate} até ${today})...`);
  let targetOp = null;
  try {
    const resOps = await fetch(`${API_BASE}/recebiveis/operacoes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipoDeData: 'Cadastro',
        dataInicial: `${startDate}T00:00:00.000Z`,
        dataFinal: `${today}T23:59:59.999Z`
      })
    });
    if (resOps.ok) {
      const ops = await resOps.json();
      if (Array.isArray(ops)) {
        targetOp = ops.find(o => 
          String(o.id) === '13902' || 
          String(o.numero) === '13902' || 
          String(o.codigo) === '13902' ||
          String(o.identificador) === '13902'
        );
        console.log(`   -> Total operações no período: ${ops.length}. Operação 13902 localizada: ${targetOp ? 'SIM' : 'NÃO'}`);
      }
    }
  } catch (err) {
    console.warn('   Aviso ao buscar operacoes:', err.message);
  }

  // Se não achou na lista direta por data, tenta buscar endpoint por ID
  if (!targetOp) {
    console.log('   Tentando endpoint direto /recebiveis/operacoes/13902...');
    try {
      const resDirect = await fetch(`${API_BASE}/recebiveis/operacoes/13902`, { headers });
      if (resDirect.ok) {
        targetOp = await resDirect.json();
        console.log('   -> Operação 13902 encontrada no endpoint direto!');
      }
    } catch (_) {}
  }

  if (targetOp) {
    console.log('\n📄 DADOS DA OPERAÇÃO:');
    console.log(`   - ID: ${targetOp.id || targetOp.numero}`);
    console.log(`   - Cedente/Cliente: ${targetOp.cliente?.nome || targetOp.cedente?.nome || targetOp.contaOperacional?.cliente?.entidade?.nome || 'N/D'}`);
    console.log(`   - Documento Cedente: ${targetOp.cliente?.documento || targetOp.cedente?.documento || targetOp.contaOperacional?.cliente?.entidade?.documento || 'N/D'}`);
    console.log(`   - Unidade Administrativa: ${targetOp.unidadeAdministrativa?.nome || targetOp.contaOperacional?.unidadeAdministrativa?.alias || 'N/D'}`);
    console.log(`   - Valor Total: R$ ${Number(targetOp.valorTotal || targetOp.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   - Status / Situação: ${targetOp.situacao || targetOp.status || 'N/D'}`);
  }

  // 2. Busca títulos vinculados à operação 13902
  console.log(`\n🔍 [2/3] Buscando títulos vinculados à operação 13902 em /recebiveis/titulos...`);
  let titulosOp = [];
  try {
    const resTit = await fetch(`${API_BASE}/recebiveis/titulos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tipoDeData: 'Cadastro',
        dataInicial: `${startDate}T00:00:00.000Z`,
        dataFinal: `${today}T23:59:59.999Z`
      })
    });
    if (resTit.ok) {
      const allTit = await resTit.json();
      if (Array.isArray(allTit)) {
        titulosOp = allTit.filter(t => 
          String(t.operacao?.id) === '13902' ||
          String(t.operacaoId) === '13902' ||
          String(t.operacao?.numero) === '13902' ||
          String(t.operacao) === '13902' ||
          String(t.bordero) === '13902' ||
          String(t.idOperacao) === '13902'
        );
        console.log(`   -> Total títulos no período: ${allTit.length}`);
        console.log(`   -> Títulos vinculados à operação 13902: ${titulosOp.length}`);
      }
    }
  } catch (err) {
    console.warn('   Aviso ao buscar titulos:', err.message);
  }

  // 3. Extrai lista única de Sacados
  const sacadosMap = new Map();
  for (const t of titulosOp) {
    const doc = String(t.sacado?.entidade?.documento || t.sacado?.documento || t.sacado_cnpj || '').replace(/\D/g, '');
    const nome = (t.sacado?.entidade?.nome || t.sacado?.nome || t.sacado_nome || 'Sacado Desconhecido').trim();
    if (!doc && !nome) continue;
    const key = doc || nome;
    if (!sacadosMap.has(key)) {
      sacadosMap.set(key, {
        documento: doc,
        nome: nome,
        titulosCount: 0,
        valorTotal: 0,
        rawSacadoObj: t.sacado
      });
    }
    const item = sacadosMap.get(key);
    item.titulosCount++;
    item.valorTotal += Number(t.valorNominal || t.valor || 0);
  }

  console.log(`\n👥 [3/3] Total de Sacados Distintos na Operação: ${sacadosMap.size}`);

  // 4. Consulta detalhes cadastrais (Endereço, CEP, Telefones, E-mails) de cada Sacado
  console.log('\n🔎 Consultando dados cadastrais e CEPs de cada sacado na API /entidades/{doc}...\n');

  let invalidCepCount = 0;
  let validCepCount = 0;
  const sacadosReport = [];

  for (const [key, s] of sacadosMap.entries()) {
    let cep = 'NÃO CADASTRADO';
    let enderecoCompleto = 'Sem endereço retornado';
    let telefones = [];
    let emails = [];
    let isCepValido = false;

    if (s.documento) {
      try {
        const resEnt = await fetch(`${API_BASE}/entidades/${s.documento}`, { headers });
        if (resEnt.ok) {
          const ent = await resEnt.json();
          const entidade = Array.isArray(ent) ? (ent[0] || {}) : ent;

          // Extrai CEP e Endereço
          const end = entidade.endereco || entidade.enderecos?.[0] || {};
          const rawCep = String(end.cep || end.codigoPostal || '').replace(/\D/g, '');
          if (rawCep) {
            cep = rawCep.length === 8 ? `${rawCep.slice(0, 5)}-${rawCep.slice(5)}` : rawCep;
            isCepValido = rawCep.length === 8 && !/^0{8}$/.test(rawCep);
            enderecoCompleto = `${end.logradouro || ''}, ${end.numero || 'S/N'} ${end.complemento || ''} - ${end.bairro || ''}, ${end.localidade || end.cidade || ''}/${end.estado || end.uf || ''}`;
          }

          // Extrai Contatos Diretos
          if (entidade.telefone) telefones.push(entidade.telefone);
          if (entidade.celular) telefones.push(entidade.celular);
          if (entidade.email) emails.push(entidade.email);
          if (Array.isArray(entidade.contatos)) {
            entidade.contatos.forEach(c => {
              if (c.telefone) telefones.push(`${c.nome ? c.nome + ': ' : ''}${c.telefone}`);
              if (c.email) emails.push(`${c.nome ? c.nome + ': ' : ''}${c.email}`);
            });
          }
        }
      } catch (e) {
        console.warn(`Aviso ao buscar entidade ${s.documento}:`, e.message);
      }
    }

    if (isCepValido) validCepCount++;
    else invalidCepCount++;

    sacadosReport.push({
      nome: s.nome,
      documento: s.documento || 'Sem Documento',
      titulos: s.titulosCount,
      valorTotal: s.valorTotal,
      cep,
      isCepValido,
      endereco: enderecoCompleto,
      telefones: [...new Set(telefones)],
      emails: [...new Set(emails)]
    });
  }

  // 5. Exibe Relatório Final
  console.log('===============================================================');
  console.log('                      RELATÓRIO DE SACADOS                     ');
  console.log('===============================================================');
  console.log(`📊 TOTAL DE SACADOS: ${sacadosMap.size}`);
  console.log(`❌ SACADOS COM CEP INVÁLIDO/PENDENTE: ${invalidCepCount}`);
  console.log(`✅ SACADOS COM CEP VÁLIDO: ${validCepCount}\n`);

  sacadosReport.forEach((sr, idx) => {
    const statusIcon = sr.isCepValido ? '✅' : '❌ [CEP INVÁLIDO]';
    console.log(`${idx + 1}. ${sr.nome} (CNPJ/CPF: ${sr.documento}) ${statusIcon}`);
    console.log(`   - CEP Cadastrado: ${sr.cep}`);
    console.log(`   - Endereço: ${sr.endereco}`);
    console.log(`   - Qtd Títulos: ${sr.titulos} | Valor Total: R$ ${sr.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   - Telefones: ${sr.telefones.length ? sr.telefones.join(' | ') : 'Nenhum contato telefônico direto'}`);
    console.log(`   - E-mails: ${sr.emails.length ? sr.emails.join(' | ') : 'Nenhum e-mail direto'}`);
    console.log('---------------------------------------------------------------');
  });

  console.log('\n===============================================================');
  console.log('            CONTATO DIRETO COM A OPERAÇÃO 13902                ');
  console.log('===============================================================');
  if (targetOp) {
    console.log('📞 DADOS DO CEDENTE (CLIENTE DA OPERAÇÃO):');
    const cedDoc = targetOp.cliente?.documento || targetOp.cedente?.documento || targetOp.contaOperacional?.cliente?.entidade?.documento;
    if (cedDoc) {
      try {
        const resCed = await fetch(`${API_BASE}/entidades/${cedDoc}`, { headers });
        if (resCed.ok) {
          const ced = await resCed.json();
          const cedEnt = Array.isArray(ced) ? (ced[0] || {}) : ced;
          console.log(`   - Razão Social: ${cedEnt.nome || targetOp.cliente?.nome}`);
          console.log(`   - Telefones: ${cedEnt.telefone || cedEnt.celular || 'Não informado'}`);
          console.log(`   - E-mail: ${cedEnt.email || 'Não informado'}`);
        }
      } catch (_) {}
    }
  }
}

main().catch(err => console.error('Erro fatal:', err));
