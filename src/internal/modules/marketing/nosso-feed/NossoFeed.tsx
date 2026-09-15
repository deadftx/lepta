import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2, Volume2, VolumeX, Play, Pause,
  ChevronDown, ChevronUp, Tv, Image as ImageIcon,
  Video as VideoIcon, BarChart2, FileText,
  Clock, Upload, Check,
  SlidersHorizontal, Radio
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './NossoFeed.css';

// Tipos de conteúdo para cada quadro
export type FrameType = 'image' | 'video' | 'youtube' | 'instagram' | 'poll' | 'text';

export interface PollOption {
  id: number;
  text: string;
  votes: number;
}

export interface FrameData {
  type: FrameType;
  image?: {
    url: string;
    fit?: 'cover' | 'contain';
    caption?: string;
  };
  video?: {
    url: string;
    loop?: boolean;
    muted?: boolean;
    autoplay?: boolean;
  };
  youtube?: {
    url: string;
    videoId?: string;
  };
  instagram?: {
    url: string;
    username?: string;
    author?: string;
    caption?: string;
    imageUrl?: string;
    likes?: string;
  };
  poll?: {
    question: string;
    qrUrl?: string;
    options: PollOption[];
  };
  text?: {
    badgeType?: string;
    badgeText?: string;
    title: string;
    body: string;
    theme?: string;
    author?: string;
  };
}

export type PresetType = '1-full' | '2-split-h' | '2-split-v' | '3-featured' | '3-columns' | '4-grid' | '4-spotlight';

export interface HubConfig {
  currentPreset: PresetType;
  activeFrameIndex: number;
  activeDockTab: 'frame' | 'ticker';
  isTvMode: boolean;
  isDockCollapsed: boolean;
  showTicker: boolean;
  isAudioMuted: boolean;
  isAutoPlayActive: boolean;
  autoPlayInterval: number; // segundos
  tickerSpeed: 'slow' | 'normal' | 'fast';
  tickerText: string;
  frames: FrameData[];
}

export const DEFAULT_CONFIG: HubConfig = {
  currentPreset: '3-featured',
  activeFrameIndex: 0,
  activeDockTab: 'frame',
  isTvMode: false,
  isDockCollapsed: true, // Inicia recolhido para eliminar espaço preto e focar 100% no feed!
  showTicker: true,
  isAudioMuted: true,
  isAutoPlayActive: false,
  autoPlayInterval: 25,
  tickerSpeed: 'normal',
  tickerText: '⚡ Comunicado Geral: Apresentação dos resultados do trimestre hoje às 16h no auditório • Meta de marketing superada com 114%! • Participe da enquete semanal no painel interativo • Novos projetos de inovação em andamento.',
  frames: [
    {
      type: 'video',
      video: {
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        loop: true,
        muted: true,
        autoplay: true
      }
    },
    {
      type: 'poll',
      poll: {
        question: 'Qual deve ser o tema do nosso próximo Workshop interno?',
        qrUrl: 'https://lepta.com.br/workshop',
        options: [
          { id: 1, text: 'Inteligência Artificial no Dia a Dia', votes: 48 },
          { id: 2, text: 'Produtividade & Gestão de Tempo', votes: 22 },
          { id: 3, text: 'Design Thinking & Inovação', votes: 35 },
          { id: 4, text: 'Comunicação e Liderança Ágil', votes: 19 }
        ]
      }
    },
    {
      type: 'text',
      text: {
        badgeType: 'meta',
        badgeText: '🏆 META CONQUISTADA',
        title: 'Recorde Histórico de Campanhas!',
        body: 'Alcançamos 1.2M de visualizações orgânicas este mês. Parabéns a todos os times pelo empenho excepcional.',
        theme: 'theme-gradient-blue',
        author: 'Diretoria de Marketing • Lepta'
      }
    },
    {
      type: 'image',
      image: {
        url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
        fit: 'cover',
        caption: 'Equipe reunida no sprint de planejamento estratégico'
      }
    }
  ]
};

