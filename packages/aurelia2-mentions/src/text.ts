/** A half-open UTF-16 range: `text.slice(start, end)`. */
export interface MentionRange {
  start: number;
  end: number;
}
/** A resolved mention inside the text. Offsets are UTF-16 code units, the same as JavaScript string indices. */
export interface MentionEntity extends MentionRange {
  /** The trigger character that produced the mention, e.g. `@`. */
  trigger: string;
  id: string;
  label: string;
  /** The exact inserted text, equal to `text.slice(start, end)`. */
  text: string;
}
/**
 * One text replacement: `previous[start, removedEnd)` became `next[start, insertedEnd)`.
 * A pure insertion has `removedEnd === start`; a pure deletion has `insertedEnd === start`.
 */
export interface TextEdit {
  start: number;
  removedEnd: number;
  insertedEnd: number;
}
export interface TriggerRule {
  /** A single non-whitespace, non-word character. */
  char: string;
  allowSpaces?: boolean;
  startOfLineOnly?: boolean;
  maxQueryLength?: number;
}
export interface TriggerMatch extends MentionRange {
  /** Index of the matching rule in the rules passed to `findTrigger`. */
  trigger: number;
  char: string;
  /** Text between the trigger character and the caret. */
  query: string;
}
export interface RebaseResult<T> {
  mentions: T[];
  removed: T[];
}

export const DEFAULT_MAX_QUERY_LENGTH = 50;
const WORD = /[\p{L}\p{N}\p{M}_]/u;
const SPACE = /\s/;
const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;
const isBreak = (char: string) => char === '\n' || char === '\r';

function charBefore(text: string, index: number): string {
  if (index <= 0) return '';
  if (index >= 2 && isLow(text.charCodeAt(index - 1)) && isHigh(text.charCodeAt(index - 2)))
    return text.slice(index - 2, index);
  return text[index - 1];
}

/**
 * Find the trigger that owns the caret. The nearest trigger character before the caret decides:
 * it must start the text, follow whitespace or punctuation (so `ana@example.com` never matches),
 * and with `startOfLineOnly` it must start a line. Queries never cross a line break, contain
 * whitespace only with `allowSpaces` (never leading or doubled), and may not overlap `exclude`.
 */
export function findTrigger(
  text: string,
  caret: number,
  rules: readonly TriggerRule[],
  exclude: readonly MentionRange[] = [],
): TriggerMatch | null {
  if (!rules.length || !Number.isInteger(caret) || caret < 0 || caret > text.length) return null;
  const limit = Math.max(...rules.map((rule) => rule.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH));
  const spaces = rules.some((rule) => rule.allowSpaces);
  let space = false;
  for (let index = caret - 1; index >= 0 && caret - index - 1 <= limit; index--) {
    const char = text[index];
    if (isBreak(char)) return null;
    const trigger = rules.findIndex((rule) => rule.char === char);
    if (trigger >= 0) {
      const rule = rules[trigger];
      const query = text.slice(index + 1, caret);
      if (space && !rule.allowSpaces) return null;
      if (rule.allowSpaces && (SPACE.test(query[0] ?? '') || /\s\s/.test(query))) return null;
      if (query.length > (rule.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH)) return null;
      const before = charBefore(text, index);
      if (rule.startOfLineOnly ? before !== '' && !isBreak(before) : WORD.test(before)) return null;
      if (exclude.some((range) => index < range.end && range.start < caret)) return null;
      return { trigger, char, start: index, end: caret, query };
    }
    if (SPACE.test(char)) {
      if (!spaces) return null;
      space = true;
    }
  }
  return null;
}

/**
 * Describe how `previous` became `next` as one replacement, using the longest shared prefix and
 * suffix. `caret`, when known, is the caret in `next` after a user edit; it disambiguates edits in
 * repeated text. The result never splits a surrogate pair. Returns `null` when the texts are equal.
 */
