import express from 'express';
import { getTickerData } from './tickerService.js';

export function registerTickerRoutes(app) {
  app.get('/api/market-ticker', async (req, res) => {
    try {
      const data = await getTickerData();
      res.json(data);
    } catch (error) {
      console.error('Erro na rota market-ticker:', error);
      res.status(500).json({ error: 'Erro ao buscar cotações do mercado' });
    }
  });
}
