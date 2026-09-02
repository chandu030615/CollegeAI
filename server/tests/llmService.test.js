const test = require('node:test');
const assert = require('node:assert/strict');
const { generateAnswer } = require('../src/services/llmService');

test('fallback gives a concise answer with a document and page citation', async () => {
  const answer = await generateAnswer('When is the tuition fee payment deadline?', [
    {
      content: 'All undergraduate semester tuition fees must be submitted before September 15th every academic year. Late fee payments incur a penalty of $50 per week.',
      documentTitle: 'Official Academic Handbook 2026',
      pageNumber: 4,
      similarity: 0.91
    }
  ]);

  assert.match(answer, /September 15th/);
  assert.match(answer, /\[Source: Official Academic Handbook 2026, p\. 4\]/);
  assert.ok(answer.length < 300, 'fallback answer should stay concise');
});

test('fallback cites the chunk most relevant to the question', async () => {
  const answer = await generateAnswer('What time do hostel gates close?', [
    {
      content: 'Semester tuition fees are due before September 15th.',
      documentTitle: 'Academic Handbook',
      pageNumber: 2,
      similarity: 0.95
    },
    {
      content: 'Main hostel gates close at 10:00 PM on weekdays.',
      documentTitle: 'Hostel Rules',
      pageNumber: 7,
      similarity: 0.78
    }
  ]);

  assert.match(answer, /10:00 PM/);
  assert.match(answer, /\[Source: Hostel Rules, p\. 7\]/);
});
