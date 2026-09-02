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
10. Do not answer a deadline question using only late-payment, penalty, or fine information.
11. For broad or summary questions, summarize multiple relevant facts from the supplied context.
12. Ignore disclaimer text such as "sample data" or "not official information" when the user is asking for substantive college information.
13. Never treat unrelated retrieved text as an answer merely because it has high vector similarity.
14. For fee amount questions, provide an answer ONLY when an actual fee amount is explicitly present in the context. Do not substitute a fee deadline for a fee amount.
15. Do not use Markdown formatting, escaped Markdown, HTML entities, or generated numbering in the final answer.
16. Keep answers concise and easy for students to read.`;

// ============================================================
// CONSTANTS
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

const DISCLAIMER_WORDS = [
  'sample data',
  'not official information',
  'not official information from any real college',
  'demo data',
  'demonstration data'
];

const STOP_WORDS = new Set([
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
  'me',
  'mentioned',
  'information'
]);

// ============================================================
// TEXT HELPERS
// ============================================================

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/&#x20;/gi, ' ')
    .replace(/&#32;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function cleanAnswerText(value) {
  let result = String(value || '');

  // Decode common HTML entities that may come from stored document text.
  result = result
    .replace(/&#x20;/gi, ' ')
    .replace(/&#32;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Remove escaped Markdown artifacts.
  result = result
    .replace(/\\([\-*+])/g, '$1')
    .replace(/\\(\d+)\./g, '$1.')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\`/g, '`');

  // Remove excessive whitespace.
  result = result
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Remove stray list markers at the beginning.
  result = result.replace(/^(?:[-*+]|\d+\.)\s+/g, '').trim();

  return result;
}

function containsAny(text, words) {
  const normalized = String(text || '').toLowerCase();

  return words.some((word) =>
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

function isPenaltyQuestion(question) {
  return containsAny(normalizeText(question).toLowerCase(), [
    'late',
    'late payment',
    'penalty',
    'fine',
    'consequence',
    'consequences',
    'what happens if',
    'what happens when',
    'pay late'
  ]);
}

function isAmountQuestion(question) {
  const lower = normalizeText(question).toLowerCase();

  return containsAny(lower, [
    'how much',
    'amount',
    'cost',
    'price',
    'fee amount',
    'tuition amount',
    'semester fee amount',
    'how much is the fee',
    'what is the fee',
    'what is the semester fee',
    'what is the tuition fee'
  ]);
}

function isMenuQuestion(question) {
  const lower = normalizeText(question).toLowerCase();

  return containsAny(lower, [
    'menu',
    'mess menu',
    'food menu',
    'meal menu',
    'breakfast',
    'lunch menu',
    'dinner menu',
    'mess food'
  ]);
}

function isSummaryQuestion(question) {
  const lower = normalizeText(question).toLowerCase();

  return containsAny(lower, [
    'what important',
    'important information',
    'what information',
    'summarize',
    'summary',
    'overview',
    'key information',
    'academic information',
    'important academic',
    'tell me about the handbook',
    'what does the handbook say',
    'what are the important points'
  ]);
}

function getQuestionIntent(question) {
  if (isDateQuestion(question)) {
    return 'date';
  }

  if (isPenaltyQuestion(question)) {
    return 'penalty';
  }

  if (isAmountQuestion(question)) {
    return 'amount';
  }

  if (isMenuQuestion(question)) {
    return 'menu';
  }

  if (isSummaryQuestion(question)) {
    return 'summary';
  }

  return 'normal';
}

function createFallbackMessage(extra = '') {
  if (extra) {
    return `I could not find sufficient information regarding ${extra} in the available official college knowledge base.`;
  }

  return 'I could not find sufficient information regarding your query in the available official college knowledge base.';
}

// ============================================================
// DATE / DEADLINE CLEANING
// ============================================================

function cleanDeadlineSentence(sentence) {
  let result = cleanAnswerText(sentence);

  if (!result) {
    return '';
  }

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
// STREAMING
// ============================================================

async function streamText(text, onToken, delay = 25) {
  if (!onToken) {
    return;
  }

  const chunks = String(text).split(/(?<=\s)/);

  for (const chunk of chunks) {
    onToken(chunk);

    if (delay > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delay)
      );
    }
  }
}

// ============================================================
// ACTUAL AMOUNT DETECTION
// ============================================================

function containsActualAmount(text) {
  const normalized = normalizeText(text);

  // Currency symbol/code followed by a number.
  const currencyAmount =
    /(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
      normalized
    );

  // Number followed by a currency word/code.
  const writtenCurrencyAmount =
    /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
      normalized
    );

  return currencyAmount || writtenCurrencyAmount;
}

