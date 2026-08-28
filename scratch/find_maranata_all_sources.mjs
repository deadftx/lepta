import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== BUSCA PROFUNDA DE MARANATA E TODOS OS 17 CEDENTES RESTANTES ===\n');

const remaining17 = [
  { cnpj: '25.156.476/0001-47', nome: 'COUDELARIA VS LTDA', raiz: '25156476' },
  { cnpj: '02.940.452/0001-89', nome: 'DRAY INDUSTRIA E COMERCIO LTDA EM RECUPERACAO JUDI', raiz: '02940452' },
  { cnpj: '434.245.381-91', nome: 'FERNANDO ANTÔNIO ALVES PRUDENTE', raiz: '43424538' },
  { cnpj: '08.725.249/0001-76', nome: 'FRIGOFAR INDUSTRIA DE ALIMENTOS LTDA EM RECUPERACA', raiz: '08725249' },
  { cnpj: '00.146.889/0001-10', nome: 'GOCIL SERVICOS GERAIS LTDA EM RECUPERACAO JUDICIAL', raiz: '00146889' },
  { cnpj: '90.952.052/0001-50', nome: 'HIDRO JET EQUIPAMENTOS', raiz: '90952052' },
  { cnpj: '37.943.945/0001-57', nome: 'IESE - INSTITUTO DE ENSINO EM SAUDE E ESPECIALIZAC', raiz: '37943945' },
  { cnpj: '07.991.107/0001-98', nome: 'MARANATA INDUSTRIA E COMERCIO DE SAL LTDA', raiz: '07991107' },
  { cnpj: '07.851.963/0004-90', nome: 'MARANATA SALINEIRA DO BRASIL LTDA', raiz: '07851963' },
  { cnpj: '93.899.359/0001-23', nome: 'METALÚRGICA VENÂNCIO LTDA', raiz: '93899359' },
  { cnpj: '07.387.064/0001-36', nome: 'MINERADORA VALE DO PAJEU LTDA', raiz: '07387064' },
  { cnpj: '61.091.963/0001-32', nome: 'MOVENT AUTOMOTIVE INDÚSTRIA E COMÉRCIO DE AUTOPEÇA', raiz: '61091963' },
  { cnpj: '04.367.119/0001-58', nome: 'POLO CONSTRUCAO & INCORPORACAO LTDA', raiz: '04367119' },
  { cnpj: '700.603.021-86', nome: 'Rafaela Martins Prudente', raiz: '70060302' },
  { cnpj: '43.769.379/0001-01', nome: 'SOLIDA INDUSTRIA PLASTICA S/A', raiz: '43769379' },
  { cnpj: '16.884.335/0001-50', nome: 'TUDO BELO ESTETICA LTDA', raiz: '16884335' },
  { cnpj: '29.571.169/0001-83', nome: 'VOLPI TABACOS', raiz: '29571169' }
];

// Testar cada um nas tabelas locais
const tables = ['estoque_titulos', 'carteira_dc', 'BASE_NPL', 'CEDENTES', 'CEDENTES_CNPJS', 'FIDC_CEDENTES', 'FIDC_CEDENTES_CNPJS'];

for (const c of remaining17) {
  const cleanDoc = c.cnpj.replace(/\D/g, '');
  const raiz = c.raiz;
  const keyword = c.nome.split(' ')[0].toLowerCase();

  let found = false;

  // Busca em estoque_titulos (por cnpj ou nome)
  try {
    const row = db.prepare(`
      SELECT cedente_nome, cedente_cnpj 
      FROM estoque_titulos 
      WHERE cedente_cnpj LIKE ? OR LOWER(cedente_nome) LIKE ? 
      LIMIT 1
    `).get(`%${raiz}%`, `%${keyword}%`);

    if (row) {
      console.log(`[✓ ACHOU EM ESTOQUE_TITULOS!] ${c.nome} (CNPJ: ${c.cnpj}) ➔ ${row.cedente_nome} (CNPJ: ${row.cedente_cnpj})`);
      found = true;
    }
  } catch (e) {}

  // Busca em carteira_dc
  try {
    const row = db.prepare(`
      SELECT * 
      FROM carteira_dc 
      WHERE LOWER(cedente) LIKE ? 
      LIMIT 1
    `).get(`%${keyword}%`);

    if (row) {
      console.log(`[✓ ACHOU EM CARTEIRA_DC!] ${c.nome} ➔ ${row.cedente}`);
      found = true;
    }
  } catch (e) {}

  if (!found) {
    console.log(`[PENDENTE] ${c.nome} (${c.cnpj}) -> Não indexado no SQLite local`);
  }
}
