import Database from 'better-sqlite3';

const db = new Database('database.sqlite', { readonly: true });
const cols = db.prepare("PRAGMA table_info(estoque_titulos)").all();
console.log('COLUNAS DE estoque_titulos:');
console.log(cols.map(c => c.name).join(', '));

const sample = db.prepare("SELECT * FROM estoque_titulos ORDER BY id DESC LIMIT 2").all();
console.log('\nEXEMPLO DE REGISTRO EM estoque_titulos:');
console.log(JSON.stringify(sample, null, 2));

// Busca títulos de 26/08/2026 em estoque_titulos
const t2608 = db.prepare("SELECT count(*) as c, sum(valor_nominal) as sum_nom, sum(valor_liquido) as sum_liq FROM estoque_titulos WHERE data_cadastro LIKE '%2026-08-26%' OR data_cadastro LIKE '%26/08/2026%'").get();
console.log('\nTítulos de 26/08/2026 em estoque_titulos:', t2608);
