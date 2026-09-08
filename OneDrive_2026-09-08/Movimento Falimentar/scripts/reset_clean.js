import Database from 'better-sqlite3';
import path from 'node:path';

function resetAndCleanDb() {
  const db = new Database(path.resolve('data/movimento.db'));
  
  // 1. Apagar itens que vieram de buscas de sugestão genéricas
  const delSuggestions = db.prepare(`
    DELETE FROM rj_events 
    WHERE fonte LIKE '%RGF%' 
      AND (vara_comarca = 'Recuperação Judicial Verificada (RGF)' OR raw_json LIKE '%★%')
  `).run();
  console.log('Removidos registros de sugestões genéricas:', delSuggestions.changes);

  // 2. Apagar empresas conhecidas que tenham Status RJ = Não
  const nonRjCompanies = [
    'RODOSUL AGRONEGOCIOS LTDA',
    'COBAP COMERCIO E BENEFICIAMENTO DE ARTEFATOS DE PAPEL S/A',
    'VILANOVA AGRICOLA LTDA',
    'GRAN TORINO AUTO CENTER LTDA',
    'KZE COMERCIO DE MATERIAL DE CONSTRUCAO LTDA',
    'CAMBUI MATERIAIS PARA CONSTRUCAO LTDA',
    'TINTO HOLDING LTDA'
  ];

  for (const name of nonRjCompanies) {
    const res = db.prepare('DELETE FROM rj_events WHERE UPPER(empresa) = ?').run(name.toUpperCase());
    if (res.changes > 0) {
      console.log(`Removido especificamente: ${name}`);
    }
  }

  const remaining = db.prepare('SELECT count(*) as count FROM rj_events').get();
  console.log('Total restante no banco:', remaining.count);
}

resetAndCleanDb();
