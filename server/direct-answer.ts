const ANSWER_REQUEST = [
  /\b(?:need|want|give(?:\s+me)?|just)\s+(?:an?\s+)?(?:an[ds]?wers?|advice|opinion|take)\b/i,
  /\b(?:need|want)\s+\w{0,4}wers\b/i,
  /\bjust tell me\b/i,
  /\btell me what (?:to do|you think)\b/i,
  /\bwhat(?:'s| is) (?:your|the) (?:take|advice|opinion|answer|call)\b/i,
  /\bwhat (?:should|do) i (?:do|say|decide)\b/i,
  /\b(?:stop|quit|don't|dont|can't|cant|do not)\b.{0,24}\b(?:keep\s+)?ask(?:ing)?\b/i,
  /\bno more questions\b/i,
  /\bdon't ask(?: me)?\b/i,
];

export function userRequestsDirectAnswer(content: string): boolean {
  return ANSWER_REQUEST.some((pattern) => pattern.test(content));
}

export function dropTrailingQuestion(reply: string): string {
  const trimmed = reply.trim();
  const withoutQuestion = trimmed.match(/^(.*?[.!])["')\]]?(?:\n\s*\n|\s+)[A-Z][^.!?]*\?\s*$/s)?.[1]?.trim();
  return withoutQuestion || trimmed;
}

export function applyDirectAnswerPreference<T extends { reply: string; followUpQuestion: string }>(
  output: T,
  request: { messages: Array<{ role: string; content: string }> },
): T {
  const latest = request.messages.at(-1);
  if (!latest || latest.role !== 'user' || !userRequestsDirectAnswer(latest.content)) {
    return output;
  }

  return {
    ...output,
    followUpQuestion: '',
    reply: dropTrailingQuestion(output.reply),
  };
}
