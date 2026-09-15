const fs = require('fs');
const content = fs.readFileSync('server/internal/app.js', 'utf8');
const lines = content.split('\n');
const cobrancaBlock = lines.slice(3945, 6104).join('\n');

// Procurar chamadas de funções definidas no app.js
const helpers = [
  'requireSession', 'requirePermission', 'normalizeStr', 'fetchTitulosDaAPI',
  'tableExists', 'cleanCnpj', 'formatCnpj', 'sanitizeUser', 'recordDatabaseEvent'
];

helpers.forEach(h => {
  const count = (cobrancaBlock.match(new RegExp('\\b' + h + '\\b', 'g')) || []).length;
  console.log(`${h}: ${count} ocorrências`);
});
