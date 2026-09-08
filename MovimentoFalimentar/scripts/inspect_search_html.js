import fs from 'node:fs';

async function inspectSearchHtml() {
  const searchUrl = 'https://valor.globo.com/busca/?q=movimento%20falimentar';
  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const text = await res.text();
  
  // Find script tags and data
  const scripts = text.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  console.log(`Found ${scripts.length} script tags`);
  
  // Search for endpoints or urls
  const apiUrls = text.match(/https?:\/\/[a-zA-Z0-9.\-_/]+\b/g) || [];
  const searchApis = [...new Set(apiUrls)].filter(u => u.includes('busca') || u.includes('search') || u.includes('api'));
  console.log('Search APIs / Endpoints in HTML:', searchApis);

  // Check if there is any initial state JSON
  for (const s of scripts) {
    if (s.includes('movimento') || s.includes('resultado') || s.includes('results') || s.includes('items')) {
      console.log('Script with relevant keywords snippet:', s.slice(0, 300));
    }
  }
}

inspectSearchHtml();
