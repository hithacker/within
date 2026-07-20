import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifySafety } from './safety.js';

describe('classifySafety', () => {
  it('routes explicit self-harm language to crisis support', () => {
    assert.deepEqual(classifySafety("I don't want to live anymore"), { action: 'crisis', reason: 'self_harm' });
  });

  it('routes medical emergencies away from conversation', () => {
    assert.deepEqual(classifySafety('I have chest pain and cannot breathe'), { action: 'emergency', reason: 'medical_emergency' });
  });

  it('does not flag ordinary emotional reflection', () => {
    assert.deepEqual(classifySafety('I feel ignored after arguments with my partner'), { action: 'continue' });
  });
});
