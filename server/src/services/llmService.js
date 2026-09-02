const env = require('../config/env');
const https = require('https');

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are CollegeAI, an official AI College Knowledge Assistant.

Your job is to assist students with accurate, reliable answers based STRICTLY on official college documents provided in the context below.

RULES:
1. Answer using only the supplied context from official college documents.
2. Answer the user's question directly and concisely.
3. NEVER omit specific dates, deadlines, fees, requirements, course names, or administrative conditions when they are present in the context.
4. Preserve important facts exactly as they appear in the official documents whenever possible.
5. DO NOT invent or fabricate college-specific policies, dates, phone numbers, fees, or rules.
6. If the context does not contain sufficient information to answer the question, clearly state that the information is unavailable in the available official college knowledge base.
7. Always cite the document title and page number when available.
8. For deadline/date questions, explicitly include the exact date found in the context.
9. Do not replace an exact date with vague wording such as "before the deadline".
10. Do not answer a deadline question using only late-payment, penalty, or fine information.`;

// ============================================================
// DATE / DEADLINE CONSTANTS
// ============================================================

const DATE_PATTERNS = [
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b/i,

  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b/i,

  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/
];

const DEADLINE_WORDS = [
  'deadline',
  'due date',
  'due',
  'last date',
  'payment date',
  'submission date',
  'closing date',
  'payment deadline',
  'fee deadline',
  'pay by',
  'submit by',
  'must be paid',
  'must submit'
];

const PAYMENT_WORDS = [
  'fee',
  'fees',
  'payment',
  'tuition',
  'semester fee',
  'semester fees',
  'tuition fee',
  'tuition fees'
];

const PENALTY_WORDS = [
  'late fee',
  'late payment',
  'late payments',
  'penalty',
  'penalties',
  'fine',
  'fines',
  'additional charge',
  'additional charges',
  'per week',
  'per day',
  'after the deadline'
];

// ============================================================
// TEXT HELPERS
// ============================================================

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function containsAny(text, words) {
  const normalized = String(text || '').toLowerCase();

  return words.some(word =>
    normalized.includes(word.toLowerCase())
  );
}

function findDate(text) {
  const normalized = normalizeText(text);

  for (const pattern of DATE_PATTERNS) {
    const match = normalized.match(pattern);

    if (match) {
      return {
        value: match[0],
        index: match.index
      };
    }
  }

  return null;
}

function isDateQuestion(question) {
  return /\b(when|deadline|date|due|last date|by when|payment date)\b/i.test(
    String(question || '')
  );
}

function isPaymentQuestion(question) {
  return /\b(fee|fees|payment|tuition|semester fee|tuition fee)\b/i.test(
    String(question || '')
  );
}

// ============================================================
// CLEAN DEADLINE ANSWER
// ============================================================

function cleanDeadlineSentence(sentence) {
  let result = normalizeText(sentence);

  if (!result) {
    return '';
  }

  /*
   * Example:
   *
   * "The fee payment deadline is September 15, 2026.
   *  Late payment will incur a penalty."
   *
   * becomes:
   *
   * "The fee payment deadline is September 15, 2026."
   */

  const date = findDate(result);

  if (date) {
    const afterDate = result.slice(
      date.index + date.value.length
    );

    if (containsAny(afterDate, PENALTY_WORDS)) {
      result = result.slice(
        0,
        date.index + date.value.length
      );
    }
  }

  result = result
    .replace(/[,:;\s]+$/, '')
    .trim();

  if (result && !/[.!?]$/.test(result)) {
    result += '.';
  }

  return result;
}

// ============================================================
// GENERATE ANSWER
// ============================================================

const generateAnswer = async (
  question,
  contextChunks = [],
  onToken = null
) => {
  const hasContext =
    Array.isArray(contextChunks) &&
    contextChunks.length > 0;

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

  // ==========================================================
  // DETERMINISTIC DATE / DEADLINE HANDLING
  // ==========================================================

  /*
   * Date/deadline questions are handled deterministically
   * before OpenAI.
   *
   * This guarantees that exact dates present in official
   * documents are not replaced by vague wording.
   */

  if (
    hasContext &&
    isDateQuestion(question)
  ) {
    const bestChunk = selectBestChunk(
      question,
      contextChunks
    );

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

        await streamText(
          synthesized,
          onToken,
          25
        );

        return synthesized;
      }
    }
  }

  // ==========================================================
  // OPENAI LLM
  // ==========================================================

  const apiKey = env.llmApiKey;

  if (
    apiKey &&
    apiKey.startsWith('sk-')
  ) {
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

Student Question:
${question}`
        }
      ];

      const aiResponse = await fetchOpenAIChat(
        promptMessages,
        apiKey
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

  // ==========================================================
  // NO CONTEXT SAFETY FALLBACK
  // ==========================================================

  if (!hasContext) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base. Please check back after administrators upload relevant documents or contact your department administration directly.';

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // GROUNDED FALLBACK
  // ==========================================================

  const bestChunk = selectBestChunk(
    question,
    contextChunks
  );

  if (!bestChunk) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base.';

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  const answerText = selectAnswerSentences(
    question,
    bestChunk.content
  );

  if (!answerText) {
    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base.';

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  const pageLabel = bestChunk.pageNumber
    ? `, p. ${bestChunk.pageNumber}`
    : '';

  const synthesized =
    `${answerText} [Source: ${bestChunk.documentTitle}${pageLabel}]`;

  await streamText(
    synthesized,
    onToken,
    25
  );

  return synthesized;
};

// ============================================================
// LIGHTWEIGHT STREAMING FALLBACK
// ============================================================

async function streamText(
  text,
  onToken,
  delay = 25
) {
  if (!onToken) {
    return;
  }

  const chunks =
    String(text).split(/(?<=\s)/);

  for (const chunk of chunks) {
    onToken(chunk);

    if (delay > 0) {
      await new Promise(resolve =>
        setTimeout(resolve, delay)
      );
    }
  }
}

// ============================================================
// SELECT MOST RELEVANT RAG CHUNK
// ============================================================

function selectBestChunk(
  question,
  chunks
) {
  if (
    !Array.isArray(chunks) ||
    chunks.length === 0
  ) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(question).toLowerCase();

  const terms =
    normalizedQuestion.match(/[a-z0-9]+/g) || [];

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
    'can',
    'tell',
    'me'
  ]);

  const meaningfulTerms =
    terms.filter(
      term =>
        term.length > 2 &&
        !stopWords.has(term)
    );

  const dateQuestion =
    isDateQuestion(question);

  const paymentQuestion =
    isPaymentQuestion(question);

  const scored = chunks.map(
    (chunk, index) => {
      const content = normalizeText(
        chunk.content || ''
      );

      const lowerContent =
        content.toLowerCase();

      const keywordScore =
        meaningfulTerms.reduce(
          (total, term) =>
            total +
            (
              lowerContent.includes(term)
                ? 1
                : 0
            ),
          0
        );

      const hasExactDate =
        Boolean(findDate(content));

      const hasDeadlineKeyword =
        containsAny(
          lowerContent,
          DEADLINE_WORDS
        );

      const hasPaymentKeyword =
        containsAny(
          lowerContent,
          PAYMENT_WORDS
        );

      const hasPenaltyContent =
        containsAny(
          lowerContent,
          PENALTY_WORDS
        );

      let score =
        Number(
          chunk.similarity ||
          chunk.relevance ||
          0
        );

      score += keywordScore * 5;

      if (
        dateQuestion &&
        hasExactDate
      ) {
        score += 100;
      }

      if (
        dateQuestion &&
        hasDeadlineKeyword
      ) {
        score += 50;
      }

      if (
        paymentQuestion &&
        hasPaymentKeyword
      ) {
        score += 30;
      }

      /*
       * Penalize chunks that only discuss late fees,
       * penalties, or fines.
       *
       * A chunk containing the actual date is still allowed
       * because the exact date has much higher priority.
       */
      if (
        dateQuestion &&
        hasPenaltyContent &&
        !hasExactDate
      ) {
        score -= 40;
      }

      return {
        chunk,
        index,
        score,
        hasExactDate,
        hasDeadlineKeyword,
        hasPaymentKeyword,
        hasPenaltyContent,
        keywordScore
      };
    }
  );

  // ==========================================================
  // DATE QUESTION CHUNK PRIORITY
  // ==========================================================

  if (dateQuestion) {
    const datedChunks =
      scored.filter(
        item => item.hasExactDate
      );

    if (datedChunks.length > 0) {
      datedChunks.sort(
        (a, b) =>
          // 1. Exact date is mandatory priority.
          Number(b.hasExactDate) -
          Number(a.hasExactDate) ||

          // 2. Explicit deadline wording.
          Number(b.hasDeadlineKeyword) -
          Number(a.hasDeadlineKeyword) ||

          // 3. Fee/payment context.
          Number(b.hasPaymentKeyword) -
          Number(a.hasPaymentKeyword) ||

          // 4. Avoid penalty-heavy chunks when possible.
          Number(a.hasPenaltyContent) -
          Number(b.hasPenaltyContent) ||

          // 5. Keyword relevance.
          b.keywordScore -
          a.keywordScore ||

          // 6. Preserve document order.
          a.index -
          b.index
      );

      return datedChunks[0].chunk;
    }
  }

  // ==========================================================
  // NORMAL QUESTION CHUNK PRIORITY
  // ==========================================================

  scored.sort(
    (a, b) =>
      b.score -
      a.score ||
      a.index -
      b.index
  );

  return scored[0].chunk;
}

