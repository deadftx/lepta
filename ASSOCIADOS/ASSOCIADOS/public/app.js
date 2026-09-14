/* global Chart, ChartDataLabels */
// State Management
const state = {
  status: null,
  associados: [],
  kpis: null,
  filters: {
    search: '',
    status: 'all',
    departamento: 'all',
    cargo: 'all',
    page: 1,
    limit: 8,
    sortField: 'nome',
    sortOrder: 'asc'
  },
  charts: {
    departamentos: null,
    cargosPercent: null
  }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
  setupEventListeners();
  setupKeyboardShortcuts();
  loadDashboard();
});

function setupEventListeners() {
  // Theme Toggle
  const btnTheme = document.getElementById('btn-toggle-theme');
  btnTheme?.addEventListener('click', toggleTheme);

  // Refresh
  const btnRefresh = document.getElementById('btn-refresh');
  btnRefresh?.addEventListener('click', () => {
    btnRefresh.classList.add('rotating');
    fetch('/api/reload', { method: 'POST' })
      .then(() => loadDashboard())
      .finally(() => setTimeout(() => btnRefresh.classList.remove('rotating'), 500));
  });

  // Search Input
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      state.filters.page = 1;
      fetchAssociados();
      fetchKPIs();
    }, 250);
  });

  // Filters
  ['filter-status', 'filter-depto', 'filter-cargo'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('change', (e) => {
      if (id === 'filter-status') state.filters.status = e.target.value;
      if (id === 'filter-depto') state.filters.departamento = e.target.value;
      if (id === 'filter-cargo') state.filters.cargo = e.target.value;
      state.filters.page = 1;
      fetchAssociados();
      fetchKPIs();
    });
  });

  // Reset Filters
  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    state.filters.search = '';
    state.filters.status = 'all';
    state.filters.departamento = 'all';
    state.filters.cargo = 'all';
    state.filters.page = 1;

    const sIn = document.getElementById('search-input');
    if (sIn) sIn.value = '';
    const fSt = document.getElementById('filter-status');
    if (fSt) fSt.value = 'all';
    const fDp = document.getElementById('filter-depto');
    if (fDp) fDp.value = 'all';
    const fCg = document.getElementById('filter-cargo');
    if (fCg) fCg.value = 'all';

    fetchAssociados();
    fetchKPIs();
  });

  // Table Sorting
  document.querySelectorAll('#table-associados th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      if (state.filters.sortField === field) {
        state.filters.sortOrder = state.filters.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.filters.sortField = field;
        state.filters.sortOrder = 'asc';
      }
      renderTable();
    });
  });

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', exportCSV);

  // Upload Modal triggers
  const modalUpload = document.getElementById('modal-upload');
  const btnOpenUpload = document.getElementById('btn-open-upload');
  const btnBannerUpload = document.getElementById('btn-banner-upload');
  const btnCloseUpload = document.getElementById('btn-close-upload');

  const openUploadModal = () => { if (modalUpload) modalUpload.style.display = 'flex'; };
  const closeUploadModal = () => { if (modalUpload) modalUpload.style.display = 'none'; };

  btnOpenUpload?.addEventListener('click', openUploadModal);
  btnBannerUpload?.addEventListener('click', openUploadModal);
  btnCloseUpload?.addEventListener('click', closeUploadModal);

  // Detail Modal
  const modalDetail = document.getElementById('modal-detail');
  const btnCloseDetail = document.getElementById('btn-close-detail');
  btnCloseDetail?.addEventListener('click', () => {
    if (modalDetail) modalDetail.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === modalUpload) closeUploadModal();
    if (e.target === modalDetail) modalDetail.style.display = 'none';
  });

  // Responsive window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      Object.values(state.charts).forEach(c => { if (c) c.resize(); });
      updatePageLimit();
    }, 150);
  });

  // File Upload Drag and Drop
  setupDropzone();
}

// Dynamically compute optimal page rows to strictly avoid vertical scrollbar
function updatePageLimit() {
  const container = document.querySelector('.table-container');
  if (container && container.clientHeight > 80) {
    const thead = container.querySelector('thead');
    const theadHeight = thead ? thead.offsetHeight : 36;
    const availableHeight = container.clientHeight - theadHeight - 4;
    const optimalRows = Math.max(5, Math.floor(availableHeight / 36));
    if (optimalRows && optimalRows !== state.filters.limit) {
      state.filters.limit = optimalRows;
      const totalPages = Math.ceil((state.associados?.length || 0) / state.filters.limit) || 1;
      if (state.filters.page > totalPages) {
        state.filters.page = totalPages;
      }
      renderTable();
    }
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('search-input')?.focus();
    }
  });
}

