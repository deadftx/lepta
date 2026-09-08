async function inspectSearchJs() {
  const jsUrl = 'https://s.glbimg.com/bs/delivery/delivery-components/backstage-cms-all-search-results/0.2.9/1.js';
  const res = await fetch(jsUrl);
  const text = await res.text();
  console.log('JS text length:', text.length);
  
  // Find all URLs in the JS
  const urls = text.match(/https?:\/\/[a-zA-Z0-9.\-_/:]+/g) || [];
  console.log('URLs found in bundle:', [...new Set(urls)]);

  // Also search for query patterns
  const patterns = text.match(/(?:fetch|axios|get)\s*\(\s*[`'"][^`'"]+[`'"]/g) || [];
  console.log('Fetch patterns in bundle:', patterns);

  // Search for path patterns like /busca/ or /api/
  const paths = text.match(/["'`]\/(?:api|busca|search|content|feed)[^"'`]*["'`]/g) || [];
  console.log('Path patterns in bundle:', paths);
}

inspectSearchJs();
