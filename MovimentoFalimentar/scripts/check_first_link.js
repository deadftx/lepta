import { fetchValorArticlesList } from '../dist/valor_scraper.js';

async function checkFirstLink() {
  console.log('Buscando o primeiro link mais recente em https://valor.globo.com/busca/?q=movimento%20falimentar ...');
  const articles = await fetchValorArticlesList(5);
  console.log(`Encontrados ${articles.length} artigos:`);
  articles.forEach((a, i) => {
    console.log(`[${i+1}] ${a.title} | ${a.date} | ${a.url}`);
  });
}

checkFirstLink();
