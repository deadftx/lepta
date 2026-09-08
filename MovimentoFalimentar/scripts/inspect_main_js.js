async function inspectMainJs() {
  const jsUrl = 'https://s.glbimg.com/bs/delivery/delivery-components/backstage-cms-search-page/0.2.6/client/main.js';
  const res = await fetch(jsUrl);
  const text = await res.text();
  console.log('Main JS text length:', text.length);
  
  // Find URLs with https or http
  const urls = text.match(/https?:\/\/[a-zA-Z0-9.\-_/:]+/g) || [];
  console.log('URLs in main.js:', [...new Set(urls)]);

  // Let's search for query params or endpoints
  const endpoints = text.match(/https?:\/\/[^\s"'`]+\b/g) || [];
  console.log('Endpoints sample:', endpoints.slice(0, 15));

  // Search for search api calls
  const matches = text.match(/["'`][^"'`]*?(?:busca|search|query|falkor)[^"'`]*?["'`]/gi) || [];
  console.log('Search matches:', [...new Set(matches)].slice(0, 30));
}

inspectMainJs();
