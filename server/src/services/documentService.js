const { v4: uuidv4 } = require('uuid');
const { supabase, localDb, isSupabaseConfigured } = require('../config/database');
const pdfExtractor = require('../utils/pdfExtractor');
const textChunker = require('../utils/textChunker');
const embeddingService = require('./embeddingService');
const vectorService = require('./vectorService');

const VALID_CATEGORIES = [
  'Admissions', 'Departments', 'Courses', 'Fees', 'Examinations',
  'Academic Calendar', 'Hostel', 'Library', 'Clubs', 'Placements',
  'Scholarships', 'Policies', 'Events', 'General'
];

/**
 * Uploads document, parses text, chunks text, generates embeddings, stores in DB
 */
const createAndProcessDocument = async ({ file, title, category = 'General', uploadedBy }) => {
  if (!file) {
    throw { statusCode: 400, code: 'INVALID_FILE', message: 'File is required.' };
  }

  const docTitle = (title || file.originalname || 'Untitled Document').trim();
  const validCategory = VALID_CATEGORIES.includes(category) ? category : 'General';
  const documentId = uuidv4();

  // Create initial document record with status UPLOADED
  const initialDoc = {
    id: documentId,
    title: docTitle,
    filename: file.originalname,
    category: validCategory,
    uploaded_by: uploadedBy,
    processing_status: 'UPLOADED',
    page_count: 0,
    file_metadata: {
      sizeBytes: file.size,
      mimeType: file.mimetype
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let documentRecord;

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('documents')
      .insert(initialDoc)
      .select()
      .single();

    if (error) {
      throw { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal server error occurred.' };
    }
    documentRecord = data;
  } else {
    localDb.documents.push(initialDoc);
    documentRecord = initialDoc;
  }

  // Asynchronous or inline document processing
  try {
    await updateDocumentStatus(documentId, 'PROCESSING');

    // 1. Text Extraction
    const extractionResult = await pdfExtractor.extractTextFromBuffer(file.buffer, file.originalname);
    const { text, pageCount, pages } = extractionResult;

    if (!text || text.trim().length === 0) {
      throw new Error('Extracted document text is empty.');
    }

    // 2. Text Chunking
    const chunkObjects = textChunker.chunkDocument(pages.length > 0 ? pages : text);

    if (chunkObjects.length === 0) {
      throw new Error('Could not split document into valid chunks.');
    }

    // 3. Generate Embeddings & Prepare Chunk Records
    const chunksToStore = [];
    for (const chunkObj of chunkObjects) {
      const embedding = await embeddingService.generateEmbedding(chunkObj.content);
      chunksToStore.push({
        documentId,
        content: chunkObj.content,
        embedding,
        pageNumber: chunkObj.pageNumber,
        chunkIndex: chunkObj.chunkIndex,
        metadata: chunkObj.metadata
      });
    }

    // 4. Store Chunks into Vector Store
    await vectorService.storeChunks(chunksToStore);

    // 5. Generate Executive Summary
    const summaryService = require('./summaryService');
    const summary = await summaryService.generateDocumentSummary(text, docTitle);

    // 6. Update Status to PROCESSED
    const updated = await updateDocumentStatus(documentId, 'PROCESSED', {
      page_count: pageCount,
      file_metadata: {
        ...documentRecord.file_metadata,
        chunkCount: chunksToStore.length,
        summary,
        processedAt: new Date().toISOString()
      }
    });

    return updated;
  } catch (procError) {
    console.error(`[DocumentService Error for doc ${documentId}]:`, procError);
    await updateDocumentStatus(documentId, 'FAILED', {
      file_metadata: {
        ...documentRecord.file_metadata,
        errorMessage: procError.message
      }
    });
    throw { statusCode: 500, code: 'DOCUMENT_PROCESSING_FAILED', message: 'Document processing failed. Please try again later.' };
  }
};

/**
 * Updates document status & metadata in database
 */
const updateDocumentStatus = async (documentId, status, extraFields = {}) => {
  const payload = {
    processing_status: status,
    updated_at: new Date().toISOString(),
    ...extraFields
  };

  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', documentId)
      .select()
      .single();
    return data;
  } else {
    const doc = localDb.documents.find(d => d.id === documentId);
    if (doc) {
      Object.assign(doc, payload);
    }
    return doc;
  }
};

/**
 * Gets list of documents
 */
const getAllDocuments = async (categoryFilter = null) => {
  if (isSupabaseConfigured()) {
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }
    const { data, error } = await query;
    if (error) {
      throw { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal server error occurred.' };
    }
    return data || [];
  } else {
    let docs = [...localDb.documents];
    if (categoryFilter) {
      docs = docs.filter(d => d.category === categoryFilter);
    }
    return docs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
};

/**
 * Gets single document with its text chunks
 */
const getDocumentById = async (id) => {
  if (isSupabaseConfigured()) {
    const { data: doc } = await supabase.from('documents').select('*').eq('id', id).single();
    if (!doc) throw { statusCode: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };

    const { data: chunks } = await supabase.from('document_chunks').select('id, document_id, content, page_number, chunk_index, metadata').eq('document_id', id).order('chunk_index');
    return { ...doc, chunks: chunks || [] };
  } else {
    const doc = localDb.documents.find(d => d.id === id);
    if (!doc) throw { statusCode: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };

    const chunks = localDb.document_chunks
      .filter(c => c.document_id === id)
      .map(c => ({ id: c.id, document_id: c.document_id, content: c.content, page_number: c.page_number, chunk_index: c.chunk_index, metadata: c.metadata }))
      .sort((a, b) => a.chunk_index - b.chunk_index);

    return { ...doc, chunks };
  }
};

/**
 * Deletes document and its associated chunks
 */
const deleteDocument = async (id) => {
  await vectorService.deleteChunksByDocumentId(id);

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('documents').delete().eq('id', id).select().single();
    if (error) {
      throw { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected internal server error occurred.' };
    }
    return data;
  } else {
    const index = localDb.documents.findIndex(d => d.id === id);
    if (index === -1) throw { statusCode: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };
    const deleted = localDb.documents.splice(index, 1)[0];
    return deleted;
  }
};

module.exports = {
  createAndProcessDocument,
  getAllDocuments,
  getDocumentById,
  deleteDocument,
  VALID_CATEGORIES
};
