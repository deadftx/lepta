import Database from 'better-sqlite3';
import { getNplClients } from '../server/internal/modules/intelligence/npl/nplService.js';

const db = new Database('./database.sqlite');

console.log('=== TESTE GET_NPL_CLIENTS (FECHADOS) ===');
const fechados = getNplClients(db, { view: 'fechados' });
console.log(`Retornados ${fechados.length} cedentes fechados`);
fechados.forEach(c => {
  if (c.totalCasos > 1) {
    console.log(`[FECHADO] "${c.cedente}" | Casos: ${c.totalCasos} | Estados: [${c.estados.join(', ')}]`);
  }
});

console.log('\n=== TESTE GET_NPL_CLIENTS (PIPELINE) ===');
const pipeline = getNplClients(db, { view: 'pipeline' });
console.log(`Retornados ${pipeline.length} cedentes pipeline`);
pipeline.forEach(c => {
  if (c.totalCasos > 1 || c.estados.length > 1) {
    console.log(`[PIPELINE] "${c.cedente}" | Casos: ${c.totalCasos} | Estados: [${c.estados.join(', ')}]`);
  }
});
