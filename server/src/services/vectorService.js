const env = require('../config/env');
const { supabase, localDb, isSupabaseConfigured } = require('../config/database');

/**
 * Stores document chunks along with their vector embeddings into database
 * @param {Array<{documentId: string, content: string, embedding: Array<number>, pageNumber: number, chunkIndex: number, metadata: Object}>} chunks
 */
const storeChunks = async (chunks) => {
  if (!chunks || chunks.length === 0) return [];

  if (isSupabaseConfigured()) {
    const formatted = chunks.map(c => ({
      document_id: c.documentId,
      content: c.content,
      embedding: c.embedding,
      page_number: c.pageNumber || 1,
      chunk_index: c.chunkIndex,
      metadata: c.metadata || {}
    }));

    const { data, error } = await supabase
      .from('document_chunks')
      .insert(formatted)
      .select('id, document_id, content, page_number, chunk_index, created_at');

    if (error) {
      console.error('[VectorService] Supabase chunk insertion error:', error);
      throw error;
    }
    return data;
  } else {
    // Local In-Memory Storage
    const saved = [];
    const { v4: uuidv4 } = require('uuid');

    for (const c of chunks) {
      const chunkRecord = {
        id: uuidv4(),
        document_id: c.documentId,
        content: c.content,
        embedding: c.embedding,
        page_number: c.pageNumber || 1,
        chunk_index: c.chunkIndex,
        metadata: c.metadata || {},
        created_at: new Date().toISOString()
      };
      localDb.document_chunks.push(chunkRecord);
      saved.push(chunkRecord);
    }
    return saved;
  }
};

/**
 * Performs vector similarity search against document chunks
 * @param {Array<number>} questionEmbedding - Vector array of question
 * @param {number} topK - Number of chunks to return
 * @param {number} threshold - Min similarity score threshold
 * @returns {Promise<Array<{id: string, documentId: string, content: string, pageNumber: number, chunkIndex: number, similarity: number, metadata: Object, documentTitle: string, category: string}>>}
 */
const searchSimilarChunks = async (questionEmbedding, topK = env.topK, threshold = env.relevanceThreshold, categoryFilter = null) => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: questionEmbedding,
        match_threshold: threshold,
        match_count: topK * 2
      });

      if (!error && data && data.length > 0) {
        // Fetch document titles & categories for sources
        const docIds = [...new Set(data.map(item => item.document_id))];
        const { data: docs } = await supabase
          .from('documents')
          .select('id, title, category')
          .in('id', docIds);

        const docMap = new Map((docs || []).map(d => [d.id, d]));

        const results = data.map(item => {
          const doc = docMap.get(item.document_id) || {};
          return {
            id: item.id,
            documentId: item.document_id,
            content: item.content,
            pageNumber: item.page_number,
            chunkIndex: item.chunk_index,
            similarity: item.similarity,
            metadata: item.metadata || {},
            documentTitle: doc.title || 'College Document',
            category: doc.category || 'General'
          };
        });

        const filteredResults = categoryFilter && categoryFilter !== 'All'
          ? results.filter(r => r.category.toLowerCase() === categoryFilter.toLowerCase())
          : results;

        return filteredResults.slice(0, topK);
      }
    } catch (err) {
      console.warn('[VectorService] Supabase RPC match error, using fallback:', err.message);
    }
  }

  // Fallback Cosine Similarity Search on local storage or fetched chunks
  const allChunks = isSupabaseConfigured()
    ? (await supabase.from('document_chunks').select('*')).data || []
    : localDb.document_chunks;

  const docs = isSupabaseConfigured()
    ? (await supabase.from('documents').select('*')).data || []
    : localDb.documents;

  const docMap = new Map((docs || []).map(d => [d.id, d]));

  const scored = [];
  for (const chunk of allChunks) {
    if (!chunk.embedding || chunk.embedding.length === 0) continue;
    const doc = docMap.get(chunk.document_id) || {};
    
    if (categoryFilter && categoryFilter !== 'All' && doc.category && doc.category.toLowerCase() !== categoryFilter.toLowerCase()) {
      continue;
    }

    const sim = cosineSimilarity(questionEmbedding, chunk.embedding);
    
    if (sim >= threshold) {
      scored.push({
        id: chunk.id,
        documentId: chunk.document_id,
        content: chunk.content,
        pageNumber: chunk.page_number || 1,
        chunkIndex: chunk.chunk_index,
        similarity: sim,
        metadata: chunk.metadata || {},
        documentTitle: doc.title || 'College Document',
        category: doc.category || 'General'
      });
    }
  }

  // Sort descending by similarity score
  scored.sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, topK);
};

/**
 * Delete chunks belonging to document
 */
const deleteChunksByDocumentId = async (documentId) => {
  if (isSupabaseConfigured()) {
    await supabase.from('document_chunks').delete().eq('document_id', documentId);
  } else {
    localDb.document_chunks = localDb.document_chunks.filter(c => c.document_id !== documentId);
  }
};

/**
 * Calculates Cosine Similarity between 2 vector arrays
 */
function cosineSimilarity(v1, v2) {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  storeChunks,
  searchSimilarChunks,
  deleteChunksByDocumentId,
  cosineSimilarity
};