function toggleTheme() {
  const body = document.body;
  const isLight = body.classList.toggle('theme-light');
  body.classList.toggle('theme-dark', !isLight);
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
    if (window.lucide) window.lucide.createIcons();
  }
  // Re-render charts with updated theme colors
  if (state.kpis) renderCharts(state.kpis);
}

// Load Dashboard Data
async function loadDashboard() {
  try {
    await checkStatus();
    await fetchFilterOptions();
    await Promise.all([fetchKPIs(), fetchAssociados()]);
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
  }
}

async function checkStatus() {
  const pill = document.getElementById('file-status-pill');
  const text = document.getElementById('file-status-text');
  const banner = document.getElementById('no-data-banner');

  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.status = data;

    if (data.isLoaded) {
      pill.className = 'status-pill status-success';
      text.textContent = `Planilha Conectada: ${data.fileName}`;
      if (banner) banner.style.display = 'none';
    } else {
      pill.className = 'status-pill status-error';
      text.textContent = 'Aguardando planilha Controle - Associados - 2026.xlsx';
      if (banner) banner.style.display = 'block';
    }
  } catch (err) {
    pill.className = 'status-pill status-error';
    text.textContent = 'Servidor desconectado';
  }
}

async function fetchFilterOptions() {
  try {
    const res = await fetch('/api/filters');
    const data = await res.json();

    populateSelect('filter-status', data.status, 'Todos os Status');
    populateSelect('filter-depto', data.departamentos, 'Todas as Áreas');
    populateSelect('filter-cargo', data.cargos, 'Todos os Cargos');
  } catch (err) {
    console.error('Erro ao buscar filtros:', err);
  }
}

function populateSelect(selectId, options, defaultLabel) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentVal = select.value;

  select.innerHTML = `<option value="all">${defaultLabel}</option>`;
  if (options && Array.isArray(options)) {
    options.forEach(opt => {
      if (opt) {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        select.appendChild(el);
      }
    });
  }
  select.value = currentVal || 'all';
}

async function fetchKPIs() {
  try {
    const params = new URLSearchParams();
    if (state.filters.search) params.append('search', state.filters.search);
    if (state.filters.status !== 'all') params.append('status', state.filters.status);
    if (state.filters.departamento !== 'all') params.append('departamento', state.filters.departamento);
    if (state.filters.cargo !== 'all') params.append('cargo', state.filters.cargo);

    const res = await fetch(`/api/kpis?${params.toString()}`);
    const kpis = await res.json();
    state.kpis = kpis;

    renderKPIs(kpis);
    renderCharts(kpis);
  } catch (err) {
    console.error('Erro ao buscar KPIs:', err);
  }
}

