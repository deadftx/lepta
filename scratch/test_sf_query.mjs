import Database from 'better-sqlite3';
import { searchSmartFactorTitles, getSmartFactorCedentes } from '../server/internal/modules/intelligence/smartfactor/smartFactorService.js';

const db = new Database('./database.sqlite');

console.log('=== TESTE DE CONSULTAS NA BASE_SMARTFACTOR ===\n');

// 1. Teste de Cedentes
const cedentes = getSmartFactorCedentes(db);
console.log(`Cedentes retornados: ${cedentes.length}`);
if (cedentes.length > 0) {
  console.log('Exemplos de cedentes:', cedentes.slice(0, 3));
}

// 2. Teste sem filtro
console.log('\n--- Teste Sem Filtro ---');
const resEmpty = searchSmartFactorTitles(db, {});
console.log(`KPIs totalTitulos: ${resEmpty.kpis.totalTitulos}`);
console.log(`KPIs totalValorNominal: R$ ${resEmpty.kpis.totalValorNominal.toLocaleString('pt-BR')}`);
console.log(`Titulos retornados no array: ${resEmpty.titles.length}`);

// 3. Teste com Cedente
console.log('\n--- Teste com Cedente (CONCREBETON) ---');
const resCed = searchSmartFactorTitles(db, { cedente: 'CONCREBETON' });
console.log(`Encontrados: ${resCed.titles.length} títulos (Total: ${resCed.kpis.totalTitulos})`);

// 4. Teste com Datas
console.log('\n--- Teste com Data Op 2024-01-01 a 2024-12-31 ---');
const resDates = searchSmartFactorTitles(db, { dataOpDe: '2024-01-01', dataOpAte: '2024-12-31' });
console.log(`Encontrados: ${resDates.titles.length} títulos (Total: ${resDates.kpis.totalTitulos})`);

// 5. Teste com Vencimento 2024-01-01 a 2024-12-31
console.log('\n--- Teste com Vencimento 2024-01-01 a 2024-12-31 ---');
const resVenc = searchSmartFactorTitles(db, { vencDe: '2024-01-01', vencAte: '2024-12-31' });
console.log(`Encontrados: ${resVenc.titles.length} títulos (Total: ${resVenc.kpis.totalTitulos})`);
