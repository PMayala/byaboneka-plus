/**
 * ============================================
 * VERIFICATION STRENGTH ANALYZER
 * ============================================
 * 
 * NOVEL FEATURE: No lost-and-found platform analyzes the QUALITY of
 * verification questions. This service scores questions on specificity,
 * guessability, and redundancy, then gives users actionable feedback.
 * 
 * Also provides category-specific question templates as defined in
 * Algorithm Spec section 3.2.2 (was missing from codebase).
 */

// ============================================
// TYPES
// ============================================

export type StrengthLevel = 'WEAK' | 'MODERATE' | 'STRONG';

export interface QuestionAnalysis {
  question_index: number;
  strength: StrengthLevel;
  score: number;       // 0-100
  issues: string[];
  suggestions: string[];
}

export interface VerificationStrengthResult {
  overall_strength: StrengthLevel;
  overall_score: number;        // 0-100
  questions: QuestionAnalysis[];
  redundancy_warning: boolean;
  improvement_tips: string[];
}

export interface QuestionTemplate {
  category: string;
  question: string;
  why_effective: string;
}

// ============================================
// CATEGORY-SPECIFIC TEMPLATES (from Algo Spec 3.2.2)
// ============================================

export const QUESTION_TEMPLATES: Record<string, QuestionTemplate[]> = {
  PHONE: [
    { category: 'PHONE', question: 'What is your lockscreen wallpaper?', why_effective: 'Only the owner would know this - it cannot be guessed from the phone exterior.' },
    { category: 'PHONE', question: 'What color/design is the phone case?', why_effective: 'Specific physical detail that requires having seen the phone.' },
    { category: 'PHONE', question: 'What are the last 4 digits of the IMEI number?', why_effective: 'Unique identifier that only the owner would have recorded.' },
    { category: 'PHONE', question: 'Name one specific app on the home screen', why_effective: 'Personal customization that is unique to each user.' },
    { category: 'PHONE', question: 'What is the phone ringtone or notification sound?', why_effective: 'Personal setting that distinguishes one phone from others.' },
  ],
  ID: [
    { category: 'ID', question: 'What are the last 3 characters of the ID number?', why_effective: 'Partial identifier that the owner would know.' },
    { category: 'ID', question: 'What are the name initials on the document?', why_effective: 'Verifies the document belongs to the claimant.' },
    { category: 'ID', question: 'Which district issued the document?', why_effective: 'Administrative detail that only the holder would know.' },
    { category: 'ID', question: 'What year was the document issued?', why_effective: 'Temporal detail specific to this particular document.' },
  ],
  WALLET: [
    { category: 'WALLET', question: 'How many cards are inside the wallet?', why_effective: 'Specific content count that requires having owned the wallet.' },
    { category: 'WALLET', question: 'Name one specific card (bank/ID/other) inside', why_effective: 'Identifies specific contents only the owner would know.' },
    { category: 'WALLET', question: 'Approximately how much cash was inside (in RWF)?', why_effective: 'Content detail that is hard to guess correctly.' },
    { category: 'WALLET', question: 'Are there any photos inside? If yes, describe one.', why_effective: 'Personal content that uniquely identifies the wallet.' },
    { category: 'WALLET', question: 'What color is the wallet interior?', why_effective: 'Physical detail only visible when the wallet is open.' },
  ],
  BAG: [
    { category: 'BAG', question: 'Describe any distinctive marks, stickers, or damage', why_effective: 'Unique physical features that identify this specific bag.' },
    { category: 'BAG', question: 'What brand is the bag?', why_effective: 'Manufacturer detail that narrows identification.' },
    { category: 'BAG', question: 'How many compartments does it have?', why_effective: 'Structural detail requiring familiarity with the bag.' },
    { category: 'BAG', question: 'Name one specific item that was inside', why_effective: 'Contents knowledge only the owner would have.' },
  ],
  KEYS: [
    { category: 'KEYS', question: 'How many keys are on the keyring?', why_effective: 'Specific count that the owner would know.' },
    { category: 'KEYS', question: 'Describe the keychain or any attachment', why_effective: 'Decorative details unique to this key set.' },
    { category: 'KEYS', question: 'Are there any distinctive or unusual key shapes?', why_effective: 'Physical detail that distinguishes these keys.' },
  ],
  OTHER: [
    { category: 'OTHER', question: 'Describe a specific unique mark or feature on the item', why_effective: 'Physical uniqueness proves familiarity.' },
    { category: 'OTHER', question: 'What was the item being used for when last seen?', why_effective: 'Contextual detail only the owner would know.' },
    { category: 'OTHER', question: 'Where exactly was the item stored or placed before loss?', why_effective: 'Specific location knowledge proves ownership.' },
  ],
};

