import React, { useState, useEffect, useRef } from 'react';
import { BarChart2, Radio, Sparkles } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import type { HubConfig, FrameData } from '../../marketing/nosso-feed/NossoFeed';
import {
  DEFAULT_CONFIG,
  PRESET_CAPACITIES,
  PRESET_SEQUENCE
} from '../../marketing/nosso-feed/NossoFeed';
import '../../marketing/nosso-feed/NossoFeed.css';

const getYoutubeEmbedUrl = (url?: string, videoId?: string) => {
  if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  const id = match ? match[1] : '';
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}` : url;
};

const getInstagramPostId = (url?: string) => {
  if (!url) return '';
  const match = url.match(/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
};

export const MesaFeedStage: React.FC = () => {
  const [config, setConfig] = useState<HubConfig>(() => {
    try {
      const saved = localStorage.getItem('lepta_feed_tv_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_CONFIG;
  });

  const [isLiveOnline, setIsLiveOnline] = useState<boolean>(false);
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});
  const autoPlayTimerRef = useRef<any>(null);

  // 1. Carrega configuração inicial do banco e inicializa SSE para sincronização instantânea
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/marketing/feed/hub-config`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.config) {
            setConfig(prev => ({ ...prev, ...json.config }));
            setIsLiveOnline(true);
          }
        }
      } catch (_) {}
    };

    fetchConfig();

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
          if (payload.type === 'HUB_CONFIG_UPDATE') {
            const newConfig = payload.data || payload.raw?.config || payload.config;
            if (newConfig) {
              setConfig(newConfig);
              setIsLiveOnline(true);
              try {
                localStorage.setItem('lepta_feed_tv_config', JSON.stringify(newConfig));
              } catch (_) {}
            }
          } else if (payload.type === 'INIT' && payload.hubConfig) {
            setConfig(prev => ({ ...prev, ...payload.hubConfig }));
            setIsLiveOnline(true);
          } else if (payload.type === 'POLL_VOTE') {
            const frameIdx = payload.data?.frameIndex ?? payload.frameIndex;
            const optId = payload.data?.optionId ?? payload.optionId;
            const votesCount = payload.data?.votes ?? payload.votes;

            if (frameIdx !== undefined && optId !== undefined) {
              setConfig(prev => {
                const nextFrames = [...prev.frames];
                if (nextFrames[frameIdx]?.poll) {
                  const poll = { ...nextFrames[frameIdx].poll! };
                  poll.options = poll.options.map(o => o.id === optId ? { ...o, votes: votesCount } : o);
                  nextFrames[frameIdx] = { ...nextFrames[frameIdx], poll };
                  return { ...prev, frames: nextFrames };
                }
                return prev;
              });
            }
          }
        } catch (_) {}
      };
    } catch (_) {}

    // Fallback polling a cada 5s para garantia de sincronia
    const pollInterval = setInterval(fetchConfig, 5000);

    return () => {
      clearInterval(pollInterval);
      if (eventSource) eventSource.close();
    };
  }, []);

  // 3. Playlist Automática (Ciclo de Presets se ativado)
  useEffect(() => {
    if (config.isAutoPlayActive) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      const intervalMs = Math.max(5, config.autoPlayInterval || 25) * 1000;
      autoPlayTimerRef.current = setInterval(() => {
        setConfig(prev => {
          const currentIndex = PRESET_SEQUENCE.indexOf(prev.currentPreset);
          const nextIndex = (currentIndex + 1) % PRESET_SEQUENCE.length;
          return { ...prev, currentPreset: PRESET_SEQUENCE[nextIndex] };
        });
      }, intervalMs);
    } else {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    }
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [config.isAutoPlayActive, config.autoPlayInterval]);

  // 4. Votação de enquete ao vivo na tela da mesa
  const handleVotePoll = (frameIndex: number, optionId: number) => {
    const pollKey = `poll_${frameIndex}`;
    if (votedPolls[pollKey]) return;

    setVotedPolls(prev => ({ ...prev, [pollKey]: optionId }));

    setConfig(prev => {
      const nextFrames = [...prev.frames];
      const targetFrame = nextFrames[frameIndex];
      if (targetFrame?.poll) {
        const opt = targetFrame.poll.options.find(o => o.id === optionId);
        if (opt) opt.votes = (opt.votes || 0) + 1;
      }
      return { ...prev, frames: nextFrames };
    });

    fetch(`${API_BASE_URL}/api/marketing/feed/vote-poll`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ frameIndex, optionId })
    }).catch(() => {});
  };

  const capacity = PRESET_CAPACITIES[config.currentPreset] || 3;

  return (
    <div className="lepta-feed-hub tv-mode-active mesa-feed-fullbleed">
      {/* Barra de Letreiro Noticioso / Comunicados (Rolagem Contínua) */}
      {config.showTicker && config.tickerText && (
        <div className="feed-ticker-bar">
          <div className="ticker-badge">
            <Sparkles size={12} className="ticker-sparkle" />
            <span>COMUNICADOS</span>
          </div>
          <div className="ticker-content-track">
            <div className={`ticker-marquee speed-${config.tickerSpeed || 'normal'}`}>
              <span>{config.tickerText}</span>
              <span className="ticker-sep">•</span>
              <span>{config.tickerText}</span>
            </div>
          </div>
          <div className="mesa-feed-live-indicator" title="Transmissão sincronizada com o Marketing">
            <Radio size={12} className={isLiveOnline ? 'pulse-live' : ''} />
            <span>{isLiveOnline ? 'AO VIVO' : 'SYNC...'}</span>
          </div>
        </div>
      )}

      {/* Viewport dos Quadros do Feed (100% da tela) */}
      <main className="feed-hub-viewport">
        <div className={`feed-frames-grid layout-${config.currentPreset}`}>
          {Array.from({ length: capacity }).map((_, idx) => {
            const frame: FrameData = config.frames[idx] || {
              type: 'text',
              text: {
                badgeText: `QUADRO ${idx + 1}`,
                title: 'Lepta Hub',
                body: 'Aguardando publicação do Marketing...',
                theme: 'theme-gradient-blue'
              }
            };

            return (
              <div key={idx} className="feed-frame-card">
                <div className="frame-inner-content">
                  {/* TIPO: IMAGEM */}
                  {frame.type === 'image' && (
                    <div className={`frame-image-box ${frame.image?.fit === 'contain' ? 'fit-contain' : 'fit-cover'}`}>
                      <img
                        src={frame.image?.url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80'}
                        alt={frame.image?.caption || 'Feed'}
                        loading="lazy"
                      />
                      {frame.image?.caption && (
                        <div className="frame-image-caption">
                          {frame.image.caption}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TIPO: VÍDEO */}
                  {frame.type === 'video' && (
                    <div className="frame-video-box">
                      <video
                        src={frame.video?.url}
                        autoPlay
                        loop
                        muted={config.isAudioMuted}
                        playsInline
                      />
                    </div>
                  )}

                  {/* TIPO: YOUTUBE */}
                  {frame.type === 'youtube' && (
                    <div className="frame-youtube-box">
                      <iframe
                        src={getYoutubeEmbedUrl(frame.youtube?.url, frame.youtube?.videoId)}
                        title="YouTube Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* TIPO: INSTAGRAM */}
                  {frame.type === 'instagram' && (() => {
                    const postId = getInstagramPostId(frame.instagram?.url);
                    if (postId) {
                      return (
                        <div className="frame-instagram-box">
                          <iframe
                            src={`https://www.instagram.com/p/${postId}/embed/captioned/`}
                            title="Instagram Post"
                            allowFullScreen
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="frame-instagram-card">
                        <div className="ig-card-header">
                          <div className="ig-avatar">L</div>
                          <div className="ig-header-info">
                            <span className="ig-username">@{frame.instagram?.username || 'lepta_oficial'}</span>
                            <span className="ig-author-name">{frame.instagram?.author || 'Lepta Capital'}</span>
                          </div>
                        </div>
                        {frame.instagram?.imageUrl && (
                          <div className="ig-image-holder">
                            <img src={frame.instagram.imageUrl} alt="Instagram" />
                          </div>
                        )}
                        <div className="ig-card-footer">
                          {frame.instagram?.likes && (
                            <div className="ig-likes-count">❤️ {frame.instagram.likes} curtidas</div>
                          )}
                          <div className="ig-caption-text">
                            <strong>@{frame.instagram?.username || 'lepta_oficial'}</strong> {frame.instagram?.caption}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TIPO: ENQUETE INTERATIVA (SEM VOTE PELO CELULAR, 100% LIMPA) */}
                  {frame.type === 'poll' && frame.poll && (() => {
                    const totalVotes = frame.poll.options.reduce((sum, o) => sum + (o.votes || 0), 0);

                    return (
                      <div className="frame-poll-card">
                        <div className="poll-info-col">
                          <div className="poll-header-pill">
                            <BarChart2 size={13} />
                            <span>ENQUETE INTERATIVA</span>
                          </div>
                          <h2 className="poll-question-title">{frame.poll.question}</h2>

                          <div className="poll-options-grid">
                            {frame.poll.options.map((opt) => {
                              const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                              const hasVoted = votedPolls[`poll_${idx}`] === opt.id;

                              return (
                                <button
                                  type="button"
                                  key={opt.id}
                                  className={`poll-option-btn ${hasVoted ? 'voted' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVotePoll(idx, opt.id);
                                  }}
                                >
                                  <div className="poll-fill-progress" style={{ width: `${pct}%` }} />
                                  <span className="poll-opt-name">{opt.text}</span>
                                  <span className="poll-opt-percent">{pct}% <small>({opt.votes})</small></span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="poll-meta-footer">
                            <span>{totalVotes} votos registrados</span>
                            <span>•</span>
                            <span>Clique para registrar seu voto</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TIPO: TEXTO / AVISO */}
                  {frame.type === 'text' && (
                    <div className={`frame-text-card ${frame.text?.theme || 'theme-gradient-blue'}`}>
                      <div className="text-badge-pill">
                        {frame.text?.badgeText || 'COMUNICADO'}
                      </div>
                      <h1 className="text-card-title">{frame.text?.title || 'Título do Comunicado'}</h1>
                      <div className="text-card-body">{frame.text?.body || 'Texto corporativo...'}</div>
                      <div className="text-card-author">
                        <span>{frame.text?.author || 'Diretoria de Marketing • Lepta'}</span>
                        <span>•</span>
                        <span>Atualizado ao Vivo</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default MesaFeedStage;
