import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  ArrowRight,
  MapPin,
  Building2,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './ValidateCepsCnab.css';

interface SacadoInconsistente {
  doc: string;
  nome: string;
  endereco: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cepArquivo: string;
  cepOficial: string;
  enderecoOficial?: string;
  titlesCount: number;
  errorReason: string;
  status: 'CORRIGIVEL' | 'NAO_LOCALIZADO' | 'ERRO_CONSULTA';
}

interface AnalysisResult {
  filename: string;
  totalLinhas: number;
  totalTitulos: number;
  totalSacadosUnicos: number;
  totalCepsUnicos: number;
  totalValidos: number;
  totalInconsistentes: number;
  sacadosInconsistentes: SacadoInconsistente[];
  correcoesSugeridas: Array<{
    doc: string;
    oldCep: string;
    newCep: string;
    nome: string;
  }>;
}

export const ValidateCepsCnab: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCnpjCpf = (doc: string) => {
    const clean = String(doc || '').replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return doc;
  };

  const formatCep = (cep: string) => {
    const clean = String(cep || '').replace(/\D/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 5)}-${clean.slice(5)}`;
    }
    return cep;
  };

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setDownloadSuccess(null);
    setAnalysis(null);

    const validExtensions = ['.txt', '.rem', '.cnab', '.ret'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileNameLower.endsWith(ext));

    if (!hasValidExt) {
      setErrorMsg('Por favor, selecione um arquivo CNAB válido (.txt, .rem ou .cnab).');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setErrorMsg(null);
    setDownloadSuccess(null);
    setLoadingStep('Lendo arquivo e mapeando títulos Tipo 1...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      setLoadingStep('Consultando base dos Correios e Receita Federal para CEPs únicos...');
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/validar-ceps-cnab`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar o arquivo CNAB enviado.');
      }

      const data: AnalysisResult = await res.json();
      setAnalysis(data);
    } catch (err: any) {
      console.error('Erro na análise do CNAB:', err);
      setErrorMsg(err.message || 'Falha ao analisar o arquivo CNAB.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleGenerateCorrectedCnab = async () => {
    if (!selectedFile || !analysis) return;

    setGenerating(true);
    setErrorMsg(null);
    setDownloadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('corrections', JSON.stringify(analysis.correcoesSugeridas));

      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/gerar-cnab-corrigido?format=json`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar o CNAB corrigido.');
      }

      const data = await res.json();

      if (data.cnabBase64) {
        const byteCharacters = atob(data.cnabBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'text/plain;charset=iso-8859-1' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'REMESSA_CEPS_CORRIGIDOS.REM';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setDownloadSuccess(
          `Arquivo "${data.filename}" baixado com sucesso! Foram corrigidos ${data.totalCorrigidos} títulos com 100% de preservação dos outros campos.`
        );
      }
    } catch (err: any) {
      console.error('Erro ao gerar CNAB corrigido:', err);
      setErrorMsg(err.message || 'Falha ao gerar o arquivo CNAB corrigido.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (!analysis || !analysis.sacadosInconsistentes.length) return;

    try {
      const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sacados Inconsistentes');

      sheet.columns = [
        { header: 'CNPJ / CPF', key: 'doc', width: 20 },
        { header: 'Razão Social / Nome', key: 'nome', width: 35 },
        { header: 'Endereço CNAB', key: 'endereco', width: 30 },
        { header: 'CEP Arquivo', key: 'cepArquivo', width: 14 },
        { header: 'Novo CEP Oficial', key: 'cepOficial', width: 16 },
        { header: 'Endereço Oficial (Receita)', key: 'enderecoOficial', width: 40 },
        { header: 'Qtd Títulos', key: 'titlesCount', width: 14 },
        { header: 'Status Correção', key: 'status', width: 18 },
        { header: 'Diagnóstico', key: 'errorReason', width: 35 }
      ];

      // Header style
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' }
      };

      analysis.sacadosInconsistentes.forEach(s => {
        sheet.addRow({
          doc: formatCnpjCpf(s.doc),
          nome: s.nome,
          endereco: s.endereco,
          cepArquivo: formatCep(s.cepArquivo),
          cepOficial: formatCep(s.cepOficial),
          enderecoOficial: s.enderecoOficial || '-',
          titlesCount: s.titlesCount,
          status: s.status === 'CORRIGIVEL' ? 'Corrigível' : 'Verificar',
          errorReason: s.errorReason
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DIAGNOSTICO_CEPS_${analysis.filename.replace(/\.[^/.]+$/, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao exportar diagnóstico para Excel.');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setErrorMsg(null);
    setDownloadSuccess(null);
    setSearchTerm('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredInconsistentes = useMemo(() => {
    if (!analysis) return [];
    if (!searchTerm.trim()) return analysis.sacadosInconsistentes;
    const term = searchTerm.toLowerCase().trim();
    return analysis.sacadosInconsistentes.filter(s =>
      s.doc.includes(term) ||
      s.nome.toLowerCase().includes(term) ||
      s.endereco.toLowerCase().includes(term) ||
      s.cepArquivo.includes(term) ||
      s.cepOficial.includes(term)
    );
  }, [analysis, searchTerm]);

  return (
    <div className="vc-container">
      {/* Header */}
      <div className="vc-header">
        <div className="vc-header-content">
          <div className="vc-breadcrumb">
            <span>Mesa de Operação</span>
            <ArrowRight size={14} />
            <span className="active">Validar CEPs</span>
          </div>
          <h1>Validação & Correção Autônoma de CEPs em CNAB</h1>
          <p>
            Faça upload do arquivo de remessa CNAB 400 para auditar pontualmente todos os CEPs de sacados contra a base dos Correios e Receita Federal, gerando o arquivo corrigido instantaneamente.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="vc-alert error">
          <AlertTriangle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="vc-alert success">
          <CheckCircle size={20} />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Upload Zone */}
      {!analysis && (
        <div className="vc-upload-card">
          <div
            className={`vc-dropzone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
            onDragOver={e => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept=".txt,.rem,.cnab,.ret"
              style={{ display: 'none' }}
              disabled={loading}
            />

            <div className="vc-dropzone-icon">
              {selectedFile ? <FileText size={48} className="file-ready" /> : <UploadCloud size={48} />}
            </div>

            {selectedFile ? (
              <div className="vc-selected-file-info">
                <h3>{selectedFile.name}</h3>
                <p>{(selectedFile.size / 1024).toFixed(1)} KB • Arquivo CNAB selecionado</p>
                <span className="vc-reselect-hint">Clique ou arraste outro arquivo para substituir</span>
              </div>
            ) : (
              <div className="vc-dropzone-instructions">
                <h3>Arraste e solte o arquivo CNAB aqui</h3>
                <p>ou clique para selecionar do seu computador</p>
                <div className="vc-supported-formats">
                  <span>.TXT</span>
                  <span>.REM</span>
                  <span>.CNAB</span>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="vc-upload-actions">
              <button
                type="button"
                className="vc-btn-primary"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    <span>{loadingStep || 'Processando validação...'}</span>
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    <span>Validar CEPs do Arquivo</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analysis Dashboard */}
      {analysis && (
        <div className="vc-results-section">
          {/* Top Bar with Metrics */}
          <div className="vc-metrics-grid">
            <div className="vc-metric-card">
              <div className="vc-metric-icon blue">
                <Layers size={22} />
              </div>
              <div className="vc-metric-data">
                <span className="label">Títulos no Arquivo</span>
                <span className="value">{analysis.totalTitulos.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="vc-metric-card">
              <div className="vc-metric-icon purple">
                <Building2 size={22} />
              </div>
              <div className="vc-metric-data">
                <span className="label">Sacados Únicos</span>
                <span className="value">{analysis.totalSacadosUnicos.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className="vc-metric-card">
              <div className="vc-metric-icon green">
                <CheckCircle size={22} />
              </div>
              <div className="vc-metric-data">
                <span className="label">Sacados c/ CEP Válido</span>
                <span className="value">{analysis.totalValidos.toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <div className={`vc-metric-card ${analysis.totalInconsistentes > 0 ? 'highlight-warning' : ''}`}>
              <div className={`vc-metric-icon ${analysis.totalInconsistentes > 0 ? 'red' : 'green'}`}>
                {analysis.totalInconsistentes > 0 ? <AlertTriangle size={22} /> : <CheckCircle size={22} />}
              </div>
              <div className="vc-metric-data">
                <span className="label">Sacados com CEP Errado</span>
                <span className="value">{analysis.totalInconsistentes.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Action Header */}
          <div className="vc-actions-bar">
            <div className="vc-file-badge">
              <FileText size={16} />
              <strong>{analysis.filename}</strong>
              <span>({analysis.totalLinhas.toLocaleString('pt-BR')} linhas de 400 posições)</span>
            </div>

            <div className="vc-bar-buttons">
              {analysis.totalInconsistentes > 0 && (
                <>
                  <button
                    type="button"
                    className="vc-btn-excel"
                    onClick={handleExportExcel}
                  >
                    <FileSpreadsheet size={16} />
                    <span>Baixar Relatório (.XLSX)</span>
                  </button>

                  <button
                    type="button"
                    className="vc-btn-generate"
                    onClick={handleGenerateCorrectedCnab}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <RefreshCw size={16} className="spin" />
                        <span>Gerando Remessa Corrigida...</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Gerar CNAB Corrigido (.REM)</span>
                      </>
                    )}
                  </button>
                </>
              )}

              <button
                type="button"
                className="vc-btn-secondary"
                onClick={handleReset}
              >
                <RefreshCw size={16} />
                <span>Analisar Outro Arquivo</span>
              </button>
            </div>
          </div>

          {/* Notice banner */}
          {analysis.totalInconsistentes === 0 ? (
            <div className="vc-alert success">
              <CheckCircle size={24} />
              <div>
                <strong>Nenhum erro de CEP encontrado!</strong>
                <p>Todos os {analysis.totalSacadosUnicos} sacados possuem CEPs válidos e verificados na base dos Correios.</p>
              </div>
            </div>
          ) : (
            <div className="vc-alert warning">
              <AlertTriangle size={24} />
              <div>
                <strong>Atenção: Foram encontrados {analysis.totalInconsistentes} sacados com CEP inválido ou genérico.</strong>
                <p>
                  O sistema consultou a Receita Federal e os Correios para descobrir o CEP oficial do logradouro de cada sacado.
                  Ao clicar em <strong>"Gerar CNAB Corrigido"</strong>, o sistema replicará rigorosamente o mesmo arquivo, substituindo <strong>SOMENTE</strong> o CEP nas posições 327 a 334.
                </p>
              </div>
            </div>
          )}

          {/* Table of Inconsistencies */}
          {analysis.totalInconsistentes > 0 && (
            <div className="vc-table-wrapper">
              <div className="vc-table-header">
                <div className="vc-table-title">
                  <MapPin size={18} />
                  <h3>Sacados com Inconsistência de CEP ({filteredInconsistentes.length})</h3>
                </div>
                <div className="vc-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Filtrar por CNPJ, Nome, Endereço ou CEP..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="vc-table-responsive">
                <table className="vc-table">
                  <thead>
                    <tr>
                      <th>Documento (CNPJ)</th>
                      <th>Razão Social</th>
                      <th>Endereço no CNAB</th>
                      <th>CEP no CNAB</th>
                      <th>Novo CEP Oficial</th>
                      <th>Títulos Afetados</th>
                      <th>Status / Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInconsistentes.map((item, idx) => {
                      const isCorrected = item.cepOficial && item.cepOficial !== item.cepArquivo;
                      return (
                        <tr key={idx} className={isCorrected ? 'row-corrected' : ''}>
                          <td className="doc-cell">
                            <code>{formatCnpjCpf(item.doc)}</code>
                          </td>
                          <td className="name-cell">
                            <strong>{item.nome}</strong>
                          </td>
                          <td className="address-cell">
                            <span>{item.endereco}</span>
                            {item.bairro && <span className="sub-addr">Bairro: {item.bairro}</span>}
                            {item.cidade && <span className="sub-addr">{item.cidade}/{item.uf}</span>}
                          </td>
                          <td className="cep-old-cell">
                            <span className="badge-cep-old">
                              {formatCep(item.cepArquivo)}
                            </span>
                          </td>
                          <td className="cep-new-cell">
                            {isCorrected ? (
                              <div className="new-cep-container">
                                <span className="badge-cep-new">
                                  {formatCep(item.cepOficial)}
                                </span>
                                <span className="badge-verified">
                                  <CheckCircle size={12} /> Correios / Receita
                                </span>
                              </div>
                            ) : (
                              <span className="badge-unresolved">Não localizado</span>
                            )}
                          </td>
                          <td className="count-cell">
                            <span className="badge-count">{item.titlesCount} título(s)</span>
                          </td>
                          <td className="reason-cell">
                            <span className="reason-text">{item.errorReason}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidateCepsCnab;
