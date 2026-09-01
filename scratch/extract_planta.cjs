const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const htmlPath = path.join(rootDir, 'planta_interativa_salas_reuniao.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const prefix = 'src="data:image/png;base64,';
const startIndex = content.indexOf(prefix);
if (startIndex !== -1) {
  const base64Start = startIndex + prefix.length;
  const endIndex = content.indexOf('"', base64Start);
  const base64Data = content.substring(base64Start, endIndex);
  
  const targetDir = path.join(rootDir, 'public', 'images');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const outputPath = path.join(targetDir, 'planta_escritorio.png');
  fs.writeFileSync(outputPath, Buffer.from(base64Data, 'base64'));
  console.log('Successfully saved image to:', outputPath, 'Bytes:', fs.statSync(outputPath).size);
} else {
  console.error('Prefix not found');
}
