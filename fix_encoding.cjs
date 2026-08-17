const fs = require('fs');
const content = fs.readFileSync('server.js', 'utf16le');
fs.writeFileSync('server.js', content, 'utf8');
console.log('Fixed encoding!');
