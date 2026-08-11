const xlsx = require('xlsx');
const fs = require('fs');

// Substitua pelo nome exato do seu arquivo Excel
const arquivoEntrada = 'Lepta - TitulosEmAberto.xlsx';

console.log("Carregando o arquivo na memória...");
const workbook = xlsx.readFile(arquivoEntrada);

// Passa por cada aba e salva com o nome exato dela
workbook.SheetNames.forEach(aba => {
    console.log(`Exportando: ${aba}.csv`);

    const worksheet = workbook.Sheets[aba];
    const csvData = xlsx.utils.sheet_to_csv(worksheet);

    // O nome do arquivo será apenas o nome da aba + .csv
    fs.writeFileSync(`${aba}.csv`, csvData);
});

console.log("Todas as abas foram convertidas!");