// ============================================================
// SPLIT CONTENT INTO CLEAN SENTENCES
// ============================================================

function extractCandidates(content) {
  const normalizedContent = normalizeText(content);

  if (!normalizedContent) {
    return [];
  }

  const lines = normalizedContent
    .split(/\n+/)
    .map((line) => cleanAnswerText(line))
    .filter(Boolean);

  const candidates = [];

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const fragments = lines[lineIndex]
      .split(/(?<=[.!?])\s+/)
      .map((part) => cleanAnswerText(part))
      .filter(Boolean);

    for (const fragment of fragments) {
      candidates.push({
        text: fragment,
        lineIndex
      });
    }
  }

  return candidates;
}

// ============================================================
// SELECT MOST RELEVANT RAG CHUNK
// ============================================================

function selectBestChunk(question, chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(question).toLowerCase();

  const terms =
    normalizedQuestion.match(/[a-z0-9]+/g) || [];

  const meaningfulTerms = terms.filter(
    (term) =>
      term.length > 2 &&
      !STOP_WORDS.has(term)
  );

  const dateQuestion = isDateQuestion(question);
  const paymentQuestion = /\b(fee|fees|payment|tuition)\b/i.test(
    normalizedQuestion
  );

  const asksPenalty = isPenaltyQuestion(question);
  const asksAmount = isAmountQuestion(question);
  const asksMenu = isMenuQuestion(question);

  const scored = chunks.map((chunk, index) => {
    const content = normalizeText(chunk.content || '');
    const lowerContent = content.toLowerCase();

    const keywordScore = meaningfulTerms.reduce(
      (total, term) =>
        total +
        (lowerContent.includes(term) ? 1 : 0),
      0
    );

    const hasExactDate = Boolean(findDate(content));

    const hasDeadlineKeyword = containsAny(
      lowerContent,
      DEADLINE_WORDS
    );

    const hasPaymentKeyword = containsAny(
      lowerContent,
      PAYMENT_WORDS
    );

    const hasPenaltyContent = containsAny(
      lowerContent,
      PENALTY_WORDS
    );

    const hasActualAmount =
      containsActualAmount(content);

    const hasMenuContent = containsAny(
      lowerContent,
      [
        'menu',
        'breakfast',
        'lunch',
        'dinner',
        'meal',
        'mess'
      ]
    );

    const hasDisclaimer = containsAny(
      lowerContent,
      DISCLAIMER_WORDS
    );

    let score =
      Number(
        chunk.similarity ||
        chunk.relevance ||
        0
      );

    score += keywordScore * 5;

    if (dateQuestion && hasExactDate) {
      score += 100;
    }

    if (dateQuestion && hasDeadlineKeyword) {
      score += 50;
    }

    if (paymentQuestion && hasPaymentKeyword) {
      score += 30;
    }

    if (asksPenalty && hasPenaltyContent) {
      score += 100;
    }

    if (asksAmount && hasActualAmount) {
      score += 100;
    }

    if (asksMenu && hasMenuContent) {
      score += 100;
    }

    // Strongly reject deadline-only chunks for fee amount questions.
    if (
      asksAmount &&
      hasDeadlineKeyword &&
      !hasActualAmount
    ) {
      score -= 150;
    }

    // Reject penalty-only chunks for date questions.
    if (
      dateQuestion &&
      hasPenaltyContent &&
      !hasExactDate
    ) {
      score -= 100;
    }

    if (hasDisclaimer) {
      score -= 100;
    }

    return {
      chunk,
      index,
      score,
      hasExactDate,
      hasDeadlineKeyword,
      hasPaymentKeyword,
      hasPenaltyContent,
      hasActualAmount,
      hasMenuContent,
      hasDisclaimer,
      keywordScore
    };
  });

  // ==========================================================
  // DATE PRIORITY
  // ==========================================================

  if (dateQuestion) {
    const datedChunks = scored.filter(
      (item) => item.hasExactDate
    );

    if (datedChunks.length > 0) {
      datedChunks.sort(
        (a, b) =>
          Number(b.hasDeadlineKeyword) -
          Number(a.hasDeadlineKeyword) ||
          Number(b.hasPaymentKeyword) -
          Number(a.hasPaymentKeyword) ||
          Number(a.hasPenaltyContent) -
          Number(b.hasPenaltyContent) ||
          b.keywordScore - a.keywordScore ||
          b.score - a.score ||
          a.index - b.index
      );

      return datedChunks[0].chunk;
    }
  }

  // ==========================================================
  // PENALTY PRIORITY
  // ==========================================================

  if (asksPenalty) {
    const penaltyChunks = scored.filter(
      (item) => item.hasPenaltyContent
    );

    if (penaltyChunks.length > 0) {
      penaltyChunks.sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index
      );

      return penaltyChunks[0].chunk;
    }
  }

  // ==========================================================
  // AMOUNT PRIORITY
  // ==========================================================

  if (asksAmount) {
    const amountChunks = scored.filter(
      (item) => item.hasActualAmount
    );

    if (amountChunks.length > 0) {
      amountChunks.sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index
      );

      return amountChunks[0].chunk;
    }

    // Critical: no actual amount means no amount answer.
    return null;
  }

  // ==========================================================
  // MENU PRIORITY
  // ==========================================================

  if (asksMenu) {
    const menuChunks = scored.filter(
      (item) => {
        const lower =
          String(item.chunk.content || '').toLowerCase();

        const accommodationOnly =
          lower.includes('accommodation') &&
          !lower.includes('menu') &&
          !lower.includes('breakfast') &&
          !lower.includes('lunch') &&
          !lower.includes('dinner') &&
          !lower.includes('meal');

        return (
          item.hasMenuContent &&
          !accommodationOnly
        );
      }
    );

    if (menuChunks.length > 0) {
      menuChunks.sort(
        (a, b) =>
          b.score - a.score ||
          a.index - b.index
      );

      return menuChunks[0].chunk;
    }

    return null;
  }

  // ==========================================================
  // NORMAL QUESTION
  // ==========================================================

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.index - b.index
  );

  return scored[0].chunk;
}

