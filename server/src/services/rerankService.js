/**
 * Reciprocal Rank Fusion (RRF) & Cross-Encoder style Hybrid Re-Ranker
 * Combines dense vector similarity with sparse BM25 keyword matching
 */

const STOP_WORDS = new Set(['a','an','the','is','are','was','were','be','been','being','in','on','at','to','for','from','of','with','by','about','against','between','into','through','during','before','after','above','below','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now']);

/**
 * Re-ranks candidate chunks using Reciprocal Rank Fusion (RRF)
 * @param {string} query - Student question
 * @param {Array<Object>} chunks - Candidate vector chunks
 * @returns {Array<Object>} Re-ranked chunks with updated similarity scores
 */
const rerankChunks = (query, chunks = []) => {
  if (!chunks || chunks.length <= 1) return chunks;

  const queryTerms = query.toLowerCase().split(/\W+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
  if (queryTerms.length === 0) return chunks;

  // 1. Vector Similarity Ranking (already sorted)
  const vectorRankMap = new Map();
  chunks.forEach((chunk, index) => {
    vectorRankMap.set(chunk.id || index, index + 1);
  });

  // 2. BM25 / Term Frequency Keyword Ranking
  const scoredChunks = chunks.map(chunk => {
    const textLower = chunk.content.toLowerCase();
    let keywordScore = 0;

    for (const term of queryTerms) {
      const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g');
      const matches = textLower.match(regex);
      if (matches) {
        keywordScore += matches.length * 2.0;
      } else if (textLower.includes(term)) {
        keywordScore += 0.8;
      }
    }

    // Title match boost
    if (chunk.documentTitle) {
      const titleLower = chunk.documentTitle.toLowerCase();
      for (const term of queryTerms) {
        if (titleLower.includes(term)) {
          keywordScore += 1.5;
        }
      }
    }

    return { chunk, keywordScore };
  });

  // Sort by BM25 keyword score descending
  scoredChunks.sort((a, b) => b.keywordScore - a.keywordScore);

  const keywordRankMap = new Map();
  scoredChunks.forEach((item, index) => {
    keywordRankMap.set(item.chunk.id || index, index + 1);
  });

  // 3. Reciprocal Rank Fusion (RRF) + Keyword Score Boost
  const k = 60; // Standard RRF constant
  const fused = chunks.map((chunk, origIdx) => {
    const id = chunk.id || origIdx;
    const vRank = vectorRankMap.get(id) || (chunks.length + 1);
    const kRank = keywordRankMap.get(id) || (chunks.length + 1);
    const kwItem = scoredChunks.find(item => (item.chunk.id || item.chunk.chunkIndex) === id);
    const kwScore = kwItem ? kwItem.keywordScore : 0;

    // RRF score boosted by term overlap score
    const rrfScore = (1 / (k + vRank)) + (1 / (k + kRank)) + (kwScore * 0.005);
    
    // Normalize similarity between 0 and 1
    const normalizedSim = Math.min(Math.round((chunk.similarity * 0.6 + Math.min(kwScore, 5) * 0.08 + (rrfScore * 10) * 0.2) * 100) / 100, 1.0);

    return {
      ...chunk,
      similarity: Math.max(normalizedSim, chunk.similarity),
      rrfScore
    };
  });

  // Sort descending by RRF score
  fused.sort((a, b) => b.rrfScore - a.rrfScore);

  return fused;
};

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  rerankChunks
};