// ============================================
// WEAK QUESTION PATTERNS
// ============================================

const GENERIC_PATTERNS = [
  /^what colou?r/i,
  /^what is the colou?r/i,
  /^is it (a |my )?/i,
  /^what brand/i,
  /^where did/i,
  /^when did/i,
  /^how old/i,
];

const TOO_SHORT_THRESHOLD = 15;   // Characters
const TOO_VAGUE_WORDS = ['thing', 'stuff', 'something', 'item', 'object', 'it'];
const YES_NO_PATTERNS = [/^is /i, /^are /i, /^was /i, /^were /i, /^do /i, /^does /i, /^did /i, /^can /i, /^has /i, /^have /i];

// ============================================
// CORE ANALYSIS FUNCTION
// ============================================

export function analyzeVerificationStrength(
  questions: string[],
  answers: string[],
  itemCategory: string,
  itemDescription: string
): VerificationStrengthResult {
  const questionAnalyses: QuestionAnalysis[] = [];

  // Analyze each question individually
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i] || '';
    const a = answers[i] || '';
    questionAnalyses.push(analyzeQuestion(q, a, itemDescription, i));
  }

  // Check for redundancy (all questions asking about the same thing)
  const redundancyWarning = checkRedundancy(questions);

  // Calculate overall score
  const avgScore = questionAnalyses.reduce((sum, qa) => sum + qa.score, 0) / questionAnalyses.length;
  const redundancyPenalty = redundancyWarning ? 15 : 0;
  const overallScore = Math.max(0, Math.round(avgScore - redundancyPenalty));

  let overallStrength: StrengthLevel;
  if (overallScore >= 70) overallStrength = 'STRONG';
  else if (overallScore >= 40) overallStrength = 'MODERATE';
  else overallStrength = 'WEAK';

  // Generate tips
  const tips: string[] = [];
  if (overallStrength === 'WEAK') {
    tips.push('Your verification questions may not protect your item. Consider using our suggested templates.');
  }
  if (redundancyWarning) {
    tips.push('Your questions are too similar. Use different types of questions for better security.');
  }
  const weakQ = questionAnalyses.filter(qa => qa.strength === 'WEAK');
  if (weakQ.length > 0) {
    tips.push(`${weakQ.length} of your ${questions.length} questions are weak. Tap on each for improvement suggestions.`);
  }

  // Add category-specific tips
  const templates = QUESTION_TEMPLATES[itemCategory] || QUESTION_TEMPLATES['OTHER'];
  if (overallStrength !== 'STRONG') {
    tips.push(`For ${itemCategory.toLowerCase()} items, try questions like: "${templates[0].question}"`);
  }

  return {
    overall_strength: overallStrength,
    overall_score: overallScore,
    questions: questionAnalyses,
    redundancy_warning: redundancyWarning,
    improvement_tips: tips
  };
}

// ============================================
// INDIVIDUAL QUESTION ANALYSIS
// ============================================