// ============================================================
// SELECT CONCISE ANSWER SENTENCE
// ============================================================

function selectAnswerSentences(question, content) {
  if (!content) {
    return '';
  }

  const lowerQuestion =
    normalizeText(question).toLowerCase();

  const dateQuestion = isDateQuestion(question);
  const asksPenalty = isPenaltyQuestion(question);
  const asksAmount = isAmountQuestion(question);
  const asksMenu = isMenuQuestion(question);

  const candidates = extractCandidates(content);

  if (candidates.length === 0) {
    return '';
  }

  // ==========================================================
  // 1. PENALTY / LATE PAYMENT
  // ==========================================================

  if (asksPenalty) {
    const penaltyCandidates =
      candidates.filter((candidate) =>
        containsAny(
          candidate.text.toLowerCase(),
          PENALTY_WORDS
        )
      );

    if (penaltyCandidates.length > 0) {
      penaltyCandidates.sort((a, b) => {
        const score = (candidate) => {
          const lower =
            candidate.text.toLowerCase();

          let value = 0;

          if (lower.includes('late payment')) {
            value += 50;
          }

          if (
            lower.includes('penalty') ||
            lower.includes('fine') ||
            lower.includes('late fee')
          ) {
            value += 50;
          }

          if (
            lower.includes('may result') ||
            lower.includes('will result') ||
            lower.includes('subject to')
          ) {
            value += 25;
          }

          return value;
        };

        return score(b) - score(a);
      });

      return cleanAnswerText(
        penaltyCandidates[0].text
      ).replace(/[.,:;!?\s]+$/, '') + '.';
    }

    return '';
  }

  // ==========================================================
  // 2. FEE AMOUNT
  // ==========================================================

  if (asksAmount) {
    const amountCandidates =
      candidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        const hasActualAmount =
          containsActualAmount(candidate.text);

        if (!hasActualAmount) {
          return false;
        }

        // Never treat a deadline as a fee amount.
        if (
          containsAny(
            lower,
            DEADLINE_WORDS
          ) &&
          !containsActualAmount(candidate.text)
        ) {
          return false;
        }

        return containsAny(lower, [
          'fee',
          'fees',
          'tuition',
          'semester fee',
          'amount payable',
          'cost',
          'price'
        ]);
      });

    if (amountCandidates.length > 0) {
      amountCandidates.sort((a, b) => {
        const score = (candidate) => {
          const lower =
            candidate.text.toLowerCase();

          let value = 0;

          if (containsActualAmount(candidate.text)) {
            value += 100;
          }

          if (
            lower.includes('semester fee') ||
            lower.includes('tuition fee')
          ) {
            value += 40;
          }

          if (lower.includes('amount')) {
            value += 20;
          }

          return value;
        };

        return score(b) - score(a);
      });

      return cleanAnswerText(
        amountCandidates[0].text
      );
    }

    // Absolutely no amount found.
    return '';
  }

  // ==========================================================
  // 3. HOSTEL / MESS MENU
  // ==========================================================

  if (asksMenu) {
    const menuCandidates =
      candidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        const accommodationOnly =
          lower.includes('accommodation') &&
          !lower.includes('menu') &&
          !lower.includes('breakfast') &&
          !lower.includes('lunch') &&
          !lower.includes('dinner') &&
          !lower.includes('meal');

        return (
          !accommodationOnly &&
          containsAny(lower, [
            'menu',
            'breakfast',
            'lunch',
            'dinner',
            'meal',
            'mess food',
            'mess menu'
          ])
        );
      });

    if (menuCandidates.length > 0) {
      menuCandidates.sort((a, b) => {
        const score = (candidate) => {
          const lower =
            candidate.text.toLowerCase();

          let value = 0;

          if (lower.includes('menu')) {
            value += 100;
          }

          if (lower.includes('breakfast')) {
            value += 30;
          }

          if (lower.includes('lunch')) {
            value += 30;
          }

          if (lower.includes('dinner')) {
            value += 30;
          }

          if (lower.includes('mess')) {
            value += 20;
          }

          return value;
        };

        return score(b) - score(a);
      });

      return cleanAnswerText(
        menuCandidates[0].text
      );
    }

    return '';
  }

  // ==========================================================
  // 4. DATE / DEADLINE
  // ==========================================================

  if (dateQuestion) {
    const dateCandidates = candidates
      .map((candidate) => {
        const date =
          findDate(candidate.text);

        if (!date) {
          return null;
        }

        const lower =
          candidate.text.toLowerCase();

        return {
          ...candidate,
          date,
          hasDeadlineLanguage:
            containsAny(
              lower,
              DEADLINE_WORDS
            ),
          hasPaymentLanguage:
            containsAny(
              lower,
              PAYMENT_WORDS
            ),
          hasPenaltyLanguage:
            containsAny(
              lower,
              PENALTY_WORDS
            )
        };
      })
      .filter(Boolean);

    if (dateCandidates.length > 0) {
      dateCandidates.sort((a, b) => {
        const score = (candidate) => {
          let value = 0;

          if (candidate.hasDeadlineLanguage) {
            value += 100;
          }

          if (candidate.hasPaymentLanguage) {
            value += 50;
          }

          if (candidate.hasPenaltyLanguage) {
            value -= 1000;
          }

          return value;
        };

        return score(b) - score(a);
      });

      const selected = dateCandidates[0];

      let answer =
        cleanDeadlineSentence(
          selected.text
        );

      const previousLineIndex =
        selected.lineIndex - 1;

      if (previousLineIndex >= 0) {
        const previous =
          candidates.find(
            (candidate) =>
              candidate.lineIndex ===
              previousLineIndex
          );

        if (previous) {
          const previousText =
            cleanAnswerText(previous.text);

          const previousLower =
            previousText.toLowerCase();

          const looksLikeDeadlineLabel =
            previousText.endsWith(':') ||
            containsAny(
              previousLower,
              DEADLINE_WORDS
            );

          const previousHasNoDate =
            !findDate(previousText);

          if (
            looksLikeDeadlineLabel &&
            previousHasNoDate &&
            !containsAny(
              previousLower,
              PENALTY_WORDS
            )
          ) {
            answer =
              `${previousText} ${answer}`;
          }
        }
      }

      return cleanDeadlineSentence(answer);
    }

    return '';
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  // Summary is handled by generateGroundedSummary().
  if (isSummaryQuestion(question)) {
    return '';
  }

  // ==========================================================
  // NORMAL QUESTION
  // ==========================================================

  const questionTerms =
    lowerQuestion.match(/[a-z0-9]+/g) || [];

  const meaningfulQuestionTerms =
    questionTerms.filter(
      (word) =>
        word.length >= 4 &&
        !STOP_WORDS.has(word)
    );

  const scoredCandidates =
    candidates.map((candidate, index) => {
      const text =
        candidate.text;

      const lower =
        text.toLowerCase();

      let score = 0;

      for (
        const word of meaningfulQuestionTerms
      ) {
        if (lower.includes(word)) {
          score += 5;
        }
      }

      if (
        containsAny(lower, PAYMENT_WORDS)
      ) {
        score += 10;
      }

      if (
        containsAny(lower, DEADLINE_WORDS)
      ) {
        score += 5;
      }

      if (
        containsAny(lower, PENALTY_WORDS)
      ) {
        score -= 10;
      }

      if (
        containsAny(
          lower,
          DISCLAIMER_WORDS
        )
      ) {
        score -= 100;
      }

      return {
        text,
        score,
        index
      };
    });

  scoredCandidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.index - b.index
  );

  const best =
    scoredCandidates[0];

  if (!best || best.score <= 0) {
    return '';
  }

  return cleanAnswerText(best.text);
}

