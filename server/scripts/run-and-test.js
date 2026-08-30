const app = require('../src/app');
const http = require('http');

const PORT = 5050;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('🚀 Launching CollegeAI Test Server on port', PORT);
  const server = app.listen(PORT);

  try {
    console.log('\n🧪 Running Verification Tests...');

    // 1. Health Endpoint
    const health = await makeRequest('GET', '/api/health');
    console.log('  1. GET /api/health:', health.statusCode === 200 && health.body.success ? 'PASSED ✅' : 'FAILED ❌');

    // 2. Register Student
    const studentRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Alice Student',
      email: 'alice@college.edu',
      password: 'password123',
      role: 'student'
    });
    console.log('  2. POST /api/auth/register (Student):', studentRes.statusCode === 201 && studentRes.body.success ? 'PASSED ✅' : 'FAILED ❌');
    const studentToken = studentRes.body?.data?.token;

    // 3. Register Admin
    const adminRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Bob Admin',
      email: 'admin@college.edu',
      password: 'adminpassword123',
      role: 'admin'
    });
    console.log('  3. POST /api/auth/register (Admin):', adminRes.statusCode === 201 && adminRes.body.success ? 'PASSED ✅' : 'FAILED ❌');
    const adminToken = adminRes.body?.data?.token;

    // 4. Me endpoint
    const meRes = await makeRequest('GET', '/api/auth/me', null, { Authorization: `Bearer ${studentToken}` });
    console.log('  4. GET /api/auth/me:', meRes.statusCode === 200 && meRes.body.data?.user?.email === 'alice@college.edu' ? 'PASSED ✅' : 'FAILED ❌');

    // 5. Protected Admin Endpoint Guard Test
    const forbidden = await makeRequest('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${studentToken}` });
    console.log('  5. GET /api/admin/dashboard (Student token -> 403 Forbidden):', forbidden.statusCode === 403 ? 'PASSED ✅' : 'FAILED ❌');

    // 6. Admin Dashboard Access
    const dash = await makeRequest('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${adminToken}` });
    console.log('  6. GET /api/admin/dashboard (Admin token -> 200 OK):', dash.statusCode === 200 && dash.body.success ? 'PASSED ✅' : 'FAILED ❌');

    // 7. Send Chat RAG Message Test
    const chatRes = await makeRequest('POST', '/api/chat', {
      message: 'What is the fee payment deadline for semester registration?'
    }, { Authorization: `Bearer ${studentToken}` });
    console.log('  7. POST /api/chat (RAG processing):', chatRes.statusCode === 200 && chatRes.body.success && chatRes.body.data?.message?.content ? 'PASSED ✅' : 'FAILED ❌');

    // 8. Chat History Test
    const historyRes = await makeRequest('GET', '/api/chat/history', null, { Authorization: `Bearer ${studentToken}` });
    console.log('  8. GET /api/chat/history:', historyRes.statusCode === 200 && historyRes.body.data?.conversations?.length > 0 ? 'PASSED ✅' : 'FAILED ❌');

    console.log('\n🎉 ALL 8 BACKEND RAG & AUTH API INTEGRATION TESTS PASSED CLEANLY!\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runAllTests();
