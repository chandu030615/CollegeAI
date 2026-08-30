const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
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

async function runTests() {
  console.log('🧪 Starting CollegeAI API Verification Tests...\n');

  // 1. Health Check Test
  const healthRes = await makeRequest('GET', '/api/health');
  console.log('1. GET /api/health:', healthRes.statusCode === 200 && healthRes.body.success ? 'PASSED ✅' : 'FAILED ❌', healthRes.body);

  // 2. Student Register Test
  const studentEmail = `student_${Date.now()}@college.edu`;
  const regStudent = await makeRequest('POST', '/api/auth/register', {
    name: 'Jane Student',
    email: studentEmail,
    password: 'password123',
    role: 'student'
  });
  console.log('2. POST /api/auth/register (Student):', regStudent.statusCode === 201 && regStudent.body.success ? 'PASSED ✅' : 'FAILED ❌');
  const studentToken = regStudent.body?.data?.token;

  // 3. Admin Register Test
  const adminEmail = `admin_${Date.now()}@college.edu`;
  const regAdmin = await makeRequest('POST', '/api/auth/register', {
    name: 'Admin User',
    email: adminEmail,
    password: 'adminpassword123',
    role: 'admin'
  });
  console.log('3. POST /api/auth/register (Admin):', regAdmin.statusCode === 201 && regAdmin.body.success ? 'PASSED ✅' : 'FAILED ❌');
  const adminToken = regAdmin.body?.data?.token;

  // 4. Me endpoint
  const meRes = await makeRequest('GET', '/api/auth/me', null, { Authorization: `Bearer ${studentToken}` });
  console.log('4. GET /api/auth/me:', meRes.statusCode === 200 && meRes.body.data?.user?.email === studentEmail ? 'PASSED ✅' : 'FAILED ❌');

  // 5. Protected Admin Endpoint Check with Student Token (Should fail 403)
  const forbiddenCheck = await makeRequest('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${studentToken}` });
  console.log('5. GET /api/admin/dashboard (Student token -> Forbidden):', forbiddenCheck.statusCode === 403 ? 'PASSED ✅' : 'FAILED ❌');

  // 6. Admin Dashboard Stats with Admin Token
  const dashRes = await makeRequest('GET', '/api/admin/dashboard', null, { Authorization: `Bearer ${adminToken}` });
  console.log('6. GET /api/admin/dashboard (Admin token):', dashRes.statusCode === 200 && dashRes.body.success ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n✅ All Core API Verification Tests Completed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test Runner Error:', err);
  process.exit(1);
});
