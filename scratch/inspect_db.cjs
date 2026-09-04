const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });
const rows = db.prepare("SELECT nome, cnpj_raiz, contas_operacionais_json FROM cedentes WHERE nome LIKE '%NAVARRO%' OR cnpj_raiz = '24415230'").all();
console.log('Navarro rows:', rows);

