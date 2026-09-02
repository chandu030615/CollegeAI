const env = require('../config/env');
const https = require('https');

const SYSTEM_PROMPT = `You are CollegeAI, an official AI College Knowledge Assistant.
Your job is to assist students with accurate, reliable answers based STRICTLY on official college documents provided in the context below.

RULES:
1. Answer using the supplied context snippets from official documents.
2. If the context contains relevant information, answer thoroughly, clearly, and structure key facts with bullet points or formatted sections.
3. Preserve important dates, requirements, fees, course names, and administrative conditions.
4. DO NOT invent or fabricate college-specific policies, dates, phone numbers, or rules that are not present in the context.
5. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER to the user's question, state clearly:
   "I could not find sufficient information regarding your query in the available official college knowledge base. Please contact your department or college administration for further details."
6. Always cite document titles and page numbers when available.`;

/**
 * Generates grounded answer using external LLM or intelligent grounded fallback engine
 * @param {string} question - Student question
 * @param {Array<{content: string, documentTitle: string, pageNumber: number, similarity: number}>} contextChunks - Retrieved vector chunks
 * @param {Function} [onToken] - Optional callback for streaming tokens
 * @returns {Promise<string>} Grounded answer text
 */
const generateAnswer = async (question, contextChunks = [], onToken = null) => {
  const hasContext = contextChunks && contextChunks.length > 0;

  // Build context block
  let contextText = '';
  if (hasContext) {
    contextText = contextChunks.map((chunk, idx) => {
      const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : '';
      return `--- CONTEXT CHUNK ${idx + 1} [Source: "${chunk.documentTitle}"${pageInfo}] ---\n${chunk.content}`;
    }).join('\n\n');
  }

  const apiKey = env.llmApiKey;

  // 1. Try OpenAI Chat Completions API if key is present
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const promptMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Retrieved College Context:\n${contextText || 'NO RELEVANT CONTEXT FOUND IN KNOWLEDGE BASE.'}\n\nStudent Question: ${question}` }
      ];
      const aiResponse = await fetchOpenAIChat(promptMessages, apiKey, onToken);
      if (aiResponse) return aiResponse;
    } catch (err) {
      console.warn('[LLMService] OpenAI LLM API call error, using grounded context generator:', err.message);
    }
  }

  // 2. Grounded Fallback Answer Generation Engine
  if (!hasContext) {
    const fallbackMsg = "I could not find sufficient information regarding your query in the available official college knowledge base. Please check back after administrators upload relevant documents or contact your department administration directly.";
    if (onToken) {
      const words = fallbackMsg.split(' ');
      for (const word of words) {
        onToken(word + ' ');
        await new Promise(r => setTimeout(r, 20));
      }
    }
    return fallbackMsg;
  }

  // Keep the non-LLM experience useful: answer with the most relevant, complete
  // sentence(s), rather than dumping leading lines from every retrieved chunk.
  const bestChunk = selectBestChunk(question, contextChunks);
  const answerText = selectAnswerSentences(question, bestChunk.content);
  const pageLabel = bestChunk.pageNumber ? `, p. ${bestChunk.pageNumber}` : '';
  const synthesized = `${answerText} [Source: ${bestChunk.documentTitle}${pageLabel}]`;

  if (onToken) {
    const chunksText = synthesized.split(/(?<=\s)/);
    for (const chunkToken of chunksText) {
      onToken(chunkToken);
      await new Promise(r => setTimeout(r, 25));
    }
  }

  return synthesized;
};

function selectBestChunk(question, chunks) {
  const terms = question.toLowerCase().match(/[a-z0-9]+/g) || [];
  const meaningfulTerms = terms.filter(term => term.length > 2 && !new Set([
    'what', 'when', 'where', 'which', 'does', 'with', 'from', 'that', 'this', 'about', 'have', 'will', 'your', 'college'
  ]).has(term));

  return chunks.reduce((best, chunk) => {
    const score = meaningfulTerms.reduce((total, term) => (
      total + (chunk.content.toLowerCase().includes(term) ? 1 : 0)
    ), 0);
    const bestScore = meaningfulTerms.reduce((total, term) => (
      total + (best.content.toLowerCase().includes(term) ? 1 : 0)
    ), 0);
    return score > bestScore ? chunk : best;
  }, chunks[0]);
}

function selectAnswerSentences(question, content) {
  const sentences = content
    .split(/\r?\n/)
    .flatMap(line => line
      .trim()
      .replace(/^[•\-]\s*/, '')
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map(sentence => sentence.trim())
    .filter(sentence => sentence && !/^section\s+\d+\s*:/i.test(sentence));
  const terms = question.toLowerCase().match(/[a-z0-9]+/g) || [];
  const meaningfulTerms = terms.filter(term => term.length > 2);
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: meaningfulTerms.reduce((total, term) => (
        total + (sentence.toLowerCase().includes(term) ? 1 : 0)
      ), 0)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const matching = ranked.filter(item => item.score > 0);
  const asksWhen = terms.includes('when');
  const datedMatch = asksWhen && matching
    .filter(item =>
      /\b(before|after|on|by)\b/i.test(item.sentence) ||
      /\b\d{1,2}[:/]\d{2}\b/i.test(item.sentence) ||
      /\b\d{1,2}(st|nd|rd|th)\b/i.test(item.sentence) ||
      /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i.test(item.sentence)
    )
    .sort((a, b) => {
      const aHasMonthDate = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i.test(a.sentence);
      const bHasMonthDate = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i.test(b.sentence);

      if (aHasMonthDate !== bHasMonthDate) {
        return aHasMonthDate ? -1 : 1;
      }

      return a.index - b.index;
    })[0];
  const selected = datedMatch ? [datedMatch] : matching.slice(0, 1);

  return (selected.length ? selected : ranked.slice(0, 1))
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence)
    .join(' ')
    .slice(0, 500);
}

/**
 * Invokes OpenAI API via HTTPS
 */
function fetchOpenAIChat(messages, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.2
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
              resolve(parsed.choices[0].message.content);
            } else {
              reject(new Error('Invalid OpenAI response format'));
            }
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  generateAnswer
};
