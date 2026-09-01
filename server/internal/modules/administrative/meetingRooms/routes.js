import { Router } from 'express';

export function registerMeetingRoomRoutes(app, { db, requireSession, requirePermission }) {
  // Inicialização da tabela de salas de reunião
  db.exec(`
    CREATE TABLE IF NOT EXISTS salas_reuniao_agendamentos (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      data TEXT NOT NULL,
      horario_inicio TEXT NOT NULL,
      horario_fim TEXT NOT NULL,
      sala TEXT NOT NULL,
      tipo_reuniao TEXT NOT NULL,
      empresa TEXT DEFAULT '',
      participantes TEXT DEFAULT '',
      observacoes TEXT DEFAULT '',
      solicitante_id TEXT NOT NULL,
      solicitante_nome TEXT NOT NULL,
      solicitante_email TEXT DEFAULT '',
      status TEXT DEFAULT 'CONFIRMADO',
      cancelado_por TEXT DEFAULT NULL,
      motivo_cancelamento TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_salas_data_sala ON salas_reuniao_agendamentos(data, sala);
    CREATE INDEX IF NOT EXISTS idx_salas_status ON salas_reuniao_agendamentos(status);
  `);

  const router = Router();

  // Helper para verificar conflito de horário na mesma sala e mesma data
  function checkScheduleConflict(sala, data, horarioInicio, horarioFim, ignoreId = null) {
    let query = `
      SELECT * FROM salas_reuniao_agendamentos
      WHERE sala = ?
        AND data = ?
        AND status = 'CONFIRMADO'
        AND (
          (horario_inicio < ? AND horario_fim > ?)
        )
    `;
    const params = [sala, data, horarioFim, horarioInicio];

    if (ignoreId) {
      query += ` AND id != ?`;
      params.push(ignoreId);
    }

    query += ` LIMIT 1`;
    return db.prepare(query).get(...params);
  }

  // 1. Listar agendamentos com filtros
  router.get('/', requireSession, requirePermission('11.3', '11'), (req, res) => {
    try {
      const { data, mes, sala, tipo_reuniao, status, apenas_minhas } = req.query;
      let query = `SELECT * FROM salas_reuniao_agendamentos WHERE 1=1`;
      const params = [];

      if (data) {
        query += ` AND data = ?`;
        params.push(data);
      } else if (mes) {
        query += ` AND data LIKE ?`;
        params.push(`${mes}%`);
      }

      if (sala && sala !== 'TODAS') {
        query += ` AND sala = ?`;
        params.push(sala);
      }

      if (tipo_reuniao && tipo_reuniao !== 'TODOS') {
        query += ` AND tipo_reuniao = ?`;
        params.push(tipo_reuniao);
      }

      if (status && status !== 'TODOS') {
        query += ` AND status = ?`;
        params.push(status);
      } else if (!status) {
        // Por padrão não exibe reuniões canceladas a não ser que filtrado
        query += ` AND status != 'CANCELADO'`;
      }

      if (apenas_minhas === 'true') {
        query += ` AND solicitante_id = ?`;
        params.push(req.authUser.id);
      }

      query += ` ORDER BY data ASC, horario_inicio ASC`;

      const agendamentos = db.prepare(query).all(...params);
      res.json(agendamentos);
    } catch (err) {
      console.error('Erro ao listar agendamentos de salas:', err);
      res.status(500).json({ error: 'Erro ao carregar agendamentos de salas de reunião.' });
    }
  });

  // 2. Métricas / Estatísticas de salas
  router.get('/stats', requireSession, requirePermission('11.3', '11'), (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7);

      const reunioesHoje = db.prepare(`
        SELECT COUNT(*) as count FROM salas_reuniao_agendamentos 
        WHERE data = ? AND status = 'CONFIRMADO'
      `).get(today)?.count || 0;

      const totalMes = db.prepare(`
        SELECT COUNT(*) as count FROM salas_reuniao_agendamentos 
        WHERE data LIKE ? AND status = 'CONFIRMADO'
      `).get(`${currentMonth}%`)?.count || 0;

      const salaDiretoriaFuturas = db.prepare(`
        SELECT COUNT(*) as count FROM salas_reuniao_agendamentos 
        WHERE sala = 'Sala da Diretoria' AND data >= ? AND status = 'CONFIRMADO'
      `).get(today)?.count || 0;

      const sala1Futuras = db.prepare(`
        SELECT COUNT(*) as count FROM salas_reuniao_agendamentos 
        WHERE sala = 'Sala 1' AND data >= ? AND status = 'CONFIRMADO'
      `).get(today)?.count || 0;

      res.json({
        reunioesHoje,
        totalMes,
        salaDiretoriaFuturas,
        sala1Futuras,
        today,
        currentMonth
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas de salas:', err);
      res.status(500).json({ error: 'Erro ao carregar métricas.' });
    }
  });

  // 3. Checagem de disponibilidade em tempo real
  router.get('/check-availability', requireSession, requirePermission('11.3', '11'), (req, res) => {
    try {
      const { sala, data, horario_inicio, horario_fim, ignore_id } = req.query;
      if (!sala || !data || !horario_inicio || !horario_fim) {
        return res.status(400).json({ error: 'Parâmetros insuficientes para validação.' });
      }

      const conflito = checkScheduleConflict(
        String(sala).trim(),
        String(data).trim(),
        String(horario_inicio).trim(),
        String(horario_fim).trim(),
        ignore_id ? String(ignore_id).trim() : null
      );

      if (conflito) {
        return res.json({
          available: false,
          conflict: {
            id: conflito.id,
            titulo: conflito.titulo,
            horario_inicio: conflito.horario_inicio,
            horario_fim: conflito.horario_fim,
            solicitante_nome: conflito.solicitante_nome,
            empresa: conflito.empresa
          }
        });
      }

      return res.json({ available: true });
    } catch (err) {
      console.error('Erro ao checar disponibilidade:', err);
      res.status(500).json({ error: 'Erro ao verificar disponibilidade de horário.' });
    }
  });

  // 4. Criar novo agendamento
  router.post('/', requireSession, requirePermission('11.3', '11'), (req, res) => {
    try {
      const {
        titulo,
        data,
        horario_inicio,
        horario_fim,
        sala,
        tipo_reuniao,
        empresa,
        participantes,
        observacoes
      } = req.body || {};

      if (!titulo || !String(titulo).trim()) {
        return res.status(400).json({ error: 'O título/assunto da reunião é obrigatório.' });
      }
      if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return res.status(400).json({ error: 'Data inválida (formato esperado AAAA-MM-DD).' });
      }
      if (!horario_inicio || !horario_fim) {
        return res.status(400).json({ error: 'Horário de início e término são obrigatórios.' });
      }
      if (horario_inicio >= horario_fim) {
        return res.status(400).json({ error: 'O horário de término deve ser posterior ao horário de início.' });
      }

      const allowedSalas = ['Sala da Diretoria', 'Sala 1'];
      if (!allowedSalas.includes(sala)) {
        return res.status(400).json({ error: 'Sala selecionada inválida. Opções: Sala da Diretoria ou Sala 1.' });
      }

      const allowedTipos = ['Interna', 'Externa'];
      if (!allowedTipos.includes(tipo_reuniao)) {
        return res.status(400).json({ error: 'Tipo de reunião inválido. Opções: Interna ou Externa.' });
      }

      // Validação de conflito de agenda na mesma sala e mesma data
      const conflito = checkScheduleConflict(sala, data, horario_inicio, horario_fim);
      if (conflito) {
        return res.status(409).json({
          error: `Conflito de agenda: A "${sala}" já está reservada no dia ${data} das ${conflito.horario_inicio} às ${conflito.horario_fim} por ${conflito.solicitante_nome} ("${conflito.titulo || conflito.empresa || 'Reunião'}").`
        });
      }

      const id = `mtg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const user = req.authUser;
      const solicitanteNome = user.name || user.username || 'Colaborador';
      const solicitanteEmail = user.email || '';

      db.prepare(`
        INSERT INTO salas_reuniao_agendamentos (
          id, titulo, data, horario_inicio, horario_fim, sala,
          tipo_reuniao, empresa, participantes, observacoes,
          solicitante_id, solicitante_nome, solicitante_email,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADO', ?, ?)
      `).run(
        id,
        String(titulo).trim(),
        String(data).trim(),
        String(horario_inicio).trim(),
        String(horario_fim).trim(),
        sala,
        tipo_reuniao,
        String(empresa || '').trim(),
        String(participantes || '').trim(),
        String(observacoes || '').trim(),
        user.id,
        solicitanteNome,
        solicitanteEmail,
        now,
        now
      );

      const novoAgendamento = db.prepare(`SELECT * FROM salas_reuniao_agendamentos WHERE id = ?`).get(id);
      res.status(201).json(novoAgendamento);
    } catch (err) {
      console.error('Erro ao agendar sala de reunião:', err);
      res.status(500).json({ error: 'Erro interno ao salvar agendamento.' });
    }
  });

  // 5. Cancelar agendamento (somente solicitante ou MASTER)
  router.post('/:id/cancel', requireSession, requirePermission('11.3', '11'), (req, res) => {
    try {
      const { id } = req.params;
      const { motivo } = req.body || {};

      const agendamento = db.prepare(`SELECT * FROM salas_reuniao_agendamentos WHERE id = ?`).get(id);
      if (!agendamento) {
        return res.status(404).json({ error: 'Agendamento não encontrado.' });
      }

      const isOwner = req.authUser.id === agendamento.solicitante_id;
      const isMaster = req.authUser.role === 'MASTER';

      if (!isOwner && !isMaster) {
        return res.status(403).json({ error: 'Você só pode cancelar agendamentos solicitados por você.' });
      }

      const now = new Date().toISOString();
      const canceladoPor = req.authUser.name || req.authUser.username;

      db.prepare(`
        UPDATE salas_reuniao_agendamentos
        SET status = 'CANCELADO',
            cancelado_por = ?,
            motivo_cancelamento = ?,
            updated_at = ?
        WHERE id = ?
      `).run(canceladoPor, String(motivo || 'Cancelado pelo solicitante').trim(), now, id);

      const atualizado = db.prepare(`SELECT * FROM salas_reuniao_agendamentos WHERE id = ?`).get(id);
      res.json(atualizado);
    } catch (err) {
      console.error('Erro ao cancelar agendamento:', err);
      res.status(500).json({ error: 'Erro ao cancelar agendamento.' });
    }
  });

  app.use('/api/administrative/meeting-rooms', router);
}
