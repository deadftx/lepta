async function inspectAfterB() {
  const url = 'https://s.glbimg.com/bs/delivery/delivery-components/backstage-cms-search-page/0.2.6/client/src_components_SearchResult_jsx-src_components_track_js-src_fonts_css-src_style_css-webpack_s-934337.js';
  const res = await fetch(url);
  const text = await res.text();
  
  const idx = text.indexOf('B="".concat(_.searchAPI,"/v1/search")');
  if (idx !== -1) {
    console.log(text.slice(idx, idx + 1000));
  }
}

inspectAfterB();
