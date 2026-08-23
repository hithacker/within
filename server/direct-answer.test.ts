import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyDirectAnswerPreference,
  dropTrailingQuestion,
  userRequestsDirectAnswer,
} from './direct-answer.js';

describe('userRequestsDirectAnswer', () => {
  it('detects the frustrated request for answers from the product screenshot', () => {
    assert.equal(userRequestsDirectAnswer('Dude like i need andwers also. U cant keep asking me'), true);
  });

  it('detects ordinary requests for a take', () => {
    assert.equal(userRequestsDirectAnswer('I need answers, not more questions.'), true);
    assert.equal(userRequestsDirectAnswer('Just tell me what to do about this.'), true);
    assert.equal(userRequestsDirectAnswer('What should I do here?'), true);
    assert.equal(userRequestsDirectAnswer('Stop asking me how I feel.'), true);
  });

  it('does not treat ordinary sharing as a request for answers', () => {
    assert.equal(userRequestsDirectAnswer('My wife thinks I have a crush on my best friend.'), false);
    assert.equal(userRequestsDirectAnswer('I keep asking myself if I handled that well.'), false);
  });
});

describe('dropTrailingQuestion', () => {
  it('removes a trailing question while keeping the working take', () => {
    assert.equal(
      dropTrailingQuestion('Your wife may be reacting to distance, not proof of an affair. What do you think might help?'),
      'Your wife may be reacting to distance, not proof of an affair.',
    );
    assert.equal(
      dropTrailingQuestion('The accusations have taken a toll.\n\nWhat feels most difficult right now?'),
      'The accusations have taken a toll.',
    );
  });

  it('keeps a reply that is only a question', () => {
    assert.equal(dropTrailingQuestion('What happened next?'), 'What happened next?');
  });
});

describe('applyDirectAnswerPreference', () => {
  it('clears a follow-up question when the user asked for answers', () => {
    const result = applyDirectAnswerPreference({
      reply: 'The accusations have taken a toll. What feels most difficult right now?',
      followUpQuestion: 'What feels most difficult right now?',
    }, {
      messages: [{
        role: 'user',
        content: 'Dude like i need andwers also. U cant keep asking me',
      }],
    });

    assert.equal(result.followUpQuestion, '');
    assert.equal(result.reply, 'The accusations have taken a toll.');
  });

  it('leaves ordinary exploratory replies unchanged', () => {
    const output = {
      reply: 'The deadline change may not be laziness.',
      followUpQuestion: 'What changed after the original estimate?',
    };

    assert.deepEqual(applyDirectAnswerPreference(output, {
      messages: [{ role: 'user', content: 'The project deadline slipped after another scope change.' }],
    }), output);
  });
});
