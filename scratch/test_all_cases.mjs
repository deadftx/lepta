import Database from 'better-sqlite3';
import { getNplClients, getNplSummary } from '../server/internal/modules/intelligence/npl/nplService.js';

const db = new Database('./database.sqlite');

console.log('=== TESTE: VISÃO TOTAL DE CASOS (TUDO NA BASE_NPL) ===');

const summaryTotal = getNplSummary(db, { view: 'pipeline' });
console.log('Summary Total:', summaryTotal);

const clientsTotal = getNplClients(db, { view: 'pipeline' });
console.log(`Clientes retornados no Total de Casos: ${clientsTotal.length}`);
console.log('Exemplos de cedentes no Total de Casos:', clientsTotal.slice(0, 5).map(c => ({
  cedente: c.cedente,
  casos: c.totalCasos,
  valorConsiderado: c.totalValorConsiderado,
  estados: c.estados
})));
