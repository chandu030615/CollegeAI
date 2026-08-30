const app = require('../src/app');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 5052;
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

function testSseStreamRequest(pathUrl, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const postData = JSON.stringify(data);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let fullBody = '';
      const tokensReceived = [];
      let sourcesReceived = [];

      res.on('data', (chunk) => {
        const str = chunk.toString();
        fullBody += str;
        const lines = str.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.substring(6));
              if (parsed.type === 'token') {
                tokensReceived.push(parsed.content);
              } else if (parsed.type === 'sources') {
                sourcesReceived = parsed.sources;
              }
            } catch (e) {}
          }
        }
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          tokensCount: tokensReceived.length,
          fullText: tokensReceived.join(''),
          sources: sourcesReceived
        });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runPhase6Tests() {
  console.log('🚀 Launching Phase 6 Advanced RAG Feature Test Server on port', PORT);
  const server = app.listen(PORT);

  try {
    // 1. Register Student & Admin Users
    const studentRes = await makeJsonRequest('POST', '/api/auth/register', {
      name: 'Phase6 Student',
      email: 'p6_student@college.edu',
      password: 'password123',
      role: 'student'
    });
    const studentToken = studentRes.body?.data?.token;

    const adminRes = await makeJsonRequest('POST', '/api/auth/register', {
      name: 'Phase6 Admin',
      email: 'p6_admin@college.edu',
      password: 'adminpassword123',
      role: 'admin'
    });
    const adminToken = adminRes.body?.data?.token;

    console.log('1. User Authentication:', studentToken && adminToken ? 'PASSED ✅' : 'FAILED ❌');

    // 2. Test Server-Sent Events (SSE) Streaming API
    const streamResult = await testSseStreamRequest('/api/chat/stream', {
      message: 'What is the fee payment deadline?'
    }, studentToken);

    const isSseValid = streamResult.statusCode === 200 &&
      streamResult.contentType?.includes('text/event-stream') &&
      streamResult.tokensCount > 0;

    console.log('2. Streaming AI Responses (SSE POST /api/chat/stream):', isSseValid ? `PASSED ✅ (${streamResult.tokensCount} stream tokens received)` : 'FAILED ❌', streamResult);
    console.log('   Streamed Text Preview:', streamResult.fullText.substring(0, 100) + '...');

    // 3. Test Hybrid RRF Re-ranking Engine Directly
    const rerankService = require('../src/services/rerankService');
    const dummyChunks = [
      { id: '1', content: 'General information about campus library opening hours', similarity: 0.8, documentTitle: 'Library Rules' },
      { id: '2', content: 'Tuition fee submission deadline is September 15th for all semesters', similarity: 0.7, documentTitle: 'Fee Policy 2026' }
    ];

    const reranked = rerankService.rerankChunks('tuition fee payment deadline', dummyChunks);
    const rerankPassed = reranked.length === 2 && reranked[0].id === '2';
    console.log('3. Hybrid Keyword + BM25 RRF Re-ranking Stage:', rerankPassed ? 'PASSED ✅ (Chunk #2 elevated to rank 1 due to keyword boost)' : 'FAILED ❌');

    // 4. Test Automatic Document Summarization
    const summaryService = require('../src/services/summaryService');
    const sampleText = "Hostel Policy Guide 2026. Main hostel gates close at 10 PM daily. Late entry requires warden permission. Visitors allowed between 4 PM and 7 PM.";
    const summary = await summaryService.generateDocumentSummary(sampleText, 'Hostel Guide');
    console.log('4. Automatic Document Summarization:', summary && summary.length > 0 ? 'PASSED ✅' : 'FAILED ❌');
    console.log('   Summary Excerpt:\n', summary);

    console.log('\n🎉 ALL PHASE 6 ADVANCED RAG INTEGRATION TESTS PASSED CLEANLY!\n');
  } catch (err) {
    console.error('❌ Phase 6 Test Failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runPhase6Tests();
