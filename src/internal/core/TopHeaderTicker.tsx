import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../config/api';
import './TopHeaderTicker.css';

interface MarketQuote {
  key: string;
  name: string;
  value: string;
  change: string;
  positive: boolean;
}

interface BankruptcyItem {
  empresa: string;
  tipo: string;
  info: string;
}

interface TickerData {
  quotes: MarketQuote[];
  bankruptcies: BankruptcyItem[];
  updatedAt?: string;
}

export const TopHeaderTicker: React.FC = () => {
  const [data, setData] = useState<TickerData>({
    quotes: [
      { key: 'ibov', name: 'Ibovespa', value: 'Carregando...', change: '0.00%', positive: true },
      { key: 'usd', name: 'Dólar Comercial', value: 'R$ --', change: '0.00%', positive: true },
      { key: 'eur', name: 'Euro', value: 'R$ --', change: '0.00%', positive: true },
      { key: 'btc', name: 'Bitcoin', value: 'US$ --', change: '0.00%', positive: true },
      { key: 'ouro', name: 'Ouro', value: 'US$ --', change: '0.00%', positive: false },
      { key: 'brent', name: 'Brent', value: 'US$ --', change: '0.00%', positive: false }
    ],
    bankruptcies: []
  });

  const fetchTicker = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-ticker`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.quotes && json.quotes.length > 0) {
          setData(json);
        }
      }
    } catch (err) {
      console.warn('Erro ao atualizar ticker de mercado:', err);
    }
  };

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, 60000); // 60 segundos
    return () => clearInterval(interval);
  }, []);

  const renderTickerContent = () => (
    <>
      {data.quotes.map((q) => (
        <React.Fragment key={q.key}>
          <div className="top-ticker-item">
            <strong>{q.name}:</strong>
            <span>{q.value}</span>
            <span className={`top-ticker-val ${q.positive ? 'positive' : 'negative'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {q.positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              ({q.change})
            </span>
          </div>
          <span className="top-ticker-separator">•</span>
        </React.Fragment>
      ))}

      {data.bankruptcies && data.bankruptcies.length > 0 && (
        <>
          <div className="top-ticker-item">
            <span className="top-ticker-badge-falencia">
              <AlertTriangle size={13} /> Falências do Dia (Valor):
            </span>
            <span style={{ color: '#fca5a5', fontWeight: 600 }}>
              {data.bankruptcies.map(b => b.empresa).join(', ')}
            </span>
          </div>
          <span className="top-ticker-separator">•</span>
        </>
      )}
    </>
  );

  return (
    <div className="top-header-ticker-container" title="Cotações de mercado e falências em tempo real (Passe o mouse para pausar)">
      <div className="top-header-ticker-track">
        {renderTickerContent()}
        {renderTickerContent()}
      </div>
    </div>
  );
};

export default TopHeaderTicker;
