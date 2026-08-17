const token = '4E5BF2FC1313695BD24FB21591DC3D4E69B24CC04BCC6DB53CC2541CAA7A1367';
fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/titulos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `UNLTD-BackEnd ${token}`
  },
  body: JSON.stringify({
    "tipoDeData": "Cadastro",
    "dataInicial": "2026-08-01T13:30:10.197Z",
    "dataFinal": "2026-08-24T18:30:10.197Z"
  })
}).then(res => {
  console.log('Status:', res.status);
  return res.text();
}).then(txt => {
  console.log('Body:', txt.substring(0, 500));
}).catch(err => {
  console.error('Network Error:', err);
});
