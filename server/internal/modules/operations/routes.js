import multer from 'multer';
import {
  listOperationsByDate,
  getOperationDetails,
  generateSacadosInconsistentesExcel,
  generateTitulosInconsistentesExcel,
  generateFullOperationExcel,
  diagnoseBitfinOperation,
  generateCorrectedCnab400,
  correctUploadedCnab,
  analyzeCnabCeps,
  generateCorrectedCnabFromAnalysis,
  splitCnab400File,
  splitOperationCnab400,
  buildUnifiedCnabRemessa
} from './operationsService.js';

export function registerOperationsRoutes(app, {
  requireSession,
  checkAccess,
  unltdToken
}) {
  const getToken = () => unltdToken || process.env.UNLTD_API_TOKEN;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  // 1. Listagem de Operações da Mesa por Data (padrão dia atual)
  app.get('/api/mesa-operacoes/operacoes', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const { data, status } = req.query;
      const result = await listOperationsByDate({
        token,
        date: data,
        statusFilter: status
      });

      return res.json({ success: true, ...result });
    } catch (err) {
      console.error('Erro ao listar operações da mesa:', err);
      return res.status(500).json({ error: `Erro ao consultar operações: ${err.message}` });
    }
  });

  // 2. Detalhe da Operação com Diagnóstico de Sacados e CEPs
  app.get('/api/mesa-operacoes/operacoes/:id', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data } = req.query;

      const details = await getOperationDetails({
        token,
        operacaoId,
        date: data
      });

      return res.json({ success: true, ...details });
    } catch (err) {
      console.error(`Erro ao consultar detalhes da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao consultar operação: ${err.message}` });
    }
  });

  // 2.1 Diagnóstico de Dados Brutos da API BitFin para a Operação
  app.get('/api/mesa-operacoes/operacoes/:id/raw', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado.' });

      const operacaoId = req.params.id;
      const API_BASE = 'https://lepta-backend.bit-unltd.com.br';
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `UNLTD-BackEnd ${token}`
      };

      let opDirect = null;
      try {
        const r = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}`, { headers });
        if (r.ok) opDirect = await r.json();
      } catch (e) {
        opDirect = { error: e.message };
      }

      let subTitulos = null;
      try {
        const r = await fetch(`${API_BASE}/recebiveis/operacoes/${operacaoId}/titulos`, { headers });
        if (r.ok) subTitulos = await r.json();
      } catch (e) {
        subTitulos = { error: e.message };
      }

      return res.json({
        success: true,
        operacaoId,
        opDirect: {
          keys: opDirect && typeof opDirect === 'object' ? Object.keys(opDirect) : [],
          totalBruto: opDirect?.totalBruto,
          totalLiquido: opDirect?.totalLiquido,
          quantidadeDeTitulos: opDirect?.quantidadeDeTitulos,
          itensLen: Array.isArray(opDirect?.itens) ? opDirect.itens.length : null,
          itensSample10: Array.isArray(opDirect?.itens) ? opDirect.itens.slice(0, 10) : null,
          titulosIsArray: Array.isArray(opDirect?.titulos),
          titulosLen: opDirect?.titulos?.length,
          titulosSample: opDirect?.titulos?.[0] || null,
          sacadosIsArray: Array.isArray(opDirect?.sacados),
          sacadosLen: opDirect?.sacados?.length,
          sacadosSample: opDirect?.sacados?.[0] || null,
          valorNominal: opDirect?.valorNominal,
          valorFace: opDirect?.valorFace,
          valor: opDirect?.valor,
          total: opDirect?.total
        },
        subTitulos: {
          isArray: Array.isArray(subTitulos),
          len: Array.isArray(subTitulos) ? subTitulos.length : null,
          sample: Array.isArray(subTitulos) ? subTitulos[0] : subTitulos
        }
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2.2 Varredura Investigativa Completa da Operação no BitFin
  app.get('/api/mesa-operacoes/operacoes/:id/investigar', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });

      const operacaoId = req.params.id;
      const diag = await diagnoseBitfinOperation(operacaoId, token);
      return res.json({ success: true, ...diag });
    } catch (err) {
      return res.status(500).json({ error: `Erro na investigação: ${err.message}` });
    }
  });

  // 3. Exportação em XLSX dos Sacados Inconsistentes (com erro de CEP)
  app.get('/api/mesa-operacoes/operacoes/:id/exportar-xlsx', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data } = req.query;

      const details = await getOperationDetails({
        token,
        operacaoId,
        date: data
      });

      if (!details.sacadosInconsistentes || details.sacadosInconsistentes.length === 0) {
        return res.status(400).json({ error: 'Esta operação não possui sacados com erro de CEP para exportar.' });
      }

      const buffer = await generateSacadosInconsistentesExcel({
        operacao: details,
        sacadosInconsistentes: details.sacadosInconsistentes
      });

      const filename = `Sacados_Sem_Endereco_Verificado_Op_${operacaoId}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error(`Erro ao exportar XLSX da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao exportar planilha: ${err.message}` });
    }
  });

  // 3.1 Exportação em XLSX Completa da Operação (todos os dados, sacados, títulos, CEP e endereço - com ou sem erro)
  app.get('/api/mesa-operacoes/operacoes/:id/exportar-completo-xlsx', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data } = req.query;

      const details = await getOperationDetails({
        token,
        operacaoId,
        date: data
      });

      const buffer = await generateFullOperationExcel({
        operacao: details
      });

      const safeName = String(details.cedente?.nome || 'Operacao').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      const filename = `Operacao_${operacaoId}_Completa_${safeName}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error(`Erro ao exportar XLSX completo da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao exportar operação completa: ${err.message}` });
    }
  });

  // 4. Exportação granular de TÍTULOS e SACADOS com erro para refazer a operação
  app.get('/api/mesa-operacoes/operacoes/:id/exportar-titulos-xlsx', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data } = req.query;

      const details = await getOperationDetails({
        token,
        operacaoId,
        date: data
      });

      if (!details.sacadosInconsistentes || details.sacadosInconsistentes.length === 0) {
        return res.status(400).json({ error: 'Esta operação não possui sacados com erro de CEP para exportar.' });
      }

      const buffer = await generateTitulosInconsistentesExcel({
        operacao: details,
        sacadosInconsistentes: details.sacadosInconsistentes
      });

      const filename = `Titulos_e_Sacados_Com_Erro_Op_${operacaoId}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err) {
      console.error(`Erro ao exportar títulos em XLSX da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao exportar planilha de títulos: ${err.message}` });
    }
  });

  // 5. Exportação de Remessa CNAB 400 Corrigida (com todos os títulos da operação)
  app.get('/api/mesa-operacoes/operacoes/:id/exportar-cnab', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data } = req.query;

      const result = await generateCorrectedCnab400({
        token,
        operacaoId,
        date: data
      });

      const filename = `REM_OP_${operacaoId}_CORRIGIDA.REM`;
      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(Buffer.from(result.cnabContent, 'latin1'));
    } catch (err) {
      console.error(`Erro ao exportar CNAB 400 da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao gerar remessa CNAB: ${err.message}` });
    }
  });

  // 5.1 Construtor Consolidado de Remessa CNAB (Escopos: Valido / Erro / Completo | Modelos: Vortex / Bitfin)
  app.get('/api/mesa-operacoes/operacoes/:id/gerar-cnab', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data, escopo = 'completo', modelo = 'vortex' } = req.query;

      const result = await buildUnifiedCnabRemessa({
        token,
        operacaoId,
        date: data,
        escopo,
        modelo
      });

      if (!result.cnabContent) {
        return res.status(404).json({ error: `Nenhum título encontrado para o escopo "${escopo}".` });
      }

      const filename = result.filename || `REM_${modelo.toUpperCase()}_OP_${operacaoId}_${escopo.toUpperCase()}.REM`;

      if (req.query.format === 'json') {
        return res.json({
          success: true,
          filename,
          totalTitulos: result.totalTitulos,
          totalLinhas: result.totalLinhas,
          escopo: result.escopo,
          modelo: result.modelo,
          cnabBase64: Buffer.from(result.cnabContent, 'latin1').toString('base64')
        });
      }

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Total-Titulos', String(result.totalTitulos || 0));
      return res.send(Buffer.from(result.cnabContent, 'latin1'));
    } catch (err) {
      console.error(`Erro ao gerar remessa consolidada da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao gerar CNAB: ${err.message}` });
    }
  });

  // 6. Importação de Remessa CNAB enviada pelo Cedente + Correção Automática Pontual de CEPs
  app.post('/api/mesa-operacoes/operacoes/:id/corrigir-cnab-upload', requireSession, checkAccess, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Nenhum arquivo CNAB (.txt ou .rem) enviado.' });
      }

      const operacaoId = req.params.id;
      let inconsistentCnpjs = [];
      if (req.body?.inconsistentCnpjs) {
        try {
          inconsistentCnpjs = typeof req.body.inconsistentCnpjs === 'string'
            ? JSON.parse(req.body.inconsistentCnpjs)
            : req.body.inconsistentCnpjs;
        } catch (_) {}
      }

      const result = await correctUploadedCnab({
        fileBuffer: req.file.buffer,
        operacaoId,
        inconsistentCnpjs,
        token: getToken()
      });

      const filename = `REM_OP_${operacaoId}_CORRIGIDA.REM`;

      if (req.query.format === 'json') {
        return res.json({
          success: true,
          filename,
          totalLinhas: result.totalLinhas,
          totalTitulos: result.totalTitulos,
          totalCorrigidos: result.totalCorrigidos,
          totalOriginaisValidos: result.totalOriginaisValidos,
          detalhesCorrecoes: result.detalhesCorrecoes,
          cnabBase64: Buffer.from(result.cnabContent, 'latin1').toString('base64')
        });
      }

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Total-Titulos', String(result.totalTitulos));
      res.setHeader('X-Total-Corrigidos', String(result.totalCorrigidos));
      return res.send(Buffer.from(result.cnabContent, 'latin1'));
    } catch (err) {
      console.error(`Erro ao processar upload de CNAB da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao processar remessa: ${err.message}` });
    }
  });

  // 7. Validação Autônoma de CEPs de qualquer Arquivo CNAB (.txt / .rem)
  app.post('/api/mesa-operacoes/validar-ceps-cnab', requireSession, checkAccess, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Nenhum arquivo CNAB (.txt ou .rem) enviado.' });
      }

      const result = await analyzeCnabCeps(req.file.buffer);
      return res.json({
        success: true,
        filename: req.file.originalname,
        ...result
      });
    } catch (err) {
      console.error('Erro ao analisar CEPs do CNAB:', err);
      return res.status(500).json({ error: `Erro ao analisar arquivo CNAB: ${err.message}` });
    }
  });

  // 8. Geração de CNAB Corrigido a partir da Análise com Download Imediato
  app.post('/api/mesa-operacoes/gerar-cnab-corrigido', requireSession, checkAccess, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Nenhum arquivo CNAB (.txt ou .rem) enviado.' });
      }

      let corrections = [];
      if (req.body?.corrections) {
        try {
          corrections = typeof req.body.corrections === 'string'
            ? JSON.parse(req.body.corrections)
            : req.body.corrections;
        } catch (_) {}
      }

      const result = await generateCorrectedCnabFromAnalysis({
        fileBuffer: req.file.buffer,
        corrections
      });

      const originalName = req.file.originalname || 'REMESSA.REM';
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const correctedFilename = `${baseName}_CEPS_CORRIGIDOS.REM`;

      if (req.query.format === 'json') {
        return res.json({
          success: true,
          filename: correctedFilename,
          totalLinhas: result.totalLinhas,
          totalCorrigidos: result.totalCorrigidos,
          cnabBase64: Buffer.from(result.cnabContent, 'latin1').toString('base64')
        });
      }

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${correctedFilename}"`);
      res.setHeader('X-Total-Corrigidos', String(result.totalCorrigidos));
      return res.send(Buffer.from(result.cnabContent, 'latin1'));
    } catch (err) {
      console.error('Erro ao gerar CNAB corrigido:', err);
      return res.status(500).json({ error: `Erro ao gerar remessa corrigida: ${err.message}` });
    }
  });

  // 9. Exportação de CNAB Separado da Operação (Válidos OU Com Erro) sem alterar dados
  app.get('/api/mesa-operacoes/operacoes/:id/exportar-cnab-separado', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado no servidor.' });
      }

      const operacaoId = req.params.id;
      const { data, tipo = 'validos' } = req.query;

      const result = await splitOperationCnab400({
        token,
        operacaoId,
        date: data,
        targetType: tipo
      });

      if (!result.cnabContent) {
        return res.status(404).json({ error: `Nenhum título encontrado para o lote ${tipo}.` });
      }

      const suffix = tipo === 'erros' ? 'COM_ERRO_CEP' : 'VALIDOS';
      const filename = `REM_OP_${operacaoId}_${suffix}.REM`;

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Total-Titulos', String(result.totalTitulos));
      return res.send(Buffer.from(result.cnabContent, 'latin1'));
    } catch (err) {
      console.error(`Erro ao exportar CNAB separado da operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao gerar lote separado de CNAB: ${err.message}` });
    }
  });

  // 10. Upload e Separação de CNAB do Cedente na Operação (sem alterar dados)
  app.post('/api/mesa-operacoes/operacoes/:id/split-cnab-upload', requireSession, checkAccess, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Nenhum arquivo CNAB (.txt ou .rem) enviado.' });
      }

      const operacaoId = req.params.id;
      const { tipo = 'validos' } = req.query;

      let inconsistentCnpjs = [];
      if (req.body?.inconsistentCnpjs) {
        try {
          inconsistentCnpjs = typeof req.body.inconsistentCnpjs === 'string'
            ? JSON.parse(req.body.inconsistentCnpjs)
            : req.body.inconsistentCnpjs;
        } catch (_) {}
      }

      if (!inconsistentCnpjs.length) {
        const diag = await getOperationDetails({ token: getToken(), operacaoId });
        inconsistentCnpjs = (diag.sacadosInconsistentes || []).map(s => String(s.documento || '').replace(/\D/g, ''));
      }

      const result = splitCnab400File({
        fileBuffer: req.file.buffer,
        invalidDocs: inconsistentCnpjs,
        targetType: tipo
      });

      const cnabOut = tipo === 'erros' ? result.errorCnab : result.validCnab;
      const titulosCount = tipo === 'erros' ? result.totalTitulosErros : result.totalTitulosValidos;
      const totalLinhas = tipo === 'erros' ? result.errorTotalLinhas : result.validTotalLinhas;

      if (!cnabOut) {
        return res.status(404).json({ error: `Nenhum título encontrado para o lote ${tipo}.` });
      }

      const suffix = tipo === 'erros' ? 'COM_ERRO_CEP' : 'VALIDOS';
      const filename = `REM_OP_${operacaoId}_${suffix}.REM`;

      if (req.query.format === 'json') {
        return res.json({
          success: true,
          filename,
          totalLinhas,
          totalTitulos: titulosCount,
          cnabBase64: Buffer.from(cnabOut, 'latin1').toString('base64')
        });
      }

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Total-Titulos', String(titulosCount));
      return res.send(Buffer.from(cnabOut, 'latin1'));
    } catch (err) {
      console.error(`Erro ao particionar CNAB enviado na operação ${req.params.id}:`, err);
      return res.status(500).json({ error: `Erro ao particionar remessa: ${err.message}` });
    }
  });

  // 11. Particionamento de CNAB no Submenu "Validar CEPs" (sem alterar dados)
  app.post('/api/mesa-operacoes/validar-ceps/exportar-separado', requireSession, checkAccess, upload.single('file'), async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Nenhum arquivo CNAB (.txt ou .rem) enviado.' });
      }

      const { tipo = 'validos' } = req.query;

      let invalidDocs = [];
      if (req.body?.invalidDocs) {
        try {
          invalidDocs = typeof req.body.invalidDocs === 'string'
            ? JSON.parse(req.body.invalidDocs)
            : req.body.invalidDocs;
        } catch (_) {}
      }

      const result = splitCnab400File({
        fileBuffer: req.file.buffer,
        invalidDocs,
        targetType: tipo
      });

      const cnabOut = tipo === 'erros' ? result.errorCnab : result.validCnab;
      const titulosCount = tipo === 'erros' ? result.totalTitulosErros : result.totalTitulosValidos;
      const totalLinhas = tipo === 'erros' ? result.errorTotalLinhas : result.validTotalLinhas;

      if (!cnabOut) {
        return res.status(404).json({ error: `Nenhum título encontrado para o lote ${tipo}.` });
      }

      const originalName = req.file.originalname || 'REMESSA.REM';
      const baseName = originalName.replace(/\.[^/.]+$/, '');
      const suffix = tipo === 'erros' ? 'COM_ERRO_CEP' : 'VALIDOS';
      const filename = `${baseName}_${suffix}.REM`;

      if (req.query.format === 'json') {
        return res.json({
          success: true,
          filename,
          totalLinhas,
          totalTitulos: titulosCount,
          cnabBase64: Buffer.from(cnabOut, 'latin1').toString('base64')
        });
      }

      res.setHeader('Content-Type', 'text/plain; charset=iso-8859-1');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Total-Titulos', String(titulosCount));
      return res.send(Buffer.from(cnabOut, 'latin1'));
    } catch (err) {
      console.error('Erro ao particionar arquivo CNAB no módulo de CEPs:', err);
      return res.status(500).json({ error: `Erro ao particionar remessa: ${err.message}` });
    }
  });

  // =========================================================================
  // MESA DE OPERAÇÕES: WALLBOARD & ANALYTICS EM TEMPO REAL (BUSINESS INTELLIGENCE)
  // =========================================================================
  const liveStatsCache = new Map();
  const LIVE_CACHE_TTL_MS = 15 * 1000;

  function calculatePeriodRange(periodo = 'hoje', customInicio, customFim) {
    const now = new Date();
    const formatISOStart = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}T00:00:00`;
    };
    const formatISOEnd = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}T23:59:59`;
    };

    switch (periodo) {
      case 'hoje':
        return { inicio: formatISOStart(now), fim: formatISOEnd(now), label: 'Hoje (Ao Vivo)', isDaily: true };
      case '7d': {
        const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { inicio: formatISOStart(past), fim: formatISOEnd(now), label: 'Últimos 7 Dias', isDaily: false };
      }
      case '30d': {
        const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { inicio: formatISOStart(past), fim: formatISOEnd(now), label: 'Últimos 30 Dias', isDaily: false };
      }
      case 'mes': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { inicio: formatISOStart(startOfMonth), fim: formatISOEnd(now), label: 'Mês Atual', isDaily: false };
      }
      case 'ano': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return { inicio: formatISOStart(startOfYear), fim: formatISOEnd(now), label: `Ano Atual (${now.getFullYear()})`, isDaily: false };
      }
      case 'custom': {
        if (customInicio && customFim) {
          return {
            inicio: customInicio.includes('T') ? customInicio : `${customInicio}T00:00:00`,
            fim: customFim.includes('T') ? customFim : `${customFim}T23:59:59`,
            label: 'Período Personalizado',
            isDaily: false
          };
        }
        return { inicio: formatISOStart(now), fim: formatISOEnd(now), label: 'Hoje (Ao Vivo)', isDaily: true };
      }
      default:
        return { inicio: formatISOStart(now), fim: formatISOEnd(now), label: 'Hoje (Ao Vivo)', isDaily: true };
    }
  }

  async function fetchLiveOps(token, range, tipoDeData = 'Cadastro') {
    const cacheKey = `live_ops_${tipoDeData}_${range.inicio}_${range.fim}`;
    const cached = liveStatsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < LIVE_CACHE_TTL_MS) {
      return cached.data;
    }

    const API_BASE = 'https://lepta-backend.bit-unltd.com.br';
    let ops = [];
    try {
      const res = await fetch(`${API_BASE}/recebiveis/operacoes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `UNLTD-BackEnd ${token}`
        },
        body: JSON.stringify({
          tipoDeData,
          dataInicial: range.inicio,
          dataFinal: range.fim
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) ops = data;
      }
    } catch (err) {
      console.warn('Erro fetchLiveOps tentativa 1:', err.message);
    }

    // Se veio vazio, tenta alternar com/sem Z no payload
    if (ops.length === 0) {
      const altInicio = range.inicio.endsWith('Z') ? range.inicio.slice(0, -1) : `${range.inicio}Z`;
      const altFim = range.fim.endsWith('Z') ? range.fim.slice(0, -1) : `${range.fim}Z`;
      try {
        const res2 = await fetch(`${API_BASE}/recebiveis/operacoes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `UNLTD-BackEnd ${token}`
          },
          body: JSON.stringify({
            tipoDeData,
            dataInicial: altInicio,
            dataFinal: altFim
          })
        });
        if (res2.ok) {
          const data2 = await res2.json();
          if (Array.isArray(data2) && data2.length > 0) {
            ops = data2;
          }
        }
      } catch (_) {}
    }

    ops.sort((a, b) => new Date(b.dataDeCadastro || 0).getTime() - new Date(a.dataDeCadastro || 0).getTime());

    liveStatsCache.set(cacheKey, { data: ops, timestamp: Date.now() });
    return ops;
  }

  function formatCompactBRL(val) {
    const num = Number(val || 0);
    if (num >= 1000000) return `R$ ${(num / 1000000).toFixed(2).replace('.', ',')}M`;
    if (num >= 1000) return `R$ ${(num / 1000).toFixed(1).replace('.', ',')}k`;
    return `R$ ${num.toFixed(2).replace('.', ',')}`;
  }

  function computeLiveStats(operacoes, periodoLabel, isDaily) {
    let volumeBruto = 0;
    let volumeLiquido = 0;
    let totalTitulos = 0;

    let efetivadasQtd = 0;
    let efetivadasVolumeBruto = 0;
    let efetivadasVolumeLiquido = 0;

    let emAprovacaoQtd = 0;
    let emAprovacaoVolumeBruto = 0;
    let emAprovacaoVolumeLiquido = 0;

    let emAnaliseQtd = 0;
    let emAnaliseVolumeBruto = 0;
    let emAnaliseVolumeLiquido = 0;

    let comCoobrigacaoQtd = 0;
    let semCoobrigacaoQtd = 0;

    const porUnidade = {};
    const porProduto = {};
    const cedentesMap = new Map();
    const timelineMap = new Map();

    for (const op of operacoes) {
      const bruto = Number(op.totalBruto || op.valorTotal || op.valor || 0);
      const liquido = Number(op.totalLiquido || op.valorLiquido || bruto);
      const titulos = Number(op.quantidadeDeTitulos || op.quantidadeTitulos || 0);

      volumeBruto += bruto;
      volumeLiquido += liquido;
      totalTitulos += titulos;

      const statusRaw = String(op.situacao || op.status || op.statusOperacao || op.fase || '').trim().toLowerCase();

      // Regra de Classificação:
      // 1. 'aprovado (concluido)' / 'efetivada'
      const isEfetivada = !!op.efetivada ||
        statusRaw.includes('efetivad') ||
        statusRaw.includes('liquid') ||
        statusRaw.includes('concluid') ||
        statusRaw === 'aprovado' ||
        statusRaw === 'aprovada';

      // 2. 'em aprovação'
      const isEmAprovacao = !isEfetivada && (
        statusRaw.includes('em aprova') ||
        statusRaw.includes('em aprovação') ||
        statusRaw.includes('aprova') ||
        statusRaw.includes('comite') ||
        statusRaw.includes('comitê')
      );

      // 3. 'em análise': tudo que for <> de 'em aprovação' e 'aprovado (concluido)'
      const isEmAnalise = !isEfetivada && !isEmAprovacao;

      if (isEfetivada) {
        efetivadasQtd++;
        efetivadasVolumeBruto += bruto;
        efetivadasVolumeLiquido += liquido;
      } else if (isEmAprovacao) {
        emAprovacaoQtd++;
        emAprovacaoVolumeBruto += bruto;
        emAprovacaoVolumeLiquido += liquido;
      } else {
        emAnaliseQtd++;
        emAnaliseVolumeBruto += bruto;
        emAnaliseVolumeLiquido += liquido;
      }

      if (op.coobrigacao) {
        comCoobrigacaoQtd++;
      } else {
        semCoobrigacaoQtd++;
      }

      const unidade = op.contaOperacional?.unidadeAdministrativa?.alias || op.contaOperacional?.unidadeAdministrativa?.nome || 'Outros';
      if (!porUnidade[unidade]) porUnidade[unidade] = { qtd: 0, bruto: 0, liquido: 0 };
      porUnidade[unidade].qtd++;
      porUnidade[unidade].bruto += bruto;
      porUnidade[unidade].liquido += liquido;

      const produto = op.contaOperacional?.produto?.descricao || 'Outros';
      if (!porProduto[produto]) porProduto[produto] = { qtd: 0, bruto: 0, liquido: 0 };
      porProduto[produto].qtd++;
      porProduto[produto].bruto += bruto;
      porProduto[produto].liquido += liquido;

      const clienteNome = op.contaOperacional?.cliente?.entidade?.nome || op.cliente?.nome || op.cedente?.nome || 'Não identificado';
      const clienteDoc = op.contaOperacional?.cliente?.entidade?.documento || op.cliente?.documento || op.cedente?.documento || '';
      const docKey = clienteDoc || clienteNome;
      if (!cedentesMap.has(docKey)) {
        cedentesMap.set(docKey, { nome: clienteNome, documento: clienteDoc, qtd: 0, bruto: 0, liquido: 0 });
      }
      const c = cedentesMap.get(docKey);
      c.qtd++;
      c.bruto += bruto;
      c.liquido += liquido;

      const dt = new Date(op.dataDeCadastro || Date.now());
      let timeKey;
      let timeLabel;
      if (isDaily) {
        const hour = dt.getHours();
        timeKey = `${String(hour).padStart(2, '0')}:00`;
        timeLabel = `${String(hour).padStart(2, '0')}h`;
      } else {
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        timeKey = `${yyyy}-${mm}-${dd}`;
        timeLabel = `${dd}/${mm}`;
      }

      if (!timelineMap.has(timeKey)) {
        timelineMap.set(timeKey, { label: timeLabel, qtd: 0, bruto: 0, liquido: 0 });
      }
      const t = timelineMap.get(timeKey);
      t.qtd++;
      t.bruto += bruto;
      t.liquido += liquido;
    }

    const desagioTotal = Math.max(0, volumeBruto - volumeLiquido);
    const taxaDesagioMedia = volumeBruto > 0 ? (desagioTotal / volumeBruto) * 100 : 0;
    const totalOperacoes = operacoes.length;
    const ticketMedioOperacao = totalOperacoes > 0 ? volumeBruto / totalOperacoes : 0;
    const ticketMedioTitulo = totalTitulos > 0 ? volumeBruto / totalTitulos : 0;
    const taxaEfetivacaoQtd = totalOperacoes > 0 ? (efetivadasQtd / totalOperacoes) * 100 : 0;
    const taxaEfetivacaoVolume = volumeBruto > 0 ? (efetivadasVolumeBruto / volumeBruto) * 100 : 0;
    const percentualCoobrigacao = totalOperacoes > 0 ? (comCoobrigacaoQtd / totalOperacoes) * 100 : 0;
    const titulosPorOperacao = totalOperacoes > 0 ? Math.round((totalTitulos / totalOperacoes) * 10) / 10 : 0;

    const timeline = Array.from(timelineMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({
        dataOuHora: key,
        label: val.label,
        qtd: val.qtd,
        bruto: Math.round(val.bruto * 100) / 100,
        liquido: Math.round(val.liquido * 100) / 100,
        brutoLabel: formatCompactBRL(val.bruto),
        liqLabel: formatCompactBRL(val.liquido)
      }));

    const topCedentes = Array.from(cedentesMap.values())
      .sort((a, b) => b.bruto - a.bruto)
      .slice(0, 10);

    const knownColors = {
      'Lepta MS FIDC': '#06b6d4',
      'Lepta Special FIDC': '#a855f7',
      'Lepta Securitizadora': '#f59e0b'
    };
    const defaultColors = ['#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#14b8a6'];

    const porUnidadeList = Object.entries(porUnidade)
      .map(([name, val], idx) => ({
        name,
        percent: volumeBruto > 0 ? Math.round((val.bruto / volumeBruto) * 1000) / 10 : 0,
        valor: formatCompactBRL(val.bruto),
        bruto: Math.round(val.bruto * 100) / 100,
        liquido: Math.round(val.liquido * 100) / 100,
        qtd: val.qtd,
        color: knownColors[name] || defaultColors[idx % defaultColors.length]
      }))
      .sort((a, b) => b.bruto - a.bruto);

    const maxProdBruto = Math.max(...Object.values(porProduto).map(p => p.bruto), 10000);
    const maxBar = Math.ceil(maxProdBruto * 1.15);

    const porProdutoList = Object.entries(porProduto)
      .map(([name, val]) => ({
        name,
        bruto: Math.round(val.bruto * 100) / 100,
        max: maxBar,
        label: formatCompactBRL(val.bruto),
        qtd: val.qtd
      }))
      .sort((a, b) => b.bruto - a.bruto)
      .slice(0, 6);

    const step = maxBar / 6;
    const axisTicks = [0, 1, 2, 3, 4, 5, 6].map(i => {
      const v = i * step;
      if (v === 0) return '0';
      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
      return String(Math.round(v));
    });

    return {
      periodo: periodoLabel,
      totalOperacoes,
      totalTitulos,
      titulosPorOperacao,
      volumeBruto: Math.round(volumeBruto * 100) / 100,
      volumeLiquido: Math.round(volumeLiquido * 100) / 100,
      desagioTotal: Math.round(desagioTotal * 100) / 100,
      taxaDesagioMedia: Math.round(taxaDesagioMedia * 10) / 10,
      ticketMedioOperacao: Math.round(ticketMedioOperacao * 100) / 100,
      ticketMedioTitulo: Math.round(ticketMedioTitulo * 100) / 100,

      // Efetivação - 3 Status
      taxaEfetivacao: Math.round(taxaEfetivacaoVolume * 10) / 10,
      taxaEfetivacaoQtd: Math.round(taxaEfetivacaoQtd * 10) / 10,
      taxaEfetivacaoVolume: Math.round(taxaEfetivacaoVolume * 10) / 10,

      efetivadasQtd,
      efetivadasVolume: Math.round(efetivadasVolumeBruto * 100) / 100,
      efetivadasVolumeBruto: Math.round(efetivadasVolumeBruto * 100) / 100,
      efetivadasVolumeLiquido: Math.round(efetivadasVolumeLiquido * 100) / 100,

      emAprovacaoQtd,
      emAprovacaoVolume: Math.round(emAprovacaoVolumeBruto * 100) / 100,
      emAprovacaoVolumeBruto: Math.round(emAprovacaoVolumeBruto * 100) / 100,
      emAprovacaoVolumeLiquido: Math.round(emAprovacaoVolumeLiquido * 100) / 100,

      emAnaliseQtd,
      emAnaliseVolume: Math.round(emAnaliseVolumeBruto * 100) / 100,
      emAnaliseVolumeBruto: Math.round(emAnaliseVolumeBruto * 100) / 100,
      emAnaliseVolumeLiquido: Math.round(emAnaliseVolumeLiquido * 100) / 100,

      pendentesQtd: emAnaliseQtd + emAprovacaoQtd,
      pendentesVolume: Math.round((emAnaliseVolumeBruto + emAprovacaoVolumeBruto) * 100) / 100,
      pendentesVolumeBruto: Math.round((emAnaliseVolumeBruto + emAprovacaoVolumeBruto) * 100) / 100,

      comCoobrigacaoQtd,
      semCoobrigacaoQtd,
      comCoobQtd: comCoobrigacaoQtd,
      semCoobQtd: semCoobrigacaoQtd,
      coobrigacaoPercent: Math.round(percentualCoobrigacao * 10) / 10,
      percentualCoobrigacao: Math.round(percentualCoobrigacao * 10) / 10,

      porUnidade: porUnidadeList,
      porUnidadeMap: porUnidade,
      porProduto: porProdutoList,
      porProdutoMap: porProduto,
      axisTicks,
      topCedentes,
      timeline
    };
  }

  // 10. Listagem ao vivo para o Wallboard da Mesa
  app.get('/api/mesa-operacoes/live-operacoes', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado.' });

      const { periodo = 'hoje', dataInicial, dataFinal, status = 'todas', unidade = '', tipoDeData = 'Cadastro' } = req.query;
      const range = calculatePeriodRange(periodo, dataInicial, dataFinal);

      const operacoes = await fetchLiveOps(token, range, tipoDeData);

      let filtradas = operacoes;
      if (status === 'efetivadas') {
        filtradas = filtradas.filter(o => o.efetivada);
      } else if (status === 'pendentes') {
        filtradas = filtradas.filter(o => !o.efetivada);
      }

      if (unidade) {
        filtradas = filtradas.filter(o =>
          (o.contaOperacional?.unidadeAdministrativa?.alias === unidade) ||
          (o.contaOperacional?.unidadeAdministrativa?.nome === unidade)
        );
      }

      return res.json({
        success: true,
        periodoLabel: range.label,
        range,
        totalCount: filtradas.length,
        operacoes: filtradas
      });
    } catch (err) {
      console.error('Erro em /api/mesa-operacoes/live-operacoes:', err);
      return res.status(500).json({ error: `Erro ao buscar operações ao vivo: ${err.message}` });
    }
  });

  // 11. KPIs e Estatísticas consolidadas para o Wallboard
  app.get('/api/mesa-operacoes/live-stats', requireSession, checkAccess, async (req, res) => {
    try {
      const token = getToken();
      if (!token) return res.status(400).json({ error: 'Token UNLTD_API_TOKEN não configurado.' });

      const { periodo = 'hoje', dataInicial, dataFinal, tipoDeData = 'Cadastro' } = req.query;
      const range = calculatePeriodRange(periodo, dataInicial, dataFinal);

      const operacoes = await fetchLiveOps(token, range, tipoDeData);
      const stats = computeLiveStats(operacoes, range.label, range.isDaily);

      return res.json({
        success: true,
        stats
      });
    } catch (err) {
      console.error('Erro em /api/mesa-operacoes/live-stats:', err);
      return res.status(500).json({ error: `Erro ao calcular estatísticas ao vivo: ${err.message}` });
    }
  });
}



