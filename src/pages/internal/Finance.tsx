import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle, AlertCircle, Download, FileText, X } from 'lucide-react';
import * as xlsx from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import './Finance.css';

interface SourceTransaction {
  Data_da_Ocorrencia?: number | string;
  Lancamento?: string;
  Nome?: string;
  Valor?: number;
  Saldo?: number;
  [key: string]: any;
}

interface TargetTransaction {
  Data: string;
  Histórico: string;
  '  Complemento': string;
  Créditos: number | null;
  Débitos: number | null;
  Saldo: number | null;
}

const Finance = () => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<TargetTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const formatExcelDate = (excelDate: number | string | undefined): string => {
    if (!excelDate) return '';
    if (typeof excelDate === 'string') return excelDate;
    
    // Excel dates are number of days since Jan 1, 1900
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    
    // Convert to local time to avoid timezone offset issues making the day off by one
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    
    const day = String(correctedDate.getDate()).padStart(2, '0');
    const month = String(correctedDate.getMonth() + 1).padStart(2, '0');
    const year = correctedDate.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsSaved(false);
    setProcessedData([]);
    
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setError('Por favor, envie apenas arquivos no formato Excel (.xlsx ou .xls)');
      return;
    }
    
    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Read everything as json array of arrays
      const rawData = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      
      // Extract Razão Social from the first few rows for intelligence matching
      let razaoSocial = '';
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        if (rawData[i] && rawData[i][0] === 'Razão Social') {
          razaoSocial = String(rawData[i][1] || '');
          break;
        }
      }
      
      const razaoWords = razaoSocial
        .toLowerCase()
        .split(/[\s\.\,\-\/]+/)
        .filter(w => w.length > 3 && !['ltda', 's/a', 's.a', 'limitada', 'recuperacao', 'judicial', 'empresa', 'eireli', 'participacoes', 'sociedade', 'anonima'].includes(w));
      
      // Find the row containing "Data_da_Ocorrencia"
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        if (rawData[i] && rawData[i].includes('Data_da_Ocorrencia')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Formato inválido. Não foi possível encontrar a coluna "Data_da_Ocorrencia". Este é um Extrato Grfeno válido?');
      }

      // Convert from the header row downwards into objects
      const tableData = xlsx.utils.sheet_to_json<SourceTransaction>(worksheet, {
        range: headerRowIndex
      });

      const formatted: TargetTransaction[] = [];

      for (const row of tableData) {
        // Skip final balance row
        if (row.Lancamento === 'SALDO FINAL' || row.Lancamento === 'SALDO INICIAL') {
          continue;
        }
        
        // Skip empty rows
        if (!row.Data_da_Ocorrencia && !row.Valor) {
          continue;
        }

        const isCredit = row.Valor && row.Valor > 0;
        const isDebit = row.Valor && row.Valor < 0;
        
        let historico = row.Lancamento || '';
        let complemento = row.Nome || '';
        const compLower = complemento.toLowerCase();
        
        // Apply Business Rules
        if (isCredit) {
          historico = 'Crédito';
        } else if (isDebit) {
          if (compLower.includes('lepta bank') || compLower.includes('lepta financeiro')) {
            historico = 'Gestão de contas';
          } else if (compLower.includes('lepta multisetorial') || compLower.includes('lepta special')) {
            historico = 'Liquidação de Recebíveis';
          } else if (historico.toLowerCase().includes('tarifas de conta')) {
            historico = 'Tarifas';
          } else if (razaoWords.length > 0 && razaoWords.some(w => compLower.includes(w))) {
            historico = 'Transferência';
          }
        }

        formatted.push({
          Data: formatExcelDate(row.Data_da_Ocorrencia),
          Histórico: historico,
          '  Complemento': complemento,
          Créditos: isCredit ? row.Valor! : null,
          Débitos: isDebit ? Math.abs(row.Valor!) : null,
          Saldo: row.Saldo || null
        });
      }

      setProcessedData(formatted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar a planilha.');
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setProcessedData([]);
    setError(null);
    setIsSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateAndDownloadExcel = async (data: TargetTransaction[]) => {
    try {
      // Fetch the template from the public folder
      const response = await fetch('/template_extrato.xlsx');
      if (!response.ok) throw new Error('Template não encontrado. Certifique-se de que o arquivo "template_extrato.xlsx" existe.');
      const arrayBuffer = await response.arrayBuffer();
      
      // @ts-ignore
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default || window.ExcelJS || await import('exceljs/dist/exceljs.min.js');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer);
      
      // Remove all tabs except the first one
      while (wb.worksheets.length > 1) {
        wb.removeWorksheet(wb.worksheets[1].id);
      }
      
      const ws = wb.worksheets[0];
      
      // Fix logo overlapping by ensuring Row 1 has enough height to fit the image
      ws.getRow(1).height = 105;
      
      // Remove printer settings to avoid prompt
      ws.pageSetup = { printArea: undefined };
      ws.views = [{ state: 'normal', activeCell: 'A1' }];
      wb.views = [];
      
      // Fix exceljs shared formula bug by stripping formulas before manipulating rows
      ws.eachRow((r: any) => {
        r.eachCell((c: any) => {
          if (c.value && typeof c.value === 'object' && ('formula' in c.value || 'sharedFormula' in c.value)) {
            // @ts-ignore
            c.value = c.value.result || null;
          }
        });
      });
      
      // Cache style from row 9 to maintain format
      const baseRow = ws.getRow(9);
      const styles = {
        A: baseRow.getCell('A').style,
        B: baseRow.getCell('B').style,
        C: baseRow.getCell('C').style,
        D: baseRow.getCell('D').style,
        E: baseRow.getCell('E').style,
        F: baseRow.getCell('F').style,
      };
      
      // Insert new rows
      data.forEach((item, index) => {
        const rowIndex = 9 + index;
        const row = ws.getRow(rowIndex);
        row.getCell('A').value = item.Data;
        row.getCell('B').value = item.Histórico;
        row.getCell('C').value = item['  Complemento'];
        row.getCell('D').value = item.Créditos;
        row.getCell('E').value = item.Débitos;
        row.getCell('F').value = item.Saldo;
        
        row.getCell('A').style = styles.A;
        row.getCell('B').style = styles.B;
        row.getCell('C').style = styles.C;
        row.getCell('D').style = styles.D;
        row.getCell('E').style = styles.E;
        row.getCell('F').style = styles.F;
        
        row.commit();
      });
      
      // Manually clear all extra rows from template instead of using spliceRows
      const lastDataRow = 8 + data.length;
      const maxRow = ws.rowCount; // Cache this because getRow() expands rowCount!
      for (let i = lastDataRow + 1; i <= maxRow; i++) {
        const row = ws.getRow(i);
        if (row.hasValues || row.height) {
          row.values = [];
          row.eachCell((c: any) => {
            c.value = null;
            c.style = {}; // Clear styling (borders, etc)
          });
          row.commit();
        }
      }
      
      // Update formulas in row 6
      const lastRow = 8 + (data.length > 0 ? data.length : 1);
      ws.getCell('D6').value = { formula: `SUM(D9:D${lastRow})` };
      ws.getCell('E6').value = { formula: `SUM(E9:E${lastRow})` };
      ws.getCell('F6').value = { formula: `F${lastRow}` };
      
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      // Get dynamic file name
      const nomeEmpresa = (ws.getCell('B5').value as string) || 'empresa';
      const nomeBanco = (ws.getCell('B4').value as string) || 'banco';
      const cleanString = (str: string) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      const date = new Date();
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dateStr = `${day}${month}`;
      
      const fileName = `${cleanString(nomeEmpresa)}_${dateStr}_${cleanString(nomeBanco)}.xlsx`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error generating Excel', error);
      setError('Erro ao gerar padronizado: ' + (error.message || String(error)));
    }
  };

  const handleSaveData = async () => {
    if (processedData.length === 0) return;
    setIsProcessing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/financialTransactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: selectedFile?.name,
          uploadDate: new Date().toISOString(),
          transactions: processedData
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar no banco de dados');
      
      generateAndDownloadExcel(processedData);
      setIsSaved(true);
    } catch (err) {
      console.error(err);
      setError('Falha ao salvar dados no servidor. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="finance-page fade-in">
      <div className="finance-header">
        <h1>Financeiro</h1>
        <p>Padronização e processamento de Extratos Bancários</p>
      </div>

      <div className="upload-card">
        <h2>Processar Extrato</h2>
        
        {!selectedFile ? (
          <div 
            className={`drop-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={48} className="drop-zone-icon" />
            <p>Arraste e solte o extrato aqui</p>
            <span>ou clique para selecionar o arquivo (XLSX, XLS)</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleChange} 
              className="hidden-input" 
              accept=".xlsx, .xls"
            />
          </div>
        ) : (
          <div className="file-info">
            <div className="file-info-details">
              <FileSpreadsheet size={24} color="var(--accent-orange)" />
              <div>
                <span className="file-name">{selectedFile.name}</span>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            {!isSaved && (
              <button className="icon-btn" onClick={removeFile} title="Remover">
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {isSaved && (
          <div className="processing-status">
            <CheckCircle size={20} />
            Dados salvos com sucesso e planilha exportada!
          </div>
        )}

        {processedData.length > 0 && !error && (
          <>
            <div className="process-actions">
              <button 
                className="btn-primary" 
                onClick={handleSaveData} 
                disabled={isProcessing || isSaved}
              >
                <Download size={20} />
                {isProcessing ? 'Processando...' : 'Salvar no BD e Baixar Padrão'}
              </button>
              
              {isSaved && (
                <button className="btn-success" onClick={() => generateAndDownloadExcel(processedData)}>
                  <FileText size={20} />
                  Baixar Novamente
                </button>
              )}
            </div>

            <div className="preview-table-container">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Histórico</th>
                    <th>Complemento</th>
                    <th>Créditos</th>
                    <th>Débitos</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.slice(0, 50).map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.Data}</td>
                      <td>{row.Histórico}</td>
                      <td>{row['  Complemento']}</td>
                      <td className={row.Créditos ? 'val-credito' : ''}>{formatCurrency(row.Créditos)}</td>
                      <td className={row.Débitos ? 'val-debito' : ''}>{formatCurrency(row.Débitos)}</td>
                      <td>{formatCurrency(row.Saldo)}</td>
                    </tr>
                  ))}
                  {processedData.length > 50 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Mostrando 50 de {processedData.length} registros...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Finance;
