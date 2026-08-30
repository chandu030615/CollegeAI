const env = require('../config/env');
const https = require('https');

/**
 * Generates vector embedding (1536 dimensions) for input text string
 * @param {string} text - Text to embed
 * @returns {Promise<Array<number>>} Vector array of numbers
 */
const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string') {
    return new Array(1536).fill(0);
  }

  const cleanText = text.replace(/\n/g, ' ').trim();
  const apiKey = env.embeddingApiKey || env.llmApiKey;

  // 1. Try OpenAI Embedding API if key is present
  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const response = await fetchOpenAIEmbedding(cleanText, apiKey);
      if (response && response.data && response.data[0] && response.data[0].embedding) {
        return response.data[0].embedding;
      }
    } catch (err) {
      console.warn('[EmbeddingService] OpenAI API error, using fallback embedding:', err.message);
    }
  }

  // 2. Local Deterministic Hashing Vector Fallback (1536 dimensions)
  return generateDeterministicVector(cleanText, 1536);
};

/**
 * Helper to invoke OpenAI Embedding API
 */
const fetchOpenAIEmbedding = (text, apiKey) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      input: text,
      model: 'text-embedding-3-small'
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: '/v1/embeddings',
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
            resolve(JSON.parse(body));
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
};

const STOP_WORDS = new Set(['a','an','the','is','are','was','were','be','been','being','in','on','at','to','for','from','of','with','by','about','against','between','into','through','during','before','after','above','below','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']);

/**
 * Generates a normalized deterministic vector based on text token frequencies and subword feature projection.
 */
function generateDeterministicVector(text, dimensions = 1536) {
  const vector = new Array(dimensions).fill(0);
  const rawWords = text.toLowerCase().split(/\W+/).filter(Boolean);
  const words = rawWords.filter(w => w.length > 1 && !STOP_WORDS.has(w));

  const tokensToProcess = words.length > 0 ? words : rawWords;
  if (tokensToProcess.length === 0) return vector;

  for (const word of tokensToProcess) {
    // Hash full word
    let hash = 5381;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) + hash) + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vector[idx] += 1.0;

    // Hash word prefix/stem (first 4 chars)
    if (word.length > 3) {
      let stemHash = 5381;
      const stem = word.substring(0, 4);
      for (let j = 0; j < stem.length; j++) {
        stemHash = ((stemHash << 5) + stemHash) + stem.charCodeAt(j);
        stemHash |= 0;
      }
      const stemIdx = Math.abs(stemHash) % dimensions;
      vector[stemIdx] += 0.5;
    }
  }

  // L2 Normalize
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

module.exports = {
  generateEmbedding
};