export const PRESET_CAPACITIES: Record<PresetType, number> = {
  '1-full': 1,
  '2-split-h': 2,
  '2-split-v': 2,
  '3-featured': 3,
  '3-columns': 3,
  '4-grid': 4,
  '4-spotlight': 4
};

export const PRESET_SEQUENCE: PresetType[] = ['1-full', '2-split-h', '3-featured', '3-columns', '4-grid', '4-spotlight'];

export const NossoFeed: React.FC = () => {
  const [config, setConfig] = useState<HubConfig>(() => {
    try {
      const saved = localStorage.getItem('lepta_feed_tv_config');
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_CONFIG;
  });

  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);
  const autoPlayTimerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Relógio em tempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Carrega configuração da API / banco SQLite no mount
  useEffect(() => {
    const loadHubConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/marketing/feed/hub-config`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.config) {
            setConfig(prev => ({ ...prev, ...json.config }));
          }
        }
      } catch (err) {
        console.warn('Não foi possível carregar hub-config do servidor:', err);
      }
    };
    loadHubConfig();
  }, []);

  // 3. Salva no localStorage e opcionalmente na API
  const persistConfig = (newConfig: HubConfig, syncServer = false) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('lepta_feed_tv_config', JSON.stringify(newConfig));
    } catch (_) {}

    if (syncServer) {
      fetch(`${API_BASE_URL}/api/marketing/feed/hub-config`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: newConfig })
      })
        .then(() => {
          setPublishSuccess(true);
          setTimeout(() => setPublishSuccess(false), 3000);
        })
        .catch(() => {});
    }
  };

  // 3.1 Publicação instantânea na Mesa de Operações (Transmissão em Tempo Real)
  const handlePublishToMesa = async () => {
    setIsPublishing(true);
    try {
      localStorage.setItem('lepta_feed_tv_config', JSON.stringify(config));

      const res = await fetch(`${API_BASE_URL}/api/marketing/feed/publish-hub`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
      });

      if (!res.ok) {
        await fetch(`${API_BASE_URL}/api/marketing/feed/hub-config`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ config })
        });
      }

      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 3500);
    } catch (err) {
      console.error('Erro ao publicar feed para a Mesa:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  // 4. Playlist Automática (Ciclo de Presets)
  useEffect(() => {
    if (config.isAutoPlayActive) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      const intervalMs = Math.max(5, config.autoPlayInterval || 25) * 1000;
      autoPlayTimerRef.current = setInterval(() => {
        setConfig(prev => {
          const currentIndex = PRESET_SEQUENCE.indexOf(prev.currentPreset);
          const nextIndex = (currentIndex + 1) % PRESET_SEQUENCE.length;
          const nextPreset = PRESET_SEQUENCE[nextIndex];
          const updated = { ...prev, currentPreset: nextPreset };
          try {
            localStorage.setItem('lepta_feed_tv_config', JSON.stringify(updated));
          } catch (_) {}
          return updated;
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

  // 5. Atalhos de teclado (F ou Esc para Modo TV)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      if (e.key === 'Escape' && config.isTvMode) {
        toggleTvMode(false);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleTvMode(!config.isTvMode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.isTvMode]);

  const toggleTvMode = (enable?: boolean) => {
    const nextVal = enable !== undefined ? enable : !config.isTvMode;
    const updated = { ...config, isTvMode: nextVal };
    persistConfig(updated);

    if (nextVal) {
      const el = containerRef.current || document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const setPreset = (preset: PresetType) => {
    const capacity = PRESET_CAPACITIES[preset] || 1;
    let nextIdx = config.activeFrameIndex;
    if (nextIdx >= capacity) nextIdx = 0;
    persistConfig({ ...config, currentPreset: preset, activeFrameIndex: nextIdx });
  };

  const handleSelectFrame = (idx: number) => {
    persistConfig({ ...config, activeFrameIndex: idx, activeDockTab: 'frame', isDockCollapsed: false });
  };

  const handleVotePoll = (frameIndex: number, optionId: number) => {
    const pollKey = `poll_${frameIndex}`;
    if (votedPolls[pollKey]) return; // Já votou

    const newFrames = [...config.frames];
    const frame = newFrames[frameIndex];
    if (frame && frame.poll) {
      const opt = frame.poll.options.find(o => o.id === optionId);
      if (opt) {
        opt.votes = (opt.votes || 0) + 1;
        setVotedPolls(prev => ({ ...prev, [pollKey]: optionId }));
        persistConfig({ ...config, frames: newFrames }, true);

        // Notifica o backend
        fetch(`${API_BASE_URL}/api/marketing/feed/vote-poll`, {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ frameIndex, optionId })
        }).catch(() => {});
      }
    }
  };

  const handleUpdateCurrentFrame = (updater: (frame: FrameData) => void) => {
    const newFrames = [...config.frames];
    while (newFrames.length <= config.activeFrameIndex) {
      newFrames.push({
        type: 'text',
        text: {
          badgeText: 'COMUNICADO',
          title: 'Novo Comunicado',
          body: 'Texto informativo...',
          theme: 'theme-gradient-blue',
          author: 'Marketing'
        }
      });
    }
    const currentFrame = { ...newFrames[config.activeFrameIndex] };
    updater(currentFrame);
    newFrames[config.activeFrameIndex] = currentFrame;
    persistConfig({ ...config, frames: newFrames });
  };

  const handleTypeChange = (newType: FrameType) => {
    handleUpdateCurrentFrame(frame => {
      frame.type = newType;
      if (newType === 'image' && !frame.image) {
        frame.image = {
          url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
          fit: 'cover',
          caption: 'Destaque Corporativo'
        };
      } else if (newType === 'video' && !frame.video) {
        frame.video = {
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          loop: true,
          muted: true,
          autoplay: true
        };
      } else if (newType === 'youtube' && !frame.youtube) {
        frame.youtube = {
          url: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
          videoId: 'L_LUpnjgPso'
        };
      } else if (newType === 'instagram' && !frame.instagram) {
        frame.instagram = {
          url: 'https://www.instagram.com/p/example/',
          username: 'lepta_oficial',
          author: 'Lepta Inovação',
          caption: 'Transformando tecnologia em resultados reais. Confira nosso novo ecossistema!',
          imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
          likes: '342'
        };
      } else if (newType === 'poll' && !frame.poll) {
        frame.poll = {
          question: 'Qual tema você quer ver no próximo treinamento?',
          qrUrl: 'https://lepta.com.br',
          options: [
            { id: 1, text: 'Automação & IA', votes: 15 },
            { id: 2, text: 'Gestão Ágil de Projetos', votes: 10 },
            { id: 3, text: 'Comunicação Estratégica', votes: 8 }
          ]
        };
      } else if (newType === 'text' && !frame.text) {
        frame.text = {
          badgeType: 'comunicado',
          badgeText: 'COMUNICADO',
          title: 'Novo Comunicado Lepta',
          body: 'Escreva aqui a mensagem corporativa a ser divulgada.',
          theme: 'theme-gradient-blue',
          author: 'Comunicação Interna'
        };
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        handleUpdateCurrentFrame(frame => {
          if (!frame.image) frame.image = { url: base64, fit: 'cover' };
          else frame.image.url = base64;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const activeCapacity = PRESET_CAPACITIES[config.currentPreset] || 1;
  const currentFrame = config.frames[config.activeFrameIndex] || config.frames[0];

  // Helper para extrair ID do YouTube
  const getYoutubeEmbedUrl = (url?: string, vid?: string) => {
    let id = vid;
    if (!id && url) {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
      id = match ? match[1] : url;
    }
    id = id || 'L_LUpnjgPso';
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&modestbranding=1&rel=0&showinfo=0&disablekb=1&iv_load_policy=3`;
  };

  // Helper para extrair post ID do Instagram
  const getInstagramPostId = (url?: string) => {
    if (!url) return null;
    const match = url.trim().match(/(?:instagram\.com\/(?:p|reel|reels|tv)\/|instagr\.am\/p\/)([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  };

  return (
    <div
      ref={containerRef}
      className={`lepta-feed-hub-root ${config.isTvMode ? 'is-tv-mode' : ''} ${config.isDockCollapsed ? 'dock-is-collapsed' : ''}`}
    >
      {/* 1. TOPBAR DE CONTROLE E STATUS (Sleek Header) */}
      <header className="feed-hub-topbar">
        <div className="topbar-left">
          <div className="topbar-brand">
            <img src="/logo-lepta-feed.png" alt="Lepta" className="topbar-logo-img" onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }} />
            <span className="topbar-system-name">MARKETING · FEED</span>
          </div>

          <div className="topbar-divider" />

          <div className="topbar-status-pill">
            <span className="pulsing-green-dot" />
            <span className="status-pill-text">CANAL CORPORATIVO AO VIVO</span>
          </div>
        </div>

        {/* Letreiro Integrado no Topo (Elimina espaço preto superior) */}
        {config.showTicker && (
          <div className="topbar-ticker-strip">
            <span className="ticker-label">📢 COMUNICADOS:</span>
            <div className="ticker-marquee-track">
              <span className={`ticker-marquee-text speed-${config.tickerSpeed}`}>
                {config.tickerText}
              </span>
            </div>
          </div>
        )}

        <div className="topbar-right">
          {/* Playlist Automática */}
          <button
            type="button"
            className={`topbar-btn ${config.isAutoPlayActive ? 'btn-active' : ''}`}
            onClick={() => persistConfig({ ...config, isAutoPlayActive: !config.isAutoPlayActive })}
            title="Alternar reprodução automática de layouts da playlist"
          >
            {config.isAutoPlayActive ? <Pause size={14} /> : <Play size={14} />}
            <span>Auto ({config.autoPlayInterval}s)</span>
          </button>

          {/* Áudio Global */}
          <button
            type="button"
            className={`topbar-btn ${!config.isAudioMuted ? 'btn-active' : ''}`}
            onClick={() => persistConfig({ ...config, isAudioMuted: !config.isAudioMuted })}
            title={config.isAudioMuted ? "Vídeos silenciados" : "Áudio ativado"}
          >
            {config.isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            <span>{config.isAudioMuted ? 'Mudo' : 'Com Som'}</span>
          </button>

          {/* Relógio e Data ao Vivo */}
          <div className="topbar-datetime-capsule">
            <Clock size={13} className="clock-icon" />
            <span className="capsule-time">{currentTime}</span>
            <span className="capsule-sep">·</span>
            <span className="capsule-date">{currentDate}</span>
          </div>

          {/* Modo TV / Tela Cheia 100% */}
          <button
            type="button"
            className="topbar-btn-highlight"
            onClick={() => toggleTvMode()}
            title="Entrar em Modo TV 100% (Tela Cheia)"
          >
            <Maximize2 size={14} />
            <span>Modo TV</span>
          </button>
        </div>
      </header>

      {/* 2. VIEWPORT PRINCIPAL COM OS QUADROS (100% DO ESPAÇO DISPONÍVEL) */}
      <main className="feed-hub-viewport">
        <div className={`feed-frames-grid layout-${config.currentPreset}`}>
          {Array.from({ length: activeCapacity }).map((_, idx) => {
            const frame = config.frames[idx] || {
              type: 'text',
              text: {
                badgeText: `QUADRO ${idx + 1}`,
                title: 'Conteúdo em Configuração',
                body: 'Abra o editor inferior para personalizar este quadro.',
                theme: 'theme-gradient-blue'
              }
            };
            const isSelected = idx === config.activeFrameIndex && !config.isDockCollapsed;

            return (
              <div
                key={idx}
                className={`feed-frame-card ${isSelected ? 'frame-selected' : ''}`}
                onClick={() => handleSelectFrame(idx)}
                title="Clique para editar este quadro no painel de controle"
              >
                {/* Badge do Quadro (Visível apenas com o painel aberto) */}
                {!config.isTvMode && (
                  <div className="frame-header-tag">
                    <span className="frame-dot" />
                    <span>Quadro {idx + 1} • {frame.type.toUpperCase()}</span>
                  </div>
                )}

                {/* Renderização Dinâmica do Conteúdo do Quadro */}
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
                        <div className="frame-instagram-embed">
                          <iframe
                            src={`https://www.instagram.com/p/${postId}/embed/captioned/`}
                            title="Instagram Post"
                            scrolling="no"
                            allowTransparency
                          />
                        </div>
                      );
                    }
                    return (
                      <div className="frame-instagram-card">
                        <div className="ig-card-header">
                          <div className="ig-avatar-wrap">
                            <img
                              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"
                              alt="Avatar"
                            />
                          </div>
                          <div className="ig-user-meta">
                            <div className="ig-username">@{frame.instagram?.username || 'lepta_oficial'}</div>
                            <div className="ig-author">{frame.instagram?.author || 'Instagram Corporativo'}</div>
                          </div>
                          <span className="ig-badge">📸</span>
                        </div>
                        <div className="ig-card-media">
                          <img
                            src={frame.instagram?.imageUrl || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80'}
                            alt="Instagram Media"
                          />
                        </div>
                        <div className="ig-card-footer">
                          <div className="ig-likes">{frame.instagram?.likes || '342'} curtidas</div>
                          <div className="ig-caption-text">
                            <strong>@{frame.instagram?.username || 'lepta_oficial'}</strong> {frame.instagram?.caption}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* TIPO: ENQUETE INTERATIVA */}
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
                        <span>{frame.text?.author || 'Diretoria de Comunicação'}</span>
                        <span>•</span>
                        <span>Atualizado Hoje</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 3. DOCK HORIZONTAL DE CONFIGURAÇÃO (SLEEK, RETRÁTIL E ZERO ESPAÇO PRETO) */}
      {!config.isTvMode && (
        <section className={`feed-control-dock ${config.isDockCollapsed ? 'collapsed' : 'expanded'}`}>
          {/* Header da Barra de Controle (Sempre Visível, 38px) */}
          <div className="dock-control-bar">
            {/* Lado Esquerdo: Seleção de Presets de Layout */}
            <div className="dock-presets-group">
              <span className="dock-label">LAYOUT:</span>
              <div className="preset-buttons-row">
                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '1-full' ? 'active' : ''}`}
                  onClick={() => setPreset('1-full')}
                  title="1 Quadro Fullscreen"
                >
                  <span className="preset-box-icon">⬛</span>
                  <span>1 Tela</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '2-split-h' ? 'active' : ''}`}
                  onClick={() => setPreset('2-split-h')}
                  title="2 Quadros Divididos Horizontalmente"
                >
                  <span className="preset-box-icon">❚❚</span>
                  <span>2 Split H</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '2-split-v' ? 'active' : ''}`}
                  onClick={() => setPreset('2-split-v')}
                  title="2 Quadros Divididos Verticalmente"
                >
                  <span className="preset-box-icon">☰</span>
                  <span>2 Split V</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '3-featured' ? 'active' : ''}`}
                  onClick={() => setPreset('3-featured')}
                  title="3 Quadros (1 Destaque + 2 Secundários)"
                >
                  <span className="preset-box-icon">◧</span>
                  <span>3 Destaque</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '3-columns' ? 'active' : ''}`}
                  onClick={() => setPreset('3-columns')}
                  title="3 Colunas Verticais"
                >
                  <span className="preset-box-icon">|||</span>
                  <span>3 Colunas</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '4-grid' ? 'active' : ''}`}
                  onClick={() => setPreset('4-grid')}
                  title="4 Quadros em Grade 2x2"
                >
                  <span className="preset-box-icon">⊞</span>
                  <span>4 Grade</span>
                </button>

                <button
                  type="button"
                  className={`preset-btn ${config.currentPreset === '4-spotlight' ? 'active' : ''}`}
                  onClick={() => setPreset('4-spotlight')}
                  title="4 Quadros (1 Destaque + 3 Laterais)"
                >
                  <span className="preset-box-icon">◩</span>
                  <span>4 Destaque</span>
                </button>
              </div>
            </div>

            {/* Centro: Seletor de Quadros do Layout Atual */}
            <div className="dock-frame-tabs-group">
              <span className="dock-label">EDITAR:</span>
              <div className="frame-tabs-list">
                {Array.from({ length: activeCapacity }).map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    className={`frame-tab-btn ${config.activeDockTab === 'frame' && config.activeFrameIndex === i ? 'active' : ''}`}
                    onClick={() => {
                      persistConfig({ ...config, activeFrameIndex: i, activeDockTab: 'frame', isDockCollapsed: false });
                    }}
                  >
                    Quadro {i + 1}
                  </button>
                ))}

                <button
                  type="button"
                  className={`frame-tab-btn ticker-tab ${config.activeDockTab === 'ticker' ? 'active' : ''}`}
                  onClick={() => {
                    persistConfig({ ...config, activeDockTab: 'ticker', isDockCollapsed: false });
                  }}
                >
                  📢 Letreiro
                </button>
              </div>
            </div>

            {/* Lado Direito: Publicar na Mesa de Operações e Controles */}
            <div className="dock-actions-group">
              <button
                type="button"
                className={`dock-publish-live-btn ${isPublishing ? 'publishing' : ''} ${publishSuccess ? 'published' : ''}`}
                onClick={handlePublishToMesa}
                disabled={isPublishing}
                title="Publicar na Mesa de Operações em Tempo Real (Broadcast Instantâneo)"
              >
                <span className="live-pulsing-dot" />
                {publishSuccess ? <Check size={14} /> : <Radio size={14} className={isPublishing ? 'pulse-spin' : ''} />}
                <span className="publish-label">
                  {publishSuccess ? 'PUBLICADO NA MESA! ✓' : isPublishing ? 'PUBLICANDO...' : 'PUBLICAR'}
                </span>
              </button>

              <button
                type="button"
                className="dock-toggle-btn"
                onClick={() => persistConfig({ ...config, isDockCollapsed: !config.isDockCollapsed })}
              >
                <span>{config.isDockCollapsed ? 'Editar Feed' : 'Ocultar Editor'}</span>
                {config.isDockCollapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          </div>

          {/* Gaveta de Edição Completa do Quadro ou Letreiro */}
          {!config.isDockCollapsed && (
            <div className="dock-editor-drawer">
              {config.activeDockTab === 'ticker' ? (
                /* FORMULÁRIO DO LETREIRO */
                <div className="editor-form-grid">
                  <div className="editor-field span-2">
                    <label>Texto do Letreiro Rolante (Comunicados em Tempo Real)</label>
                    <textarea
                      rows={2}
                      value={config.tickerText}
                      onChange={(e) => persistConfig({ ...config, tickerText: e.target.value })}
                      placeholder="Digite os comunicados que rolarão na barra superior..."
                    />
                  </div>

                  <div className="editor-field">
                    <label>Velocidade do Letreiro</label>
                    <select
                      value={config.tickerSpeed}
                      onChange={(e) => persistConfig({ ...config, tickerSpeed: e.target.value as any })}
                    >
                      <option value="slow">Mais Lenta (50s)</option>
                      <option value="normal">Normal Padrão (35s)</option>
                      <option value="fast">Rápida (20s)</option>
                    </select>
                  </div>

                  <div className="editor-field">
                    <label>Tempo da Playlist Automática (segundos)</label>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={config.autoPlayInterval}
                      onChange={(e) => persistConfig({ ...config, autoPlayInterval: parseInt(e.target.value, 10) || 25 })}
                    />
                  </div>
                </div>
              ) : (
                /* FORMULÁRIO DO QUADRO ATIVO */
                <div className="editor-frame-content">
                  {/* Seletor do Tipo do Quadro */}
                  <div className="frame-type-selector-bar">
                    <span className="type-label">TIPO DE CONTEÚDO:</span>
                    <div className="type-buttons-row">
                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'image' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('image')}
                      >
                        <ImageIcon size={14} />
                        <span>Imagem</span>
                      </button>

                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'video' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('video')}
                      >
                        <VideoIcon size={14} />
                        <span>Vídeo</span>
                      </button>

                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'youtube' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('youtube')}
                      >
                        <Tv size={14} />
                        <span>YouTube</span>
                      </button>

                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'instagram' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('instagram')}
                      >
                        <span>📸</span>
                        <span>Instagram</span>
                      </button>

                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'poll' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('poll')}
                      >
                        <BarChart2 size={14} />
                        <span>Enquete</span>
                      </button>

                      <button
                        type="button"
                        className={`type-btn ${currentFrame.type === 'text' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('text')}
                      >
                        <FileText size={14} />
                        <span>Texto / Aviso</span>
                      </button>
                    </div>
                  </div>

                  {/* Campos Dinâmicos por Tipo */}
                  <div className="editor-form-grid">
                    {/* 1. Imagem */}
                    {currentFrame.type === 'image' && (
                      <>
                        <div className="editor-field span-2">
                          <label>URL da Imagem ou Arquivo Local</label>
                          <div className="field-with-upload">
                            <input
                              type="text"
                              value={currentFrame.image?.url || ''}
                              onChange={(e) => handleUpdateCurrentFrame(f => {
                                if (!f.image) f.image = { url: e.target.value };
                                else f.image.url = e.target.value;
                              })}
                              placeholder="https://exemplo.com/banner.jpg"
                            />
                            <label className="upload-inline-btn" title="Carregar imagem do computador">
                              <Upload size={14} />
                              <span>Arquivo</span>
                              <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                            </label>
                          </div>
                        </div>

                        <div className="editor-field">
                          <label>Ajuste de Exibição</label>
                          <select
                            value={currentFrame.image?.fit || 'cover'}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.image) f.image.fit = e.target.value as any;
                            })}
                          >
                            <option value="cover">Preenchimento Total (Cover - Sem barras pretas)</option>
                            <option value="contain">Conter Inteira (Contain)</option>
                          </select>
                        </div>

                        <div className="editor-field">
                          <label>Legenda Sobreposta (Opcional)</label>
                          <input
                            type="text"
                            value={currentFrame.image?.caption || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.image) f.image.caption = e.target.value;
                            })}
                            placeholder="Ex: Campanha de Novos Clientes"
                          />
                        </div>
                      </>
                    )}

                    {/* 2. Vídeo */}
                    {currentFrame.type === 'video' && (
                      <div className="editor-field span-2">
                        <label>URL do Arquivo de Vídeo (.mp4 ou .webm)</label>
                        <input
                          type="text"
                          value={currentFrame.video?.url || ''}
                          onChange={(e) => handleUpdateCurrentFrame(f => {
                            if (!f.video) f.video = { url: e.target.value, autoplay: true, loop: true, muted: true };
                            else f.video.url = e.target.value;
                          })}
                          placeholder="https://exemplo.com/video-institucional.mp4"
                        />
                      </div>
                    )}

                    {/* 3. YouTube */}
                    {currentFrame.type === 'youtube' && (
                      <div className="editor-field span-2">
                        <label>Link ou ID do Vídeo do YouTube</label>
                        <input
                          type="text"
                          value={currentFrame.youtube?.url || ''}
                          onChange={(e) => handleUpdateCurrentFrame(f => {
                            if (!f.youtube) f.youtube = { url: e.target.value };
                            else f.youtube.url = e.target.value;
                          })}
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                    )}

                    {/* 4. Instagram */}
                    {currentFrame.type === 'instagram' && (
                      <>
                        <div className="editor-field span-2">
                          <label>Link da Publicação ou Reel do Instagram</label>
                          <input
                            type="text"
                            value={currentFrame.instagram?.url || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (!f.instagram) f.instagram = { url: e.target.value };
                              else f.instagram.url = e.target.value;
                            })}
                            placeholder="https://www.instagram.com/p/..."
                          />
                        </div>

                        <div className="editor-field">
                          <label>Nome de Usuário (@)</label>
                          <input
                            type="text"
                            value={currentFrame.instagram?.username || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.instagram) f.instagram.username = e.target.value;
                            })}
                            placeholder="lepta_oficial"
                          />
                        </div>

                        <div className="editor-field">
                          <label>Legenda / Descrição</label>
                          <input
                            type="text"
                            value={currentFrame.instagram?.caption || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.instagram) f.instagram.caption = e.target.value;
                            })}
                            placeholder="Texto descritivo do post..."
                          />
                        </div>
                      </>
                    )}

                    {/* 5. Enquete */}
                    {currentFrame.type === 'poll' && (
                      <>
                        <div className="editor-field span-2">
                          <label>Pergunta da Enquete</label>
                          <input
                            type="text"
                            value={currentFrame.poll?.question || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.poll) f.poll.question = e.target.value;
                            })}
                            placeholder="Ex: Onde devemos realizar a confraternização?"
                          />
                        </div>

                        <div className="editor-field span-2">
                          <label>Opções de Resposta</label>
                          <div className="options-edit-inline">
                            {currentFrame.poll?.options.map((opt, oIdx) => (
                              <div key={opt.id} className="opt-row">
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => handleUpdateCurrentFrame(f => {
                                    if (f.poll?.options[oIdx]) f.poll.options[oIdx].text = e.target.value;
                                  })}
                                />
                                <span className="opt-v-count">{opt.votes} votos</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* 6. Texto / Comunicado */}
                    {currentFrame.type === 'text' && (
                      <>
                        <div className="editor-field">
                          <label>Tag / Badge de Destaque</label>
                          <input
                            type="text"
                            value={currentFrame.text?.badgeText || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.text) f.text.badgeText = e.target.value;
                            })}
                            placeholder="Ex: COMUNICADO GERAL"
                          />
                        </div>

                        <div className="editor-field">
                          <label>Tema Gradiente</label>
                          <select
                            value={currentFrame.text?.theme || 'theme-gradient-blue'}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.text) f.text.theme = e.target.value;
                            })}
                          >
                            <option value="theme-gradient-blue">Azul Tecnológico Neon</option>
                            <option value="theme-gradient-purple">Roxo Moderno & Rosa</option>
                            <option value="theme-gradient-emerald">Verde Esmeralda (Metas)</option>
                            <option value="theme-gradient-amber">Dourado / Ouro (Premiações)</option>
                            <option value="theme-gradient-dark">Dark Carbono Minimalista</option>
                          </select>
                        </div>

                        <div className="editor-field span-2">
                          <label>Título Principal</label>
                          <input
                            type="text"
                            value={currentFrame.text?.title || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.text) f.text.title = e.target.value;
                            })}
                            placeholder="Título do aviso..."
                          />
                        </div>

                        <div className="editor-field span-2">
                          <label>Corpo do Comunicado</label>
                          <textarea
                            rows={3}
                            value={currentFrame.text?.body || ''}
                            onChange={(e) => handleUpdateCurrentFrame(f => {
                              if (f.text) f.text.body = e.target.value;
                            })}
                            placeholder="Escreva a mensagem completa..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Botão Flutuante de Retorno no Modo TV 100% */}
      {config.isTvMode && (
        <button
          type="button"
          className="floating-exit-tv-btn"
          onClick={() => toggleTvMode(false)}
          title="Sair do Modo TV (ou pressione Esc)"
        >
          <SlidersHorizontal size={14} />
          <span>Painel de Controle</span>
          <kbd>Esc</kbd>
        </button>
      )}
    </div>
  );
};

export default NossoFeed;
