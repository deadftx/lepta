import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Copy, Check, Database, ShieldCheck, FileJson,
  FileSpreadsheet, Terminal, BookOpen, ExternalLink
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './PowerBiModal.css';

interface BiCatalogTable {
  name: string;
  type: string;
  rowCount: number;
  columnsCount: number;
  endpoints?: {
    json: string;
    csv: string;
  };
  powerQueryM?: {
    json: string;
    csv: string;
  };
}

interface PowerBiModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTable?: string;
  fallbackTables?: Array<{ nome: string; registros: number }>;
}

export const PowerBiModal: React.FC<PowerBiModalProps> = ({
  isOpen,
  onClose,
  initialTable,
  fallbackTables = []
}) => {
  const [tables, setTables] = useState<BiCatalogTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [format, setFormat] = useState<'json' | 'csv' | 'html'>('json');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedM, setCopiedM] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/bi/catalog`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tables && Array.isArray(data.tables)) {
            setTables(data.tables);
            if (!selectedTable) {
              const defaultTable = initialTable && data.tables.some((t: BiCatalogTable) => t.name === initialTable)
                ? initialTable
                : data.tables[0]?.name || '';
              setSelectedTable(defaultTable);
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar catálogo Power BI:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [isOpen, initialTable]);

  useEffect(() => {
    if (initialTable) {
      setSelectedTable(initialTable);
    }
  }, [initialTable]);

  // Se o catálogo ainda não carregou ou falhou, usa a lista local de tabelas
  const effectiveTables = useMemo(() => {
    if (tables.length > 0) return tables;
    return fallbackTables.map(t => ({
      name: t.nome,
      type: 'table',
      rowCount: t.registros,
      columnsCount: 0
    }));
  }, [tables, fallbackTables]);

  const activeTableName = selectedTable || effectiveTables[0]?.name || 'CEDENTES';

  // Constrói a URL completa pública/baseada no servidor atual
  const generatedUrl = useMemo(() => {
    const origin = API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : (typeof window !== 'undefined' ? window.location.origin : '');
    return `${origin}/api/bi/data/${encodeURIComponent(activeTableName)}?format=${format}`;
  }, [activeTableName, format]);

  // Constrói o script M do Power Query
  const powerQueryCode = useMemo(() => {
    if (format === 'json') {
      return `let
    // Conexão LEPTA API (Power BI Web Connector)
    Fonte = Json.Document(Web.Contents("${generatedUrl}", [
        Headers = [#"Accept" = "application/json"]
    ])),
    Tabela = Table.FromRecords(Fonte)
in
    Tabela`;
    }

    return `let
    // Conexão LEPTA CSV Stream (Power BI Web Connector)
    Fonte = Csv.Document(Web.Contents("${generatedUrl}"), [
        Delimiter = ",",
        Encoding = 65001,
        QuoteStyle = QuoteStyle.Csv
    ]),
    Cabecalho = Table.PromoteHeaders(Fonte, [PromoteAllScalars = true])
in
    Cabecalho`;
  }, [generatedUrl, format]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyM = async () => {
    try {
      await navigator.clipboard.writeText(powerQueryCode);
      setCopiedM(true);
      setTimeout(() => setCopiedM(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pbi-modal-backdrop" onClick={onClose}>
      <div className="pbi-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="pbi-modal-header">
          <div className="pbi-modal-title-wrap">
            <div className="pbi-modal-logo">BI</div>
            <div>
              <h3>Conectar ao Power BI</h3>
              <p>Link direto e seguro para carregar tabelas do banco da VPS no Power BI Desktop e Service.</p>
            </div>
          </div>
          <button type="button" className="pbi-close-btn" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </header>

        {/* Body */}
        <div className="pbi-modal-body">
          {/* Controles de Tabela e Formato */}
          <div className="pbi-grid-controls">
            <div className="pbi-field-group">
              <label htmlFor="pbi-table-select">
                <Database size={15} /> Selecionar Tabela / Base
              </label>
              <select
                id="pbi-table-select"
                className="pbi-select"
                value={activeTableName}
                onChange={e => setSelectedTable(e.target.value)}
                disabled={loading && effectiveTables.length === 0}
              >
                {effectiveTables.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} {t.rowCount ? `(${t.rowCount.toLocaleString('pt-BR')} registros)` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="pbi-field-group">
              <label>Formato dos Dados</label>
              <div className="pbi-format-tabs">
                <button
                  type="button"
                  className={`pbi-format-tab ${format === 'json' ? 'active' : ''}`}
                  onClick={() => setFormat('json')}
                >
                  <FileJson size={16} /> JSON (Padrão)
                </button>
                <button
                  type="button"
                  className={`pbi-format-tab ${format === 'csv' ? 'active' : ''}`}
                  onClick={() => setFormat('csv')}
                >
                  <FileSpreadsheet size={16} /> CSV (Planilha)
                </button>
                <button
                  type="button"
                  className={`pbi-format-tab ${format === 'html' ? 'active' : ''}`}
                  onClick={() => setFormat('html')}
                >
                  <ExternalLink size={16} /> Tabela Web (Navegador)
                </button>
              </div>
            </div>
          </div>

          {/* URL Gerada */}
          <div className="pbi-url-box">
            <div className="pbi-url-label-row">
              <span className="pbi-url-label">Link para Fonte Web do Power BI / Navegador</span>
              {copiedUrl && (
                <span className="pbi-copy-pill">
                  <Check size={13} /> Link copiado!
                </span>
              )}
            </div>
            <div className="pbi-url-input-wrap">
              <input
                type="text"
                readOnly
                value={generatedUrl}
                className="pbi-url-input"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                className={`pbi-copy-btn ${copiedUrl ? 'copied' : ''}`}
                onClick={handleCopyUrl}
              >
                {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                {copiedUrl ? 'Copiado' : 'Copiar Link'}
              </button>
              {format === 'html' && (
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pbi-copy-btn"
                  style={{ background: '#2563eb', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <ExternalLink size={16} /> Abrir no Navegador
                </a>
              )}
            </div>
          </div>

          {/* Código Power Query M */}
          <div className="pbi-m-section">
            <div className="pbi-m-header">
              <span>
                <Terminal size={15} /> Código Power Query (Editor Avançado)
              </span>
              <button
                type="button"
                className="pbi-m-copy-btn"
                onClick={handleCopyM}
              >
                {copiedM ? <Check size={14} /> : <Copy size={14} />}
                {copiedM ? 'Copiado!' : 'Copiar Código M'}
              </button>
            </div>
            <pre className="pbi-m-code">{powerQueryCode}</pre>
          </div>

          {/* Passo a Passo */}
          <div className="pbi-steps-guide">
            <h4>
              <BookOpen size={16} /> Como conectar no Power BI passo a passo
            </h4>
            <div className="pbi-steps-list">
              <div className="pbi-step-item">
                <span className="pbi-step-badge">1</span>
                <div>
                  No Power BI Desktop, clique em <strong>Obter Dados</strong> &gt; <strong>Web</strong> (ou <i>Get Data &gt; Web</i>).
                </div>
              </div>
              <div className="pbi-step-item">
                <span className="pbi-step-badge">2</span>
                <div>
                  Cole o <strong>Link</strong> acima no campo de URL e clique em <strong>OK</strong>.
                </div>
              </div>
              <div className="pbi-step-item">
                <span className="pbi-step-badge">3</span>
                <div>
                  Na janela de autenticação que surgir, clique na aba <kbd>Básico</kbd> (Basic).
                </div>
              </div>
              <div className="pbi-step-item">
                <span className="pbi-step-badge">4</span>
                <div>
                  Preencha seu <strong>Usuário / E-mail</strong> e sua <strong>Senha</strong> do LEPTA.
                </div>
              </div>
              <div className="pbi-step-item">
                <span className="pbi-step-badge">5</span>
                <div>
                  Clique em <strong>Conectar</strong>. Seus dados serão importados com total segurança e criptografia!
                </div>
              </div>
            </div>
          </div>

          {/* Banner de Segurança */}
          <div className="pbi-security-banner">
            <ShieldCheck size={20} />
            <div>
              <strong>Segurança Integrada:</strong> A conexão é autenticada diretamente pelo servidor da VPS. Apenas contas LEPTA ativas com permissão de <strong>Banco de Dados</strong> ou administradores <strong>MASTER</strong> têm autorização de acesso.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