// ============================================================
// GROUNDED SUMMARY
// ============================================================

function generateGroundedSummary(
  question,
  contextChunks
) {
  if (
    !Array.isArray(contextChunks) ||
    contextChunks.length === 0
  ) {
    return {
      text: '',
      sources: []
    };
  }

  const summaryCandidates = [];

  const questionTerms =
    normalizeText(question)
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];

  const meaningfulTerms =
    questionTerms.filter(
      (term) =>
        term.length > 3 &&
        !STOP_WORDS.has(term)
    );

  const academicTerms = [
    'academic',
    'semester',
    'course',
    'tuition',
    'fee',
    'fees',
    'payment',
    'deadline',
    'registration',
    'examination',
    'exam',
    'admission',
    'attendance',
    'requirement',
    'requirements',
    'scholarship',
    'student',
    'policy',
    'schedule',
    'calendar',
    'notice'
  ];

  for (
    let chunkIndex = 0;
    chunkIndex < contextChunks.length;
    chunkIndex += 1
  ) {
    const chunk =
      contextChunks[chunkIndex];

    const content =
      normalizeText(chunk.content || '');

    if (!content) {
      continue;
    }

    const fragments =
      extractCandidates(content);

    for (
      let sentenceIndex = 0;
      sentenceIndex < fragments.length;
      sentenceIndex += 1
    ) {
      const text =
        cleanAnswerText(
          fragments[sentenceIndex].text
        );

      const lower =
        text.toLowerCase();

      if (!text) {
        continue;
      }

      if (
        containsAny(
          lower,
          DISCLAIMER_WORDS
        )
      ) {
        continue;
      }

      let score = 0;

      // Question relevance.
      for (
        const term of meaningfulTerms
      ) {
        if (lower.includes(term)) {
          score += 8;
        }
      }

      // Academic relevance.
      for (
        const term of academicTerms
      ) {
        if (lower.includes(term)) {
          score += 5;
        }
      }

      // Important factual signals.
      if (findDate(text)) {
        score += 10;
      }

      if (
        containsAny(lower, [
          'must',
          'required',
          'students',
          'deadline',
          'payment',
          'before',
          'submit',
          'available'
        ])
      ) {
        score += 8;
      }

      // Reject tiny headers / fragments.
      if (text.length < 25) {
        score -= 15;
      }

      // Reject obvious source/header noise.
      if (
        /^(page|chapter|section|contents)\b/i.test(text)
      ) {
        score -= 20;
      }

      if (score > 0) {
        summaryCandidates.push({
          text,
          score,
          chunkIndex,
          sentenceIndex,
          chunk
        });
      }
    }
  }

  if (summaryCandidates.length === 0) {
    return {
      text: '',
      sources: []
    };
  }

  summaryCandidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.chunkIndex - b.chunkIndex ||
      a.sentenceIndex - b.sentenceIndex
  );

  const selected = [];
  const seen = new Set();

  for (
    const candidate of summaryCandidates
  ) {
    const normalizedCandidate =
      candidate.text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (seen.has(normalizedCandidate)) {
      continue;
    }

    seen.add(normalizedCandidate);
    selected.push(candidate);

    if (selected.length >= 4) {
      break;
    }
  }

  // Preserve document order.
  selected.sort(
    (a, b) =>
      a.chunkIndex - b.chunkIndex ||
      a.sentenceIndex - b.sentenceIndex
  );

  const sentences = [];
  const sources = [];
  let totalLength = 0;

  for (
    const candidate of selected
  ) {
    let sentence =
      cleanAnswerText(candidate.text);

    if (!sentence) {
      continue;
    }

    if (!/[.!?]$/.test(sentence)) {
      sentence += '.';
    }

    // Keep summary concise.
    if (
      totalLength > 0 &&
      totalLength + sentence.length > 550
    ) {
      continue;
    }

    sentences.push(sentence);
    totalLength += sentence.length;

    sources.push(candidate.chunk);
  }

  return {
    text: sentences.join(' '),
    sources
  };
}

