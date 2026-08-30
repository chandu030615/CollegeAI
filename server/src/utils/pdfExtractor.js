const pdfParse = require('pdf-parse');

/**
 * Extracts raw text and page structured content from uploaded document buffer
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - File mime type or extension
 * @returns {Promise<{text: string, pageCount: number, pages: Array<{pageNumber: number, text: string}>}>}
 */
const extractTextFromBuffer = async (buffer, originalName = '') => {
  const extension = originalName.split('.').pop().toLowerCase();
  
  if (extension === 'txt' || extension === 'md' || extension === 'json') {
    const rawText = buffer.toString('utf-8');
    const cleaned = cleanText(rawText);
    return {
      text: cleaned,
      pageCount: 1,
      pages: [{ pageNumber: 1, text: cleaned }]
    };
  }

  try {
    const data = await pdfParse(buffer);
    const rawText = data.text || '';
    const cleanedText = cleanText(rawText);
    const totalPages = data.numpages || 1;

    // Split text into approximate pages if page markers exist
    const pageSplits = rawText.split(/\n\s*\n|\f/);
    const pages = [];

    if (pageSplits.length > 1) {
      let currentPage = 1;
      let currentChunk = '';
      for (const segment of pageSplits) {
        const cleanedSeg = cleanText(segment);
        if (cleanedSeg.length > 0) {
          currentChunk += cleanedSeg + '\n';
          if (currentChunk.length > 500) {
            pages.push({ pageNumber: Math.min(currentPage, totalPages), text: currentChunk.trim() });
            currentPage++;
            currentChunk = '';
          }
        }
      }
      if (currentChunk.trim().length > 0) {
        pages.push({ pageNumber: Math.min(currentPage, totalPages), text: currentChunk.trim() });
      }
    }

    if (pages.length === 0) {
      pages.push({ pageNumber: 1, text: cleanedText });
    }

    return {
      text: cleanedText,
      pageCount: totalPages,
      pages
    };
  } catch (error) {
    console.error('[PDFExtractor Error]:', error);
    // Fallback if pdf-parse fails on non-standard PDF streams
    const fallbackText = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    const cleanedFallback = cleanText(fallbackText);
    return {
      text: cleanedFallback,
      pageCount: 1,
      pages: [{ pageNumber: 1, text: cleanedFallback }]
    };
  }
};

/**
 * Cleans extracted text
 */
const cleanText = (text) => {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
};

module.exports = {
  extractTextFromBuffer,
  cleanText
};
