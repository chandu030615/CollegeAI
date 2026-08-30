const embeddingService = require('./embeddingService');
const vectorService = require('./vectorService');
const rerankService = require('./rerankService');
const llmService = require('./llmService');
const env = require('../config/env');

/**
 * Orchestrates the Retrieval-Augmented Generation (RAG) pipeline with streaming support & re-ranking
 * @param {string} question - User question
 * @param {Function} [onToken] - Stream callback
 * @param {string} [categoryFilter] - Optional category/department scope
 * @returns {Promise<{answer: string, sources: Array<Object>, relevanceScore: number}>}
 */
const processQuestion = async (question, onToken = null, categoryFilter = null) => {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Question string is required.' };
  }

  const cleanQuestion = question.trim();

  // 1. Generate embedding for user question
  const questionEmbedding = await embeddingService.generateEmbedding(cleanQuestion);

  // 2. Perform vector search in pgvector database with category filter if specified
  const initialChunks = await vectorService.searchSimilarChunks(
    questionEmbedding,
    env.topK * 2, // Fetch candidate pool for re-ranking
    env.relevanceThreshold,
    categoryFilter
  );

  // 3. Apply Hybrid Keyword + RRF Re-ranking stage
  const relevantChunks = rerankService.rerankChunks(cleanQuestion, initialChunks).slice(0, env.topK);

  // 4. Construct source metadata list according to Spec Section 18
  const sources = relevantChunks.map(chunk => ({
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    pageNumber: chunk.pageNumber || 1,
    chunkId: chunk.id,
    relevanceScore: Math.round(chunk.similarity * 100) / 100,
    category: chunk.category || 'General',
    snippet: chunk.content.substring(0, 150) + (chunk.content.length > 150 ? '...' : '')
  }));

  // Calculate highest relevance score
  const maxRelevance = sources.length > 0
    ? Math.max(...sources.map(s => s.relevanceScore))
    : 0;

  // 5. Generate answer grounded in context (with optional streaming callback)
  const answer = await llmService.generateAnswer(cleanQuestion, relevantChunks, onToken);

  return {
    answer,
    sources,
    relevanceScore: maxRelevance
  };
};

module.exports = {
  processQuestion
};
