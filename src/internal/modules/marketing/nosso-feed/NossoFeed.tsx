import React, { useState, useEffect } from 'react';
import { Megaphone, Send, CheckCircle, Radio, Sparkles, Image, RefreshCw, Eye } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './NossoFeed.css';

interface FeedData {
  id?: number;
  title: string;
  content: string;
  media_url: string;
  theme: string;
  is_active?: number;
  published_at?: string;
  created_by?: string;
}

export const NossoFeed: React.FC = () => {
  const [feed, setFeed] = useState<FeedData>({
    title: '',
    content: '',
    media_url: '',
    theme: 'black'
  });

  const [currentLiveFeed, setCurrentLiveFeed] = useState<FeedData | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Carrega publicação atual do feed
  const loadCurrentFeed = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/feed/current`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        if (json.feed) {
          setCurrentLiveFeed(json.feed);
          setFeed({
            title: json.feed.title || '',
            content: json.feed.content || '',
            media_url: json.feed.media_url || '',
            theme: json.feed.theme || 'black'
          });
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar feed atual:', err);
    }
  };

  useEffect(() => {
    loadCurrentFeed();

    // Conecta ao SSE para saber se o servidor de broadcast está online
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/marketing/feed/stream`);
      eventSource.onopen = () => setIsConnected(true);
      eventSource.onerror = () => setIsConnected(false);
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.data) {
            setCurrentLiveFeed(payload.data);
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handlePublish = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsPublishing(true);
    setPublishSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/api/marketing/feed/publish`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feed)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.feed) {
          setCurrentLiveFeed(data.feed);
        }
        setPublishSuccess(true);
        setTimeout(() => setPublishSuccess(false), 4000);
      } else {
        alert('Erro ao publicar no feed. Tente novamente.');
      }
    } catch (err) {
      console.error('Falha ao publicar feed:', err);
      alert('Falha na comunicação com o servidor.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleResetBlack = () => {
    setFeed({
      title: '',
      content: '',
      media_url: '',
      theme: 'black'
    });
  };

  return (
    <div className="nosso-feed-page">
      <div className="nosso-feed-header">
        <div className="nosso-feed-title-block">
          <div className="nosso-feed-icon-wrap">
            <Megaphone size={22} />
          </div>
          <div>
            <h1>Nosso Feed · Marketing</h1>
            <p>Gerencie e publique comunicados e conteúdos ao vivo no telão da Mesa de Operações.</p>
          </div>
        </div>

        <div className="nosso-feed-status-pill">
          <Radio size={14} className={isConnected ? 'radio-pulse' : ''} />
          <span>{isConnected ? 'Telão Sincronizado (Online)' : 'Servidor Conectado'}</span>
        </div>
      </div>

      <div className="nosso-feed-grid">
        {/* Painel de Edição e Publicação */}
        <div className="nosso-feed-card edit-card">
          <div className="nosso-feed-card-header">
            <h3>Novo Comunicado</h3>
            <span className="nosso-feed-badge">Transmissão em Tempo Real</span>
          </div>

          <form onSubmit={handlePublish} className="nosso-feed-form">
            <div className="form-group">
              <label>Título do Comunicado</label>
              <input
                type="text"
                placeholder="Ex: Novo Recorde Batido pela Mesa de Operações!"
                value={feed.title}
                onChange={(e) => setFeed({ ...feed, title: e.target.value })}
                className="nosso-feed-input"
              />
            </div>

            <div className="form-group">
              <label>Conteúdo / Mensagem</label>
              <textarea
                placeholder="Escreva a mensagem ou detalhes que serão exibidos no telão..."
                value={feed.content}
                onChange={(e) => setFeed({ ...feed, content: e.target.value })}
                rows={5}
                className="nosso-feed-textarea"
              />
            </div>

            <div className="form-group">
              <label>URL de Imagem / Banner (Opcional)</label>
              <div className="input-icon-wrap">
                <Image size={16} className="input-icon" />
                <input
                  type="url"
                  placeholder="https://exemplo.com/banner-comunicado.png"
                  value={feed.media_url}
                  onChange={(e) => setFeed({ ...feed, media_url: e.target.value })}
                  className="nosso-feed-input with-icon"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Tema do Fundo</label>
              <div className="theme-selector">
                <button
                  type="button"
                  className={`theme-btn ${feed.theme === 'black' ? 'active' : ''}`}
                  onClick={() => setFeed({ ...feed, theme: 'black' })}
                >
                  <span className="theme-swatch black" />
                  <span>Preto Puro (Padrão)</span>
                </button>
                <button
                  type="button"
                  className={`theme-btn ${feed.theme === 'navy' ? 'active' : ''}`}
                  onClick={() => setFeed({ ...feed, theme: 'navy' })}
                >
                  <span className="theme-swatch navy" />
                  <span>Azul Noturno</span>
                </button>
                <button
                  type="button"
                  className={`theme-btn ${feed.theme === 'amber' ? 'active' : ''}`}
                  onClick={() => setFeed({ ...feed, theme: 'amber' })}
                >
                  <span className="theme-swatch amber" />
                  <span>Destaque Ouro</span>
                </button>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-outline-clear"
                onClick={handleResetBlack}
                title="Limpar campos para deixar a tela em preto"
              >
                <RefreshCw size={15} /> Limpar
              </button>

              <button
                type="submit"
                disabled={isPublishing}
                className="btn-publish-feed"
              >
                {isPublishing ? (
                  <>Transmitindo...</>
                ) : publishSuccess ? (
                  <>
                    <CheckCircle size={17} /> Publicado no Telão!
                  </>
                ) : (
                  <>
                    <Send size={17} /> Publicar no Feed da Mesa
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Painel de Pré-visualização Ao Vivo */}
        <div className="nosso-feed-card preview-card">
          <div className="nosso-feed-card-header">
            <h3>
              <Eye size={17} /> Pré-visualização do Telão
            </h3>
            <span className="live-tag">
              <span className="live-dot" /> VISÃO DA MESA
            </span>
          </div>

          <p className="preview-desc">
            Abaixo está a exibição ao vivo no exato formato que a Mesa de Operações renderiza quando rotaciona para o botão <strong>Nosso Feed</strong>:
          </p>

          <div className={`mesa-feed-mock-stage theme-${feed.theme || 'black'}`}>
            <div className="mock-stage-topbar">
              <div className="mock-brand">
                <span className="mock-dot" /> LEPTA FEED · MARKETING
              </div>
              <div className="mock-badge">AO VIVO NO TELÃO</div>
            </div>

            <div className="mock-stage-content">
              {feed.title || feed.content || feed.media_url ? (
                <div className="mock-content-box">
                  {feed.media_url && (
                    <div className="mock-media-wrap">
                      <img src={feed.media_url} alt="Mídia do Feed" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    </div>
                  )}
                  {feed.title && <h2 className="mock-title">{feed.title}</h2>}
                  {feed.content && <p className="mock-text">{feed.content}</p>}
                </div>
              ) : (
                <div className="mock-empty-black">
                  <Sparkles size={28} className="empty-sparkle" />
                  <p className="empty-label">Tela do Feed Ativa em Fundo Preto</p>
                  <span className="empty-hint">Aguardando novo comunicado ou publicação do Marketing.</span>
                </div>
              )}
            </div>

            <div className="mock-stage-footer">
              <span>Transmissão Automática · Rotatividade de 30 Segundos na Mesa</span>
              {currentLiveFeed?.published_at && (
                <span>Última Publicação: {new Date(currentLiveFeed.published_at).toLocaleTimeString('pt-BR')}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NossoFeed;
