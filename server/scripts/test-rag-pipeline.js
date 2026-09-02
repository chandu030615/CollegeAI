const app = require('../src/app');
const authService = require('../src/services/authService');
const { localDb, isSupabaseConfigured } = require('../src/config/database');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 5051;
const BASE_URL = `http://localhost:${PORT}`;

function makeJsonRequest(method, pathUrl, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
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

function uploadFileRequest(pathUrl, filePath, title, category, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const boundary = '--------------------------' + Date.now().toString(16);
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    let body = '';
    // Field 1: title
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="title"\r\n\r\n${title}\r\n`;

    // Field 2: category
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="category"\r\n\r\n${category}\r\n`;

    // Field 3: file
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`;
    body += `Content-Type: text/plain\r\n\r\n`;

    const footer = `\r\n--${boundary}--\r\n`;
    const payload = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      fileBuffer,
      Buffer.from(footer, 'utf-8')
    ]);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, rawBody: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testRAGPipeline() {
  if (isSupabaseConfigured()) {
    throw new Error('This integration test uses the in-memory store and must not run against Supabase.');
  }

  console.log('🚀 Starting Deep RAG Pipeline Audit & Integration Test on port', PORT);
  const server = app.listen(PORT);

  // Sample College Document Text
  const sampleDocPath = path.join(__dirname, 'sample-handbook.txt');
  const sampleText = `
COLLEGE ACADEMIC HANDBOOK & POLICY GUIDE 2026

Section 1: Tuition & Fees
- All undergraduate semester tuition fees must be submitted before September 15th every academic year.
- Late fee payments incur a penalty of $50 per week after the September 15th deadline.
- Refund requests for course drops must be filed within the first 14 calendar days of the semester.

Section 2: Hostel & Campus Housing
- Main hostel gates close strictly at 10:00 PM on weekdays and 11:00 PM on weekends.
- Visitors are permitted in hostel common room areas only between 4:00 PM and 7:00 PM daily.

Section 3: Scholarships & Financial Aid
- Merit scholarships provide a 50% tuition waiver for students maintaining a Cumulative GPA of 3.8 or higher.
- Applications for financial assistance must be submitted to the Student Aid Office by August 1st.
  `;

  fs.writeFileSync(sampleDocPath, sampleText.trim());

  try {
    // 1. Seed a trusted administrator. Public registration intentionally only
    // creates students, so tests must not rely on a client-provided admin role.
    const admin = {
      id: `admin-rag-${Date.now()}`,
      name: 'Dr. Smith Admin',
      email: 'admin_rag@college.edu',
      role: 'admin',
      created_at: new Date().toISOString()
    };
    localDb.users.push(admin);
    const adminToken = authService.generateToken(admin);
    console.log('1. Trusted Admin Fixture:', adminToken ? 'PASSED ✅' : 'FAILED ❌');

    // 2. Register Student User
    const studentReg = await makeJsonRequest('POST', '/api/auth/register', {
      name: 'Mark Student',
      email: 'student_rag@college.edu',
      password: 'studentpassword123',
      role: 'student'
    });
    const studentToken = studentReg.body?.data?.token;
    console.log('2. Student Registration:', studentToken ? 'PASSED ✅' : 'FAILED ❌');

    // 3. Admin Uploads Document
    const uploadRes = await uploadFileRequest('/api/documents', sampleDocPath, 'Official Academic Handbook 2026', 'Fees', adminToken);
    const uploadPassed = uploadRes.statusCode === 201 && uploadRes.body.data?.document?.processing_status === 'PROCESSED';
    console.log('3. Admin Document Upload & Chunking:', uploadPassed ? 'PASSED ✅' : 'FAILED ❌');
    if (!uploadPassed) throw new Error('Document upload or processing failed.');

    const docId = uploadRes.body?.data?.document?.id;

    // 4. Verify Document Inspection
    const inspectRes = await makeJsonRequest('GET', `/api/documents/${docId}`, null, { Authorization: `Bearer ${adminToken}` });
    const chunks = inspectRes.body?.data?.document?.chunks || [];
    const inspectionPassed = inspectRes.statusCode === 200 && chunks.length > 0;
    console.log('4. Document Chunk Inspection:', inspectionPassed ? `PASSED ✅ (${chunks.length} chunks indexed)` : 'FAILED ❌');
    if (!inspectionPassed) throw new Error('Indexed document chunks were not available.');

    // 5. Ask Grounded Question
    const q1Res = await makeJsonRequest('POST', '/api/chat', {
      message: 'When is the tuition fee payment deadline?'
    }, { Authorization: `Bearer ${studentToken}` });

    const a1 = q1Res.body?.data?.message?.content || '';
    const sources1 = q1Res.body?.data?.message?.sources || [];
    const groundedAnswerPassed = q1Res.statusCode === 200
      && a1.includes('September 15')
      && a1.includes('[Source: Official Academic Handbook 2026, p. 1]')
      && a1.length < 300
      && !a1.startsWith('Late fee payments')
      && sources1.length > 0;
    console.log('5. Grounded RAG Question Answered:', groundedAnswerPassed ? 'PASSED ✅' : 'FAILED ❌');
    console.log('   Answer Snippet:', a1.substring(0, 120) + '...');
    console.log('   Source Citation:', sources1[0]?.documentTitle, `(Relevance: ${sources1[0]?.relevanceScore})`);
    if (!groundedAnswerPassed) throw new Error('Grounded answer did not include the expected answer and citation.');

    // 6. Ask Unknown Question
    const q2Res = await makeJsonRequest('POST', '/api/chat', {
      message: 'What is the parking cost for space shuttles on campus?'
    }, { Authorization: `Bearer ${studentToken}` });

    const a2 = q2Res.body?.data?.message?.content || '';
    const unknownQuestionPassed = q2Res.statusCode === 200 && (a2.includes('could not find') || a2.includes('unavailable'));
    console.log('6. Unknown Question Safety Handling:', unknownQuestionPassed ? 'PASSED ✅' : 'FAILED ❌');
    console.log('   Safety Response:', a2.substring(0, 120) + '...');
    if (!unknownQuestionPassed) throw new Error('Unknown-question safety response failed.');

    // 7. Delete Document Cleanup
    const deleteRes = await makeJsonRequest('DELETE', `/api/documents/${docId}`, null, { Authorization: `Bearer ${adminToken}` });
    const cleanupPassed = deleteRes.statusCode === 200;
    console.log('7. Admin Delete Document & Vector Chunks Cleanup:', cleanupPassed ? 'PASSED ✅' : 'FAILED ❌');
    if (!cleanupPassed) throw new Error('Document cleanup failed.');

    console.log('\n🎉 RAG PIPELINE & DOCUMENT CHUNKING DEEP AUDIT SUCCESSFUL!\n');
  } catch (err) {
    console.error('❌ RAG Pipeline Test Error:', err);
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(sampleDocPath)) fs.unlinkSync(sampleDocPath);
    server.close();
  }
}

testRAGPipeline();
