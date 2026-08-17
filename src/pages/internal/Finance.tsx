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
      // @ts-ignore
      const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default || window.ExcelJS || await import('exceljs/dist/exceljs.min.js');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Extrato Padronizado');
      
      // Setup Columns
      ws.columns = [
        { header: 'Data', key: 'data', width: 15 },
        { header: 'Histórico', key: 'historico', width: 30 },
        { header: '  Complemento', key: 'complemento', width: 40 },
        { header: 'Créditos', key: 'creditos', width: 15 },
        { header: 'Débitos', key: 'debitos', width: 15 },
        { header: 'Saldo', key: 'saldo', width: 15 }
      ];

      // Insert data
      data.forEach(item => {
        ws.addRow({
          data: item.Data,
          historico: item.Histórico,
          complemento: item['  Complemento'],
          creditos: item.Créditos,
          debitos: item.Débitos,
          saldo: item.Saldo
        });
      });

      // Format headers
      ws.getRow(1).font = { bold: true };
      
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date();
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dateStr = `${day}${month}`;
      
      const fileName = `extrato_padronizado_${dateStr}.xlsx`;
      
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
      await generateAndDownloadExcel(processedData);
      setIsSaved(true);
    } catch (err) {
      console.error(err);
      setError('Falha ao gerar o arquivo padronizado. Tente novamente.');
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
                {isProcessing ? 'Processando...' : 'Gerar Extrato Padronizado'}
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
