import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { AssociadoNormalized, DashboardKPIs, FilterOptions } from '../types/index.js';

export class ExcelService {
  private static cachedData: AssociadoNormalized[] = [];
  private static cachedRawColumns: string[] = [];
  private static lastLoadedFile: string | null = null;
  private static lastModifiedTime: number = 0;

  // Search common directories for the Excel file
  public static findExcelFile(): string | null {
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'data'),
      path.join(process.cwd(), 'uploads'),
      // Also check OneDrive parent if accessible
      path.join(process.cwd(), '..')
    ];

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      try {
        const files = fs.readdirSync(dir);
        // First look for Controle - Associados - 2026.xlsx specifically
        const exactMatch = files.find(f => f.toLowerCase() === 'controle - associados - 2026.xlsx');
        if (exactMatch) return path.join(dir, exactMatch);

        // Next look for any file containing Associados and ending with .xlsx or .xls
        const associadosMatch = files.find(f => 
          f.toLowerCase().includes('associado') && (f.endsWith('.xlsx') || f.endsWith('.xls'))
        );
        if (associadosMatch) return path.join(dir, associadosMatch);

        // Next look for any .xlsx
        const anyXlsx = files.find(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
        if (anyXlsx) return path.join(dir, anyXlsx);
      } catch (err) {
        // Skip unreadable folders
      }
    }

    return null;
  }

  public static loadExcel(customPath?: string): { success: boolean; message: string; count?: number } {
    const filePath = customPath || this.findExcelFile();

    if (!filePath || !fs.existsSync(filePath)) {
      return { 
        success: false, 
        message: 'Nenhum arquivo Excel encontrado. Faça o upload ou coloque o arquivo Controle - Associados - 2026.xlsx na pasta do projeto.' 
      };
    }

    try {
      const stats = fs.statSync(filePath);
      if (this.lastLoadedFile === filePath && this.lastModifiedTime === stats.mtimeMs && this.cachedData.length > 0) {
        return { success: true, message: 'Dados em cache atualizados.', count: this.cachedData.length };
      }

      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

      // Find the "Associados" sheet (case insensitive)
      let targetSheetName = workbook.SheetNames.find(name => 
        name.trim().toLowerCase() === 'associados' || name.toLowerCase().includes('associad')
      );

      if (!targetSheetName) {
        // Fallback to first sheet
        targetSheetName = workbook.SheetNames[0];
      }

      const sheet = workbook.Sheets[targetSheetName];
      if (!sheet) {
        return { success: false, message: `Aba "${targetSheetName}" não encontrada no arquivo.` };
      }

      // Convert sheet to json array
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { 
        raw: false,
        defval: '' 
      });

      if (!rawRows || rawRows.length === 0) {
        return { success: false, message: 'Aba selecionada está vazia.' };
      }

      // Detect columns
      const columnKeys = new Set<string>();
      rawRows.forEach(row => {
        Object.keys(row).forEach(k => {
          if (k && !k.startsWith('__EMPTY')) {
            columnKeys.add(k.trim());
          }
        });
      });

      this.cachedRawColumns = Array.from(columnKeys);

      // Normalize data
      this.cachedData = rawRows.map((row, index) => this.normalizeRow(row, index));
      this.lastLoadedFile = filePath;
      this.lastModifiedTime = stats.mtimeMs;

      return { 
        success: true, 
        message: `Planilha carregada com sucesso (${this.cachedData.length} registros da aba "${targetSheetName}").`, 
        count: this.cachedData.length 
      };
    } catch (error: any) {
      console.error('Erro ao processar Excel:', error);
      return { success: false, message: `Erro ao processar planilha: ${error.message}` };
    }
  }

  private static normalizeRow(row: Record<string, any>, index: number): AssociadoNormalized {
    const keys = Object.keys(row);

    const findVal = (keywords: string[]): any => {
      for (const k of keys) {
        const lowerK = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        for (const kw of keywords) {
          if (lowerK.includes(kw)) {
            return row[k];
          }
        }
      }
      return undefined;
    };

    const parseNumber = (val: any): number | undefined => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'number') return val;
      const str = String(val)
        .replace(/R\$/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .trim();
      const num = parseFloat(str);
      return isNaN(num) ? undefined : num;
    };

    const parseDate = (val: any): string | undefined => {
      if (!val) return undefined;
      if (val instanceof Date) {
        return val.toLocaleDateString('pt-BR');
      }
      const str = String(val).trim();
      return str || undefined;
    };

    const nome = findVal(['nome', 'associado', 'colaborador', 'profissional', 'advogado']) || `Associado ${index + 1}`;
    const statusRaw = findVal(['status', 'situacao', 'estado']) || 'Ativo';
    const cargo = findVal(['cargo', 'funcao', 'posicao', 'senioridade', 'titulo']);
    const departamento = findVal(['area', 'depto', 'departamento', 'setor', 'time', 'equipe']);
    const unidade = findVal(['unidade', 'polo', 'escritorio', 'filial', 'cidade', 'local']);
    const dataAdmissao = parseDate(findVal(['admissao', 'entrada', 'inicio', 'data']));
    const dataDesligamento = parseDate(findVal(['desligamento', 'saida', 'termino', 'fim']));
    const valor = parseNumber(findVal(['honorario', 'remuneracao', 'valor', 'salario', 'pro-labore', 'custo']));
    const tipoContrato = findVal(['contrato', 'tipo', 'regime', 'vinculo', 'modalidade']);
    const cpfCnpj = findVal(['cpf', 'cnpj', 'documento']);
    const email = findVal(['email', 'e-mail']);
    const telefone = findVal(['telefone', 'celular', 'contato']);

    // Standardize status
    let normalizedStatus = String(statusRaw).trim();
    const sLower = normalizedStatus.toLowerCase();
    if (sLower.includes('inativ') || sLower.includes('desligad') || sLower === 'nao' || sLower === 'não') {
      normalizedStatus = 'Inativo';
    } else if (sLower.includes('ativ') || sLower === 'sim' || sLower === 'ok') {
      normalizedStatus = 'Ativo';
    } else if (sLower.includes('afastad') || sLower.includes('licenca') || sLower.includes('licença') || sLower.includes('suspens')) {
      normalizedStatus = 'Afastado';
    } else if (sLower.includes('processo') || sLower.includes('analise') || sLower.includes('análise') || sLower.includes('pendent')) {
      normalizedStatus = 'Em Processo';
    }

    return {
      id: String(index + 1),
      nome: String(nome).trim(),
      status: normalizedStatus,
      cargo: cargo ? String(cargo).trim() : 'Geral',
      departamento: departamento ? String(departamento).trim() : 'Geral',
      unidade: unidade ? String(unidade).trim() : undefined,
      dataAdmissao,
      dataDesligamento,
      valor,
      tipoContrato: tipoContrato ? String(tipoContrato).trim() : undefined,
      cpfCnpj: cpfCnpj ? String(cpfCnpj).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      telefone: telefone ? String(telefone).trim() : undefined,
      rawData: row
    };
  }

  public static getAssociados(filters?: {
    search?: string;
    status?: string;
    departamento?: string;
    cargo?: string;
    unidade?: string;
  }): AssociadoNormalized[] {
    this.ensureLoaded();

    return this.cachedData.filter(item => {
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchesName = item.nome.toLowerCase().includes(q);
        const matchesCargo = item.cargo?.toLowerCase().includes(q);
        const matchesDept = item.departamento?.toLowerCase().includes(q);
        const matchesDoc = item.cpfCnpj?.toLowerCase().includes(q);
        if (!matchesName && !matchesCargo && !matchesDept && !matchesDoc) return false;
      }

      if (filters?.status && filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }

      if (filters?.departamento && filters.departamento !== 'all' && item.departamento !== filters.departamento) {
        return false;
      }

      if (filters?.cargo && filters.cargo !== 'all' && item.cargo !== filters.cargo) {
        return false;
      }

      if (filters?.unidade && filters.unidade !== 'all' && item.unidade !== filters.unidade) {
        return false;
      }

      return true;
    });
  }

  public static getKPIs(filteredList?: AssociadoNormalized[]): DashboardKPIs {
    this.ensureLoaded();
    const list = filteredList || this.cachedData;
    const total = list.length;

    let ativos = 0;
    let inativos = 0;
    let somaValor = 0;
    let countValor = 0;

    const statusMap = new Map<string, number>();
    const areaMap = new Map<string, number>();
    const cargoMap = new Map<string, number>();
    const nivelMap = new Map<string, number>();
    const mesMap = new Map<string, number>();

    const classifyNivel = (cargoRaw: string): string => {
      const c = (cargoRaw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (c.includes('gerent')) return 'Gerentes';
      if (c.includes('coordenad')) return 'Coordenadores';
      if (c.includes('analist')) return 'Analistas';
      if (c.includes('assistent') || c.includes('assitente') || c.includes('auxiliar') || c.includes('estagi')) return 'Assistentes';
      if (c.includes('head') || c.includes('cfo') || c.includes('ceo') || c.includes('diretor') || c.includes('socio') || c.includes('socia') || c.includes('superintendent')) return 'Diretoria & Heads';
      if (c.includes('supervisor')) return 'Supervisores';
      if (c.includes('advogad') || c.includes('consultor') || c.includes('especialist') || c.includes('piloto')) return 'Especialistas & Consultores';
      return 'Operações & Apoio';
    };

    let somaIdade = 0;
    let countIdade = 0;
    const now = new Date();

    list.forEach(item => {
      // Status
      if (item.status === 'Ativo') ativos++;
      else if (item.status === 'Inativo') inativos++;

      statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1);

      // Area
      const depto = item.departamento || 'Não Informado';
      areaMap.set(depto, (areaMap.get(depto) || 0) + 1);

      // Cargo
      const c = item.cargo || 'Não Informado';
      cargoMap.set(c, (cargoMap.get(c) || 0) + 1);

      // Nivel / Cargo Group
      const nivel = classifyNivel(item.cargo || '');
      nivelMap.set(nivel, (nivelMap.get(nivel) || 0) + 1);

      // Valor
      if (typeof item.valor === 'number' && !isNaN(item.valor)) {
        somaValor += item.valor;
        countValor++;
      }

      // Idade calculation
      const dtNasc = item.rawData?.['DT. NASC'] || item.rawData?.['DATA DE NASCIMENTO'] || item.rawData?.['NASCIMENTO'];
      if (dtNasc) {
        let birthDate: Date | null = null;
        if (typeof dtNasc === 'number') {
          birthDate = new Date(Math.round((dtNasc - 25569) * 86400 * 1000));
        } else if (typeof dtNasc === 'string') {
          const parts = dtNasc.trim().split('/');
          if (parts.length === 3) {
            birthDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
          }
        }
        if (birthDate && !isNaN(birthDate.getTime())) {
          const ageDiff = now.getFullYear() - birthDate.getFullYear();
          const m = now.getMonth() - birthDate.getMonth();
          const age = (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) ? ageDiff - 1 : ageDiff;
          if (age > 0 && age < 120) {
            somaIdade += age;
            countIdade++;
          }
        }
      }

      // Admissao
      if (item.dataAdmissao) {
        const parts = item.dataAdmissao.split('/');
        if (parts.length === 3) {
          const key = `${parts[1]}/${parts[2]}`; // MM/YYYY
          mesMap.set(key, (mesMap.get(key) || 0) + 1);
        }
      }
    });

    const taxaAtivos = total > 0 ? (ativos / total) * 100 : 0;
    const mediaRemuneracao = countValor > 0 ? somaValor / countValor : 0;
    const mediaIdade = countIdade > 0 ? Math.round((somaIdade / countIdade) * 10) / 10 : 0;

    const mapToDist = (m: Map<string, number>) => 
      Array.from(m.entries())
        .map(([label, count]) => ({
          label,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0
        }))
        .sort((a, b) => b.count - a.count);

    // Sort evolucao temporally if possible
    const evolucaoAdmissoes = Array.from(mesMap.entries())
      .map(([label, count]) => ({ label, count }))
      .slice(-12);

    const distribuicaoNivelCargo = Array.from(nivelMap.entries())
      .map(([label, count]) => ({
        label,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);

    return {
      totalAssociados: total,
      totalAtivos: ativos,
      totalInativos: inativos,
      taxaAtivos: Math.round(taxaAtivos * 10) / 10,
      mediaIdade,
      totalRemuneracao: Math.round(somaValor * 100) / 100,
      mediaRemuneracao: Math.round(mediaRemuneracao * 100) / 100,
      novosPeriodo: list.filter(a => a.status === 'Ativo').length,
      distribuicaoStatus: mapToDist(statusMap),
      distribuicaoArea: mapToDist(areaMap).slice(0, 10),
      distribuicaoCargo: mapToDist(cargoMap).slice(0, 10),
      distribuicaoNivelCargo,
      evolucaoAdmissoes
    };
  }

  public static getFilters(): FilterOptions {
    this.ensureLoaded();

    const statusSet = new Set<string>();
    const deptoSet = new Set<string>();
    const cargoSet = new Set<string>();
    const unidadeSet = new Set<string>();
    const contratoSet = new Set<string>();

    this.cachedData.forEach(item => {
      if (item.status) statusSet.add(item.status);
      if (item.departamento) deptoSet.add(item.departamento);
      if (item.cargo) cargoSet.add(item.cargo);
      if (item.unidade) unidadeSet.add(item.unidade);
      if (item.tipoContrato) contratoSet.add(item.tipoContrato);
    });

    return {
      status: Array.from(statusSet).sort(),
      departamentos: Array.from(deptoSet).sort(),
      cargos: Array.from(cargoSet).sort(),
      unidades: Array.from(unidadeSet).sort(),
      tiposContrato: Array.from(contratoSet).sort()
    };
  }

  public static getRawColumns(): string[] {
    this.ensureLoaded();
    return this.cachedRawColumns;
  }

  public static getStatus(): {
    isLoaded: boolean;
    fileName: string | null;
    totalRecords: number;
    lastUpdated: number;
  } {
    return {
      isLoaded: this.cachedData.length > 0,
      fileName: this.lastLoadedFile ? path.basename(this.lastLoadedFile) : null,
      totalRecords: this.cachedData.length,
      lastUpdated: this.lastModifiedTime
    };
  }

  private static ensureLoaded() {
    if (this.cachedData.length === 0) {
      this.loadExcel();
    }
  }
}