function renderKPIs(kpis) {
  document.getElementById('kpi-total').textContent = kpis.totalAssociados.toLocaleString('pt-BR');
  document.getElementById('kpi-ativos').textContent = kpis.totalAtivos.toLocaleString('pt-BR');
  document.getElementById('kpi-taxa-ativos').textContent = `${kpis.taxaAtivos}%`;

  const elMediaIdade = document.getElementById('kpi-media-idade');
  if (elMediaIdade) {
    elMediaIdade.textContent = kpis.mediaIdade ? `${kpis.mediaIdade.toLocaleString('pt-BR')} anos` : '--';
  }

  const elTotal = document.getElementById('kpi-areas-total');
  const elMeta = document.getElementById('kpi-areas-meta');
  if (elTotal && elMeta) {
    if (kpis.totalRemuneracao > 0) {
      elTotal.textContent = kpis.mediaRemuneracao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      elMeta.textContent = `Total: ${kpis.totalRemuneracao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    } else {
      elTotal.textContent = `${kpis.distribuicaoArea.length} Setores`;
      elMeta.textContent = 'Áreas Ativas';
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

// Chart.js Visualizations (2 Stacked Charts)
function renderCharts(kpis) {
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    try {
      Chart.register(ChartDataLabels);
    } catch (e) {
      // already registered
    }
  }

  const isLight = document.body.classList.contains('theme-light');
  const textColor = isLight ? '#475569' : '#94a3b8';
  const labelColor = isLight ? '#0f172a' : '#f8fafc';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)';

  // Destroy previous charts
  Object.values(state.charts).forEach(c => { if (c) c.destroy(); });

  // 1. Departamentos Horizontal Bar Chart
  const ctxDept = document.getElementById('chart-departamentos')?.getContext('2d');
  if (ctxDept && kpis.distribuicaoArea.length > 0) {
    state.charts.departamentos = new Chart(ctxDept, {
      type: 'bar',
      data: {
        labels: kpis.distribuicaoArea.map(d => d.label),
        datasets: [{
          label: 'Associados',
          data: kpis.distribuicaoArea.map(d => d.count),
          backgroundColor: '#6366f1',
          hoverBackgroundColor: '#4f46e5',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 2, bottom: 2, left: 4, right: 30 } },
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} associados (${Math.round((ctx.raw / kpis.totalAssociados) * 100)}%)`
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: labelColor,
            font: {
              family: 'Plus Jakarta Sans',
              weight: 'bold',
              size: 11
            },
            formatter: (val) => val > 0 ? val : ''
          }
        },
        scales: {
          x: { 
            grid: { color: gridColor }, 
            ticks: { color: textColor, font: { size: 10.5 }, precision: 0 },
            suggestedMax: Math.max(...kpis.distribuicaoArea.map(d => d.count)) + 1
          },
          y: { 
            grid: { display: false }, 
            ticks: { color: textColor, font: { size: 11, weight: 'normal' } } 
          }
        }
      }
    });
  }

  // 2. Cargos / Senioridade Porcentagem Chart
  const ctxCargoPercent = document.getElementById('chart-cargos-percent')?.getContext('2d');
  const cargoData = kpis.distribuicaoNivelCargo || [];
  if (ctxCargoPercent && cargoData.length > 0) {
    state.charts.cargosPercent = new Chart(ctxCargoPercent, {
      type: 'bar',
      data: {
        labels: cargoData.map(d => d.label),
        datasets: [{
          label: '% de Associados',
          data: cargoData.map(d => d.percentage),
          backgroundColor: '#38bdf8',
          hoverBackgroundColor: '#0284c7',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 2, bottom: 2, left: 4, right: 40 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${cargoData[ctx.dataIndex].count} associado(s) (${ctx.raw}%)`
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'end',
            color: labelColor,
            font: {
              family: 'Plus Jakarta Sans',
              weight: 'bold',
              size: 11
            },
            formatter: (val) => `${val}%`
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 10.5 },
              callback: (val) => val + '%'
            },
            suggestedMax: Math.min(100, Math.ceil(Math.max(...cargoData.map(d => d.percentage)) + 5))
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor, font: { size: 11, weight: 'normal' } }
          }
        }
      }
    });
  }
}

// Fetch and Render Table Data
async function fetchAssociados() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="td-loading">
        <div class="spinner"></div>
        <span>Carregando dados dos associados...</span>
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      page: '1',
      limit: '1000'
    });
    if (state.filters.search) params.append('search', state.filters.search);
    if (state.filters.status !== 'all') params.append('status', state.filters.status);
    if (state.filters.departamento !== 'all') params.append('departamento', state.filters.departamento);
    if (state.filters.cargo !== 'all') params.append('cargo', state.filters.cargo);

    const res = await fetch(`/api/associados?${params.toString()}`);
    const json = await res.json();
    state.associados = json.data || [];

    updatePageLimit();
    renderTable();
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="td-empty">
          Erro ao conectar com o servidor. Verifique a planilha ou recarregue.
        </td>
      </tr>
    `;
  }
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  const list = [...state.associados];

  // Sorting
  const { sortField, sortOrder } = state.filters;
  list.sort((a, b) => {
    let valA = sortField === 'tempoCasa' ? (a.rawData?.['TEMPO DE CASA'] || '') : (a[sortField] ?? '');
    let valB = sortField === 'tempoCasa' ? (b.rawData?.['TEMPO DE CASA'] || '') : (b[sortField] ?? '');

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const total = list.length;
  const page = state.filters.page;
  const limit = state.filters.limit;
  const startIndex = (page - 1) * limit;
  const pageData = list.slice(startIndex, startIndex + limit);

  // Update counts
  document.getElementById('lbl-showing-count').textContent = total === 0 ? '0' : `${startIndex + 1} - ${Math.min(startIndex + limit, total)}`;
  document.getElementById('lbl-total-count').textContent = total.toString();

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="td-empty">
          Nenhum associado encontrado para os filtros selecionados.
        </td>
      </tr>
    `;
    renderPagination(0);
    return;
  }

  tbody.innerHTML = pageData.map(item => {
    const statusClass = getStatusClass(item.status);
    const tempoCasa = item.rawData?.['TEMPO DE CASA'] || item.dataAdmissao || '-';

    return `
      <tr>
        <td><strong>${escapeHtml(item.nome)}</strong></td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.cargo || '-')}</td>
        <td>${escapeHtml(item.departamento || '-')}</td>
        <td>${escapeHtml(item.dataAdmissao || '-')}</td>
        <td>${escapeHtml(tempoCasa)}</td>
        <td class="th-actions">
          <button class="btn btn-detalhes btn-compact" onclick="viewAssociadoDetails('${item.id}')">
            Detalhes
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(total);
  if (window.lucide) window.lucide.createIcons();
}

function renderPagination(total) {
  const container = document.getElementById('pagination-controls');
  if (!container) return;
  const totalPages = Math.ceil(total / state.filters.limit);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="page-btn" ${state.filters.page === 1 ? 'disabled' : ''} onclick="changePage(${state.filters.page - 1})">&laquo;</button>
  `;

  for (let i = 1; i <= Math.min(totalPages, 7); i++) {
    html += `
      <button class="page-btn ${state.filters.page === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>
    `;
  }

  if (totalPages > 7) {
    html += `<span class="page-btn" style="border:none;background:transparent;">...</span>`;
    html += `
      <button class="page-btn ${state.filters.page === totalPages ? 'active' : ''}" onclick="changePage(${totalPages})">${totalPages}</button>
    `;
  }

  html += `
    <button class="page-btn" ${state.filters.page === totalPages ? 'disabled' : ''} onclick="changePage(${state.filters.page + 1})">&raquo;</button>
  `;

  container.innerHTML = html;
}

window.changePage = function(p) {
  state.filters.page = p;
  renderTable();
};

window.viewAssociadoDetails = function(id) {
  const item = state.associados.find(a => a.id === id);
  if (!item) return;

  const modal = document.getElementById('modal-detail');
  document.getElementById('modal-detail-name').textContent = item.nome;

  const statusEl = document.getElementById('modal-detail-status');
  statusEl.textContent = item.status;
  statusEl.className = `detail-badge ${getStatusClass(item.status)}`;

  document.getElementById('modal-detail-cargo').textContent = item.cargo || 'Cargo Geral';
  document.getElementById('modal-detail-depto').textContent = item.departamento || 'Geral';

  const grid = document.getElementById('modal-detail-raw-fields');
  grid.innerHTML = '';

  if (item.rawData) {
    Object.entries(item.rawData).forEach(([k, v]) => {
      if (!k.startsWith('__EMPTY') && k !== 'URL VEICULOS') {
        const div = document.createElement('div');
        div.className = 'detail-item';
        div.innerHTML = `
          <span class="detail-item-label">${escapeHtml(k)}</span>
          <span class="detail-item-val">${escapeHtml(String(v || '-'))}</span>
        `;
        grid.appendChild(div);
      }
    });
  }

  modal.style.display = 'flex';
  if (window.lucide) window.lucide.createIcons();
};

function getStatusClass(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s.includes('inativ') || s.includes('desligad')) return 'status-inativo';
  if (s.includes('ativ')) return 'status-ativo';
  if (s.includes('afastad') || s.includes('licen')) return 'status-afastado';
  return 'status-em-processo';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Dropzone Setup
function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  if (!dropzone || !fileInput) return;

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });
}

async function handleFileUpload(file) {
  const progress = document.getElementById('upload-progress');
  const content = document.querySelector('.dropzone-content');
  const statusText = document.getElementById('upload-status-text');

  if (content) content.style.display = 'none';
  if (progress) progress.style.display = 'block';
  if (statusText) statusText.textContent = `Carregando ${file.name}...`;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success) {
      if (statusText) statusText.textContent = 'Planilha carregada com sucesso! Atualizando dashboard...';
      setTimeout(() => {
        document.getElementById('modal-upload').style.display = 'none';
        if (content) content.style.display = 'block';
        if (progress) progress.style.display = 'none';
        loadDashboard();
      }, 1000);
    } else {
      alert(`Erro: ${data.message}`);
      if (content) content.style.display = 'block';
      if (progress) progress.style.display = 'none';
    }
  } catch (err) {
    alert(`Erro ao enviar arquivo: ${err.message}`);
    if (content) content.style.display = 'block';
    if (progress) progress.style.display = 'none';
  }
}

// Export CSV
function exportCSV() {
  if (state.associados.length === 0) {
    alert('Nenhum dado para exportar.');
    return;
  }

  const headers = ['ID', 'Nome', 'Status', 'Cargo', 'Departamento', 'Unidade', 'Admissão', 'Valor'];
  const rows = state.associados.map(a => [
    a.id,
    `"${(a.nome || '').replace(/"/g, '""')}"`,
    `"${(a.status || '').replace(/"/g, '""')}"`,
    `"${(a.cargo || '').replace(/"/g, '""')}"`,
    `"${(a.departamento || '').replace(/"/g, '""')}"`,
    `"${(a.unidade || '').replace(/"/g, '""')}"`,
    `"${(a.dataAdmissao || '').replace(/"/g, '""')}"`,
    a.valor !== undefined ? a.valor : ''
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `associados_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
