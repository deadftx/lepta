import { ArrowRight, Shield, BarChart3, Globe2, Recycle, Landmark } from 'lucide-react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-logo-container">
            <img src="/logo1.png" alt="Lepta Capital" className="hero-main-logo" />
          </div>
          <h1 className="hero-title">
            O Poder do <span className="text-gradient">Renascimento</span> Financeiro
          </h1>
          <p className="hero-subtitle">
            Reestruturação inteligente, gestão de passivos e criação de valor para o seu negócio através da inteligência de crédito e securitização.
          </p>
          <div className="hero-actions">
            <a href="#servicos" className="btn-primary">
              Conheça nossas soluções <ArrowRight size={18} style={{ marginLeft: 8 }} />
            </a>
            <a href="#proposito" className="btn-outline">
              Nosso Propósito
            </a>
          </div>
        </div>
      </section>

      {/* Purpose Section */}
      <section id="proposito" className="section purpose-section">
        <div className="purpose-grid">
          <div className="purpose-text">
            <h2 className="section-title">Acreditamos no Poder do <span className="text-gradient">Renascimento</span></h2>
            <p>
              É por isso que o símbolo que representa a <strong>Lepta</strong> é uma Fênix. A Fênix é uma criatura mítica que renasce das próprias cinzas, superando todas as dificuldades, trazendo em suas asas o poder do fogo e tornando-se cada vez mais forte. Essa é a nossa missão.
            </p>
            
            <h3 className="subsection-title">OLHANDO PARA O HOJE</h3>
            <p>
              O momento é de adaptação. Conforme empresas passam por dificuldades financeiras e encaram os desafios que vêm com isso, a Lepta torna-se ainda mais relevante. Nós providenciamos o suporte necessário para que nossos clientes possam seguir em frente com a reestruturação de suas empresas.
            </p>
          </div>
          <div className="purpose-visual glass">
            <div className="abstract-phoenix">
              <div className="flame flame-1"></div>
              <div className="flame flame-2"></div>
              <div className="flame flame-3"></div>
            </div>
            <div className="strategic-position">
              <h3>Posição Estratégica</h3>
              <p>Com anos de experiência no mercado financeiro e investimento contínuo, a Lepta é fundamental na renegociação de créditos adquiridos de bancos e fornecedores, elaborando as melhores formas de limpar as dívidas de nossos clientes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Parallax Separator */}
      <section className="parallax-separator">
        <div className="parallax-overlay">
          <h2 className="parallax-title">Inteligência Financeira em Ação</h2>
        </div>
      </section>

      {/* Services Section */}
      <section id="servicos" className="section services-section">
        <div className="services-header">
          <h2 className="section-title">O Que <span className="text-gradient">Fazemos</span></h2>
          <p>Soluções financeiras customizadas e aquisição de crédito NPL.</p>
        </div>
        
        <div className="services-grid">
          <div className="service-card glass glass-hover">
            <Shield className="service-icon" />
            <h3>Aquisição de Crédito | NPL</h3>
            <p>A aquisição de crédito tem um objetivo principal: reestruturar passivos em situações de recuperação judicial (Chapter 11) e ativos estressados sem comunicação amigável.</p>
          </div>

          <div className="service-card glass glass-hover">
            <BarChart3 className="service-icon" />
            <h3>Securitização</h3>
            <p>Oferecemos soluções financeiras customizadas para empresas que precisam de recursos para gerenciar seus negócios através de securitização e/ou antecipação de recebíveis.</p>
          </div>

          <div className="service-card glass glass-hover">
            <Landmark className="service-icon" />
            <h3>Lepta Bank</h3>
            <p>Buscando expandir nossas opções e oferecer serviços financeiros mais abrangentes. Uma plataforma segura para processar pagamentos de forma confiável.</p>
          </div>

          <div className="service-card glass glass-hover">
            <Globe2 className="service-icon" />
            <h3>Câmbio</h3>
            <p>Atuamos como correspondentes bancários das principais instituições de câmbio, oferecendo uma grande variedade de produtos e serviços internacionais e trade finance.</p>
          </div>

          <div className="service-card glass glass-hover">
            <Recycle className="service-icon" />
            <h3>Lepta Metals</h3>
            <p>Comprometidos com a reciclagem de metais e redução do impacto ambiental, compramos e vendemos sucata, fornecendo uma solução de gerenciamento de resíduos sustentável.</p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section id="valores" className="section values-section">
        <h2 className="section-title text-center">Nossos <span className="text-gradient">Valores</span></h2>
        
        <div className="values-grid">
          <div className="value-card">
            <div className="value-number">01</div>
            <h3>CONFIANÇA</h3>
            <p>A história da Lepta é nossa melhor porta-voz. A credibilidade que conquistamos é fruto de muito trabalho e dedicação. Nossos resultados são nossa melhor propaganda, algo intangível que vale muito mais do que dinheiro.</p>
          </div>
          
          <div className="value-card">
            <div className="value-number">02</div>
            <h3>EFICÁCIA</h3>
            <p>Comparados às práticas de mercado, somos mais próximos da realidade de nossos clientes e entendemos, na prática, a situação de cada um. Isso nos permite desenhar a estratégia mais objetiva para a empresa.</p>
          </div>
          
          <div className="value-card">
            <div className="value-number">03</div>
            <h3>COERÊNCIA</h3>
            <p>Baseados na nossa trajetória, confiamos na nossa capacidade analítica. Não aceitamos qualquer negócio, mas aqueles em que acreditamos no potencial de recuperação e que compartilham do nosso DNA de confiabilidade.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