// ============================================================
// SELECT CONCISE ANSWER SENTENCES
// ============================================================

function selectAnswerSentences(question, content) {
  if (!content) {
    return '';
  }

  const normalizedContent = normalizeText(content);
  const lowerQuestion = normalizeText(question).toLowerCase();

  const dateQuestion = isDateQuestion(question);
  const paymentQuestion = isPaymentQuestion(question);

  // Split by lines first because PDF extraction can put the date
  // on its own line.
  const lines = normalizedContent
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Create sentence candidates while preserving line boundaries.
  const candidates = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    const fragments = line
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    for (const fragment of fragments) {
      candidates.push({
        text: fragment,
        lineIndex
      });
    }
  }

  if (candidates.length === 0) {
    return '';
  }

  /*
   * ==========================================================
   * DATE / DEADLINE QUESTIONS
   * ==========================================================
   *
   * For questions such as:
   *   "When is the tuition fee payment deadline?"
   *
   * An exact date is ALWAYS more important than:
   *   - penalty information
   *   - late payment information
   *   - generic deadline statements
   *
   * Example:
   *   The semester fee payment deadline is:
   *   15 September 2026
   *   Late fee payments incur a penalty of $50 per week.
   *
   * We must return the date, not the penalty.
   */
  if (dateQuestion) {
    const dateCandidates = candidates
      .map((candidate) => {
        const date = findDate(candidate.text);

        if (!date) {
          return null;
        }

        const lower = candidate.text.toLowerCase();

        const hasDeadlineLanguage =
          containsAny(lower, DEADLINE_WORDS);

        const hasPaymentLanguage =
          containsAny(lower, PAYMENT_WORDS);

        const hasPenaltyLanguage =
          containsAny(lower, PENALTY_WORDS);

        return {
          ...candidate,
          date,
          hasDeadlineLanguage,
          hasPaymentLanguage,
          hasPenaltyLanguage
        };
      })
      .filter(Boolean);

    if (dateCandidates.length > 0) {
      /*
       * Prefer dates appearing in sentences that explicitly
       * mention the deadline/payment.
       */
      dateCandidates.sort((a, b) => {
        const score = (candidate) => {
          let value = 0;

          if (candidate.hasDeadlineLanguage) {
            value += 100;
          }

          if (candidate.hasPaymentLanguage) {
            value += 50;
          }

          /*
           * Penalty information must NOT win over the deadline.
           */
          if (candidate.hasPenaltyLanguage) {
            value -= 1000;
          }

          return value;
        };

        return score(b) - score(a);
      });

      const selected = dateCandidates[0];

      /*
       * If the selected date sentence also contains penalty
       * information, keep only the portion through the date.
       */
      let answer = cleanDeadlineSentence(selected.text);

      /*
       * Handle PDF extraction where the deadline label is on
       * the previous line:
       *
       *   Semester Fee Payment Deadline:
       *   September 15th, 2026
       */
      const previousLineIndex = selected.lineIndex - 1;

      if (previousLineIndex >= 0) {
        const previous = lines[previousLineIndex].trim();
        const previousLower = previous.toLowerCase();

        const looksLikeDeadlineLabel =
          previous.endsWith(':') ||
          containsAny(previousLower, DEADLINE_WORDS);

        const previousHasNoDate = !findDate(previous);

        if (
          looksLikeDeadlineLabel &&
          previousHasNoDate &&
          !containsAny(previousLower, PENALTY_WORDS)
        ) {
          answer = `${previous} ${answer}`;
        }
      }

      return cleanDeadlineSentence(answer);
    }

    /*
     * If the chunk has no recognizable date, do NOT return
     * penalty information for a date/deadline question.
     */
    const deadlineCandidate = candidates.find((candidate) => {
      const lower = candidate.text.toLowerCase();

      return (
        containsAny(lower, DEADLINE_WORDS) &&
        !containsAny(lower, PENALTY_WORDS)
      );
    });

    if (deadlineCandidate) {
      return cleanDeadlineSentence(deadlineCandidate.text);
    }

    return '';
  }

  /*
   * ==========================================================
   * NORMAL QUESTIONS
   * ==========================================================
   */

  const scoredCandidates = candidates.map((candidate, index) => {
    const text = candidate.text;
    const lower = text.toLowerCase();

    let score = 0;

    if (paymentQuestion && containsAny(lower, PAYMENT_WORDS)) {
      score += 50;
    }

    if (containsAny(lower, DEADLINE_WORDS)) {
      score += 30;
    }

    if (containsAny(lower, PENALTY_WORDS)) {
      score -= 20;
    }

    /*
     * Reward overlap between question keywords and sentence.
     */
    const questionWords = lowerQuestion
      .split(/\s+/)
      .filter((word) => word.length >= 4);

    for (const word of questionWords) {
      if (lower.includes(word)) {
        score += 5;
      }
    }

    return {
      text,
      score,
      index
    };
  });

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.index - b.index;
  });

  const best = scoredCandidates[0];

  if (!best || best.score <= 0) {
    return '';
  }

  return cleanDeadlineSentence(best.text);
}

// ============================================================
// OPENAI API
// ============================================================

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
                  } catch (error) {
                    reject(error);
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

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  generateAnswer
};