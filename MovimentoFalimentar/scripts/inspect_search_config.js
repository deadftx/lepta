async function inspectSearchConfigAndPost() {
  const searchPageUrl = 'https://valor.globo.com/busca/?q=movimento%20falimentar';
  const res = await fetch(searchPageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  
  // Find searchProfile, queryId, tenantId in the HTML
  const configMatch = html.match(/window\.__COMPONENTS__\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (configMatch) {
    try {
      const components = JSON.parse(configMatch[1]);
      console.log('Components parsed successfully!');
      
      // Navigate to find config
      const allSearchResults = components?.component?.allSearchResults;
      console.log('allSearchResults keys:', allSearchResults ? Object.keys(allSearchResults) : 'null');
      console.log('api_content:', JSON.stringify(allSearchResults?.api_content || components?.api_content || {}, null, 2));
    } catch (e) {
      console.log('Direct JSON parse failed, extracting via regex:');
      const searchProfile = html.match(/"searchProfile":\s*"([^"]+)"/)?.[1];
      const queryId = html.match(/"queryId":\s*(\{[^}]+\})/)?.[1];
      const tenantId = html.match(/"tenantId":\s*"([^"]+)"/)?.[1];
      console.log('searchProfile:', searchProfile);
      console.log('queryId:', queryId);
      console.log('tenantId:', tenantId);
    }
  }
}

inspectSearchConfigAndPost();
