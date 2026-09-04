import multer from 'multer';
import {
  listOperationsByDate,
  getOperationDetails,
  generateSacadosInconsistentesExcel,
  generateTitulosInconsistentesExcel,
  diagnoseBitfinOperation,
  generateCorrectedCnab400,
  correctUploadedCnab,
  analyzeCnabCeps,
  generateCorrectedCnabFromAnalysis,
  splitCnab400File,
  splitOperationCnab400
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
}


