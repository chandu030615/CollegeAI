const env = require('../config/env');
const https = require('https');

const SYSTEM_PROMPT = `You are CollegeAI, an official AI College Knowledge Assistant.
Your job is to assist students with accurate, reliable answers based STRICTLY on official college documents provided in the context below.

RULES:
1. Answer using the supplied context snippets from official documents.
2. Answer the user's question directly and concisely using only the supplied context.
3. NEVER omit specific dates, deadlines, fees, requirements, course names, or administrative conditions when they are present in the context.
4. Preserve important facts exactly as they appear in the official documents whenever possible.
5. DO NOT invent or fabricate college-specific policies, dates, phone numbers, or rules that are not present in the context.
6. IF THE CONTEXT DOES NOT CONTAIN THE ANSWER to the user's question, state clearly:
   "I could not find sufficient information regarding your query in the available official college knowledge base. Please contact your department or college administration for further details."
7. Always cite document titles and page numbers when available.`;

const generateAnswer = async (question, contextChunks = [], onToken = null) => {
  const hasContext =
    Array.isArray(contextChunks) && contextChunks.length > 0;

  let contextText = '';

  if (hasContext) {
    contextText = contextChunks
      .map((chunk, idx) => {
        const pageInfo = chunk.pageNumber
          ? ` (Page ${chunk.pageNumber})`
          : '';

        return `--- CONTEXT CHUNK ${idx + 1} [Source: "${chunk.documentTitle}"${pageInfo}] ---
${chunk.content}`;
      })
      .join('\n\n');
  }

  // =========================================================
  // Deterministic handling for date/deadline questions
  // =========================================================

  if (
    hasContext &&
    /\b(when|deadline|date|due|last date)\b/i.test(question)
  ) {
    const bestChunk = selectBestChunk(question, contextChunks);

    if (bestChunk) {
      const answerText = selectAnswerSentences(
        question,
        bestChunk.content
      );

      if (answerText) {
        const pageLabel = bestChunk.pageNumber
          ? `, p. ${bestChunk.pageNumber}`
          : '';

        const synthesized =
          `${answerText} [Source: ${bestChunk.documentTitle}${pageLabel}]`;

        await streamText(synthesized, onToken, 25);

        return synthesized;
      }
    }
  }

  // =========================================================
  // OpenAI LLM
  // =========================================================

  const apiKey = env.llmApiKey;

  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const promptMessages = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Retrieved College Context:
${contextText || 'NO RELEVANT CONTEXT FOUND IN KNOWLEDGE BASE.'}

Student Question: ${question}`
        }
      ];

      const aiResponse = await fetchOpenAIChat(
        promptMessages,
        apiKey,
        onToken
      );

      if (aiResponse) {
        return aiResponse;
      }
    } catch (err) {
      console.warn(
        '[LLMService] OpenAI LLM API call error, using grounded context generator:',
        err.message
      );
    }
  }

  // =========================================================
  // No-context safety fallback
  // =========================================================

  if (!hasContext) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base. Please check back after administrators upload relevant documents or contact your department administration directly.';

    await streamText(fallbackMsg, onToken, 20);

    return fallbackMsg;
  }

  // =========================================================
  // Grounded fallback
  // =========================================================

  const bestChunk = selectBestChunk(
    question,
    contextChunks
  );

  if (!bestChunk) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base.';

    await streamText(fallbackMsg, onToken, 20);

    return fallbackMsg;
  }

  const answerText = selectAnswerSentences(
    question,
    bestChunk.content
  );

  if (!answerText) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base.';

    await streamText(fallbackMsg, onToken, 20);

    return fallbackMsg;
  }

  const pageLabel = bestChunk.pageNumber
    ? `, p. ${bestChunk.pageNumber}`
    : '';

  const synthesized =
    `${answerText} [Source: ${bestChunk.documentTitle}${pageLabel}]`;

  await streamText(synthesized, onToken, 25);

  return synthesized;
};


// =========================================================
// Lightweight streaming fallback
// =========================================================

async function streamText(text, onToken, delay = 25) {
  if (!onToken) {
    return;
  }

  const chunks = text.split(/(?<=\s)/);

  for (const chunk of chunks) {
    onToken(chunk);

    if (delay > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, delay)
      );
    }
  }
}


// =========================================================
// Select the most relevant RAG chunk
// =========================================================

function selectBestChunk(question, chunks) {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  const terms =
    question.toLowerCase().match(/[a-z0-9]+/g) || [];

  const stopWords = new Set([
    'what',
    'when',
    'where',
    'which',
    'does',
    'with',
    'from',
    'that',
    'this',
    'about',
    'have',
    'will',
    'your',
    'college',
    'the',
    'is',
    'are',
    'was',
    'were',
    'for',
    'and',
    'how',
    'why',
    'can'
  ]);

  const meaningfulTerms = terms.filter(
    term =>
      term.length > 2 &&
      !stopWords.has(term)
  );

  const isDateQuestion =
    /\b(when|deadline|date|due|last date)\b/i.test(
      question
    );

  // Supports:
  // September 15
  // September 15th
  // September 15, 2026
  // 15 September 2026
  // 15th September
  const datePattern =
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*,?\s*\d{4})?\b/i;

  // Supports:
  // 15/09/2026
  // 15-09-2026
  // 15.09.2026
  const numericDatePattern =
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i;

  const scored = chunks.map(
    (chunk, index) => {
      const content = String(
        chunk.content || ''
      );

      const lowerContent =
        content.toLowerCase();

      const keywordScore =
        meaningfulTerms.reduce(
          (total, term) =>
            total +
            (lowerContent.includes(term)
              ? 1
              : 0),
          0
        );

      const hasExactDate =
        datePattern.test(content) ||
        numericDatePattern.test(content);

      const hasDeadlineKeyword =
        /\b(deadline|due|payment|fee|last date|submit|submission)\b/i.test(
          content
        );

      return {
        chunk,
        index,
        keywordScore,
        hasExactDate,
        hasDeadlineKeyword
      };
    }
  );

  // For date/deadline questions, prefer chunks
  // that actually contain a date and deadline-related language.
  if (isDateQuestion) {
    const datedChunks = scored.filter(
      item => item.hasExactDate
    );

    if (datedChunks.length > 0) {
      return datedChunks
        .sort(
          (a, b) =>
            Number(b.hasDeadlineKeyword) -
            Number(a.hasDeadlineKeyword) ||
            b.keywordScore -
            a.keywordScore ||
            a.index - b.index
        )[0].chunk;
    }
  }

  return scored.sort(
    (a, b) =>
      b.keywordScore -
      a.keywordScore ||
      a.index - b.index
  )[0].chunk;
}


// =========================================================
// Select concise answer sentences
// =========================================================

function selectAnswerSentences(
  question,
  content
) {
  if (!content) {
    return '';
  }

  const sentences = content
    .split(/\r?\n/)
    .flatMap(line =>
      line
        .trim()
        .replace(/^[•\-\s*]+\s*/, '')
        .match(
          /[^.!?]+[.!?]+|[^.!?]+$/g
        ) || []
    )
    .map(sentence => sentence.trim())
    .filter(
      sentence =>
        sentence &&
        !/^section\s+\d+\s*:/i.test(
          sentence
        ) &&
        !/^\d+\.\s*$/.test(
          sentence
        )
    );

  if (sentences.length === 0) {
    return '';
  }

  const terms =
    question.toLowerCase().match(/[a-z0-9]+/g) || [];

  const meaningfulTerms =
    terms.filter(term => term.length > 2);

  const ranked = sentences
    .map(
      (sentence, index) => ({
        sentence,
        index,
        score:
          meaningfulTerms.reduce(
            (total, term) =>
              total +
              (sentence
                .toLowerCase()
                .includes(term)
                ? 1
                : 0),
            0
          )
      })
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.index - b.index
    );

  const matching =
    ranked.filter(
      item => item.score > 0
    );

  const asksWhen =
    /\b(when|deadline|date|due|last date)\b/i.test(
      question
    );

  // Date detection
  const datePattern =
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*,?\s*\d{4})?\b/i;

  const numericDatePattern =
    /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i;

  let datedMatch = null;

  // =========================================================
  // Special handling for date/deadline questions
  // =========================================================

  if (asksWhen) {
    const dateCandidates = sentences
      .map(
        (sentence, index) => {
          const hasDate =
            datePattern.test(sentence) ||
            numericDatePattern.test(
              sentence
            );

          const hasDeadlineLanguage =
            /\b(deadline|due|last date)\b/i.test(
              sentence
            );

          const hasPaymentLanguage =
            /\b(fee|payment|tuition)\b/i.test(
              sentence
            );

          const hasRelationshipWord =
            /\b(before|after|on|by|until)\b/i.test(
              sentence
            );

          // Important:
          // Penalty/late-fee sentences may contain
          // the deadline date but are NOT the answer
          // to a deadline question.
          const isPenaltySentence =
            /\b(late|penalty|penalties|fine|additional charge|per week)\b/i.test(
              sentence
            );

          return {
            sentence,
            index,
            hasDate,
            hasDeadlineLanguage,
            hasPaymentLanguage,
            hasRelationshipWord,
            isPenaltySentence
          };
        }
      )
      .filter(
        item =>
          item.hasDate ||
          item.hasDeadlineLanguage ||
          item.hasRelationshipWord
      );

    if (dateCandidates.length > 0) {
      datedMatch =
        dateCandidates.sort(
          (a, b) =>
            // 1. Avoid penalty/late-fee sentences
            Number(a.isPenaltySentence) -
            Number(b.isPenaltySentence) ||

            // 2. Prefer explicit deadline wording
            Number(b.hasDeadlineLanguage) -
            Number(a.hasDeadlineLanguage) ||

            // 3. Prefer sentences containing the date
            Number(b.hasDate) -
            Number(a.hasDate) ||

            // 4. Prefer fee/payment context
            Number(b.hasPaymentLanguage) -
            Number(a.hasPaymentLanguage) ||

            // 5. Prefer explicit date relationships
            Number(b.hasRelationshipWord) -
            Number(a.hasRelationshipWord) ||

            // 6. Preserve original document order
            a.index - b.index
        )[0];
    }
  }

  let selected;

  // =========================================================
  // Date answer
  // =========================================================

  if (datedMatch) {
    const dateIndex =
      datedMatch.index;

    // Example document format:
    //
    // The semester fee payment deadline is:
    // 30 September 2026
    //
    // Combine both lines into one useful answer.
    if (
      dateIndex > 0 &&
      /:\s*$/.test(
        sentences[dateIndex - 1]
      )
    ) {
      selected = [
        {
          sentence:
            `${sentences[dateIndex - 1]} ${datedMatch.sentence}`,
          index: dateIndex - 1
        }
      ];
    } else {
      selected = [
        {
          sentence:
            datedMatch.sentence,
          index: datedMatch.index
        }
      ];
    }
  } else {
    // Normal non-date question
    selected = matching.slice(0, 1);
  }

  // =========================================================
  // Final fallback
  // =========================================================

  if (selected.length === 0) {
    selected = ranked.slice(0, 1);
  }

  return selected
    .sort(
      (a, b) => a.index - b.index
    )
    .map(item => item.sentence)
    .join(' ')
    .slice(0, 500);
}


// =========================================================
// Invoke OpenAI API via HTTPS
// =========================================================

function fetchOpenAIChat(
  messages,
  apiKey
) {
  return new Promise(
    (resolve, reject) => {
      const postData =
        JSON.stringify({
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
          'Content-Type':
            'application/json',
          'Authorization':
            `Bearer ${apiKey}`,
          'Content-Length':
            Buffer.byteLength(
              postData
            )
        }
      };

      const req =
        https.request(
          options,
          res => {
            let body = '';

            res.on(
              'data',
              chunk => {
                body += chunk;
              }
            );

            res.on(
              'end',
              () => {
                if (
                  res.statusCode >= 200 &&
                  res.statusCode < 300
                ) {
                  try {
                    const parsed =
                      JSON.parse(body);

                    if (
                      parsed.choices &&
                      parsed.choices[0] &&
                      parsed.choices[0].message
                    ) {
                      resolve(
                        parsed
                          .choices[0]
                          .message
                          .content
                      );
                    } else {
                      reject(
                        new Error(
                          'Invalid OpenAI response format'
                        )
                      );
                    }
                  } catch (e) {
                    reject(e);
                  }
                } else {
                  reject(
                    new Error(
                      `Status ${res.statusCode}: ${body}`
                    )
                  );
                }
              }
            );
          }
        );

      req.on(
        'error',
        reject
      );

      req.write(postData);
      req.end();
    }
  );
}


// =========================================================
// Export
// =========================================================

module.exports = {
  generateAnswer
};