import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Database,
  Table,
  Columns,
  Key,
  Play,
  RefreshCw,
  Search,
  Copy,
  Check,
  Code,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  Clock,
  Info
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './SsmsWebStudio.css';

export interface TableColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

export interface TableSchemaInfo {
  tableName: string;
  type: 'table' | 'view';
  rowCount: number;
  columnsCount: number;
  columns: TableColumnInfo[];
}

export interface QueryResult {
  success: boolean;
  query: string;
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  totalFetched: number;
  durationMs: number;
  truncated?: boolean;
}

export const SsmsWebStudio: React.FC = () => {
  // Sub-abas do Studio
  const [studioTab, setStudioTab] = useState<'editor' | 'api-docs'>('editor');

  // Estado do Schema / Object Explorer
  const [schema, setSchema] = useState<TableSchemaInfo[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Estado do Editor SQL
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM usuarios_lepta LIMIT 50;');
  const [executing, setExecuting] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [resultFilter, setResultFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Carregar lista de tabelas e schema
  const fetchSchema = useCallback(async () => {
    try {
      setLoadingSchema(true);
      const res = await fetch(`${API_BASE_URL}/api/monitor/db/schema`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSchema(data.schema || []);
      }
    } catch (err) {
      console.error('Erro ao carregar schema do banco:', err);
    } finally {
      setLoadingSchema(false);
    }
  }, []);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  // Alternar expansão de tabela no Object Explorer
  const toggleTableExpand = (tableName: string) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  // Expandir todas / Recolher todas
  const toggleAllTables = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    schema.forEach(t => {
      next[t.tableName] = expand;
    });
    setExpandedTables(next);
  };

  // Executar query SQL
  const handleExecuteQuery = async (queryToRun?: string) => {
    const query = (queryToRun || sqlQuery).trim();
    if (!query) {
      setQueryError('Digite uma consulta SQL para executar.');
      return;
    }

    setExecuting(true);
    setQueryError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/monitor/db/query`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setQueryError(data.error || 'Erro ao executar a consulta SQL.');
        setQueryResult(null);
      } else {
        setQueryResult(data);
      }
    } catch (err: any) {
      setQueryError(err.message || 'Falha de comunicação com o servidor ao executar query.');
      setQueryResult(null);
    } finally {
      setExecuting(false);
    }
  };

  // Atalho F5 ou Ctrl+Enter no textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
      e.preventDefault();
      handleExecuteQuery();
    }
  };

  // Inserir SELECT TOP 100 de uma tabela
  const handleSelectTop = (tableName: string) => {
    const q = `SELECT * FROM "${tableName}" LIMIT 100;`;
    setSqlQuery(q);
    handleExecuteQuery(q);
  };

  // Inserir COUNT(*) de uma tabela
  const handleSelectCount = (tableName: string) => {
    const q = `SELECT COUNT(*) as total_registros FROM "${tableName}";`;
    setSqlQuery(q);
    handleExecuteQuery(q);
  };

  // Inserir nome da coluna no cursor do editor
  const handleInsertColumn = (colName: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const current = sqlQuery;
    const updated = current.substring(0, start) + `"${colName}"` + current.substring(end);
    setSqlQuery(updated);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + colName.length + 2, start + colName.length + 2);
    }, 50);
  };

  // Filtro de tabelas no Object Explorer
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return schema;
    const q = tableSearch.toLowerCase().trim();
    return schema.filter(t =>
      t.tableName.toLowerCase().includes(q) ||
      t.columns.some(c => c.name.toLowerCase().includes(q))
    );
  }, [schema, tableSearch]);

  // Linhas filtradas no grid de resultado
  const filteredResultRows = useMemo(() => {
    if (!queryResult || !queryResult.rows) return [];
    if (!resultFilter.trim()) return queryResult.rows;
    const q = resultFilter.toLowerCase().trim();
    return queryResult.rows.filter(row =>
      Object.values(row).some(val =>
        String(val ?? '').toLowerCase().includes(q)
      )
    );
  }, [queryResult, resultFilter]);

  // Exportar resultado para Excel (.xlsx)
  const handleExportXLSX = async () => {
    if (!queryResult || queryResult.rows.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    setExportingExcel(true);
    try {
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'LeptaSys SSMS Studio';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Resultado SQL', {
        views: [{ state: 'frozen', ySplit: 1 }]
      });

      worksheet.columns = queryResult.columns.map(col => ({
        header: col,
        key: col,
        width: Math.max(15, col.length + 4)
      }));

      // Header styling
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F172A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      queryResult.rows.forEach(r => {
        worksheet.addRow(r);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LEPTA_SQL_RESULT_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Erro ao exportar planilha:', err);
      alert('Não foi possível exportar a consulta no momento.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Copiar JSON dos resultados
  const handleCopyJson = () => {
    if (!queryResult) return;
    navigator.clipboard.writeText(JSON.stringify(queryResult.rows, null, 2));
    setCopiedKey('json');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'https://dev.lepta.com.br';

  return (
    <div className="ssms-container">
      {/* Barra de Navegação Superior do Studio */}
      <div className="ssms-topbar">
        <div className="ssms-brand">
          <Database size={20} className="ssms-brand-icon" />
          <div className="ssms-brand-text">
            <h2>SSMS Web Explorer & Query Studio</h2>
            <span>SQLite VPS Database • Acesso Master de Consulta</span>
          </div>
        </div>

        <div className="ssms-top-actions">
          <div className="ssms-security-pill">
            <ShieldCheck size={14} />
            <span>Somente Leitura Ativa (SELECTs Permitidos)</span>
          </div>

          <div className="ssms-tab-pills">
            <button
              type="button"
              className={`ssms-pill-btn ${studioTab === 'editor' ? 'active' : ''}`}
              onClick={() => setStudioTab('editor')}
            >
              <Terminal size={14} /> Query Studio
            </button>
            <button
              type="button"
              className={`ssms-pill-btn ${studioTab === 'api-docs' ? 'active' : ''}`}
              onClick={() => setStudioTab('api-docs')}
            >
              <Code size={14} /> API Desenvolvedores
            </button>
          </div>
        </div>
      </div>

      {studioTab === 'api-docs' ? (
        /* ABA DE DOCUMENTAÇÃO E CREDENCIAIS DA API DE DESENVOLVEDOR */
        <div className="ssms-api-docs-pane">
          <div className="ssms-card ssms-api-header-card">
            <div className="ssms-api-header-title">
              <Code size={24} style={{ color: '#38bdf8' }} />
              <div>
                <h3>API de Consulta Direta ao Banco de Dados para Desenvolvedores</h3>
                <p>
                  Permite a desenvolvedores e sistemas externos executarem consultas SQL diretamente no banco de dados da VPS,
                  garantindo estritamente apenas operações de leitura (SELECT).
                </p>
              </div>
            </div>

            <div className="ssms-credentials-box">
              <div className="cred-item">
                <span className="cred-label">Chave Master de Acesso (API Key)</span>
                <div className="cred-value-wrapper">
                  <code className="cred-code font-mono">•••••••••••••• (Credencial do Usuário Master)</code>
                  <button
                    type="button"
                    className="btn-copy-cred"
                    onClick={() => {
                      navigator.clipboard.writeText('<SUA_SENHA_MASTER>');
                      setCopiedKey('key');
                      setTimeout(() => setCopiedKey(null), 2000);
                    }}
                    title="Copiar Placeholder"
                  >
                    {copiedKey === 'key' ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  🔒 Validada via hash criptográfico (scrypt + salt) ou variável de ambiente <code>LEPTA_DEV_SQL_KEY</code>.
                </span>
              </div>

              <div className="cred-item">
                <span className="cred-label">Header Obrigatório de Autenticação</span>
                <div className="cred-value-wrapper">
                  <code className="cred-code font-mono">x-lepta-key: &lt;SUA_SENHA_MASTER&gt;</code>
                  <button
                    type="button"
                    className="btn-copy-cred"
                    onClick={() => {
                      navigator.clipboard.writeText('x-lepta-key: <SUA_SENHA_MASTER>');
                      setCopiedKey('header');
                      setTimeout(() => setCopiedKey(null), 2000);
                    }}
                    title="Copiar Header"
                  >
                    {copiedKey === 'header' ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                  </button>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  Também aceita <code>Authorization: Bearer &lt;SUA_SENHA_MASTER&gt;</code>.
                </span>
              </div>
            </div>
          </div>

          <div className="ssms-api-grid">
            {/* Endpoint 1: POST /api/dev/query */}
            <div className="ssms-card">
              <div className="endpoint-header">
                <span className="method-badge post">POST</span>
                <code className="endpoint-url">/api/dev/query</code>
              </div>
              <p className="endpoint-desc">
                Executa qualquer comando <strong>SELECT</strong> no banco de dados e retorna colunas, linhas e tempo de resposta em JSON.
                Qualquer instrução destrutiva (INSERT/UPDATE/DELETE/DROP) é bloqueada imediatamente.
              </p>

              <div className="code-example-tabs">
                <div className="example-block">
                  <div className="example-header">
                    <span>Exemplo cURL (Terminal / Postman)</span>
                    <button
                      type="button"
                      className="btn-copy-mini"
                      onClick={() => {
                        const curl = `curl -X POST "${currentHost}/api/dev/query" \\\n  -H "Content-Type: application/json" \\\n  -H "x-lepta-key: <SUA_SENHA_MASTER>" \\\n  -d '{"query": "SELECT * FROM estoque_titulos LIMIT 10"}'`;
                        navigator.clipboard.writeText(curl);
                        setCopiedKey('curl');
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                    >
                      {copiedKey === 'curl' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />} Copiar
                    </button>
                  </div>
                  <pre className="code-snippet font-mono">
{`curl -X POST "${currentHost}/api/dev/query" \\
  -H "Content-Type: application/json" \\
  -H "x-lepta-key: <SUA_SENHA_MASTER>" \\
  -d '{"query": "SELECT * FROM estoque_titulos LIMIT 10"}'`}
                  </pre>
                </div>

                <div className="example-block">
                  <div className="example-header">
                    <span>Exemplo Node.js / JavaScript</span>
                    <button
                      type="button"
                      className="btn-copy-mini"
                      onClick={() => {
                        const js = `const res = await fetch('${currentHost}/api/dev/query', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'x-lepta-key': '<SUA_SENHA_MASTER>'\n  },\n  body: JSON.stringify({\n    query: 'SELECT id, username, email, role FROM usuarios_lepta LIMIT 20'\n  })\n});\nconst data = await res.json();\nconsole.log(data.rows);`;
                        navigator.clipboard.writeText(js);
                        setCopiedKey('js');
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                    >
                      {copiedKey === 'js' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />} Copiar
                    </button>
                  </div>
                  <pre className="code-snippet font-mono">
{`const res = await fetch('${currentHost}/api/dev/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-lepta-key': '<SUA_SENHA_MASTER>'
  },
  body: JSON.stringify({
    query: 'SELECT id, username, email, role FROM usuarios_lepta LIMIT 20'
  })
});
const data = await res.json();
console.log(data.rows);`}
                  </pre>
                </div>

                <div className="example-block">
                  <div className="example-header">
                    <span>Exemplo Python (requests)</span>
                    <button
                      type="button"
                      className="btn-copy-mini"
                      onClick={() => {
                        const py = `import requests\n\nurl = '${currentHost}/api/dev/query'\nheaders = {'x-lepta-key': '<SUA_SENHA_MASTER>'}\npayload = {'query': 'SELECT * FROM BASE_SMARTFACTOR LIMIT 50'}\n\nresponse = requests.post(url, json=payload, headers=headers)\ndata = response.json()\nprint(f"Total: {data['rowCount']} linhas")\nprint(data['rows'])`;
                        navigator.clipboard.writeText(py);
                        setCopiedKey('py');
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                    >
                      {copiedKey === 'py' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />} Copiar
                    </button>
                  </div>
                  <pre className="code-snippet font-mono">
{`import requests

