import Database from 'better-sqlite3';
import path from 'node:path';

const RGF_BASE_URL = 'https://rgfanalytics.com';
const RGF_LOGIN_URL = `${RGF_BASE_URL}/login/submit`;
const RGF_COMPANY_DETAILS_URL = `${RGF_BASE_URL}/ajax/company/details`;

const DEFAULT_EMAIL = 'luan.alvarez@lepta.com.br';
const DEFAULT_PASSWORD = 'Rgfanalytics@26';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const db = new Database(path.resolve('data/movimento.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS rgf_status_cache (
    cnpj TEXT PRIMARY KEY,
    esta_em_rj TEXT NOT NULL,
    checked_at TEXT NOT NULL
  );`);

  console.log('Autenticando na RGF Analytics...');
  const loginRes = await fetch(RGF_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6'
    },
    body: JSON.stringify({
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD
    })
  });

  if (!loginRes.ok) {
    console.error(`Login falhou: HTTP ${loginRes.status}`);
    return;
  }

  const loginData = await loginRes.json();
  const cookie = loginRes.headers.get('set-cookie');
  console.log('✓ Login RGF bem-sucedido!');

  const rows = db.prepare('SELECT id, empresa, cnpj FROM rj_events').all();
  console.log('Total registros no banco antes da limpeza:', rows.length);

  const cnpjToIds = new Map();
  for (const r of rows) {
    if (r.cnpj) {
      const clean = r.cnpj.replace(/\D/g, '');
      if (clean.length === 14) {
        if (!cnpjToIds.has(clean)) cnpjToIds.set(clean, []);
        cnpjToIds.get(clean).push({ id: r.id, empresa: r.empresa, cnpj: r.cnpj });
      }
    }
  }

  const uniqueCnpjs = Array.from(cnpjToIds.keys());
  console.log(`Verificando ${uniqueCnpjs.length} CNPJs únicos contra a RGF Analytics...`);

  let purgedCount = 0;
  let verifiedCount = 0;

  for (const cnpj of uniqueCnpjs) {
    // Checar cache primeiro
    const cached = db.prepare('SELECT esta_em_rj FROM rgf_status_cache WHERE cnpj = ?').get(cnpj);
    let estaEmRj = cached?.esta_em_rj;

    if (!estaEmRj) {
      try {
        const res = await fetch(`${RGF_COMPANY_DETAILS_URL}/${cnpj}`, {
          headers: {
            Cookie: cookie,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MovimentoFalimentar/1.6'
          }
        });
        if (res.ok) {
          const data = await res.json();
          estaEmRj = data?.ESTA_EM_RJ === 'Sim' ? 'Sim' : (data?.ESTA_EM_RJ === 'Não' ? 'Não' : 'Desconhecido');
          db.prepare('INSERT OR REPLACE INTO rgf_status_cache (cnpj, esta_em_rj, checked_at) VALUES (?, ?, ?)').run(cnpj, estaEmRj, new Date().toISOString());
        }
      } catch (e) {
        console.error('Erro CNPJ', cnpj, e.message);
      }
      await sleep(50);
    }

    if (estaEmRj === 'Não') {
      const items = cnpjToIds.get(cnpj);
      for (const it of items) {
        console.log(`[REMOVIDO] Status RJ = Não: ${it.empresa} (${it.cnpj})`);
        db.prepare('DELETE FROM rj_events WHERE id = ?').run(it.id);
        purgedCount++;
      }
    }

    verifiedCount++;
    if (verifiedCount % 25 === 0) {
      console.log(` -> Progresso: ${verifiedCount}/${uniqueCnpjs.length} checados...`);
    }
  }

  const remaining = db.prepare('SELECT count(*) as count FROM rj_events').get();
  console.log(`\n✓ Limpeza finalizada com sucesso!`);
  console.log(`Removidos (Status RJ: Não): ${purgedCount}`);
  console.log(`Restantes confirmados no banco: ${remaining.count}`);
}

run();
