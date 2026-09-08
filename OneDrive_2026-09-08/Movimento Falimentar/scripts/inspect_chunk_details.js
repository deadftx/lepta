async function inspectChunkDetails() {
  const url = 'https://s.glbimg.com/bs/delivery/delivery-components/backstage-cms-search-page/0.2.6/client/src_components_SearchResult_jsx-src_components_track_js-src_fonts_css-src_style_css-webpack_s-934337.js';
  const res = await fetch(url);
  const text = await res.text();
  
  // Find all occurrences of "http"
  const lines = text.split(';');
  for (const l of lines) {
    if (l.includes('/v1/search') || l.includes('searchAPI') || l.includes('searchProfile') || l.includes('fetch(') || l.includes('axios')) {
      console.log('--- LINE ---');
      console.log(l.slice(0, 500));
    }
  }
}

inspectChunkDetails();
