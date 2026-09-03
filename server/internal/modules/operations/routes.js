import {
  listOperationsByDate,
  getOperationDetails,
  generateSacadosInconsistentesExcel
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
}
