import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

const rows = db.prepare(`
  SELECT id, tipo_registro, cedente, cedente_cnpj, credores_de_interesse, estado, processo
  FROM BASE_NPL
`).all();

console.log(`Total de linhas em BASE_NPL: ${rows.length}`);

const emptyCedente = rows.filter(r => !r.cedente || r.cedente.trim() === '');
console.log(`Linhas com cedente vazio: ${emptyCedente.length}`);

// Ver se há linhas onde cedente é um estado ou lista de estados
const stateNames = ['ACRE', 'ALAGOAS', 'AMAZONAS', 'BAHIA', 'CEARÁ', 'DISTRITO FEDERAL', 'ESPÍRITO SANTO', 'GOIÁS', 'GOIAS', 'MARANHÃO', 'MATO GROSSO', 'MATO GROSSO DO SUL', 'MINAS GERAIS', 'PARÁ', 'PARAÍBA', 'PARANÁ', 'PERNAMBUCO', 'PIAUÍ', 'RIO DE JANEIRO', 'RIO GRANDE DO NORTE', 'RIO GRANDE DO SUL', 'RONDÔNIA', 'RORAIMA', 'SANTA CATARINA', 'SÃO PAULO', 'SERGIPE', 'TOCANTINS'];

const stateAsCedente = rows.filter(r => {
  const cUpper = (r.cedente || '').toUpperCase().trim();
  return stateNames.some(s => cUpper === s || cUpper.includes(s));
});

console.log(`\nLinhas onde o cedente parece ser estado (${stateAsCedente.length}):`);
stateAsCedente.forEach(r => {
  console.log(`[ID ${r.id}] tipo: ${r.tipo_registro} | cedente: "${r.cedente}" | credor: "${r.credores_de_interesse}" | estado: "${r.estado}" | processo: "${r.processo}"`);
});
