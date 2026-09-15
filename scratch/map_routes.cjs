const fs = require('fs');
const lines = fs.readFileSync('server/internal/app.js', 'utf8').split('\n');
const routes = [];
lines.forEach((l, idx) => {
  const m = l.match(/app\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
  if (m) routes.push({ line: idx + 1, method: m[1].toUpperCase(), route: m[2] });
});
console.log(`Total de rotas em app.js: ${routes.length}`);
console.table(routes);