export function findTextEdit(previous: string, next: string, caret?: number): TextEdit | null {
  if (previous === next) return null;
  const shortest = Math.min(previous.length, next.length);
  const suffixLimit =
    caret !== undefined && Number.isInteger(caret) && caret >= 0 && caret <= next.length
      ? Math.min(shortest, next.length - caret)
      : shortest;
  let suffix = 0;
  while (
    suffix < suffixLimit &&
    previous.charCodeAt(previous.length - 1 - suffix) === next.charCodeAt(next.length - 1 - suffix)
  )
    suffix++;
  if (suffix > 0 && isLow(previous.charCodeAt(previous.length - suffix))) suffix--;
  let prefix = 0;
  const prefixLimit = shortest - suffix;
  while (prefix < prefixLimit && previous.charCodeAt(prefix) === next.charCodeAt(prefix)) prefix++;
  if (prefix > 0 && isHigh(previous.charCodeAt(prefix - 1))) prefix--;
  return { start: prefix, removedEnd: previous.length - suffix, insertedEnd: next.length - suffix };
}

function shiftRange<T extends MentionRange>(mention: T, edit: TextEdit): T | null {
  if (edit.removedEnd <= mention.start) {
    const delta = edit.insertedEnd - edit.removedEnd;
    return { ...mention, start: mention.start + delta, end: mention.end + delta };
  }
  return edit.start >= mention.end ? { ...mention } : null;
}

/**
 * Apply one edit to ranges. Ranges entirely before or after the edit survive (shifted when after);
 * an insertion exactly at a range's start shifts it, and one exactly at its end leaves it alone.
 * Any other overlap removes the range. Survivors are copies; `removed` holds the originals.
 */
export function shiftMentions<T extends MentionRange>(
  mentions: readonly T[],
  edit: TextEdit,
): RebaseResult<T> {
  const result: RebaseResult<T> = { mentions: [], removed: [] };
  for (const mention of mentions) {
    const moved = shiftRange(mention, edit);
    if (moved) result.mentions.push(moved);
    else result.removed.push(mention);
  }
  return result;
}

/**
 * Rebase ranges from `previous` to `next`. Mentions that carry `text` are also removed when the
 * rebased range no longer contains exactly that text.
 */
export function rebaseMentions<T extends MentionRange & { text?: string }>(
  previous: string,
  next: string,
  mentions: readonly T[],
  caret?: number,
): RebaseResult<T> {
  const edit = findTextEdit(previous, next, caret);
  const result: RebaseResult<T> = { mentions: [], removed: [] };
  for (const mention of mentions) {
    const moved = edit ? shiftRange(mention, edit) : { ...mention };
    if (moved && (moved.text === undefined || next.slice(moved.start, moved.end) === moved.text))
      result.mentions.push(moved);
    else result.removed.push(mention);
  }
  return result;
}

/**
 * Validate mentions supplied from outside against `text`. Entries must have string `trigger`,
 * `id` and `label`, integer offsets inside the text, and a `text` matching the range (when `text`
 * is omitted it is taken from the range). Results are sorted copies; overlapping entries after
 * the first are removed.
 */
export function normalizeMentions(
  text: string,
  mentions: readonly unknown[] | null | undefined,
): RebaseResult<MentionEntity> & { invalid: unknown[] } {
  const result = {
    mentions: [] as MentionEntity[],
    removed: [] as MentionEntity[],
    invalid: [] as unknown[],
  };
  const candidates: MentionEntity[] = [];
  for (const value of Array.isArray(mentions) ? mentions : []) {
    const entry = value as Partial<MentionEntity> | null;
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.trigger !== 'string' ||
      typeof entry.id !== 'string' ||
      typeof entry.label !== 'string' ||
      !Number.isInteger(entry.start) ||
      !Number.isInteger(entry.end)
    ) {
      result.invalid.push(value);
      continue;
    }
    const mention: MentionEntity = {
      trigger: entry.trigger,
      id: entry.id,
      label: entry.label,
      start: entry.start!,
      end: entry.end!,
      text: typeof entry.text === 'string' ? entry.text : text.slice(entry.start, entry.end),
    };
    if (
      mention.start < 0 ||
      mention.end <= mention.start ||
      mention.end > text.length ||
      text.slice(mention.start, mention.end) !== mention.text
    )
      result.removed.push(mention);
    else candidates.push(mention);
  }
  candidates.sort((a, b) => a.start - b.start || a.end - b.end);
  let end = 0;
  for (const mention of candidates) {
    if (mention.start < end) result.removed.push(mention);
    else {
      result.mentions.push(mention);
      end = mention.end;
    }
  }
  return result;
}
