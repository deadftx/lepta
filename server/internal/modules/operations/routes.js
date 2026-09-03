import {
  listOperationsByDate,
  getOperationDetails,
  generateSacadosInconsistentesExcel,
  generateTitulosInconsistentesExcel
} from './operationsService.js';

export function registerOperationsRoutes(app, {
  requireSession,
  checkAccess,
  unltdToken
}) {
  const getToken = () => unltdToken || process.env.UNLTD_API_TOKEN;

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
}
