const env = require('../config/env');

/**
 * Splits extracted document text into overlapping chunks with metadata
 * @param {Array<{pageNumber: number, text: string}>|string} input - Document pages or text string
 * @param {Object} options - { chunkSize, chunkOverlap }
 * @returns {Array<{content: string, pageNumber: number, chunkIndex: number, metadata: Object}>}
 */
const chunkDocument = (input, options = {}) => {
  const chunkSize = options.chunkSize || env.chunkSize || 800;
  const chunkOverlap = options.chunkOverlap || env.chunkOverlap || 150;

  const chunks = [];
  let globalChunkIndex = 0;

  // Process pages if array is provided
  if (Array.isArray(input)) {
    for (const pageObj of input) {
      const pageText = pageObj.text || '';
      const pageNumber = pageObj.pageNumber || 1;

      if (!pageText.trim()) continue;

      const pageChunks = splitTextIntoChunks(pageText, chunkSize, chunkOverlap);
      for (const cText of pageChunks) {
        if (cText.trim()) {
          chunks.push({
            content: cText.trim(),
            pageNumber,
            chunkIndex: globalChunkIndex++,
            metadata: {
              charLength: cText.trim().length,
              wordCount: cText.trim().split(/\s+/).length
            }
          });
        }
      }
    }
  } else if (typeof input === 'string') {
    const textChunks = splitTextIntoChunks(input, chunkSize, chunkOverlap);
    for (const cText of textChunks) {
      if (cText.trim()) {
        chunks.push({
          content: cText.trim(),
          pageNumber: 1,
          chunkIndex: globalChunkIndex++,
          metadata: {
            charLength: cText.trim().length,
            wordCount: cText.trim().split(/\s+/).length
          }
        });
      }
    }
  }

  return chunks;
};

/**
 * Internal recursive/sliding window text splitter
 */
function splitTextIntoChunks(text, chunkSize, chunkOverlap) {
  if (text.length <= chunkSize) {
    return [text];
  }

  const result = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < text.length) {
      // Find suitable sentence or word break near endIndex
      const lastPeriod = text.lastIndexOf('.', endIndex);
      const lastNewline = text.lastIndexOf('\n', endIndex);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > startIndex + chunkSize * 0.5) {
        endIndex = breakPoint + 1;
      } else {
        const lastSpace = text.lastIndexOf(' ', endIndex);
        if (lastSpace > startIndex) {
          endIndex = lastSpace;
        }
      }
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      result.push(chunk);
    }

    startIndex = endIndex - chunkOverlap;
    if (startIndex >= text.length || endIndex >= text.length) {
      break;
    }
  }

  return result;
}

module.exports = {
  chunkDocument
};
