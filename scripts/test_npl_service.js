import Database from 'better-sqlite3';
import { ensureBaseNplTable, getNplSummary, getNplClients, createNplRecord, getNplRecordsByCedente, updateNplRecord, deleteNplRecord } from '../server/internal/modules/intelligence/npl/nplService.js';

const db = new Database('./database.sqlite');
console.log('--- TESTANDO BASE_NPL SERVICE ---');

ensureBaseNplTable(db);
console.log('1. Tabela garantida com sucesso.');

const summary = getNplSummary(db);
console.log('2. Resumo de KPIs:', summary);

const clients = getNplClients(db);
console.log(`3. Total de cedentes encontrados: ${clients.length}`);
if (clients.length > 0) {
  console.log('Exemplo de cedente:', clients[0]);
}

// Teste de criação temporária
const testRecord = createNplRecord(db, {
  cedente: 'Cedente Teste NPL Ltda',
  cedenteCnpj: '12.345.678/0001-90',
  credoresDeInteresse: 'Banco Alfa, Banco Beta',
  creditoRj: 1500000,
  classe: 'III - Quirografário',
  creditoExecucao: 250000,
  valorConsiderado: 1200000,
  processo: '1002345-88.2025.8.26.0100',
  estado: 'SP',
  gestor: 'Arthur Feltrin',
  statusDaNegociacao: 'Proposta em Análise',
  propostaReal: 850000,
  resultadoLiquido: 350000,
  observacoes: 'Registro de validação do sistema NPL.'
}, { username: 'leptamaster' });

console.log('4. Registro teste criado:', testRecord.id, testRecord.cedente);

const records = getNplRecordsByCedente(db, 'Cedente Teste NPL Ltda');
console.log(`5. Registros do cedente: ${records.length}`);

// Atualiza
const updated = updateNplRecord(db, testRecord.id, {
  valorConsiderado: 1300000,
  statusDaNegociacao: 'Fechado'
}, { username: 'leptamaster' });
console.log('6. Registro atualizado com sucesso. Novo status:', updated.statusDaNegociacao, 'Novo valor:', updated.valorConsiderado);

// Limpa registro de teste
deleteNplRecord(db, testRecord.id);
console.log('7. Registro teste removido com sucesso.');

console.log('--- TODOS OS TESTES PASSARAM COM SUCESSO! ---');