// ============================================================
// FORMAT SOURCE CITATIONS
// ============================================================

function formatSourceCitations(chunks) {
  if (!Array.isArray(chunks)) {
    return '';
  }

  const citations = [];
  const seen = new Set();

  for (const chunk of chunks) {
    if (!chunk) {
      continue;
    }

    const title =
      chunk.documentTitle ||
      'Official college document';

    const pageLabel =
      chunk.pageNumber
        ? `, p. ${chunk.pageNumber}`
        : '';

    const citation =
      `[Source: ${title}${pageLabel}]`;

    if (!seen.has(citation)) {
      seen.add(citation);
      citations.push(citation);
    }

    if (citations.length >= 3) {
      break;
    }
  }

  return citations.join(' ');
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

  const intent =
    getQuestionIntent(question);

  let contextText = '';

  if (hasContext) {
    contextText =
      contextChunks
        .map((chunk, idx) => {
          const pageInfo =
            chunk.pageNumber
              ? ` (Page ${chunk.pageNumber})`
              : '';

          return `--- CONTEXT CHUNK ${idx + 1} [Source: "${chunk.documentTitle}"${pageInfo}] ---
${chunk.content}`;
        })
        .join('\n\n');
  }

  // ==========================================================
  // STRICT GROUNDED INTENTS
  //
  // These MUST be resolved from retrieved documents BEFORE
  // calling OpenAI. This prevents the LLM from substituting
  // related but incorrect information.
  // ==========================================================

  if (hasContext && intent === 'date') {
    const bestChunk =
      selectBestChunk(
        question,
        contextChunks
      );

    if (bestChunk) {
      const answerText =
        selectAnswerSentences(
          question,
          bestChunk.content
        );

      if (answerText) {
        const citation =
          formatSourceCitations([
            bestChunk
          ]);

        const synthesized =
          `${answerText} ${citation}`.trim();

        await streamText(
          synthesized,
          onToken,
          25
        );

        return synthesized;
      }
    }

    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // PENALTY
  // ==========================================================

  if (hasContext && intent === 'penalty') {
    const bestChunk =
      selectBestChunk(
        question,
        contextChunks
      );

    if (bestChunk) {
      const answerText =
        selectAnswerSentences(
          question,
          bestChunk.content
        );

      if (answerText) {
        const citation =
          formatSourceCitations([
            bestChunk
          ]);

        const synthesized =
          `${answerText} ${citation}`.trim();

        await streamText(
          synthesized,
          onToken,
          25
        );

        return synthesized;
      }
    }

    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // FEE AMOUNT
  //
  // IMPORTANT:
  // Do this BEFORE OpenAI so a deadline can NEVER be returned
  // as the semester fee amount.
  // ==========================================================

  if (hasContext && intent === 'amount') {
    const bestChunk =
      selectBestChunk(
        question,
        contextChunks
      );

    if (bestChunk) {
      const answerText =
        selectAnswerSentences(
          question,
          bestChunk.content
        );

      if (answerText) {
        const citation =
          formatSourceCitations([
            bestChunk
          ]);

        const synthesized =
          `${answerText} ${citation}`.trim();

        await streamText(
          synthesized,
          onToken,
          25
        );

        return synthesized;
      }
    }

    const fallbackMsg =
      createFallbackMessage(
        'the semester fee amount'
      );

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // HOSTEL / MESS MENU
  //
  // Also handled BEFORE OpenAI so unrelated accommodation
  // information cannot become a menu answer.
  // ==========================================================

  if (hasContext && intent === 'menu') {
    const bestChunk =
      selectBestChunk(
        question,
        contextChunks
      );

    if (bestChunk) {
      const answerText =
        selectAnswerSentences(
          question,
          bestChunk.content
        );

      if (answerText) {
        const citation =
          formatSourceCitations([
            bestChunk
          ]);

        const synthesized =
          `${answerText} ${citation}`.trim();

        await streamText(
          synthesized,
          onToken,
          25
        );

        return synthesized;
      }
    }

    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // BROAD SUMMARY
  //
  // Also handled BEFORE OpenAI. This guarantees clean output
  // and prevents Markdown/HTML artifacts from the LLM.
  // ==========================================================

  if (hasContext && intent === 'summary') {
    const summaryResult =
      generateGroundedSummary(
        question,
        contextChunks
      );

    if (summaryResult.text) {
      const citations =
        formatSourceCitations(
          summaryResult.sources
        );

      const synthesized =
        `${summaryResult.text} ${citations}`.trim();

      await streamText(
        synthesized,
        onToken,
        20
      );

      return synthesized;
    }

    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  // ==========================================================
  // OPENAI LLM
  //
  // Only normal questions reach this section.
  // ==========================================================

  const apiKey =
    env.llmApiKey;

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

      const aiResponse =
        await fetchOpenAIChat(
          promptMessages,
          apiKey
        );

      if (aiResponse) {
        const cleaned =
          cleanAnswerText(aiResponse);

        if (cleaned) {
          return cleaned;
        }
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
  // GROUNDED NORMAL FALLBACK
  // ==========================================================

  const bestChunk =
    selectBestChunk(
      question,
      contextChunks
    );

  if (!bestChunk) {
    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  const answerText =
    selectAnswerSentences(
      question,
      bestChunk.content
    );

  if (!answerText) {
    const fallbackMsg =
      createFallbackMessage();

    await streamText(
      fallbackMsg,
      onToken,
      20
    );

    return fallbackMsg;
  }

  const citation =
    formatSourceCitations([
      bestChunk
    ]);

  const synthesized =
    `${answerText} ${citation}`.trim();

  await streamText(
    synthesized,
    onToken,
    25
  );

  return synthesized;
};

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
            Buffer.byteLength(postData)
        }
      };

      const req =
        https.request(
          options,
          (res) => {
            let body = '';

            res.on(
              'data',
              (chunk) => {
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