url = '${currentHost}/api/dev/query'
headers = {'x-lepta-key': '<SUA_SENHA_MASTER>'}
payload = {'query': 'SELECT * FROM BASE_SMARTFACTOR LIMIT 50'}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print(f"Total: {data['rowCount']} linhas")
print(data['rows'])`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Endpoint 2: GET /api/dev/schema */}
            <div className="ssms-card">
              <div className="endpoint-header">
                <span className="method-badge get">GET</span>
                <code className="endpoint-url">/api/dev/schema</code>
              </div>
              <p className="endpoint-desc">
                Retorna o catálogo completo de todas as tabelas, contagem de linhas e lista de colunas com tipos de dados e indicação de PK.
              </p>

              <div className="code-example-tabs">
                <div className="example-block">
                  <div className="example-header">
                    <span>Exemplo cURL</span>
                  </div>
                  <pre className="code-snippet font-mono">
{`curl -X GET "${currentHost}/api/dev/schema" \\
  -H "x-lepta-key: <SUA_SENHA_MASTER>"`}
                  </pre>
                </div>

                <div className="example-block">
                  <div className="example-header">
                    <span>Exemplo de Resposta JSON</span>
                  </div>
                  <pre className="code-snippet font-mono">
{`{
  "success": true,
  "tablesCount": 51,
  "schema": [
    {
      "tableName": "usuarios_lepta",
      "rowCount": 24,
      "columns": [
        { "name": "id", "type": "TEXT", "pk": true },
        { "name": "username", "type": "TEXT", "pk": false },
        { "name": "email", "type": "TEXT", "pk": false }
      ]
    }
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ABA PRINCIPAL: SSMS OBJECT EXPLORER + QUERY STUDIO */
        <div className="ssms-main-layout">
          {/* LADO ESQUERDO: OBJECT EXPLORER (ÁRVORE DE TABELAS & COLUNAS) */}
          <aside className="ssms-sidebar">
            <div className="ssms-sidebar-header">
              <div className="ssms-sidebar-title">
                <Database size={16} />
                <span>Object Explorer ({filteredTables.length})</span>
              </div>
              <div className="ssms-sidebar-actions">
                <button
                  type="button"
                  className="ssms-icon-btn"
                  onClick={() => toggleAllTables(true)}
                  title="Expandir todas as tabelas"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  className="ssms-icon-btn"
                  onClick={() => toggleAllTables(false)}
                  title="Recolher todas as tabelas"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  className="ssms-icon-btn"
                  onClick={fetchSchema}
                  title="Atualizar lista de tabelas"
                  disabled={loadingSchema}
                >
                  <RefreshCw size={14} className={loadingSchema ? 'ssms-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="ssms-search-box">
              <Search size={14} />
              <input
                type="text"
                placeholder="Filtrar tabela ou coluna..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
              />
            </div>

            <div className="ssms-tree-list">
              {loadingSchema && schema.length === 0 ? (
                <div className="ssms-loading-state">
                  <RefreshCw size={20} className="ssms-spin" />
                  <span>Carregando catálogo de tabelas...</span>
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="ssms-empty-tree">
                  <span>Nenhuma tabela encontrada.</span>
                </div>
              ) : (
                filteredTables.map(t => {
                  const isExpanded = Boolean(expandedTables[t.tableName]);
                  return (
                    <div key={t.tableName} className="ssms-table-node">
                      <div className="ssms-table-header" onClick={() => toggleTableExpand(t.tableName)}>
                        <button type="button" className="ssms-chevron-btn">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <Table size={14} className="ssms-table-icon" />
                        <span className="ssms-table-name" title={t.tableName}>{t.tableName}</span>
                        {t.rowCount >= 0 && (
                          <span className="ssms-row-badge" title={`${t.rowCount.toLocaleString('pt-BR')} registros`}>
                            {t.rowCount > 9999 ? `${(t.rowCount / 1000).toFixed(0)}k` : t.rowCount}
                          </span>
                        )}

                        <div className="ssms-table-hover-actions" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="ssms-quick-btn"
                            onClick={() => handleSelectTop(t.tableName)}
                            title={`SELECT * FROM "${t.tableName}" LIMIT 100`}
                          >
                            SELECT
                          </button>
                          <button
                            type="button"
                            className="ssms-quick-btn"
                            onClick={() => handleSelectCount(t.tableName)}
                            title={`SELECT COUNT(*) FROM "${t.tableName}"`}
                          >
                            COUNT
                          </button>
                        </div>
                      </div>

                      {/* LISTA DE COLUNAS AO EXPANDIR */}
                      {isExpanded && (
                        <div className="ssms-columns-list">
                          {t.columns.map(col => (
                            <div
                              key={col.cid}
                              className="ssms-column-item"
                              onDoubleClick={() => handleInsertColumn(col.name)}
                              title={`Coluna: ${col.name} (${col.type})${col.pk ? ' [PRIMARY KEY]' : ''}${col.notnull ? ' [NOT NULL]' : ''} - Duplo clique para inserir no editor`}
                            >
                              {col.pk ? (
                                <Key size={12} className="ssms-pk-icon" />
                              ) : (
                                <Columns size={12} className="ssms-col-icon" />
                              )}
                              <span className={`col-name ${col.pk ? 'is-pk' : ''}`}>{col.name}</span>
                              <span className="col-type">{col.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* LADO DIREITO: EDITOR SQL + GRID DE RESULTADOS */}
          <section className="ssms-workspace">
            {/* PAINEL DO EDITOR */}
            <div className="ssms-editor-panel">
              <div className="ssms-editor-toolbar">
                <div className="toolbar-left">
                  <button
                    type="button"
                    className="ssms-run-btn"
                    onClick={() => handleExecuteQuery()}
                    disabled={executing}
                  >
                    <Play size={14} className={executing ? 'ssms-spin' : ''} />
                    <span>{executing ? 'Executando...' : 'Executar (F5 / Ctrl+Enter)'}</span>
                  </button>

                  <button
                    type="button"
                    className="ssms-tool-btn"
                    onClick={() => {
                      setSqlQuery('');
                      setQueryResult(null);
                      setQueryError(null);
                    }}
                  >
                    Limpar
                  </button>

                  {/* Dropdown de Snippets Prontos */}
                  <select
                    className="ssms-snippet-select"
                    onChange={e => {
                      if (e.target.value) {
                        setSqlQuery(e.target.value);
                        handleExecuteQuery(e.target.value);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>📋 Snippets Rápidos...</option>
                    <option value="SELECT * FROM usuarios_lepta LIMIT 50;">Usuários do Sistema (usuarios_lepta)</option>
                    <option value="SELECT * FROM estoque_titulos LIMIT 50;">Estoque de Títulos (estoque_titulos)</option>
                    <option value="SELECT * FROM BASE_SMARTFACTOR LIMIT 50;">Base SmartFactor (BASE_SMARTFACTOR)</option>
                    <option value="SELECT * FROM compras_requisicoes ORDER BY id DESC LIMIT 50;">Requisições de Compras (compras_requisicoes)</option>
                    <option value="SELECT * FROM monitor_system_errors ORDER BY id DESC LIMIT 50;">Logs de Erros (monitor_system_errors)</option>
                    <option value="SELECT type, name, tbl_name FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY name;">Listar Todas as Tabelas (sqlite_master)</option>
                  </select>
                </div>

                <div className="toolbar-right">
                  <div className="ssms-shortcut-hint">
                    <code>F5</code> ou <code>Ctrl+Enter</code>
                  </div>
                </div>
              </div>

              <div className="ssms-textarea-wrapper">
                <textarea
                  ref={textareaRef}
                  className="ssms-sql-textarea font-mono"
                  value={sqlQuery}
                  onChange={e => setSqlQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua consulta SQL aqui (ex: SELECT * FROM usuarios_lepta LIMIT 50;)..."
                  spellCheck={false}
                />
              </div>
            </div>

            {/* MENSAGEM DE ERRO (SE HOUVER) */}
            {queryError && (
              <div className="ssms-error-banner">
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div className="ssms-error-text">
                  <strong>Erro na Consulta SQL:</strong> {queryError}
                </div>
              </div>
            )}

            {/* PAINEL DE RESULTADOS */}
            <div className="ssms-results-panel">
              <div className="ssms-results-header">
                <div className="results-header-left">
                  <span className="results-title">
                    <Table size={14} /> Resultados
                  </span>

                  {queryResult && (
                    <div className="results-meta">
                      <span className="meta-pill">
                        <Clock size={12} /> {queryResult.durationMs} ms
                      </span>
                      <span className="meta-pill">
                        <strong>{filteredResultRows.length}</strong> de <strong>{queryResult.rowCount}</strong> linha(s)
                      </span>
                      {queryResult.truncated && (
                        <span className="meta-pill warning" title="Limitado para preservar desempenho da VPS">
                          Limitado a 3000 linhas
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="results-header-right">
                  {queryResult && queryResult.rows.length > 0 && (
                    <>
                      <div className="ssms-result-search">
                        <Search size={12} />
                        <input
                          type="text"
                          placeholder="Filtrar dados exibidos..."
                          value={resultFilter}
                          onChange={e => setResultFilter(e.target.value)}
                        />
                      </div>

                      <button
                        type="button"
                        className="ssms-action-btn"
                        onClick={handleExportXLSX}
                        disabled={exportingExcel}
                        title="Baixar planilha Excel (.xlsx)"
                      >
                        <FileSpreadsheet size={13} />
                        <span>{exportingExcel ? 'Exportando...' : 'Exportar Excel'}</span>
                      </button>

                      <button
                        type="button"
                        className="ssms-action-btn"
                        onClick={handleCopyJson}
                        title="Copiar resultados em formato JSON"
                      >
                        {copiedKey === 'json' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                        <span>JSON</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="ssms-table-container">
                {executing ? (
                  <div className="ssms-results-loading">
                    <RefreshCw size={24} className="ssms-spin" />
                    <span>Executando consulta no banco SQLite...</span>
                  </div>
                ) : !queryResult ? (
                  <div className="ssms-results-placeholder">
                    <Terminal size={32} />
                    <p>Digite uma consulta SQL acima e clique em <strong>Executar (F5)</strong>.</p>
                    <small>Você também pode clicar no botão <strong>SELECT</strong> de qualquer tabela no Object Explorer à esquerda.</small>
                  </div>
                ) : queryResult.rows.length === 0 ? (
                  <div className="ssms-results-placeholder">
                    <Info size={32} />
                    <p>A consulta foi executada com sucesso em {queryResult.durationMs}ms, mas não retornou nenhum registro.</p>
                  </div>
                ) : (
                  <table className="ssms-data-table">
                    <thead>
                      <tr>
                        <th className="row-num-col">#</th>
                        {queryResult.columns.map(col => (
                          <th key={col} title={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResultRows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="row-num-cell">{idx + 1}</td>
                          {queryResult.columns.map(col => {
                            const val = row[col];
                            const isNull = val === null || val === undefined;
                            return (
                              <td
                                key={col}
                                className={isNull ? 'null-cell' : typeof val === 'number' ? 'num-cell font-mono' : ''}
                                title={String(val ?? 'NULL')}
                              >
                                {isNull ? <span className="null-tag">NULL</span> : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
