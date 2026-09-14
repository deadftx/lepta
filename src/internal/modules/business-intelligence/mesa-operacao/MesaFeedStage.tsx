import React, { useState, useEffect } from 'react';
import { Sparkles, Radio } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';

export interface FeedPayload {
  id?: number;
  title: string;
  content: string;
  media_url?: string;
  theme?: string;
  is_active?: number;
  published_at?: string;
  created_by?: string;
}

export const MesaFeedStage: React.FC = () => {
  const [feed, setFeed] = useState<FeedPayload | null>(null);
  const [isLiveOnline, setIsLiveOnline] = useState<boolean>(false);

  // 1. Carregamento inicial do feed
  const fetchFeed = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/feed/current`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.feed) {
          setFeed(json.feed);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFeed();

    // 2. Conexão SSE em Tempo Real (Zero Latência)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/marketing/feed/stream`);

      eventSource.onopen = () => {
        setIsLiveOnline(true);
      };

      eventSource.onerror = () => {
        setIsLiveOnline(false);
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.data) {
            setFeed(payload.data);
            setIsLiveOnline(true);
          }
        } catch (_) {}
      };
    } catch (_) {}

    // 3. Fallback polling a cada 5s para garantia absoluta
    const pollInterval = setInterval(fetchFeed, 5000);

    return () => {
      clearInterval(pollInterval);
      if (eventSource) eventSource.close();
    };
  }, []);

  const hasContent = !!(feed && (feed.title?.trim() || feed.content?.trim() || feed.media_url?.trim()));

  return (
    <div className={`mesa-feed-stage-container ${feed?.theme ? `theme-${feed.theme}` : 'theme-black'}`}>
      {/* Topo discreto da tela de feed */}
      <div className="mesa-feed-stage-topbar">
        <div className="mesa-feed-stage-brand">
          <span className="mesa-feed-dot" />
          <span>NOSSO FEED · MARKETING</span>
        </div>
        <div className="mesa-feed-stage-status">
          <Radio size={12} className={isLiveOnline ? 'pulse-live' : ''} />
          <span>{isLiveOnline ? 'TRANSMISSÃO AO VIVO (SYNC ONLINE)' : 'CONECTANDO...'}</span>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="mesa-feed-stage-main">
        {hasContent ? (
          <div className="mesa-feed-content-card">
            {feed.media_url && (
              <div className="mesa-feed-media-wrap">
                <img
                  src={feed.media_url}
                  alt="Mídia do Feed"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            {feed.title && <h1 className="mesa-feed-title">{feed.title}</h1>}
            {feed.content && <p className="mesa-feed-text">{feed.content}</p>}
          </div>
        ) : (
          <div className="mesa-feed-empty-black">
            <div className="mesa-feed-idle-halo" />
            <Sparkles size={36} className="mesa-feed-sparkle" />
            <h2 className="mesa-feed-empty-title">LEPTA FEED</h2>
            <p className="mesa-feed-empty-sub">Canal integrado com Marketing. Aguardando próximas publicações.</p>
          </div>
        )}
      </div>

      {/* Rodapé discreto da tela de feed */}
      <div className="mesa-feed-stage-footer">
        <span>LEPTA CAPITAL · PAINEL EXECUTIVO</span>
        {feed?.published_at && (
          <span>
            ÚLTIMA ATUALIZAÇÃO: {new Date(feed.published_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
};

export default MesaFeedStage;
