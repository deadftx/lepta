import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  Table as TableIcon,
  Upload,
  Link as LinkIcon,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Download,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../../config/api';
import { saveTableRows, getTableRows, deleteTableRows } from '../../services/dbStorage';
import './DatabaseManagement.css';
import './Operations.css';
import './Permissions.css';

export interface DatabaseTable {
  id: string;
  tableName: string;      // EXACTLY the name of the sheet (e.g., "BENFICA")
  sheetName?: string;     // Original sheet name
  sourceType: 'FILE' | 'LINK';
  sourceUrl?: string;
  fileName?: string;
  columns: string[];
  primaryKey?: string;
  rowCount: number;
  lastSyncedAt: string;
  data?: Record<string, any>[]; // Inline data or fallback
}

interface ProcessedSheetResult {
  sheetName: string;
  tableName: string;
  columns: string[];
  rows: Record<string, any>[];
  primaryKey: string;
}

const STORAGE_KEY = 'lepta_database_tables';

// Seed sample tables if database is empty
const sampleTables: DatabaseTable[] = [
  {
    id: 'table_benfica_sample',
    tableName: 'BENFICA',
    sheetName: 'BENFICA',
    sourceType: 'FILE',
    fileName: 'Extrato Grfeno - Benfica.xlsx',
    columns: ['Data', 'Histórico', 'Complemento', 'Créditos', 'Débitos', 'Saldo'],
    primaryKey: 'Complemento',
    rowCount: 5,
    lastSyncedAt: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
    data: [
      { 'Data': '01/08/2026', 'Histórico': 'Crédito', 'Complemento': 'TRANSFERENCIA RECEBIDA BENFICA 001', 'Créditos': 15000, 'Débitos': 0, 'Saldo': 213535.75 },
      { 'Data': '02/08/2026', 'Histórico': 'Débito', 'Complemento': 'PAGAMENTO FORNECEDOR DIESEL S/A', 'Créditos': 0, 'Débitos': 4500, 'Saldo': 209035.75 },
      { 'Data': '03/08/2026', 'Histórico': 'Crédito', 'Complemento': 'TRANSPORTADORA TURISTICA BENFICA SA', 'Créditos': 9350, 'Débitos': 0, 'Saldo': 218385.75 },
      { 'Data': '04/08/2026', 'Histórico': 'Débito', 'Complemento': 'TAXA MANUTENCAO CONTA CORRENTE', 'Créditos': 0, 'Débitos': 120, 'Saldo': 218265.75 },
      { 'Data': '05/08/2026', 'Histórico': 'Crédito', 'Complemento': 'RECEBIMENTO DUPLICATA BENFICA 104', 'Créditos': 25000, 'Débitos': 0, 'Saldo': 243265.75 },
    ]
  }
];

