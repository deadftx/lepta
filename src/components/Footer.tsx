import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer" id="contato">
      <div className="footer-container">
        <div className="footer-brand">
          <h2 className="logo-text">
            <span className="logo-lepta">LEPTA</span> <span className="logo-capital">CAPITAL</span>
          </h2>
          <p className="footer-desc">
            Reestruturando empresas e gerando valor através de inteligência financeira.
          </p>
        </div>
        
        <div className="footer-contact">
          <h3>Contato</h3>
          <p>Av. Sagitário, 138</p>
          <p>Cj. 2106 - Torre City - Alphaville</p>
          <p>Barueri/SP | CEP 06473-073</p>
          <a href="mailto:contato@lepta.com.br" className="contact-link">contato@lepta.com.br</a>
          <p className="phone">+55 11 4326-3875</p>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; 2021 Lepta Capital. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
};

export default Footer;
