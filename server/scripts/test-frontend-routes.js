const http = require('http');

const FRONTEND_URL = 'http://localhost:3000';
const routes = [
  '/',
  '/login',
  '/register',
  '/chat',
  '/documents',
  '/admin',
  '/settings'
];

function checkRoute(route) {
  return new Promise((resolve) => {
    const url = new URL(route, FRONTEND_URL);
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const isOk = res.statusCode === 200 && body.includes('__NEXT_DATA__');
        resolve({ route, statusCode: res.statusCode, isOk });
      });
    }).on('error', (err) => {
      resolve({ route, statusCode: 500, error: err.message, isOk: false });
    });
  });
}

async function auditFrontendRoutes() {
  console.log('🌐 Auditing Next.js Frontend Routes on http://localhost:3000...\n');
  let allPassed = true;

  for (const route of routes) {
    const result = await checkRoute(route);
    if (result.isOk) {
      console.log(`  - GET ${route.padEnd(12)}: 200 OK ✅ (Next.js Page Rendered)`);
    } else {
      console.log(`  - GET ${route.padEnd(12)}: ${result.statusCode} ❌ (${result.error || 'Failed'})`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n🎉 ALL 7 FRONTEND NEXT.JS ROUTES AUDITED & FUNCTIONAL!');
  } else {
    console.log('\n⚠️ Some frontend routes failed.');
  }
}

auditFrontendRoutes();
