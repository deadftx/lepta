const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });

console.log("=== INDICES ===");
const idxs = db.prepare("SELECT tbl_name, name, sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
console.log(idxs);

console.log("\n=== COMPARAÇÃO cedentes vs fidc_cedentes ===");
console.log("cedentes cols:", db.prepare("PRAGMA table_info(cedentes)").all().map(c => c.name));
console.log("fidc_cedentes cols:", db.prepare("PRAGMA table_info(fidc_cedentes)").all().map(c => c.name));

console.log("\n=== COMPARAÇÃO cedentes_cnpjs vs fidc_cedentes_cnpjs ===");
console.log("cedentes_cnpjs cols:", db.prepare("PRAGMA table_info(cedentes_cnpjs)").all().map(c => c.name));
console.log("fidc_cedentes_cnpjs cols:", db.prepare("PRAGMA table_info(fidc_cedentes_cnpjs)").all().map(c => c.name));

console.log("\n=== ESTOQUE_TITULOS ===");
console.log("estoque_titulos cols:", db.prepare("PRAGMA table_info(estoque_titulos)").all().map(c => c.name));

db.close();
