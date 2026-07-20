export type SafetyAction = 'continue' | 'crisis' | 'emergency' | 'abuse';

export type SafetyDecision = {
  action: SafetyAction;
  reason?: 'self_harm' | 'violence' | 'medical_emergency' | 'abuse';
};

const patterns: Array<{ reason: NonNullable<SafetyDecision['reason']>; action: SafetyAction; pattern: RegExp }> = [
  {
    reason: 'self_harm',
    action: 'crisis',
    pattern: /\b(?:suicid(?:e|al)|kill myself|end my life|hurt myself|harm myself|self[- ]?harm|don't want to (?:be alive|live)|do not want to (?:be alive|live)|better off dead|no reason to live)\b/i,
  },
  {
    reason: 'violence',
    action: 'emergency',
    pattern: /\b(?:kill (?:him|her|them|someone)|hurt (?:him|her|them|someone)|attack (?:him|her|them|someone)|shoot (?:him|her|them|someone))\b/i,
  },
  {
    reason: 'medical_emergency',
    action: 'emergency',
    pattern: /\b(?:can't breathe|cannot breathe|chest pain|overdos(?:e|ed|ing)|severe bleeding|unconscious|having a seizure)\b/i,
  },
  {
    reason: 'abuse',
    action: 'abuse',
    pattern: /\b(?:being abused|hits me|hit me again|threatened to kill me|not safe at home|forced me to have sex)\b/i,
  },
];

export function classifySafety(text: string): SafetyDecision {
  for (const candidate of patterns) {
    if (candidate.pattern.test(text)) {
      return { action: candidate.action, reason: candidate.reason };
    }
  }

  return { action: 'continue' };
}

export function safetyReply(decision: SafetyDecision): string {
  if (decision.reason === 'self_harm') {
    return 'You deserve support from a real person right now. Please contact emergency services or someone you trust who can be with you. If you are in immediate danger in India, call 112.';
  }

  if (decision.reason === 'abuse') {
    return 'Your immediate safety matters most. If it is safe to do so, move to a place with other people and contact someone you trust or local emergency services. In India, call 112 for immediate danger.';
  }

  return 'This may be an emergency. Please stop using the app and contact local emergency services now. In India, call 112.';
}
