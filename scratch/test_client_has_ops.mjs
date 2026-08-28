import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

function normalizeEntityDocument(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function checkClientHasOperations(document, nome) {
  try {
    const docClean = normalizeEntityDocument(document);
    const termNome = (nome || '').trim().toLowerCase();

    // 1. Check BASE_NOVA
    try {
      const rowNova = db.prepare(`
        SELECT 1 FROM BASE_NOVA 
        WHERE (
          (DOCUMENTO IS NOT NULL AND (DOCUMENTO = ? OR REPLACE(REPLACE(REPLACE(DOCUMENTO, '.', ''), '/', ''), '-', '') = ?))
          OR (CLIENTE IS NOT NULL AND LENGTH(?) >= 3 AND LOWER(CLIENTE) LIKE ?)
        )
        LIMIT 1
      `).get(document, docClean, termNome, `%${termNome}%`);
      if (rowNova) return true;
    } catch (e) {}

    // 2. Check BASE_SMARTFACTOR
    try {
      const rowSf = db.prepare(`
        SELECT 1 FROM BASE_SMARTFACTOR 
        WHERE (
          (DOCUMENTO IS NOT NULL AND (DOCUMENTO = ? OR REPLACE(REPLACE(REPLACE(DOCUMENTO, '.', ''), '/', ''), '-', '') = ?))
          OR (CLIENTE IS NOT NULL AND LENGTH(?) >= 3 AND LOWER(CLIENTE) LIKE ?)
        )
        LIMIT 1
      `).get(document, docClean, termNome, `%${termNome}%`);
      if (rowSf) return true;
    } catch (e) {}

    return false;
  } catch {
    return false;
  }
}

console.log('--- Teste de Clientes ---');
console.log('Bom de Gosto (08.089.064/0001-12):', checkClientHasOperations('08.089.064/0001-12', 'Bom de Gosto'));
console.log('Ausus (17.382.490/0001-20):', checkClientHasOperations('17.382.490/0001-20', 'Ausus'));
console.log('Cliente Fictício sem operações (00.000.000/0001-00):', checkClientHasOperations('00.000.000/0001-00', 'Empresa Teste'));
