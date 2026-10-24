import { IContainer, Registration } from 'aurelia';
import { AuMentionList } from './mention-list.js';
import { MentionsAttribute } from './mentions.js';
import { defaultMentionsOptions, IMentionsOptions, type MentionsOptions } from './state.js';

export { getCaretRect } from './caret.js';
export { AuMentionList } from './mention-list.js';
export { MentionsAttribute } from './mentions.js';
export {
  defaultMentionsOptions,
  IMentionsOptions,
  MentionState,
  type MentionAnchor,
  type MentionBeforeInsertDetail,
  type MentionInsertDetail,
  type MentionItem,
  type MentionRemoveDetail,
  type MentionsOptions,
  type MentionStateController,
  type MentionTrigger,
} from './state.js';
export {
  DEFAULT_MAX_QUERY_LENGTH,
  findTextEdit,
  findTrigger,
  normalizeMentions,
  rebaseMentions,
  shiftMentions,
  type MentionEntity,
  type MentionRange,
  type RebaseResult,
  type TextEdit,
  type TriggerMatch,
  type TriggerRule,
} from './text.js';

function configure(options: Partial<MentionsOptions> = {}) {
  const value: Readonly<MentionsOptions> = Object.freeze({ ...defaultMentionsOptions, ...options });
  for (const key of ['maxResults', 'maxQueryLength', 'debounce'] as const)
    if (!Number.isInteger(value[key]) || value[key] < 0)
      throw new TypeError(`Mentions option ${key} must be a non-negative integer`);
  if (typeof value.appendSpace !== 'boolean')
    throw new TypeError('Mentions option appendSpace must be a boolean');
  return {
    register(container: IContainer) {
      return container.register(
        Registration.instance(IMentionsOptions, value),
        MentionsAttribute,
        AuMentionList,
      );
    },
  };
}
export const AureliaMentionsConfiguration = { ...configure(), configure };
