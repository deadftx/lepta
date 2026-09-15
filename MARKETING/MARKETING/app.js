/**
 * HUB DE FEED INTERNO / TV CORPORATIVA - SISTEMA DINÂMICO
 * Gerencia presets de tela, módulos interativos (Imagem, Vídeo, YouTube, Instagram, Enquete, Texto)
 * e sincronização em tempo real com ocupação 100% da viewport.
 */

// ==========================================================================
// ESTADO PADRÃO INICIAL (SHOWCASE MODERNO)
// ==========================================================================
const DEFAULT_CONFIG = {
  currentPreset: '3-featured',
  activeFrameIndex: 0,
  activeDockTab: 'frame', // 'frame' ou 'ticker'
  isTvMode: false,
  isDockCollapsed: false,
  showTicker: true,
  isAudioMuted: true,
  isAutoPlayActive: false,
  autoPlayInterval: 25, // segundos
  tickerSpeed: 'normal',
  tickerText: "Comunicado Geral: Apresentação dos resultados do trimestre hoje às 16h no auditório • Meta de marketing superada com 114%! • Participe da enquete semanal no painel interativo • Novos projetos de inovação em andamento.",
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
        body: 'Alcançamos 1.2M de visualizações orgânicas este mês. Parabéns a todos os times de Marketing, Design e Tecnologia pelo empenho excepcional.',
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

// ==========================================================================
// APLICAÇÃO PRINCIPAL
// ==========================================================================
class FeedTvApp {
  constructor() {
    this.config = this.loadConfig();
    this.presetCapacities = {
      '1-full': 1,
      '2-split-h': 2,
      '2-split-v': 2,
      '3-featured': 3,
      '3-columns': 3,
      '4-grid': 4,
      '4-spotlight': 4
    };

    this.presetSequence = ['1-full', '2-split-h', '3-featured', '4-grid', '4-spotlight'];
    this.autoPlayTimer = null;

    this.initElements();
    this.initClock();
    this.bindEvents();
    this.applyAudioState();
    if (this.config.isAutoPlayActive) {
      this.startAutoPlay();
    }
    this.render();
  }

  // Carregar ou inicializar configuração
  loadConfig() {
    try {
      const saved = localStorage.getItem('lepta_feed_tv_config');
      if (saved) {
        return Object.assign({}, DEFAULT_CONFIG, JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Erro ao ler localStorage, utilizando padrão:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  saveConfig() {
    try {
      localStorage.setItem('lepta_feed_tv_config', JSON.stringify(this.config));
    } catch (e) {
      console.warn('Erro ao salvar no localStorage:', e);
    }
    // Salva também no arquivo físico config.json na pasta local
    try {
      fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.config)
      }).catch(() => {});
    } catch (e) {}
  }

  // Mapear elementos do DOM
  initElements() {
    this.framesGrid = document.getElementById('framesGrid');
    this.presetButtons = document.querySelectorAll('.preset-btn');
    this.liveClock = document.getElementById('liveClock');
    this.btnTvMode = document.getElementById('btnTvMode');
    this.btnExitTv = document.getElementById('btnExitTv');
    this.btnToggleDock = document.getElementById('btnToggleDock');
    this.btnToggleTicker = document.getElementById('btnToggleTicker');
    this.btnExportConfig = document.getElementById('btnExportConfig');
    this.importConfigFile = document.getElementById('importConfigFile');
    this.btnResetConfig = document.getElementById('btnResetConfig');
    this.btnAutoPlay = document.getElementById('btnAutoPlay');
    this.autoPlayLabel = document.getElementById('autoPlayLabel');
    this.btnToggleAudio = document.getElementById('btnToggleAudio');
    this.audioIcon = document.getElementById('audioIcon');
    this.audioLabel = document.getElementById('audioLabel');
    this.tickerWrapper = document.getElementById('tickerWrapper');
    this.tickerContent = document.getElementById('tickerContent');
    this.tickerDate = document.getElementById('tickerDate');
    this.dockFramesSelector = document.getElementById('dockFramesSelector');
    this.contentTypeButtons = document.querySelectorAll('.type-btn');
    this.configFormsContainer = document.getElementById('configFormsContainer');
    this.typeSelectorStrip = document.querySelector('.type-selector-strip');
  }

  // Relógio em tempo real
  initClock() {
    this.capsuleDate = document.getElementById('capsuleDate');
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR');
      const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (this.liveClock) this.liveClock.textContent = timeStr;
      if (this.capsuleDate) this.capsuleDate.textContent = dateStr;
      if (this.tickerDate) this.tickerDate.textContent = dateStr;
    };
    update();
    setInterval(update, 1000);
  }

  // Vincular eventos globais
  bindEvents() {
    // Seleção de Presets
    this.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.setPreset(preset);
      });
    });

    // Alternar Modo TV (100% da tela)
    this.btnTvMode.addEventListener('click', () => this.toggleTvMode(true));
    this.btnExitTv.addEventListener('click', () => this.toggleTvMode(false));

    // Playlist Automática de TV
    if (this.btnAutoPlay) {
      this.btnAutoPlay.addEventListener('click', () => this.toggleAutoPlay());
    }

    // Toggle Áudio Global
    if (this.btnToggleAudio) {
      this.btnToggleAudio.addEventListener('click', () => this.toggleAudio());
    }

    // Tecla ESC e atalho F para Fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.config.isTvMode) {
        this.toggleTvMode(false);
      } else if ((e.key === 'f' || e.key === 'F') && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        this.toggleTvMode(!this.config.isTvMode);
      }
    });

    // Recolher / Expandir Dock Horizontal
    this.btnToggleDock.addEventListener('click', () => {
      this.config.isDockCollapsed = !this.config.isDockCollapsed;
      document.body.classList.toggle('dock-collapsed', this.config.isDockCollapsed);
      this.btnToggleDock.querySelector('.toggle-text').textContent =
        this.config.isDockCollapsed ? 'Expandir Painel' : 'Ocultar Painel';
      this.btnToggleDock.querySelector('.toggle-icon').textContent =
        this.config.isDockCollapsed ? '▲' : '▼';
      this.saveConfig();
    });

    // Toggle Ticker
    if (this.btnToggleTicker) {
      this.btnToggleTicker.addEventListener('click', () => {
        this.config.activeDockTab = this.config.activeDockTab === 'ticker' ? 'frame' : 'ticker';
        this.saveConfig();
        this.render();
      });
    }

    // Exportar / Importar / Resetar
    if (this.btnExportConfig) this.btnExportConfig.addEventListener('click', () => this.exportConfig());
    if (this.importConfigFile) this.importConfigFile.addEventListener('change', (e) => this.importConfig(e));
    if (this.btnResetConfig) {
      this.btnResetConfig.addEventListener('click', () => {
        if (confirm('Deseja restaurar as configurações padrão do Feed?')) {
          this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
          this.saveConfig();
          this.render();
        }
      });
    }

    // Tipos de Conteúdo
    this.contentTypeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        this.changeCurrentFrameType(type);
      });
    });
  }

  // Atualizar visibilidade do Ticker
  updateTickerVisibility() {
    if (this.tickerWrapper) {
      this.tickerWrapper.classList.toggle('hidden', !this.config.showTicker);
      document.body.classList.toggle('ticker-hidden', !this.config.showTicker);
      if (this.btnToggleTicker) {
        this.btnToggleTicker.classList.toggle('active', this.config.showTicker);
      }
    }
  }

  // Controle de Playlist Automática (TV Digital Signage)
  toggleAutoPlay() {
    this.config.isAutoPlayActive = !this.config.isAutoPlayActive;
    if (this.config.isAutoPlayActive) {
      this.startAutoPlay();
    } else {
      this.stopAutoPlay();
    }
    this.updateAutoPlayUi();
    this.saveConfig();
  }

  startAutoPlay() {
    if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);
    const intervalMs = (this.config.autoPlayInterval || 25) * 1000;
    this.autoPlayTimer = setInterval(() => {
      const currentIndex = this.presetSequence.indexOf(this.config.currentPreset);
      const nextIndex = (currentIndex + 1) % this.presetSequence.length;
      this.setPreset(this.presetSequence[nextIndex]);
    }, intervalMs);
    this.updateAutoPlayUi();
  }

  stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
    this.updateAutoPlayUi();
  }

  updateAutoPlayUi() {
    if (this.btnAutoPlay) {
      this.btnAutoPlay.classList.toggle('active-playlist', this.config.isAutoPlayActive);
      this.autoPlayLabel.textContent = this.config.isAutoPlayActive
        ? `Auto (${this.config.autoPlayInterval}s)`
        : 'Playlist Auto';
    }
  }

  // Controle de Áudio Global (Mutar / Desmutar Vídeos)
  toggleAudio() {
    this.config.isAudioMuted = !this.config.isAudioMuted;
    this.applyAudioState();
    this.saveConfig();
  }

  applyAudioState() {
    const isMuted = this.config.isAudioMuted;
    if (this.btnToggleAudio) {
      this.btnToggleAudio.classList.toggle('audio-active', !isMuted);
      this.audioIcon.textContent = isMuted ? '🔇' : '🔊';
      this.audioLabel.textContent = isMuted ? 'Mudo' : 'Com Som';
    }

    // Aplica nos elementos de vídeo do DOM
    document.querySelectorAll('video').forEach(video => {
      video.muted = isMuted;
    });
  }

  // Alterar Preset Ativo
  setPreset(preset) {
    this.config.currentPreset = preset;
    const capacity = this.presetCapacities[preset] || 1;

    // Assegura que o índice ativo esteja dentro dos quadros disponíveis
    if (this.config.activeFrameIndex >= capacity) {
      this.config.activeFrameIndex = 0;
    }

    this.saveConfig();
    this.render();
  }

  // Alternar Modo TV (Ocupa 100% da tela)
  toggleTvMode(enabled) {
    this.config.isTvMode = enabled;
    document.body.classList.toggle('tv-mode', enabled);

    if (enabled) {
      // Tenta tela cheia nativa do navegador para TVs e monitores
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => { });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }

    this.saveConfig();
  }

  // Alterar o tipo de conteúdo do quadro ativo no momento
  changeCurrentFrameType(newType) {
    const frame = this.getCurrentFrame();
    if (!frame) return;

    frame.type = newType;

    // Inicializa estrutura padrão se não existir
    if (newType === 'image' && !frame.image) {
      frame.image = {
        url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80',
        fit: 'cover',
        caption: 'Aviso de Marketing'
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
        options: [
          { id: 1, text: 'Automação & IA', votes: 15 },
          { id: 2, text: 'Gestão de Projetos', votes: 10 },
          { id: 3, text: 'Comunicação Corporativa', votes: 8 }
        ]
      };
    } else if (newType === 'text' && !frame.text) {
      frame.text = {
        badgeType: 'comunicado',
        badgeText: 'COMUNICADO',
        title: 'Novo Horário de Atendimento',
        body: 'A partir da próxima semana, a recepção e o suporte funcionarão em horário estendido.',
        theme: 'theme-gradient-blue',
        author: 'Gestão de Operações'
      };
    }

    this.saveConfig();
    this.render();
  }

  getCurrentFrame() {
    return this.config.frames[this.config.activeFrameIndex];
  }

  // Renderização principal do sistema
  render() {
    const capacity = this.presetCapacities[this.config.currentPreset] || 1;

    // Atualiza botões de preset
    this.presetButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.config.currentPreset);
    });

    // Atualiza classes do grid principal
    this.framesGrid.className = `frames-grid layout-${this.config.currentPreset}`;

    // Renderiza os quadros no grid (100% da viewport)
    this.renderGridFrames(capacity);

    // Renderiza abas dos quadros no dock horizontal
    this.renderDockTabs(capacity);

    // Renderiza botões de tipo de conteúdo
    this.renderContentTypeButtons();

    // Renderiza formulário de configuração do quadro selecionado
    this.renderActiveConfigForm();

    // Atualiza visibilidade do Ticker
    this.updateTickerVisibility();
    if (this.tickerContent) {
      this.tickerContent.textContent = this.config.tickerText;
    }
  }

  // Renderizar os quadros no viewport principal
  renderGridFrames(capacity) {
    this.framesGrid.innerHTML = '';

    for (let i = 0; i < capacity; i++) {
      // Garante existência do objeto do quadro
      if (!this.config.frames[i]) {
        this.config.frames[i] = {
          type: 'text',
          text: {
            badgeType: 'comunicado',
            badgeText: 'QUADRO ' + (i + 1),
            title: 'Conteúdo em Configuração',
            body: 'Selecione este quadro no painel inferior para configurar.',
            theme: 'theme-gradient-blue'
          }
        };
      }

      const frameData = this.config.frames[i];
      const isSelected = i === this.config.activeFrameIndex;

      const frameEl = document.createElement('div');
      frameEl.className = `frame-box ${isSelected ? 'active-editing' : ''}`;
      frameEl.dataset.index = i;

      // Badge informativo (oculto no modo TV)
      const badgeEl = document.createElement('div');
      badgeEl.className = 'frame-badge';
      badgeEl.innerHTML = `<span class="frame-badge-dot"></span> Quadro ${i + 1} • ${this.getTypeLabel(frameData.type)}`;
      frameEl.appendChild(badgeEl);

      // Container de conteúdo
      const contentContainer = document.createElement('div');
      contentContainer.className = 'frame-content-container';

      // Renderiza conteúdo dependendo do tipo
      this.renderFrameContent(contentContainer, frameData, i);
      frameEl.appendChild(contentContainer);

      // Clicar no quadro seleciona para edição imediata no menu horizontal
      frameEl.addEventListener('click', (e) => {
        // Não intercepta cliques em botões interativos (como votação em enquete)
        if (e.target.closest('.poll-option-item') || e.target.closest('button')) {
          return;
        }
        if (this.config.activeFrameIndex !== i) {
          this.config.activeFrameIndex = i;
          this.saveConfig();
          this.render();
        }
      });

      this.framesGrid.appendChild(frameEl);
    }
  }

  // Retorna nome amigável do tipo
  getTypeLabel(type) {
    switch (type) {
      case 'image': return 'Imagem';
      case 'video': return 'Vídeo';
      case 'youtube': return 'YouTube';
      case 'instagram': return 'Instagram';
      case 'poll': return 'Enquete';
      case 'text': return 'Texto';
      default: return 'Geral';
    }
  }

  // Renderizar o conteúdo visual específico do quadro
  renderFrameContent(container, frameData, frameIndex) {
    switch (frameData.type) {
      case 'image':
        this.renderImageWidget(container, frameData.image);
        break;
      case 'video':
        this.renderVideoWidget(container, frameData.video);
        break;
      case 'youtube':
        this.renderYoutubeWidget(container, frameData.youtube);
        break;
      case 'instagram':
        this.renderInstagramWidget(container, frameData.instagram);
        break;
      case 'poll':
        this.renderPollWidget(container, frameData.poll, frameIndex);
        break;
      case 'text':
      default:
        this.renderTextWidget(container, frameData.text);
        break;
    }
  }

  // 1. Renderizador de Imagem
  renderImageWidget(container, imgData) {
    if (!imgData) return;
    const wrapper = document.createElement('div');
    wrapper.className = `render-image-wrapper ${imgData.fit === 'contain' ? 'fit-contain' : 'fit-cover'}`;

    const img = document.createElement('img');
    img.src = imgData.url || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1200&q=80';
    img.alt = imgData.caption || 'Feed Imagem';
    img.loading = 'lazy';
    wrapper.appendChild(img);

    if (imgData.caption) {
      const caption = document.createElement('div');
      caption.className = 'image-caption-overlay';
      caption.textContent = imgData.caption;
      wrapper.appendChild(caption);
    }

    container.appendChild(wrapper);
  }

  // 2. Renderizador de Vídeo
  renderVideoWidget(container, vidData) {
    if (!vidData) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'render-video-wrapper';

    const video = document.createElement('video');
    video.src = vidData.url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');

    // Tenta reproduzir automaticamente
    video.play().catch(() => { });

    wrapper.appendChild(video);
    container.appendChild(wrapper);
  }

  // 3. Renderizador de YouTube
  renderYoutubeWidget(container, ytData) {
    if (!ytData) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'render-youtube-wrapper';

    let videoId = ytData.videoId || this.extractYoutubeId(ytData.url) || 'L_LUpnjgPso';

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0&disablekb=1&iv_load_policy=3`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;

    wrapper.appendChild(iframe);
    container.appendChild(wrapper);
  }

  // Extrair ID do YouTube com suporte a links tradicionais, shorts e encurtados
  extractYoutubeId(url) {
    if (!url) return null;
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  }

  // Extrair Shortcode / ID de publicação ou reel do Instagram
  extractInstagramId(url) {
    if (!url) return null;
    const clean = url.trim();
    const match = clean.match(/(?:instagram\.com\/(?:p|reel|reels|tv)\/|instagr\.am\/p\/)([A-Za-z0-9_-]+)/i);
    return match ? match[1] : null;
  }

  // 4. Renderizador do Instagram (Post Original Oficial ou Fallback)
  renderInstagramWidget(container, igData) {
    if (!igData) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'render-instagram-wrapper';

    const postId = this.extractInstagramId(igData.url);

    if (postId) {
      // Exibe o post original oficial através do embed oficial do Instagram
      const embedBox = document.createElement('div');
      embedBox.className = 'instagram-embed-box';
      embedBox.innerHTML = `
        <iframe 
          src="https://www.instagram.com/p/${postId}/embed/captioned/" 
          class="instagram-embed-iframe"
          frameborder="0" 
          scrolling="no" 
          allowtransparency="true" 
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          title="Post Original do Instagram">
        </iframe>
      `;
      wrapper.appendChild(embedBox);
    } else if (igData.imageUrl) {
      // Fallback para card estético customizado
      const card = document.createElement('div');
      card.className = 'instagram-card';
      card.innerHTML = `
        <div class="ig-header">
          <div class="ig-profile-info">
            <div class="ig-avatar">
              <img src="${igData.avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60'}" alt="Perfil">
            </div>
            <div class="ig-user-text">
              <span class="ig-username">@${igData.username || 'lepta_oficial'}</span>
              <span class="ig-location">${igData.author || 'Instagram Feed Corporativo'}</span>
            </div>
          </div>
          <div class="ig-brand-icon">📸</div>
        </div>
        <div class="ig-media">
          <img src="${igData.imageUrl}" alt="Instagram Post">
        </div>
        <div class="ig-footer">
          <div class="ig-interactions">
            <span>❤️</span>
            <span>💬</span>
            <span>✈️</span>
          </div>
          <div class="ig-likes-count">${igData.likes || '342'} curtidas</div>
          <div class="ig-caption">
            <b>@${igData.username || 'lepta_oficial'}</b> ${igData.caption || ''}
            <span class="ig-tags">#Inovação #Equipe #Lepta #Marketing #Feed</span>
          </div>
        </div>
      `;
      wrapper.appendChild(card);
    } else {
      // Placeholder orientativo
      const placeholder = document.createElement('div');
      placeholder.className = 'instagram-placeholder';
      placeholder.innerHTML = `
        <div class="ig-ph-icon">📸</div>
        <h3>Carregar Post do Instagram</h3>
        <p>Cole o link de qualquer post ou reel público do Instagram no painel abaixo para exibir a publicação original.</p>
        <code class="ig-ph-example">Ex: https://www.instagram.com/p/C_q83m5Mz-x/</code>
      `;
      wrapper.appendChild(placeholder);
    }

    container.appendChild(wrapper);

    if (window.instgrm && window.instgrm.Embeds) {
      try {
        window.instgrm.Embeds.process();
      } catch (e) { }
    }
  }

  // 5. Renderizador de Enquete Interativa com QR Code
  renderPollWidget(container, pollData, frameIndex) {
    if (!pollData) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'render-poll-wrapper';

    const card = document.createElement('div');
    card.className = 'poll-card';

    // Calcula total de votos
    const totalVotes = pollData.options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

    card.innerHTML = `
      <div class="poll-with-qr">
        <div class="poll-content-side">
          <div class="poll-top-badge">
            <span>📊</span>
            <span>ENQUETE EM TEMPO REAL</span>
          </div>
          <h2 class="poll-question">${pollData.question || 'Pergunta da Enquete'}</h2>
          <div class="poll-options-list"></div>
          <div class="poll-footer-info">
            <span>${totalVotes} votos registrados</span>
            <span>Clique na tela ou aponte o celular para votar</span>
          </div>
        </div>
        <div class="poll-qr-side">
          <div class="qr-code-box" id="pollQrCode_${frameIndex}"></div>
          <span class="qr-label">📱 VOTE PELO CELULAR</span>
        </div>
      </div>
    `;

    const optionsList = card.querySelector('.poll-options-list');

    pollData.options.forEach((option) => {
      const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;

      const optItem = document.createElement('div');
      optItem.className = 'poll-option-item';
      optItem.innerHTML = `
        <div class="poll-fill-bar" style="width: ${percentage}%"></div>
        <span class="poll-option-label">${option.text}</span>
        <div class="poll-option-stats">
          <span>${percentage}%</span>
          <span style="font-size: 0.72rem; opacity: 0.75;">(${option.votes})</span>
        </div>
      `;

      // Voto ao vivo com clique!
      optItem.addEventListener('click', (e) => {
        e.stopPropagation();
        option.votes = (option.votes || 0) + 1;
        this.saveConfig();
        this.render();
      });

      optionsList.appendChild(optItem);
    });

    wrapper.appendChild(card);
    container.appendChild(wrapper);

    // Gera QR Code de forma assíncrona garantindo a renderização do elemento
    setTimeout(() => {
      const qrElem = document.getElementById(`pollQrCode_${frameIndex}`);
      if (qrElem) {
        qrElem.innerHTML = '';
        if (window.QRCode) {
          try {
            new window.QRCode(qrElem, {
              text: pollData.qrUrl || 'https://lepta.com.br/workshop',
              width: 100,
              height: 100,
              colorDark: '#0f172a',
              colorLight: '#ffffff',
              correctLevel: window.QRCode.CorrectLevel.M
            });
          } catch (e) {
            qrElem.innerHTML = `<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#fff"/><rect x="10" y="10" width="28" height="28" fill="#0f172a"/><rect x="16" y="16" width="16" height="16" fill="#fff"/><rect x="62" y="10" width="28" height="28" fill="#0f172a"/><rect x="68" y="16" width="16" height="16" fill="#fff"/><rect x="10" y="62" width="28" height="28" fill="#0f172a"/><rect x="16" y="68" width="16" height="16" fill="#fff"/><rect x="46" y="46" width="12" height="12" fill="#0f172a"/></svg>`;
          }
        } else {
          qrElem.innerHTML = `<svg viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#fff"/><rect x="10" y="10" width="28" height="28" fill="#0f172a"/><rect x="16" y="16" width="16" height="16" fill="#fff"/><rect x="62" y="10" width="28" height="28" fill="#0f172a"/><rect x="68" y="16" width="16" height="16" fill="#fff"/><rect x="10" y="62" width="28" height="28" fill="#0f172a"/><rect x="16" y="68" width="16" height="16" fill="#fff"/><rect x="46" y="46" width="12" height="12" fill="#0f172a"/></svg>`;
        }
      }
    }, 50);
  }

  // 6. Renderizador de Texto Formatado / Comunicado Corporativo
  renderTextWidget(container, textData) {
    if (!textData) return;
    const wrapper = document.createElement('div');
    wrapper.className = `render-text-wrapper ${textData.theme || 'theme-gradient-blue'}`;

    const badgeClass = `badge-${textData.badgeType || 'comunicado'}`;

    wrapper.innerHTML = `
      <div class="text-badge ${badgeClass}">
        ${textData.badgeText || 'COMUNICADO'}
      </div>
      <h1 class="text-main-title">${textData.title || 'Título do Comunicado'}</h1>
      <div class="text-body-content">${textData.body || 'Insira o texto formatado do comunicado corporativo.'}</div>
      <div class="text-footer-meta">
        <span>${textData.author || 'Comunicação Interna'}</span>
        <span>•</span>
        <span>Atualizado Hoje</span>
      </div>
    `;

    container.appendChild(wrapper);
  }

  // Renderizar o indicador do quadro ativo ou letreiro no dock horizontal
  renderDockTabs(capacity) {
    if (!this.dockFramesSelector) return;
    this.dockFramesSelector.innerHTML = '';

    const tag = document.createElement('div');
    tag.className = 'active-frame-tag';
    if (this.config.activeDockTab === 'ticker') {
      tag.innerHTML = `<span class="tag-pulse"></span> <span>GERENCIANDO LETREIRO</span>`;
    } else {
      tag.innerHTML = `<span class="tag-pulse"></span> <span>EDITANDO QUADRO</span>`;
    }
    this.dockFramesSelector.appendChild(tag);
  }

  // Renderizar estado ativo dos botões de tipo de conteúdo
  renderContentTypeButtons() {
    const activeFrame = this.getCurrentFrame();
    if (!activeFrame) return;

    this.contentTypeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === activeFrame.type);
    });
  }

  // Atualizar classe de velocidade do ticker
  updateTickerSpeedClass() {
    if (this.tickerContent) {
      this.tickerContent.className = `ticker-content speed-${this.config.tickerSpeed || 'normal'}`;
    }
  }

  // Renderizar o formulário contextual do quadro ativo no dock horizontal
  renderActiveConfigForm() {
    this.configFormsContainer.innerHTML = '';

    if (this.config.activeDockTab === 'ticker') {
      if (this.typeSelectorStrip) this.typeSelectorStrip.style.display = 'none';
      this.buildTickerForm();
      return;
    }

    if (this.typeSelectorStrip) this.typeSelectorStrip.style.display = 'flex';

    const frame = this.getCurrentFrame();
    if (!frame) return;

    switch (frame.type) {
      case 'image':
        this.buildImageForm(frame.image);
        break;
      case 'video':
        this.buildVideoForm(frame.video);
        break;
      case 'youtube':
        this.buildYoutubeForm(frame.youtube);
        break;
      case 'instagram':
        this.buildInstagramForm(frame.instagram);
        break;
      case 'poll':
        this.buildPollForm(frame.poll, this.config.activeFrameIndex);
        break;
      case 'text':
      default:
        this.buildTextForm(frame.text);
        break;
    }
  }

  // Formulário: Letreiro Rolante e Playlist
  buildTickerForm() {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group full-width">
        <label class="form-label">Mensagens do Letreiro Rolante (Comunicados Corporativos)</label>
        <textarea class="form-textarea" id="inputTickerText" rows="2" placeholder="Digite os comunicados da empresa...">${this.config.tickerText || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Velocidade da Animação do Letreiro</label>
        <select class="form-select" id="selectTickerSpeed">
          <option value="slow" ${this.config.tickerSpeed === 'slow' ? 'selected' : ''}>Mais Lenta (50s)</option>
          <option value="normal" ${this.config.tickerSpeed === 'normal' ? 'selected' : ''}>Normal Padrão (35s)</option>
          <option value="fast" ${this.config.tickerSpeed === 'fast' ? 'selected' : ''}>Rápida (20s)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Intervalo da Playlist Automática (em segundos)</label>
        <input type="number" class="form-input" id="inputAutoPlayInterval" value="${this.config.autoPlayInterval || 25}" min="5" max="300">
      </div>
    `;

    const textInp = container.querySelector('#inputTickerText');
    const speedSel = container.querySelector('#selectTickerSpeed');
    const intervalInp = container.querySelector('#inputAutoPlayInterval');

    textInp.addEventListener('input', (e) => {
      this.config.tickerText = e.target.value;
      if (this.tickerContent) this.tickerContent.textContent = this.config.tickerText;
      this.saveConfig();
    });

    speedSel.addEventListener('change', (e) => {
      this.config.tickerSpeed = e.target.value;
      this.updateTickerSpeedClass();
      this.saveConfig();
    });

    intervalInp.addEventListener('input', (e) => {
      this.config.autoPlayInterval = parseInt(e.target.value, 10) || 25;
      if (this.config.isAutoPlayActive) {
        this.startAutoPlay();
      }
      this.saveConfig();
    });

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: Imagem
  buildImageForm(imgData) {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">URL da Imagem ou Upload Local</label>
        <div class="form-row">
          <input type="text" class="form-input" id="inputImgUrl" value="${imgData.url || ''}" placeholder="https://exemplo.com/foto.jpg" style="flex: 1;">
          <label class="btn-inline-upload" title="Carregar foto do computador">
            📁 Arquivo
            <input type="file" id="fileUploadImg" accept="image/*" style="display: none;">
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ajuste de Exibição</label>
        <select class="form-select" id="selectImgFit">
          <option value="cover" ${imgData.fit === 'cover' ? 'selected' : ''}>Preencher Total (Cover)</option>
          <option value="contain" ${imgData.fit === 'contain' ? 'selected' : ''}>Conter Inteira (Contain)</option>
        </select>
      </div>
      <div class="form-group full-width">
        <label class="form-label">Legenda Sobreposta (Opcional)</label>
        <input type="text" class="form-input" id="inputImgCaption" value="${imgData.caption || ''}" placeholder="Ex: Parabéns equipe pelo resultado">
      </div>
    `;

    // Sincronização em tempo real
    const urlInput = container.querySelector('#inputImgUrl');
    const fitSelect = container.querySelector('#selectImgFit');
    const captionInput = container.querySelector('#inputImgCaption');
    const fileInput = container.querySelector('#fileUploadImg');

    urlInput.addEventListener('input', (e) => {
      imgData.url = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    fitSelect.addEventListener('change', (e) => {
      imgData.fit = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    captionInput.addEventListener('input', (e) => {
      imgData.caption = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          imgData.url = evt.target.result;
          urlInput.value = imgData.url;
          this.saveConfig();
          this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
        };
        reader.readAsDataURL(file);
      }
    });

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: Vídeo
  buildVideoForm(vidData) {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group full-width">
        <label class="form-label">URL Direta do Vídeo (.mp4) ou Arquivo Local</label>
        <div class="form-row">
          <input type="text" class="form-input" id="inputVidUrl" value="${vidData.url || ''}" placeholder="https://exemplo.com/video.mp4" style="flex: 1;">
          <label class="btn-inline-upload" title="Carregar vídeo do computador">
            📁 Carregar Vídeo
            <input type="file" id="fileUploadVid" accept="video/mp4,video/webm" style="display: none;">
          </label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Propriedades de TV</label>
        <div style="font-size: 0.76rem; color: var(--text-muted); padding-top: 6px;">
          ✓ Autoplay Automático Mudo (Padrão para exibição contínua em TVs sem bloqueio do navegador)
        </div>
      </div>
    `;

    const urlInput = container.querySelector('#inputVidUrl');
    const fileInput = container.querySelector('#fileUploadVid');

    urlInput.addEventListener('input', (e) => {
      vidData.url = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          vidData.url = evt.target.result;
          urlInput.value = '(Arquivo local carregado)';
          this.saveConfig();
          this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
        };
        reader.readAsDataURL(file);
      }
    });

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: YouTube
  buildYoutubeForm(ytData) {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group full-width">
        <label class="form-label">Link do YouTube (Vídeo, Shorts ou Compartilhamento)</label>
        <input type="text" class="form-input" id="inputYtUrl" value="${ytData.url || ''}" placeholder="https://www.youtube.com/watch?v=...">
      </div>
      <div class="form-group full-width">
        <div style="font-size: 0.76rem; color: var(--accent-cyan);">
          ⚡ O player inicia automaticamente (autoplay), em loop infinito, sem barras ou anúncios recomendados.
        </div>
      </div>
    `;

    const input = container.querySelector('#inputYtUrl');
    input.addEventListener('input', (e) => {
      ytData.url = e.target.value;
      ytData.videoId = this.extractYoutubeId(e.target.value);
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: Instagram
  buildInstagramForm(igData) {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group full-width">
        <label class="form-label">Link da Publicação do Instagram (Post ou Reel)</label>
        <input type="text" class="form-input" id="inputIgUrl" value="${igData.url || ''}" placeholder="https://www.instagram.com/p/... ou https://www.instagram.com/reel/..." autofocus>
        <span class="form-help-text" style="font-size: 0.72rem; color: #38bdf8; margin-top: 4px; display: block;">
          ✨ Cole o link de qualquer post ou reel público do Instagram para renderizar a publicação original oficial.
        </span>
      </div>
      <div class="form-group">
        <label class="form-label">Usuário (@) [Opcional]</label>
        <input type="text" class="form-input" id="inputIgUser" value="${igData.username || ''}" placeholder="lepta_oficial">
      </div>
      <div class="form-group">
        <label class="form-label">Nome / Localização [Opcional]</label>
        <input type="text" class="form-input" id="inputIgAuthor" value="${igData.author || ''}" placeholder="Lepta Capital • São Paulo">
      </div>
      <div class="form-group full-width">
        <label class="form-label">Legenda Complementar [Opcional]</label>
        <textarea class="form-textarea" id="inputIgCaption" rows="2" placeholder="Legenda personalizada">${igData.caption || ''}</textarea>
      </div>
    `;

    const urlInp = container.querySelector('#inputIgUrl');
    const userInp = container.querySelector('#inputIgUser');
    const authInp = container.querySelector('#inputIgAuthor');
    const captionInp = container.querySelector('#inputIgCaption');

    const update = () => {
      igData.url = urlInp.value.trim();
      igData.username = userInp.value.trim();
      igData.author = authInp.value.trim();
      igData.caption = captionInp.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    };

    [urlInp, userInp, authInp, captionInp].forEach(el => el.addEventListener('input', update));

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: Enquete
  buildPollForm(pollData) {
    const container = document.createElement('div');
    container.className = 'form-grid';

    let optionsHtml = '';
    pollData.options.forEach((opt, idx) => {
      optionsHtml += `
        <div class="poll-option-row" data-idx="${idx}">
          <input type="text" class="form-input opt-text" value="${opt.text}" placeholder="Opção ${idx + 1}" style="flex: 1;">
          <input type="number" class="form-input opt-votes" value="${opt.votes || 0}" style="width: 75px;" title="Votos" min="0">
          <button type="button" class="btn-remove-opt" title="Remover Opção">✕</button>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="form-group full-width">
        <label class="form-label">Pergunta da Enquete</label>
        <input type="text" class="form-input" id="inputPollQuestion" value="${pollData.question || ''}" placeholder="Qual a pergunta?">
      </div>
      <div class="form-group full-width">
        <label class="form-label">Link para Votação Mobile (Gera o QR Code na TV)</label>
        <input type="text" class="form-input" id="inputPollQr" value="${pollData.qrUrl || 'https://lepta.com.br/workshop'}" placeholder="https://...">
      </div>
      <div class="form-group full-width">
        <label class="form-label">Opções de Resposta e Votos Iniciais</label>
        <div id="pollOptionsContainer">${optionsHtml}</div>
        <button type="button" class="btn-add-opt" id="btnAddPollOption">+ Adicionar Nova Opção</button>
      </div>
    `;

    const questionInput = container.querySelector('#inputPollQuestion');
    const qrInput = container.querySelector('#inputPollQr');

    questionInput.addEventListener('input', (e) => {
      pollData.question = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    qrInput.addEventListener('input', (e) => {
      pollData.qrUrl = e.target.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    });

    const bindOptionRows = () => {
      container.querySelectorAll('.poll-option-row').forEach(row => {
        const idx = parseInt(row.dataset.idx, 10);
        const textInp = row.querySelector('.opt-text');
        const votesInp = row.querySelector('.opt-votes');
        const btnRemove = row.querySelector('.btn-remove-opt');

        textInp.oninput = (e) => {
          pollData.options[idx].text = e.target.value;
          this.saveConfig();
          this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
        };

        votesInp.oninput = (e) => {
          pollData.options[idx].votes = parseInt(e.target.value, 10) || 0;
          this.saveConfig();
          this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
        };

        btnRemove.onclick = () => {
          if (pollData.options.length <= 2) {
            alert('A enquete precisa de pelo menos 2 opções.');
            return;
          }
          pollData.options.splice(idx, 1);
          this.saveConfig();
          this.render();
        };
      });
    };

    bindOptionRows();

    const btnAdd = container.querySelector('#btnAddPollOption');
    btnAdd.addEventListener('click', () => {
      if (pollData.options.length >= 6) {
        alert('Máximo de 6 opções para preservar a legibilidade em TV.');
        return;
      }
      pollData.options.push({
        id: Date.now(),
        text: `Nova Opção ${pollData.options.length + 1}`,
        votes: 0
      });
      this.saveConfig();
      this.render();
    });

    this.configFormsContainer.appendChild(container);
  }

  // Formulário: Texto / Comunicado
  buildTextForm(textData) {
    const container = document.createElement('div');
    container.className = 'form-grid';
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tipo de Destaque</label>
        <select class="form-select" id="selectBadgeType">
          <option value="comunicado" ${textData.badgeType === 'comunicado' ? 'selected' : ''}>Comunicado Geral</option>
          <option value="urgente" ${textData.badgeType === 'urgente' ? 'selected' : ''}>Aviso Urgente</option>
          <option value="meta" ${textData.badgeType === 'meta' ? 'selected' : ''}>Meta Batida / Sucesso</option>
          <option value="aniversario" ${textData.badgeType === 'aniversario' ? 'selected' : ''}>Aniversariantes / Evento</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Texto da Tag (Badge)</label>
        <input type="text" class="form-input" id="inputBadgeText" value="${textData.badgeText || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Tema Visual / Gradiente</label>
        <select class="form-select" id="selectTheme">
          <option value="theme-gradient-blue" ${textData.theme === 'theme-gradient-blue' ? 'selected' : ''}>Azul Tecnológico</option>
          <option value="theme-gradient-purple" ${textData.theme === 'theme-gradient-purple' ? 'selected' : ''}>Violeta Criativo</option>
          <option value="theme-gradient-emerald" ${textData.theme === 'theme-gradient-emerald' ? 'selected' : ''}>Esmeralda Metas</option>
          <option value="theme-gradient-amber" ${textData.theme === 'theme-gradient-amber' ? 'selected' : ''}>Âmbar Alerta</option>
          <option value="theme-gradient-crimson" ${textData.theme === 'theme-gradient-crimson' ? 'selected' : ''}>Rubi Urgência</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Assinatura / Departamento</label>
        <input type="text" class="form-input" id="inputAuthor" value="${textData.author || ''}" placeholder="Ex: Recursos Humanos">
      </div>
      <div class="form-group full-width">
        <label class="form-label">Título Principal</label>
        <input type="text" class="form-input" id="inputTitle" value="${textData.title || ''}">
      </div>
      <div class="form-group full-width">
        <label class="form-label">Corpo do Texto / Conteúdo Formatado</label>
        <textarea class="form-textarea" id="inputTextBody" rows="2">${textData.body || ''}</textarea>
      </div>
    `;

    const badgeSel = container.querySelector('#selectBadgeType');
    const badgeTextInp = container.querySelector('#inputBadgeText');
    const themeSel = container.querySelector('#selectTheme');
    const authorInp = container.querySelector('#inputAuthor');
    const titleInp = container.querySelector('#inputTitle');
    const bodyInp = container.querySelector('#inputTextBody');

    const update = () => {
      textData.badgeType = badgeSel.value;
      textData.badgeText = badgeTextInp.value;
      textData.theme = themeSel.value;
      textData.author = authorInp.value;
      textData.title = titleInp.value;
      textData.body = bodyInp.value;
      this.saveConfig();
      this.renderGridFrames(this.presetCapacities[this.config.currentPreset]);
    };

    badgeSel.addEventListener('change', () => {
      // Ajusta texto padrão da tag se usuário desejar
      if (badgeSel.value === 'urgente') badgeTextInp.value = '🚨 ATENÇÃO URGENTE';
      else if (badgeSel.value === 'meta') badgeTextInp.value = '🏆 META ATINGIDA';
      else if (badgeSel.value === 'aniversario') badgeTextInp.value = '🎉 COMEMORAÇÃO';
      else badgeTextInp.value = 'COMUNICADO';
      update();
    });

    [badgeTextInp, themeSel, authorInp, titleInp, bodyInp].forEach(el => {
      el.addEventListener('input', update);
      el.addEventListener('change', update);
    });

    this.configFormsContainer.appendChild(container);
  }

  // Exportar configuração JSON
  exportConfig() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `lepta-feed-config-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Importar configuração JSON
  importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported && imported.frames) {
          this.config = imported;
          this.saveConfig();
          this.render();
          alert('Configurações do Feed importadas com sucesso!');
        } else {
          alert('Formato de arquivo inválido.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
}

// Inicializa a aplicação assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.feedTvApp = new FeedTvApp();
});
