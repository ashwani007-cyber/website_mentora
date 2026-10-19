import http from 'http';

http.get('http://localhost:5173/about', (res) => {
  console.log('Status code for /about:', res.statusCode);
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log('Received HTML length:', data.length);
    console.log('Contains root div:', data.includes('<div id="root"></div>'));
  });
}).on('error', (err) => {
  console.error('Error fetching /about:', err.message);
});
