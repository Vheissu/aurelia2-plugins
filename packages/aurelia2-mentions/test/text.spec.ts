import {
  findTextEdit,
  findTrigger,
  normalizeMentions,
  rebaseMentions,
  type MentionEntity,
} from '../src/index';

const mention = (start: number, text: string, id = text): MentionEntity => ({
  trigger: '@',
  id,
  label: text.slice(1),
  text,
  start,
  end: start + text.length,
});
const at = [{ char: '@' }];

describe('findTextEdit', () => {
  it('describes insertions, deletions and replacements as one range', () => {
    expect(findTextEdit('abc', 'abc')).toBeNull();
    expect(findTextEdit('ac', 'abc')).toEqual({ start: 1, removedEnd: 1, insertedEnd: 2 });
    expect(findTextEdit('abc', 'ac')).toEqual({ start: 1, removedEnd: 2, insertedEnd: 1 });
    expect(findTextEdit('hello world', 'hello there')).toEqual({
      start: 6,
      removedEnd: 11,
      insertedEnd: 11,
    });
  });

  it('uses the caret to place edits inside repeated text', () => {
    expect(findTextEdit('aa', 'aaa')).toEqual({ start: 0, removedEnd: 0, insertedEnd: 1 });
    expect(findTextEdit('aa', 'aaa', 3)).toEqual({ start: 2, removedEnd: 2, insertedEnd: 3 });
    expect(findTextEdit('aa', 'aaa', 2)).toEqual({ start: 1, removedEnd: 1, insertedEnd: 2 });
  });

  it('never splits a surrogate pair', () => {
    // 😀 and 😁 share their high surrogate.
    expect(findTextEdit('a😀b', 'a😁b')).toEqual({ start: 1, removedEnd: 3, insertedEnd: 3 });
    expect(findTextEdit('😀', '😀😀')).toEqual({ start: 0, removedEnd: 0, insertedEnd: 2 });
    expect(findTextEdit('😀😀', '😀😁', 4)).toEqual({ start: 2, removedEnd: 4, insertedEnd: 4 });
  });
});

describe('rebaseMentions', () => {
  const text = 'Hi @Ana and @Bo!';
  const ana = mention(3, '@Ana');
  const bo = mention(12, '@Bo');

  it('shifts mentions after an edit and leaves earlier ones untouched', () => {
    const result = rebaseMentions(text, 'Hi @Ana, and @Bo!', [ana, bo]);
    expect(result.mentions).toEqual([ana, { ...bo, start: 13, end: 16 }]);
    expect(result.removed).toEqual([]);
    const prefixed = rebaseMentions(text, `Re: ${text}`, [ana, bo]);
    expect(prefixed.mentions.map((m) => m.start)).toEqual([7, 16]);
  });

  it('keeps a mention when typing touches its boundaries but not its text', () => {
    expect(rebaseMentions(text, 'Hi x@Ana and @Bo!', [ana], 4).mentions).toEqual([
      { ...ana, start: 4, end: 8 },
    ]);
    expect(rebaseMentions(text, 'Hi @Anax and @Bo!', [ana], 8).mentions).toEqual([ana]);
  });

  it('removes a mention edited inside and returns the original object', () => {
    const result = rebaseMentions(text, 'Hi @Anna and @Bo!', [ana, bo], 6);
    expect(result.removed).toEqual([ana]);
    expect(result.removed[0]).toBe(ana);
    expect(result.mentions).toEqual([{ ...bo, start: 13, end: 16 }]);
  });

  it('removes every mention a deletion or paste crosses', () => {
    expect(rebaseMentions(text, 'Hi @A!', [ana, bo], 5)).toEqual({
      mentions: [],
      removed: [ana, bo],
    });
    expect(rebaseMentions(text, 'Hi pasted @Bo!', [ana, bo], 9).removed).toEqual([ana]);
  });

  it('counts offsets in UTF-16 units across emoji', () => {
    const result = rebaseMentions(text, `👋 ${text}`, [ana, bo], 3);
    expect(result.mentions.map((m) => [m.start, m.end])).toEqual([
      [6, 10],
      [15, 18],
    ]);
    const next = `👋 ${text}`;
    expect(next.slice(result.mentions[0].start, result.mentions[0].end)).toBe('@Ana');
  });

  it('drops a rebased mention whose range no longer contains its text', () => {
    const stale = { ...ana, text: '@Anna' };
    expect(rebaseMentions(text, `${text} `, [stale]).removed).toEqual([stale]);
  });
});

describe('findTrigger', () => {
  it('opens at the start, after whitespace and after punctuation', () => {
    expect(findTrigger('@an', 3, at)).toEqual({
      trigger: 0,
      char: '@',
      start: 0,
      end: 3,
      query: 'an',
    });
    expect(findTrigger('hi @an', 6, at)?.query).toBe('an');
    expect(findTrigger('(@an', 4, at)?.start).toBe(1);
    expect(findTrigger('hi @', 4, at)?.query).toBe('');
  });

  it('ignores triggers inside words such as email addresses', () => {
    expect(findTrigger('ana@example', 11, at)).toBeNull();
    expect(findTrigger('@ana@ex', 7, at)).toBeNull();
  });

  it('applies allowSpaces, line breaks, query length and startOfLineOnly', () => {
    expect(findTrigger('@ana smi', 8, at)).toBeNull();
    expect(findTrigger('@ana smi', 8, [{ char: '@', allowSpaces: true }])?.query).toBe('ana smi');
    expect(findTrigger('@ ana', 5, [{ char: '@', allowSpaces: true }])).toBeNull();
    expect(findTrigger('@ana  s', 7, [{ char: '@', allowSpaces: true }])).toBeNull();
    expect(findTrigger('@an\nx', 5, at)).toBeNull();
    expect(findTrigger('@abcdef', 7, [{ char: '@', maxQueryLength: 5 }])).toBeNull();
    const slash = [{ char: '/', startOfLineOnly: true }];
    expect(findTrigger('/gi', 3, slash)?.query).toBe('gi');
    expect(findTrigger('a\n/gi', 5, slash)?.start).toBe(2);
    expect(findTrigger('see /gi', 7, slash)).toBeNull();
  });

  it('uses the nearest trigger and skips existing mentions', () => {
    const rules = [{ char: '@' }, { char: '#' }];
    expect(findTrigger('@a #12', 6, rules)).toMatchObject({ trigger: 1, query: '12' });
    expect(findTrigger('@Ana', 4, at, [{ start: 0, end: 4 }])).toBeNull();
    expect(findTrigger('@Ana @b', 7, at, [{ start: 0, end: 4 }])?.query).toBe('b');
    expect(findTrigger('@an', 4, at)).toBeNull();
  });
});

describe('normalizeMentions', () => {
  it('sorts copies, derives text, and removes mismatched or overlapping entries', () => {
    const text = '@Ana and @Bo';
    const bo = { trigger: '@', id: 'b', label: 'Bo', start: 9, end: 12 };
    const ana = mention(0, '@Ana', 'a');
    const result = normalizeMentions(text, [
      bo,
      ana,
      { ...ana, id: 'dup' },
      mention(5, '@x'),
      null,
    ]);
    expect(result.mentions).toEqual([ana, { ...bo, text: '@Bo' }]);
    expect(result.mentions[0]).not.toBe(ana);
    expect(result.removed.map((m) => m.id)).toEqual(['@x', 'dup']);
    expect(result.invalid).toEqual([null]);
    expect(normalizeMentions(text, undefined).mentions).toEqual([]);
  });
});