function analyzeQuestion(
  question: string,
  answer: string,
  itemDescription: string,
  index: number
): QuestionAnalysis {
  let score = 50; // Start at middle
  const issues: string[] = [];
  const suggestions: string[] = [];

  // ── Check 1: Question length (too short = vague) ──
  if (question.length < TOO_SHORT_THRESHOLD) {
    score -= 20;
    issues.push('Question is too short and vague');
    suggestions.push('Add more specific details to your question');
  }

  // ── Check 2: Yes/No questions (low entropy) ──
  const isYesNo = YES_NO_PATTERNS.some(p => p.test(question));
  if (isYesNo) {
    score -= 25;
    issues.push('Yes/no questions are easy to guess (50% chance)');
    suggestions.push('Rephrase as an open-ended question (e.g., "What is..." or "Describe...")');
  }

  // ── Check 3: Generic patterns ──
  const isGeneric = GENERIC_PATTERNS.some(p => p.test(question));
  if (isGeneric) {
    score -= 15;
    issues.push('This is a very common question type that others might guess');
    suggestions.push('Ask about something more specific and personal to the item');
  }

  // ── Check 4: Answer quality ──
  if (answer.length <= 2) {
    score -= 20;
    issues.push('Answer is too short - easy to guess');
    suggestions.push('Use a more detailed answer (at least 3 characters)');
  } else if (answer.length <= 5) {
    score -= 10;
    issues.push('Short answers are easier to brute-force');
  } else if (answer.length >= 10) {
    score += 10; // Bonus for detailed answers
  }

  // ── Check 5: Answer in item description (guessable!) ──
  const descLower = itemDescription.toLowerCase();
  const ansLower = answer.toLowerCase().trim();
  if (ansLower.length > 2 && descLower.includes(ansLower)) {
    score -= 30;
    issues.push('CRITICAL: Your answer appears in the item description! Anyone can see it.');
    suggestions.push('Choose a secret that is NOT mentioned in your public item description');
  }

  // ── Check 6: Common/guessable answers ──
  const commonAnswers = ['yes', 'no', 'black', 'white', 'red', 'blue', 'green', '1', '2', '3', 'none', 'n/a'];
  if (commonAnswers.includes(ansLower)) {
    score -= 15;
    issues.push('This answer is very common and easy to guess');
    suggestions.push('Use a more unique and specific answer');
  }

  // ── Check 7: Vague words ──
  const hasVagueWords = TOO_VAGUE_WORDS.some(w => question.toLowerCase().includes(w));
  if (hasVagueWords) {
    score -= 10;
    issues.push('Question uses vague words');
    suggestions.push('Replace vague terms with specific details');
  }

  // ── Check 8: Good question patterns (bonus) ──
  const specificPatterns = [/how many/i, /describe/i, /last \d/i, /name (one|a|the)/i, /specific/i, /exact/i];
  const isSpecific = specificPatterns.some(p => p.test(question));
  if (isSpecific) {
    score += 15;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  let strength: StrengthLevel;
  if (score >= 65) strength = 'STRONG';
  else if (score >= 35) strength = 'MODERATE';
  else strength = 'WEAK';

  return {
    question_index: index,
    strength,
    score,
    issues,
    suggestions
  };
}

// ============================================
// REDUNDANCY CHECK
// ============================================

function checkRedundancy(questions: string[]): boolean {
  if (questions.length < 2) return false;

  // Spelling normalization (UK→US, common synonyms)
  const NORMALIZE_MAP: Record<string, string> = {
    'colour': 'color', 'colours': 'color', 'coloured': 'color', 'colored': 'color',
    'grey': 'gray', 'favourite': 'favorite', 'centre': 'center',
    'describe': 'detail', 'description': 'detail', 'explain': 'detail',
  };

  const normalizeWord = (w: string): string => NORMALIZE_MAP[w] || w;

  // Extract key topic words from each question
  const stopwords = new Set(['what', 'is', 'the', 'a', 'an', 'of', 'my', 'your', 'it', 'this', 'that', 'how', 'where', 'when', 'which', 'does', 'do', 'are', 'was', 'were', 'on', 'in', 'about', 'can', 'you', 'tell', 'me']);
  
  const topicSets = questions.map(q => {
    const words = q.toLowerCase().replace(/[?.,!]/g, '').split(/\s+/)
      .filter(w => !stopwords.has(w) && w.length > 2)
      .map(normalizeWord);
    return new Set(words);
  });

  // Check overlap between all pairs
  let highOverlapCount = 0;
  for (let i = 0; i < topicSets.length; i++) {
    for (let j = i + 1; j < topicSets.length; j++) {
      const intersection = [...topicSets[i]].filter(w => topicSets[j].has(w));
      const minSize = Math.min(topicSets[i].size, topicSets[j].size);
      if (minSize > 0 && intersection.length / minSize >= 0.5) {
        highOverlapCount++;
      }
    }
  }

  // If most question pairs have high overlap, flag redundancy
  const totalPairs = (questions.length * (questions.length - 1)) / 2;
  return highOverlapCount / totalPairs >= 0.5;
}

// ============================================
// API ENDPOINT HELPER
// ============================================

export function getTemplatesForCategory(category: string): QuestionTemplate[] {
  return QUESTION_TEMPLATES[category.toUpperCase()] || QUESTION_TEMPLATES['OTHER'];
}