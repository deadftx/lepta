import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface TitulosProps {
  fundoId: string;
  dataPosicao: string;
}

export const ConfirmationTitulos: React.FC<TitulosProps> = ({ fundoId, dataPosicao }) => {
  const [titulos, setTitulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [notaFiltro, setNotaFiltro] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTitulos = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/titulos?fundo_id=${fundoId}&page=${p}&limit=50`;
      if (dataPosicao) url += `&data=${dataPosicao}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (tipoFiltro) url += `&tipo=${encodeURIComponent(tipoFiltro)}`;
      if (notaFiltro) url += `&nota=${encodeURIComponent(notaFiltro)}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTitulos(data.titulos || []);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar títulos:', err);
    } finally {
      setLoading(false);
    }
  }, [fundoId, dataPosicao, search, tipoFiltro, notaFiltro]);

  useEffect(() => {
    fetchTitulos(1);
  }, [fetchTitulos]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTitulos(1);
  };

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  return (
    <div>
      <form onSubmit={handleSearchSubmit} className="cs-search-row">
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="cs-search-input"
            style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px' }}
            placeholder="Buscar por Cedente, Sacado, CNPJ ou Número do Título..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
        </div>

        <select
          className="cs-date-input"
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
        >
          <option value="">Todos os Tipos</option>
          <option value="DUPLICATA">Duplicatas</option>
          <option value="CCB">CCB</option>
          <option value="CHEQUE">Cheque</option>
          <option value="CONTRATO">Contrato</option>
          <option value="NOTA COMERCIAL">Nota Comercial</option>
        </select>

        <select
          className="cs-date-input"
          value={notaFiltro}
          onChange={e => setNotaFiltro(e.target.value)}
        >
          <option value="">Todas as Notas PDD</option>
          <option value="AA">Rating AA</option>
          <option value="A">Rating A</option>
          <option value="B">Rating B</option>
          <option value="C">Rating C</option>
          <option value="D">Rating D</option>
          <option value="E">Rating E</option>
          <option value="F">Rating F</option>
          <option value="G">Rating G</option>
          <option value="H">Rating H</option>
        </select>

        <button type="submit" className="cs-page-btn" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', color: '#38bdf8' }}>
          <RefreshCw size={14} /> Filtrar
        </button>
      </form>

      <div className="cs-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="cs-card-title" style={{ margin: 0 }}>
            Títulos da Carteira ({totalCount.toLocaleString('pt-BR')} registros)
          </h3>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>Carregando títulos...</p>
          </div>
        ) : (
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Nº Título</th>
                  <th>Cedente</th>
                  <th>Sacado</th>
                  <th>Tipo</th>
                  <th>Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente</th>
                  <th style={{ textAlign: 'center' }}>Rating</th>
                  <th style={{ textAlign: 'right' }}>PDD</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((t, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f8fafc' }}>
                      {t.numero_titulo || '-'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{t.cedente_nome}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.cedente_cnpj}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.sacado_nome}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.sacado_cnpj}</div>
                    </td>
                    <td>
                      <span className="cs-badge info">{t.tipo_ativo || 'OUTROS'}</span>
                    </td>
                    <td style={{ color: new Date(t.data_vencimento) < new Date(t.data_posicao) ? '#f87171' : '#cbd5e1' }}>
                      {formatDate(t.data_vencimento)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(t.valor_presente)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="cs-badge warning">{t.nota_pdd || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#fbbf24', fontWeight: 500 }}>
                      {formatBrl((t.pdd_nota || 0) + (t.pdd_vencido || 0))}
                    </td>
                  </tr>
                ))}
                {titulos.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      Nenhum título encontrado com os filtros informados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="cs-pagination">
          <span>
            Página {page} de {totalPages} ({totalCount.toLocaleString('pt-BR')} títulos)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="cs-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => fetchTitulos(page - 1)}
            >
              <ChevronLeft size={16} /> Anterior
            </button>
            <button
              className="cs-page-btn"
              disabled={page >= totalPages || loading}
              onClick={() => fetchTitulos(page + 1)}
            >
              Próxima <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationTitulos;