const DatabaseManagement: React.FC = () => {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);

  // Sync & Upload Status Messages
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Progress bar state for heavy file uploads (~300MB)
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  // Form State
  const [formTableName, setFormTableName] = useState('');
  const [formSourceType, setFormSourceType] = useState<'FILE' | 'LINK'>('FILE');
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [formPrimaryKey, setFormPrimaryKey] = useState('');
  const [fileName, setFileName] = useState('');

  // Extracted sheets from current file upload
  const [extractedSheets, setExtractedSheets] = useState<ProcessedSheetResult[]>([]);

  // Selected Table Viewer Data (Loaded from IndexedDB or state)
  const [viewerRows, setViewerRows] = useState<Record<string, any>[]>([]);
  const [loadingViewerRows, setLoadingViewerRows] = useState(false);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Tables Metadata on Mount
  useEffect(() => {
    fetchTables();
  }, []);

  // Whenever selectedTableId changes, load table rows from IndexedDB or fallback
  useEffect(() => {
    if (!selectedTableId) {
      setViewerRows([]);
      return;
    }

    const targetTable = tables.find(t => t.id === selectedTableId);
    if (!targetTable) return;

    loadRowsForTable(targetTable);
  }, [selectedTableId, tables]);

  const loadRowsForTable = async (table: DatabaseTable) => {
    setLoadingViewerRows(true);
    try {
      // First try loading from IndexedDB
      const idbRows = await getTableRows(table.id);
      if (idbRows && idbRows.length > 0) {
        setViewerRows(idbRows);
      } else if (table.data && table.data.length > 0) {
        // Fallback to inline table data
        setViewerRows(table.data);
        // Cache into IndexedDB for future fast access
        saveTableRows(table.id, table.data);
      } else {
        setViewerRows([]);
      }
    } catch (err) {
      console.error('Error loading table rows:', err);
      setViewerRows(table.data || []);
    } finally {
      setLoadingViewerRows(false);
    }
  };

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/databaseTables`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setTables(data);
          if (!selectedTableId) setSelectedTableId(data[0].id);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('API databaseTables unreachable, using local storage fallback.', err);
    }

    // Fallback to localStorage / seed
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTables(parsed);
          if (!selectedTableId) setSelectedTableId(parsed[0].id);
          setLoading(false);
          return;
        }
      } catch {
        // ignore
      }
    }

    // Default Seed
    const seed = sampleTables;
    setTables(seed);
    setSelectedTableId(seed[0].id);
    saveTablesToStorage(seed);
    setLoading(false);
  };

  const saveTablesToStorage = async (updatedTables: DatabaseTable[]) => {
    // Save lightweight metadata list (without massive row payload) to localStorage / API
    const lightTables = updatedTables.map(t => ({
      id: t.id,
      tableName: t.tableName,
      sheetName: t.sheetName,
      sourceType: t.sourceType,
      sourceUrl: t.sourceUrl,
      fileName: t.fileName,
      columns: t.columns,
      primaryKey: t.primaryKey,
      rowCount: t.rowCount,
      lastSyncedAt: t.lastSyncedAt
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightTables));

    try {
      for (const table of lightTables) {
        await fetch(`${API_BASE_URL}/databaseTables/${table.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(table)
        }).catch(async () => {
          await fetch(`${API_BASE_URL}/databaseTables`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(table)
          }).catch(() => {});
        });
      }
    } catch (e) {
      console.warn('Could not persist table metadata to server API:', e);
    }
  };

  const handleOpenAddModal = () => {
    setEditingTable(null);
    setFormTableName('');
    setFormSourceType('FILE');
    setFormSourceUrl('');
    setFormPrimaryKey('');
    setExtractedSheets([]);
    setFileName('');
    setProgressPercent(0);
    setProgressStatus('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (table: DatabaseTable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTable(table);
    setFormTableName(table.tableName);
    setFormSourceType(table.sourceType);
    setFormSourceUrl(table.sourceUrl || '');
    setFormPrimaryKey(table.primaryKey || '');
    setExtractedSheets([]);
    setFileName(table.fileName || '');
    setIsModalOpen(true);
  };

  // High-performance, chunked multi-sheet file upload & extraction (~300MB optimized)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessingFile(true);
    setProgressPercent(10);
    setProgressStatus(`Carregando arquivo (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        setProgressPercent(30);
        setProgressStatus('Lendo estrutura da planilha...');

        // Yield to UI thread to update progress bar smoothly
        await new Promise(r => setTimeout(r, 50));

        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array', dense: true, cellDates: true });
        
        const sheetNames = workbook.SheetNames;
        if (!sheetNames || sheetNames.length === 0) {
          setSyncMessage({ type: 'error', text: 'Nenhuma base encontrada na planilha.' });
          setIsProcessingFile(false);
          return;
        }

        const processedResults: ProcessedSheetResult[] = [];
        const totalSheets = sheetNames.length;

        for (let i = 0; i < totalSheets; i++) {
          const sName = sheetNames[i];
          const pct = Math.round(30 + ((i + 1) / totalSheets) * 60);
          setProgressPercent(pct);
          setProgressStatus(`Processando base ${i + 1} de ${totalSheets}: "${sName}"...`);

          await new Promise(r => setTimeout(r, 30));

          const worksheet = workbook.Sheets[sName];
          const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

          if (rawRows.length > 0) {
            // Find header row by finding the row with the max string columns in the first 30 rows
            const searchLimit = Math.min(rawRows.length, 30);
            let maxCols = 0;
            let headerIdx = 0;
            for (let r = 0; r < searchLimit; r++) {
              const rowArr = rawRows[r] || [];
              const count = rowArr.filter((v: any) => v !== null && v !== undefined && String(v).trim() !== '').length;
              if (count > maxCols) {
                maxCols = count;
                headerIdx = r;
              }
            }

            const headerArr = (rawRows[headerIdx] || []).map((v: any, i: number) => String(v ?? `Coluna ${i + 1}`).trim());
            
            const rows: Record<string, any>[] = [];
            for (let r = headerIdx + 1; r < rawRows.length; r++) {
              const rowArr = rawRows[r];
              if (!rowArr || rowArr.length === 0) continue;
              const rowObj: Record<string, any> = {};
              let hasContent = false;
              headerArr.forEach((h: string, idx: number) => {
                const val = rowArr[idx] !== undefined && rowArr[idx] !== null ? rowArr[idx] : '';
                if (val !== '') hasContent = true;
                rowObj[h] = val;
              });
              if (hasContent) rows.push(rowObj);
            }

            if (rows.length > 0) {
              const defaultPk = headerArr.find((c: string) => /id|código|codigo|cnpj|cpf|data|chave/i.test(c)) || headerArr[0] || '';
              
              processedResults.push({
                sheetName: sName,
                tableName: sName.trim(), // EXACT sheet name
                columns: headerArr,
                rows,
                primaryKey: defaultPk
              });
            }
          }
        }

        setProgressPercent(100);
        setProgressStatus('Extração concluída com sucesso!');
        setExtractedSheets(processedResults);

        if (processedResults.length > 0) {
          setFormTableName(processedResults[0].tableName);
          setFormPrimaryKey(processedResults[0].primaryKey);
          setSyncMessage({
            type: 'success',
            text: `Planilha com ${totalSheets} base(s) processada(s)! ${processedResults.length} tabela(s) pronta(s) para criação com o nome exato das bases.`
          });
        } else {
          setSyncMessage({ type: 'error', text: 'Todas as bases da planilha estão vazias.' });
        }
      } catch (err) {
        console.error('Erro ao ler planilha:', err);
        setSyncMessage({ type: 'error', text: 'Erro ao processar planilha pesada. Verifique se o formato é suportado (.xlsx, .xls, .csv).' });
      } finally {
        setIsProcessingFile(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Row deduplication fingerprint key
  const getRowKey = (row: Record<string, any>, pkColumn?: string): string => {
    if (pkColumn && row[pkColumn] !== undefined && row[pkColumn] !== '') {
      return String(row[pkColumn]).trim();
    }
    return Object.values(row).map(v => String(v ?? '').trim()).join('|');
  };

  // Deduplicated Upsert Sync Logic (SEM DUPLICAR INFORMAÇÃO)
  const performUpsertSync = (
    existingRows: Record<string, any>[],
    incomingRows: Record<string, any>[],
    pkColumn?: string
  ) => {
    let addedCount = 0;
    let updatedCount = 0;
    let duplicateCount = 0;

    const existingMap = new Map<string, number>();
    const updatedRows = [...existingRows];

    existingRows.forEach((r, idx) => {
      const key = getRowKey(r, pkColumn);
      if (key) existingMap.set(key, idx);
    });

    incomingRows.forEach(newRow => {
      const key = getRowKey(newRow, pkColumn);
      if (existingMap.has(key)) {
        const existingIdx = existingMap.get(key)!;
        const existingRow = updatedRows[existingIdx];

        if (JSON.stringify(existingRow) !== JSON.stringify(newRow)) {
          updatedRows[existingIdx] = { ...existingRow, ...newRow };
          updatedCount++;
        } else {
          duplicateCount++; // Exact duplicate ignored
        }
      } else {
        updatedRows.push(newRow);
        existingMap.set(key, updatedRows.length - 1);
        addedCount++;
      }
    });

    return { updatedRows, addedCount, updatedCount, duplicateCount };
  };

  // Save Modal (Create tables for all sheets or edit existing table)
  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');

    if (editingTable) {
      // Editing existing single table
      const currentRows = await getTableRows(editingTable.id);
      const incomingRows = extractedSheets.length > 0 ? extractedSheets[0].rows : currentRows;

      const syncResult = performUpsertSync(currentRows, incomingRows, formPrimaryKey);

      const updatedTable: DatabaseTable = {
        ...editingTable,
        tableName: formTableName.trim() || editingTable.tableName,
        sourceType: formSourceType,
        sourceUrl: formSourceUrl,
        fileName: fileName || editingTable.fileName,
        columns: extractedSheets.length > 0 ? extractedSheets[0].columns : editingTable.columns,
        primaryKey: formPrimaryKey,
        rowCount: syncResult.updatedRows.length,
        lastSyncedAt: now
      };

      // Save heavy rows to IndexedDB
      await saveTableRows(updatedTable.id, syncResult.updatedRows);

      const newTablesList = tables.map(t => t.id === editingTable.id ? updatedTable : t);
      setTables(newTablesList);
      saveTablesToStorage(newTablesList);

      setSyncMessage({
        type: 'success',
        text: `Tabela "${updatedTable.tableName}" atualizada! ${syncResult.addedCount} novos inseridos, ${syncResult.updatedCount} atualizados, ${syncResult.duplicateCount} duplicados ignorados.`
      });
    } else {
      // Creating NEW table(s) from uploaded file / sheets
      if (extractedSheets.length === 0 && formSourceType === 'FILE') {
        alert('Por favor, selecione um arquivo de planilha com dados.');
        return;
      }

      const createdTables: DatabaseTable[] = [];

      if (extractedSheets.length > 0) {
        // Multi-sheet creation from uploaded file: Create a table for EACH sheet with the exact name of the sheet!
        for (const sheet of extractedSheets) {
          const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const tableName = sheet.tableName;
          const syncResult = performUpsertSync([], sheet.rows, sheet.primaryKey);

          await saveTableRows(tableId, syncResult.updatedRows);

          createdTables.push({
            id: tableId,
            tableName,
            sheetName: sheet.sheetName,
            sourceType: formSourceType,
            sourceUrl: formSourceUrl,
            fileName: fileName || 'Planilha',
            columns: sheet.columns,
            primaryKey: sheet.primaryKey,
            rowCount: syncResult.updatedRows.length,
            lastSyncedAt: now
          });
        }

        const newTablesList = [...tables, ...createdTables];
        setTables(newTablesList);
        if (createdTables.length > 0) {
          setSelectedTableId(createdTables[0].id);
        }
        saveTablesToStorage(newTablesList);

        setSyncMessage({
          type: 'success',
          text: `${createdTables.length} tabela(s) criada(s) com sucesso a partir das bases da planilha sem duplicação de dados!`
        });
      } else if (formSourceType === 'LINK' && formSourceUrl) {
        // SharePoint / OneDrive URL: Delegate heavy streaming import to Node Backend server
        setIsProcessingFile(true);
        setProgressStatus('Enviando link para o Servidor Node processar em modo Streaming...');
        setProgressPercent(40);

        try {
          const res = await fetch(`${API_BASE_URL}/api/sync-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: formSourceUrl })
          });
          const result = await res.json();

          if (result.success) {
            await fetchTables();
            setSyncMessage({
              type: 'success',
              text: `✓ ${result.message}`
            });
          } else {
            setSyncMessage({
              type: 'error',
              text: result.error || 'Erro ao sincronizar link via servidor Node.'
            });
          }
        } catch (err) {
          console.error(err);
          setSyncMessage({
            type: 'error',
            text: 'Não foi possível conectar ao servidor Node para sincronizar o link. Verifique a conexão com o servidor local.'
          });
        } finally {
          setIsProcessingFile(false);
        }
      }
    }

    setIsModalOpen(false);
  };

  // Re-sync single table
  const handleSyncTable = async (table: DatabaseTable, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      if (table.sourceUrl) {
        // Trigger Node backend streaming download & sync for SharePoint link
        const res = await fetch(`${API_BASE_URL}/api/sync-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: table.sourceUrl })
        });
        const result = await res.json();
        if (result.success) {
          await fetchTables();
          setSyncMessage({
            type: 'success',
            text: `✓ Tabela "${table.tableName}" atualizada pelo Servidor Node em modo Streaming!`
          });
          setIsSyncing(false);
          return;
        }
      }

      const now = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
      const currentRows = await getTableRows(table.id);

      const syncResult = performUpsertSync(currentRows, currentRows, table.primaryKey);
      await saveTableRows(table.id, syncResult.updatedRows);

      const syncedTable: DatabaseTable = {
        ...table,
        lastSyncedAt: now,
        rowCount: syncResult.updatedRows.length
      };

      const updatedList = tables.map(t => t.id === table.id ? syncedTable : t);
      setTables(updatedList);
      saveTablesToStorage(updatedList);

      setSyncMessage({
        type: 'success',
        text: `Sincronização concluída para "${table.tableName}"! ${syncResult.duplicateCount} registros mantidos sem duplicidades.`
      });
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: `Erro ao sincronizar a tabela ${table.tableName}.` });
    } finally {
      setIsSyncing(false);
    }
  };

  // 1-Click Sync for Lepta DB
  const handleSyncLeptaDB = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const fixedPath = 'C:\\Users\\ArthurFeltrinDeco\\OneDrive - Lepta\\Depto Credito - Documentos\\DEPTO CREDITO\\Lepta - TitulosEmAberto.xlsx';
      const res = await fetch(`${API_BASE_URL}/api/sync-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fixedPath })
      });
      const result = await res.json();

      if (result.success) {
        await fetchTables();
        setSyncMessage({
          type: 'success',
          text: `✓ Sucesso! ${result.message}`
        });
      } else {
        setSyncMessage({
          type: 'error',
          text: result.message || 'Erro ao sincronizar banco principal.'
        });
      }
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: 'Falha de comunicação com o servidor Node local.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Re-sync ALL tables
  const handleSyncAllTables = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const now = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
      const updatedList: DatabaseTable[] = [];

      for (const table of tables) {
        if (table.sourceUrl) {
          await fetch(`${API_BASE_URL}/api/sync-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: table.sourceUrl })
          }).catch(() => {});
        } else {
          const currentRows = await getTableRows(table.id);
          const syncResult = performUpsertSync(currentRows, currentRows, table.primaryKey);
          await saveTableRows(table.id, syncResult.updatedRows);

          updatedList.push({
            ...table,
            lastSyncedAt: now,
            rowCount: syncResult.updatedRows.length
          });
        }
      }

      await fetchTables();

      setSyncMessage({
        type: 'success',
        text: `Todas as ${tables.length} tabelas/bases foram sincronizadas em modo Streaming via servidor Node sem travar o navegador.`
      });
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: 'Erro ao sincronizar bases de dados.' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete Table
  const handleDeleteTable = async (tableId: string, tableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Tem certeza que deseja excluir a tabela "${tableName}" do banco de dados?`)) {
      await deleteTableRows(tableId);
      const filtered = tables.filter(t => t.id !== tableId);
      setTables(filtered);
      saveTablesToStorage(filtered);
      if (selectedTableId === tableId) {
        setSelectedTableId(filtered.length > 0 ? filtered[0].id : null);
      }
      setSyncMessage({ type: 'success', text: `Tabela "${tableName}" removida do banco de dados.` });
    }
  };

  // Selected Table Meta
  const selectedTable = tables.find(t => t.id === selectedTableId) || null;

  // Filtered rows for data viewer table
  const filteredRows = viewerRows.filter(row => {
    if (!searchTerm.trim()) return true;
    return Object.values(row).some(val =>
      String(val ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleExportJson = (table: DatabaseTable) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(viewerRows, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${table.tableName.toLowerCase().replace(/\s+/g, '_')}_banco.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="database-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="intelligence-badge">
            <Database size={16} /> Infraestrutura & Dados
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: '#fff' }}>
            Banco de Dados
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.95rem' }}>
            Centralização de bases de dados de planilhas pesadas com criação automática por aba e atualização sem duplicação.
          </p>
        </div>

        <div className="db-header-actions">
          <button
            onClick={handleSyncAllTables}
            className="btn-outline"
            disabled={isSyncing || tables.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={18} className={isSyncing ? 'spin-icon' : ''} />
            {isSyncing ? 'Sincronizando...' : 'Atualizar Todas as Bases'}
          </button>
          <button
            onClick={handleSyncLeptaDB}
            className="btn-primary"
            disabled={isSyncing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10b981', borderColor: '#10b981' }}
          >
            <RefreshCw size={18} className={isSyncing ? 'spin-icon' : ''} /> {isSyncing ? 'Sincronizando...' : 'Sincronizar Banco Lepta (Automático)'}
          </button>
          <button
            onClick={handleOpenAddModal}
            className="btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Importação Manual Avançada
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div className={`sync-status-banner ${syncMessage.type}`}>
          {syncMessage.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ flex: 1 }}>{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-icon">
            <Layers size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>Tabelas / Abas Ativas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{tables.length}</div>
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
            <TableIcon size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>Total de Registros (Linhas)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
              {tables.reduce((acc, t) => acc + t.rowCount, 0).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>

        <div className="db-stat-card">
          <div className="db-stat-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.85rem' }}>Storage de Alta Performance</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#10b981' }}>IndexedDB (~300MB Suportado)</div>
          </div>
        </div>
      </div>

      {/* Table Cards Grid */}
      <div>
        <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem' }}>Tabelas das Bases no Banco de Dados</h3>
        {loading ? (
          <p style={{ color: 'var(--text-muted, #94a3b8)' }}>Carregando tabelas do banco...</p>
        ) : tables.length === 0 ? (
          <div className="internal-card glass" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <FileSpreadsheet size={48} style={{ color: 'var(--accent-orange, #ff6b00)', marginBottom: '1rem', opacity: 0.8 }} />
            <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Nenhuma base cadastrada</h3>
            <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '1.5rem' }}>
              Cadastre suas planilhas. Se tiverem várias bases (abas), o sistema criará as tabelas com o nome exato de cada base automaticamente.
            </p>
            <button onClick={handleOpenAddModal} className="btn-primary">
              <Plus size={18} /> Cadastrar Primeira Tabela
            </button>
          </div>
        ) : (
          <div className="tables-grid">
            {tables.map(t => (
              <div
                key={t.id}
                className={`table-card ${selectedTableId === t.id ? 'selected' : ''}`}
                onClick={() => { setSelectedTableId(t.id); setCurrentPage(1); }}
              >
                <div>
                  <div className="table-card-header">
                    <div className="table-card-title">
                      <TableIcon size={18} style={{ color: 'var(--accent-orange, #ff6b00)' }} />
                      {t.tableName}
                    </div>
                    <span className="sheet-badge">
                      <FileText size={12} /> {t.sheetName ? `Base: ${t.sheetName}` : 'Tabela'}
                    </span>
                  </div>

                  <div className="table-card-meta" style={{ marginTop: '0.75rem' }}>
                    <div>📊 <strong>{t.rowCount.toLocaleString('pt-BR')}</strong> registros | <strong>{t.columns.length}</strong> colunas</div>
                    <div>🔑 Chave: <span style={{ fontFamily: 'monospace' }}>{t.primaryKey || 'Auto-hash'}</span></div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>🕒 Atualizado: {t.lastSyncedAt}</div>
                  </div>
                </div>

                <div className="table-card-actions">
                  <button
                    onClick={(e) => handleSyncTable(t, e)}
                    className="btn-outline"
                    disabled={isSyncing}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    title="Sincronizar planilha sem duplicar"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'spin-icon' : ''} /> Atualizar
                  </button>

                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={(e) => handleOpenEditModal(t, e)}
                      className="btn-outline"
                      style={{ padding: '0.3rem 0.5rem' }}
                      title="Editar configurações da tabela"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteTable(t.id, t.tableName, e)}
                      className="btn-outline"
                      style={{ padding: '0.3rem 0.5rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                      title="Excluir tabela"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Table Data Viewer */}
      {selectedTable && (
        <div className="internal-card glass table-view-container">
          <div className="table-toolbar">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
                <TableIcon size={20} style={{ color: 'var(--accent-orange, #ff6b00)' }} />
                Tabela: <span style={{ color: 'var(--accent-orange, #ff6b00)' }}>{selectedTable.tableName}</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                {loadingViewerRows ? 'Carregando dados do IndexedDB...' : `${filteredRows.length.toLocaleString('pt-BR')} de ${selectedTable.rowCount.toLocaleString('pt-BR')} registros exibidos`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="search-input-wrapper" style={{ minWidth: '240px' }}>
                <Search size={16} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Pesquisar nos registros..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <button
                onClick={() => handleExportJson(selectedTable)}
                className="btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Download size={16} /> Exportar JSON
              </button>
            </div>
          </div>

          {/* Table Render */}
          <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>#</th>
                  {selectedTable.columns.map((col, i) => (
                    <th key={i}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingViewerRows ? (
                  <tr>
                    <td colSpan={selectedTable.columns.length + 1} style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)', padding: '2rem' }}>
                      Carregando dados do IndexedDB...
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={selectedTable.columns.length + 1} style={{ textAlign: 'center', color: 'var(--text-muted, #94a3b8)', padding: '2rem' }}>
                      Nenhum registro encontrado para o termo pesquisado.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>
                        {(currentPage - 1) * rowsPerPage + rIdx + 1}
                      </td>
                      {selectedTable.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ whiteSpace: 'nowrap' }}>
                          {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                Página {currentPage} de {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn-outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ padding: '0.35rem 0.65rem' }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button
                  className="btn-outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ padding: '0.35rem 0.65rem' }}
                >
                  Próxima <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Database size={20} style={{ color: 'var(--accent-orange, #ff6b00)' }} />
                {editingTable ? 'Configurar / Atualizar Tabela' : 'Cadastrar Nova Base de Dados'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTable} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {!editingTable && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                    Tipo de Origem da Planilha
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#fff' }}>
                      <input
                        type="radio"
                        name="sourceType"
                        checked={formSourceType === 'FILE'}
                        onChange={() => setFormSourceType('FILE')}
                      />
                      <Upload size={16} /> Upload de Arquivo (.xlsx, .xls, .csv)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#fff' }}>
                      <input
                        type="radio"
                        name="sourceType"
                        checked={formSourceType === 'LINK'}
                        onChange={() => setFormSourceType('LINK')}
                      />
                      <LinkIcon size={16} /> Link de Planilha (SharePoint / Web)
                    </label>
                  </div>
                </div>
              )}

              {formSourceType === 'LINK' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                    URL / Link da Planilha
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="https://leptacapital.sharepoint.com/.../planilha.xlsx"
                    value={formSourceUrl}
                    onChange={e => setFormSourceUrl(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                    Selecione ou Arraste a Planilha (~300MB Suportado)
                  </label>
                  <div
                    className="file-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileSpreadsheet size={36} style={{ color: 'var(--accent-orange, #ff6b00)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600, color: '#fff' }}>
                      {fileName ? `Arquivo selecionado: ${fileName}` : 'Clique para selecionar arquivo .xlsx, .xls ou .csv'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.25rem' }}>
                      O sistema criará automaticamente as tabelas com o <strong>nome exato de cada base</strong> da planilha.
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', fontSize: '0.825rem', color: '#93c5fd' }}>
                    <strong>💡 Dica para Planilhas Gigantes (~300MB):</strong><br />
                    Para importar arquivos extremamente grandes de centenas de megabytes sem travar a aba do navegador, você também pode executar no terminal local:<br />
                    <code style={{ background: 'rgba(0,0,0,0.4)', padding: '0.25rem 0.5rem', borderRadius: '4px', color: '#fff', display: 'inline-block', marginTop: '0.35rem', fontFamily: 'monospace' }}>
                      npm run import-excel -- "caminho/da/sua/planilha.xlsx"
                    </code>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}

              {/* Progress bar for heavy file processing */}
              {isProcessingFile && (
                <div className="upload-progress-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
                    <span>{progressStatus}</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              )}

              {/* Display Extracted Sheets Summary */}
              {extractedSheets.length > 0 && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
                    ✓ {extractedSheets.length} base(s) encontrada(s) na planilha:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {extractedSheets.map((sh, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: '#fff' }}>Tabela: "{sh.tableName}"</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', marginLeft: '0.5rem' }}>
                            ({sh.rows.length.toLocaleString('pt-BR')} linhas, {sh.columns.length} colunas)
                          </span>
                        </div>
                        <span className="sheet-badge">Base exata</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {editingTable && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.9rem' }}>
                    Nome da Tabela *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    value={formTableName}
                    onChange={e => setFormTableName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isProcessingFile}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={18} /> {editingTable ? 'Salvar Alterações' : `Criar ${extractedSheets.length > 1 ? `${extractedSheets.length} Tabelas` : 'Tabela'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManagement;
