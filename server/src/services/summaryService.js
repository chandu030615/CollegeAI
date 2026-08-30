const llmService = require('./llmService');

/**
 * Generates an executive AI summary for document text
 * @param {string} text - Full or sample document text
 * @param {string} title - Document title
 * @returns {Promise<string>} Summary text
 */
const generateDocumentSummary = async (text, title = 'Document') => {
  if (!text || text.trim().length === 0) {
    return 'Summary unavailable for empty document.';
  }

  const sample = text.substring(0, 3000); // Take first 3000 chars for summary
  const prompt = `Summarize the following college document titled "${title}" in 3-4 bullet points highlighting key dates, policies, or requirements:\n\n${sample}`;

  try {
    const summary = await llmService.generateAnswer(prompt, []);
    if (summary && !summary.includes('could not find')) {
      return summary;
    }
  } catch (err) {
    console.warn('[SummaryService] Failed to generate summary via LLM:', err.message);
  }

  // Fallback Rule-Based Summary
  const lines = text.split('\n').filter(l => l.trim().length > 20);
  const topLines = lines.slice(0, 3).map(l => `- ${l.trim()}`).join('\n');
  return `**Summary of ${title}**:\n${topLines}`;
};

module.exports = {
  generateDocumentSummary
};
