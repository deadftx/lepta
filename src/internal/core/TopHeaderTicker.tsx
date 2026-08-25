import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../config/api';
import './TopHeaderTicker.css';

interface MarketQuote {
  key: string;
  name: string;
  value: string;
  change: string;
  positive: boolean;
}

interface TickerData {
  quotes: MarketQuote[];
  updatedAt?: string;
}

export const TopHeaderTicker: React.FC = () => {
  const [data, setData] = useState<TickerData>({
    quotes: [
      { key: 'ibov', name: 'Ibovespa', value: '131.250 pts', change: '+0.42%', positive: true },
      { key: 'usd', name: 'Dólar Comercial', value: 'R$ 5,68', change: '+0.15%', positive: true },
      { key: 'eur', name: 'Euro', value: 'R$ 6,18', change: '+0.28%', positive: true },
      { key: 'btc', name: 'Bitcoin', value: 'US$ 91.500', change: '+1.85%', positive: true },
      { key: 'ouro', name: 'Ouro', value: 'US$ 2.920,00', change: '-0.12%', positive: false },
      { key: 'brent', name: 'Brent', value: 'US$ 73,80', change: '-0.95%', positive: false }
    ]
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Drag & Scroll State
  const isDraggingRef = useRef(false);
  const isHoveredRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const animFrameIdRef = useRef<number | null>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const fetchTicker = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-ticker`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.quotes && json.quotes.length > 0) {
          setData({ quotes: json.quotes, updatedAt: json.updatedAt });
        }
      }
    } catch (err) {
      console.warn('Erro ao atualizar ticker de mercado:', err);
    }
  };

  useEffect(() => {
    fetchTicker();
    const interval = setInterval(fetchTicker, 60000);
    return () => clearInterval(interval);
  }, []);

  // Continuous Auto-scroll with Resume
  const scrollStep = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;

    if (container && track && !isDraggingRef.current && !isHoveredRef.current) {
      const halfWidth = track.scrollWidth / 2;
      container.scrollLeft += 0.65; // Velocidade confortável de leitura

      if (container.scrollLeft >= halfWidth) {
        container.scrollLeft = container.scrollLeft - halfWidth;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scrollStep);
  }, []);

  useEffect(() => {
    animFrameIdRef.current = requestAnimationFrame(scrollStep);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [scrollStep]);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    setIsGrabbing(true);
    startXRef.current = e.pageX - containerRef.current.offsetLeft;
    startScrollLeftRef.current = containerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    let newScrollLeft = startScrollLeftRef.current - walk;

    const halfWidth = trackRef.current.scrollWidth / 2;
    if (newScrollLeft < 0) {
      newScrollLeft += halfWidth;
    } else if (newScrollLeft >= halfWidth) {
      newScrollLeft -= halfWidth;
    }

    containerRef.current.scrollLeft = newScrollLeft;
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsGrabbing(false);
    }
  };

  // Touch Handlers for touchscreens
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.touches[0].pageX - containerRef.current.offsetLeft;
    startScrollLeftRef.current = containerRef.current.scrollLeft;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !containerRef.current || !trackRef.current) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    let newScrollLeft = startScrollLeftRef.current - walk;

    const halfWidth = trackRef.current.scrollWidth / 2;
    if (newScrollLeft < 0) newScrollLeft += halfWidth;
    else if (newScrollLeft >= halfWidth) newScrollLeft -= halfWidth;

    containerRef.current.scrollLeft = newScrollLeft;
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

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
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`top-header-ticker-container ${isGrabbing ? 'grabbing' : ''}`}
      title="Cotações de Mercado em Tempo Real • Clique e arraste para rolar"
      onMouseEnter={() => { isHoveredRef.current = true; }}
      onMouseLeave={() => { isHoveredRef.current = false; handleMouseUpOrLeave(); }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={trackRef} className="top-header-ticker-track">
        {renderTickerContent()}
        {renderTickerContent()}
      </div>
    </div>
  );
};

export default TopHeaderTicker;
