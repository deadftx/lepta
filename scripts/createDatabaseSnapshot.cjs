const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const sourcePath = path.resolve(process.argv[2] || 'database.sqlite');
const targetPath = path.resolve(process.argv[3] || 'database.deploy.sqlite');

if (!fs.existsSync(sourcePath)) throw new Error(`Banco não encontrado: ${sourcePath}`);
if (fs.existsSync(targetPath)) fs.rmSync(targetPath);

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
source.backup(targetPath)
  .then(() => console.log(targetPath))
  .finally(() => source.close());
