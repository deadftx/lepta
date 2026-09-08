import Database from 'better-sqlite3';
import path from 'node:path';

function fixClasses() {
  const db = new Database(path.resolve('data/movimento.db'));
  const res1 = db.prepare("UPDATE rj_events SET classe = 'Recuperação Judicial Deferida' WHERE fonte LIKE '%TJCE%' AND processo LIKE '%3001626%'").run();
  console.log('Cheppitos atualizado para Recuperação Judicial Deferida:', res1.changes);

  const res2 = db.prepare("UPDATE rj_events SET classe = 'Recuperação Judicial Deferida' WHERE UPPER(empresa) LIKE '%MAGDALA%'").run();
  console.log('Magdala atualizado para Recuperação Judicial Deferida:', res2.changes);
}

fixClasses();
