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
11. For broad or summary questions, summarize multiple relevant facts from the supplied context instead of selecting one arbitrary sentence.
12. Ignore disclaimer text such as "sample data" or "not official information" when the user is asking for substantive college information.
13. Never treat unrelated retrieved text as an answer merely because it has high vector similarity.`;

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

const DISCLAIMER_WORDS = [
  'sample data',
  'not official information',
  'not official information from any real college',
  'demo data',
  'demonstration data'
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

function isPaymentQuestion(question) {
  return /\b(fee|fees|payment|tuition|semester fee|tuition fee)\b/i.test(
    String(question || '')
  );
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

// ============================================================
// CLEAN ANSWER
// ============================================================

function cleanDeadlineSentence(sentence) {
  let result = normalizeText(sentence);

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
// STREAMING FALLBACK
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
      await new Promise((resolve) =>
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
      (term) =>
        term.length > 2 &&
        !stopWords.has(term)
    );

  const dateQuestion =
    isDateQuestion(question);

  const paymentQuestion =
    isPaymentQuestion(question);

  const asksPenalty =
    containsAny(normalizedQuestion, [
      'late',
      'penalty',
      'fine',
      'consequence',
      'what happens if'
    ]);

  const asksAmount =
    containsAny(normalizedQuestion, [
      'how much',
      'amount',
      'cost',
      'price',
      'fee amount',
      'tuition amount',
      'semester fee amount'
    ]);

  const asksMenu =
    containsAny(normalizedQuestion, [
      'menu',
      'mess menu',
      'food menu',
      'meal menu',
      'breakfast',
      'lunch menu',
      'dinner menu'
    ]);

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

      const hasActualAmount =
        /\b(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
          content
        ) ||
        /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
          content
        );

      const hasMenuContent =
        containsAny(lowerContent, [
          'menu',
          'breakfast',
          'lunch',
          'dinner',
          'meal',
          'mess'
        ]);

      const hasDisclaimer =
        containsAny(
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

      if (
        asksPenalty &&
        hasPenaltyContent
      ) {
        score += 100;
      }

      if (
        asksAmount &&
        hasActualAmount
      ) {
        score += 100;
      }

      if (
        asksMenu &&
        hasMenuContent
      ) {
        score += 100;
      }

      if (
        asksMenu &&
        lowerContent.includes('accommodation') &&
        !hasMenuContent
      ) {
        score -= 100;
      }

      if (
        asksAmount &&
        hasDeadlineKeyword &&
        !hasActualAmount
      ) {
        score -= 100;
      }

      if (
        dateQuestion &&
        hasPenaltyContent &&
        !hasExactDate
      ) {
        score -= 40;
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
    }
  );

  // ==========================================================
  // DATE QUESTION CHUNK PRIORITY
  // ==========================================================

  if (dateQuestion) {
    const datedChunks =
      scored.filter(
        (item) => item.hasExactDate
      );

    if (datedChunks.length > 0) {
      datedChunks.sort(
        (a, b) =>
          Number(b.hasExactDate) -
          Number(a.hasExactDate) ||

          Number(b.hasDeadlineKeyword) -
          Number(a.hasDeadlineKeyword) ||

          Number(b.hasPaymentKeyword) -
          Number(a.hasPaymentKeyword) ||

          Number(a.hasPenaltyContent) -
          Number(b.hasPenaltyContent) ||

          b.keywordScore -
          a.keywordScore ||

          a.index -
          b.index
      );

      return datedChunks[0].chunk;
    }
  }

  // ==========================================================
  // PENALTY QUESTION CHUNK PRIORITY
  // ==========================================================

  if (asksPenalty) {
    const penaltyChunks =
      scored.filter(
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
  // AMOUNT QUESTION CHUNK PRIORITY
  // ==========================================================

  if (asksAmount) {
    const amountChunks =
      scored.filter(
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
  }

  // ==========================================================
  // MENU QUESTION CHUNK PRIORITY
  // ==========================================================

  if (asksMenu) {
    const menuChunks =
      scored.filter(
        (item) =>
          item.hasMenuContent &&
          !(
            item.chunk.content || ''
          )
            .toLowerCase()
            .includes('accommodation')
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

function selectAnswerSentences(
  question,
  content
) {
  if (!content) {
    return '';
  }

  const normalizedContent =
    normalizeText(content);

  const lowerQuestion =
    normalizeText(question).toLowerCase();

  const dateQuestion =
    isDateQuestion(question);

  const paymentQuestion =
    isPaymentQuestion(question);

  const asksPenalty =
    containsAny(lowerQuestion, [
      'late',
      'late payment',
      'penalty',
      'fine',
      'consequence',
      'consequences',
      'what happens if',
      'what happens when',
      'what if i pay late',
      'what happens if i pay late',
      'pay late'
    ]);

  const asksAmount =
    containsAny(lowerQuestion, [
      'how much',
      'amount',
      'cost',
      'price',
      'fee amount',
      'tuition amount',
      'semester fee amount',
      'how much is the fee',
      'what is the fee'
    ]);

  const asksMenu =
    containsAny(lowerQuestion, [
      'menu',
      'mess menu',
      'food menu',
      'meal menu',
      'breakfast',
      'lunch menu',
      'dinner menu',
      'mess food'
    ]);

  const asksSummary =
    isSummaryQuestion(question);

  const lines =
    normalizedContent
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

  const candidates = [];

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const fragments =
      lines[lineIndex]
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

  // ==========================================================
  // 1. PENALTY / LATE PAYMENT
  // ==========================================================

  if (asksPenalty) {
    const penaltyCandidates =
      candidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        return (
          containsAny(
            lower,
            PENALTY_WORDS
          ) ||
          containsAny(lower, [
            'late payment',
            'late fee',
            'pay late',
            'payment after',
            'payment is late',
            'paid late',
            'late payments'
          ])
        );
      });

    if (penaltyCandidates.length > 0) {
      penaltyCandidates.sort((a, b) => {
        const score = (candidate) => {
          const lower =
            candidate.text.toLowerCase();

          let value = 0;

          if (
            containsAny(
              lower,
              PENALTY_WORDS
            )
          ) {
            value += 100;
          }

          if (
            lower.includes('late payment')
          ) {
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

      return cleanDeadlineSentence(
        penaltyCandidates[0].text
      );
    }

    return '';
  }

  // ==========================================================
  // 2. FEE AMOUNT / COST
  // ==========================================================

  if (asksAmount) {
    const amountCandidates =
      candidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        const hasCurrencyAmount =
          /\b(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
            candidate.text
          );

        const hasWrittenAmount =
          /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
            candidate.text
          );

        const hasFeeLanguage =
          containsAny(lower, [
            'fee amount',
            'tuition fee',
            'semester fee',
            'fee is',
            'fee:',
            'amount payable',
            'amount is',
            'tuition cost',
            'semester cost'
          ]);

        return (
          hasCurrencyAmount ||
          hasWrittenAmount ||
          hasFeeLanguage
        );
      });

    const usefulAmountCandidates =
      amountCandidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        const hasCurrencyAmount =
          /\b(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
            candidate.text
          );

        const hasWrittenAmount =
          /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
            candidate.text
          );

        const hasActualAmount =
          hasCurrencyAmount ||
          hasWrittenAmount;

        const isOnlyDeadline =
          containsAny(
            lower,
            DEADLINE_WORDS
          ) &&
          !hasActualAmount;

        const isDeadlineIntroduction =
          lower.includes(
            'payment deadline'
          ) &&
          !hasActualAmount;

        return (
          !isOnlyDeadline &&
          !isDeadlineIntroduction
        );
      });

    if (
      usefulAmountCandidates.length > 0
    ) {
      usefulAmountCandidates.sort(
        (a, b) => {
          const score = (candidate) => {
            const lower =
              candidate.text.toLowerCase();

            let value = 0;

            if (
              /\b(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
                candidate.text
              )
            ) {
              value += 100;
            }

            if (
              /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
                candidate.text
              )
            ) {
              value += 100;
            }

            if (
              containsAny(lower, [
                'tuition fee',
                'semester fee',
                'fee amount'
              ])
            ) {
              value += 30;
            }

            if (
              containsAny(
                lower,
                PAYMENT_WORDS
              )
            ) {
              value += 20;
            }

            return value;
          };

          return score(b) - score(a);
        }
      );

      return cleanDeadlineSentence(
        usefulAmountCandidates[0].text
      );
    }

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

        return containsAny(lower, [
          'menu',
          'breakfast',
          'lunch',
          'dinner',
          'meal',
          'mess food',
          'mess menu'
        ]);
      });

    const relevantMenuCandidates =
      menuCandidates.filter((candidate) => {
        const lower =
          candidate.text.toLowerCase();

        const isAccommodationOnly =
          lower.includes('accommodation') &&
          !lower.includes('menu') &&
          !lower.includes('breakfast') &&
          !lower.includes('lunch') &&
          !lower.includes('dinner') &&
          !lower.includes('meal');

        return !isAccommodationOnly;
      });

    if (
      relevantMenuCandidates.length > 0
    ) {
      relevantMenuCandidates.sort(
        (a, b) => {
          const score = (candidate) => {
            const lower =
              candidate.text.toLowerCase();

            let value = 0;

            if (
              lower.includes('menu')
            ) {
              value += 100;
            }

            if (
              lower.includes('breakfast')
            ) {
              value += 30;
            }

            if (
              lower.includes('lunch')
            ) {
              value += 30;
            }

            if (
              lower.includes('dinner')
            ) {
              value += 30;
            }

            if (
              lower.includes('mess')
            ) {
              value += 20;
            }

            return value;
          };

          return score(b) - score(a);
        }
      );

      return cleanDeadlineSentence(
        relevantMenuCandidates[0].text
      );
    }

    return '';
  }

  // ==========================================================
  // 4. DATE / DEADLINE
  // ==========================================================

  if (dateQuestion) {
    const dateCandidates =
      candidates
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
      dateCandidates.sort(
        (a, b) => {
          const score = (candidate) => {
            let value = 0;

            if (
              candidate.hasDeadlineLanguage
            ) {
              value += 100;
            }

            if (
              candidate.hasPaymentLanguage
            ) {
              value += 50;
            }

            if (
              candidate.hasPenaltyLanguage
            ) {
              value -= 1000;
            }

            return value;
          };

          return score(b) - score(a);
        }
      );

      const selected =
        dateCandidates[0];

      let answer =
        cleanDeadlineSentence(
          selected.text
        );

      const previousLineIndex =
        selected.lineIndex - 1;

      if (
        previousLineIndex >= 0
      ) {
        const previous =
          lines[previousLineIndex].trim();

        const previousLower =
          previous.toLowerCase();

        const looksLikeDeadlineLabel =
          previous.endsWith(':') ||
          containsAny(
            previousLower,
            DEADLINE_WORDS
          );

        const previousHasNoDate =
          !findDate(previous);

        if (
          looksLikeDeadlineLabel &&
          previousHasNoDate &&
          !containsAny(
            previousLower,
            PENALTY_WORDS
          )
        ) {
          answer =
            `${previous} ${answer}`;
        }
      }

      return cleanDeadlineSentence(
        answer
      );
    }

    const deadlineCandidate =
      candidates.find(
        (candidate) => {
          const lower =
            candidate.text.toLowerCase();

          return (
            containsAny(
              lower,
              DEADLINE_WORDS
            ) &&
            !containsAny(
              lower,
              PENALTY_WORDS
            )
          );
        }
      );

    if (deadlineCandidate) {
      return cleanDeadlineSentence(
        deadlineCandidate.text
      );
    }

    return '';
  }

  // ==========================================================
  // 5. SUMMARY QUESTIONS
  // ==========================================================

  /*
   * Summary questions are intentionally NOT answered with
   * one arbitrary sentence.
   *
   * generateAnswer() handles these using multiple relevant
   * retrieved chunks.
   */

  if (asksSummary) {
    return '';
  }

  // ==========================================================
  // 6. NORMAL QUESTIONS
  // ==========================================================

  const questionWords =
    lowerQuestion
      .split(/\s+/)
      .filter(
        (word) => word.length >= 4
      );

  const scoredCandidates =
    candidates.map(
      (candidate, index) => {
        const text =
          candidate.text;

        const lower =
          text.toLowerCase();

        let score = 0;

        if (
          paymentQuestion &&
          containsAny(
            lower,
            PAYMENT_WORDS
          )
        ) {
          score += 50;
        }

        if (
          containsAny(
            lower,
            DEADLINE_WORDS
          )
        ) {
          score += 20;
        }

        if (
          containsAny(
            lower,
            PENALTY_WORDS
          )
        ) {
          score -= 20;
        }

        if (
          containsAny(
            lower,
            DISCLAIMER_WORDS
          )
        ) {
          score -= 100;
        }

        for (
          const word of questionWords
        ) {
          if (
            lower.includes(word)
          ) {
            score += 5;
          }
        }

        return {
          text,
          score,
          index
        };
      }
    );

  scoredCandidates.sort(
    (a, b) => {
      if (
        b.score !== a.score
      ) {
        return b.score - a.score;
      }

      return a.index - b.index;
    }
  );

  const best =
    scoredCandidates[0];

  if (
    !best ||
    best.score <= 0
  ) {
    return '';
  }

  return cleanDeadlineSentence(
    best.text
  );
}

// ============================================================
// GROUNDED SUMMARY GENERATOR
// ============================================================

function generateGroundedSummary(
  question,
  contextChunks
) {
  if (
    !Array.isArray(contextChunks) ||
    contextChunks.length === 0
  ) {
    return '';
  }

  const summaryCandidates = [];

  for (
    let chunkIndex = 0;
    chunkIndex < contextChunks.length;
    chunkIndex += 1
  ) {
    const chunk =
      contextChunks[chunkIndex];

    const content =
      normalizeText(
        chunk.content || ''
      );

    if (!content) {
      continue;
    }

    const fragments =
      content
        .split(/(?<=[.!?])\s+/)
        .map((text) => text.trim())
        .filter(Boolean);

    for (
      let index = 0;
      index < fragments.length;
      index += 1
    ) {
      const text =
        fragments[index];

      const lower =
        text.toLowerCase();

      if (
        containsAny(
          lower,
          DISCLAIMER_WORDS
        )
      ) {
        continue;
      }

      let score = 0;

      /*
       * Prefer substantive academic information.
       */
      if (
        containsAny(lower, [
          'academic',
          'semester',
          'course',
          'tuition',
          'fee',
          'payment',
          'deadline',
          'registration',
          'examination',
          'exam',
          'admission',
          'student',
          'attendance',
          'requirement',
          'requirement',
          'important'
        ])
      ) {
        score += 20;
      }

      /*
       * Give factual sentences additional weight.
       */
      if (
        findDate(text)
      ) {
        score += 10;
      }

      if (
        containsAny(lower, [
          'must',
          'required',
          'deadline',
          'available',
          'students',
          'payment'
        ])
      ) {
        score += 10;
      }

      /*
       * Penalize sentences that are mainly disclaimers
       * or navigation/header noise.
       */
      if (
        text.length < 20
      ) {
        score -= 10;
      }

      summaryCandidates.push({
        text,
        score,
        chunkIndex,
        sentenceIndex: index
      });
    }
  }

  if (
    summaryCandidates.length === 0
  ) {
    return '';
  }

  summaryCandidates.sort(
    (a, b) =>
      b.score -
      a.score ||
      a.chunkIndex -
      b.chunkIndex ||
      a.sentenceIndex -
      b.sentenceIndex
  );

  /*
   * Select up to three distinct useful facts.
   */
  const selected = [];
  const seen = new Set();

  for (
    const candidate of summaryCandidates
  ) {
    const key =
      candidate.text.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    selected.push(candidate);

    if (selected.length >= 3) {
      break;
    }
  }

  if (selected.length === 0) {
    return '';
  }

  /*
   * Preserve document order for readability.
   */
  selected.sort(
    (a, b) =>
      a.chunkIndex -
      b.chunkIndex ||
      a.sentenceIndex -
      b.sentenceIndex
  );

  return selected
    .map((candidate) =>
      cleanDeadlineSentence(
        candidate.text
      )
    )
    .filter(Boolean)
    .join(' ');
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

  const summaryQuestion =
    isSummaryQuestion(question);

  const amountQuestion =
    containsAny(
      normalizeText(question).toLowerCase(),
      [
        'how much',
        'amount',
        'cost',
        'price',
        'fee amount',
        'tuition amount',
        'semester fee amount',
        'how much is the fee',
        'what is the fee'
      ]
    );

  // ==========================================================
  // DETERMINISTIC DATE / DEADLINE HANDLING
  // ==========================================================

  if (
    hasContext &&
    isDateQuestion(question)
  ) {
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
        const pageLabel =
          bestChunk.pageNumber
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
  // BROAD SUMMARY FALLBACK
  // ==========================================================

  if (summaryQuestion) {
    const summary =
      generateGroundedSummary(
        question,
        contextChunks
      );

    if (summary) {
      /*
       * Use citations from the chunks that contributed to
       * the summary.
       */
      const usedChunks =
        contextChunks.filter(
          (chunk) => {
            const content =
              normalizeText(
                chunk.content || ''
              ).toLowerCase();

            return summary
              .toLowerCase()
              .includes(
                content.slice(
                  0,
                  Math.min(
                    40,
                    content.length
                  )
                )
              );
          }
        );

      /*
       * If exact matching is not possible, use the top
       * relevant chunks as citation sources.
       */
      const citationChunks =
        usedChunks.length > 0
          ? usedChunks.slice(0, 3)
          : contextChunks.slice(0, 3);

      const citations =
        citationChunks
          .map((chunk) => {
            const pageLabel =
              chunk.pageNumber
                ? `, p. ${chunk.pageNumber}`
                : '';

            return `[Source: ${chunk.documentTitle}${pageLabel}]`;
          })
          .filter(
            (value, index, array) =>
              array.indexOf(value) === index
          )
          .join(' ');

      const synthesized =
        `${summary} ${citations}`.trim();

      await streamText(
        synthesized,
        onToken,
        20
      );

      return synthesized;
    }

    const fallbackMsg =
      'I could not find sufficient information regarding your query in the available official college knowledge base.';

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

  const bestChunk =
    selectBestChunk(
      question,
      contextChunks
    );

  /*
   * For amount questions, if no chunk actually contains
   * a numeric amount, do NOT fall through to an unrelated
   * deadline sentence.
   */
  if (amountQuestion) {
    const hasActualAmount =
      contextChunks.some(
        (chunk) => {
          const content =
            normalizeText(
              chunk.content || ''
            );

          return (
            /\b(?:₹|rs\.?|inr|\$|usd|€|eur|£)\s*[\d,]+(?:\.\d+)?\b/i.test(
              content
            ) ||
            /\b[\d,]+(?:\.\d+)?\s*(?:rupees|rs|inr|usd|dollars|euros|pounds)\b/i.test(
              content
            )
          );
        }
      );

    if (!hasActualAmount) {
      const fallbackMsg =
        'I could not find sufficient information regarding the semester fee amount in the available official college knowledge base.';

      await streamText(
        fallbackMsg,
        onToken,
        20
      );

      return fallbackMsg;
    }
  }

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

  const answerText =
    selectAnswerSentences(
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

  const pageLabel =
    bestChunk.pageNumber
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