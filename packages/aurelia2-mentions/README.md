# aurelia2-mentions

`@`-mentions, `#`-references and `/`-commands inside free text. Add the `mentions` attribute to a `<textarea>` or text `<input>` next to `value.bind`. When the user types a trigger character, the attribute runs that trigger's search and opens a suggestion list at the cursor. The chosen item is inserted as plain text, and a `mentions` array records where each inserted mention sits in the text. If the text later changes, the offsets are recalculated. If an edit changes a mention's own text, that mention is dropped. That way, a submitted comment never pairs an id with text that no longer says it.

`aurelia2-autocomplete` is different: it treats the whole field as the query, and the selection becomes the value. Here, the value is still the text the user typed.

```sh
npm install aurelia2-mentions
```

```ts
import Aurelia from 'aurelia';
import { AureliaMentionsConfiguration, type MentionEntity, type MentionState, type MentionTrigger } from 'aurelia2-mentions';

Aurelia.register(AureliaMentionsConfiguration);

export class CommentBox {
  text = '';
  mentions: MentionEntity[] = [];
  mentionState?: MentionState;
  triggers: MentionTrigger[] = [
    {
      char: '@',
      search: async (query, signal) => {
        const response = await fetch(`/api/people?q=${encodeURIComponent(query)}`, { signal });
        if (!response.ok) throw new Error('People search failed');
        return response.json(); // [{ id, label, description?, disabled? }]
      },
      debounce: 120,
    },
    { char: '#', search: (query) => this.findTickets(query), format: (ticket) => `#${ticket.id}` },
    { char: '/', search: (query) => this.findCommands(query), startOfLineOnly: true },
  ];
  submit() {
    return fetch('/api/comments', { method: 'POST', body: JSON.stringify({ text: this.text, mentions: this.mentions }) });
  }
}
```

```html
<label for="comment">Comment</label>
<textarea id="comment" value.bind="text"
  mentions="triggers.bind: triggers; mentions.two-way: mentions; state.from-view: mentionState"></textarea>
<au-mention-list state.bind="mentionState" label="People and tickets">
  <template au-slot="item">${$host.item.label} <small>${$host.item.description}</small></template>
</au-mention-list>
```

Choosing "Ana Smith" after typing `@an` replaces `@an` with `@Ana Smith ` and adds this entry to `mentions`:

```json
{ "trigger": "@", "id": "u1", "label": "Ana Smith", "text": "@Ana Smith", "start": 0, "end": 10 }
```

## Offsets

`start` and `end` are **UTF-16 code-unit offsets**: JavaScript string indices, so `text.slice(start, end) === mention.text`. An emoji counts as two units. Servers in other languages must convert, for example Python's `len()` counts code points. Edits never split a surrogate pair.

The attribute recalculates offsets for both user input and text changed through the binding:

- Edits before a mention shift it. Edits after it leave it alone, and so does typing directly before its first character or directly after its last.
- An edit that touches the mention's own characters removes the mention. The text stays as typed, and the field dispatches `mention-remove`.
- The changed range is found from the text the two versions share at the start and the end. For user input, the caret position settles ambiguous cases in repeated text. A change pushed from the view model has no caret, so in repeated text it may be placed at a different, equally valid position. Every remaining mention still matches its `text`.
- Assign a new `mentions` array; changes made inside the existing array aren't observed. Saved mentions are checked against the field text at the end of the turn in which you assign them, so assign `text` and `mentions` together. Entries whose range doesn't hold their `text` are dropped, along with entries that overlap an earlier one; each dropped entry raises `mention-remove` with reason `invalid`. Entries missing `trigger`, `id`, `label` or integer offsets are dropped without an event. If `text` is omitted, it is taken from the range.

Text written directly to `field.value` by code outside Aurelia raises no event. The attribute picks it up at the next input, key press or click and treats it like a binding change.

## Triggers

| Option | Default | Meaning |
| --- | --- | --- |
| `char` | required | One character that isn't whitespace, a letter, a digit or `_`. Each character can be used by only one trigger. |
| `search(query, signal)` | required | Returns items, either directly or as a promise. Each item needs a non-empty string `id` and a string `label`; `description` and `disabled` are optional. |
| `format(item)` | `char + label` | The text to insert. It must be a non-empty string. |
| `minLength` | `0` | The minimum query length before a search runs. |
| `maxResults` | `10` | Results beyond this number are discarded. |
| `maxQueryLength` | `50` | Longer queries close the list. |
| `allowSpaces` | `false` | Lets the query contain single spaces, e.g. `@Ana Sm`. A query can't start with a space or contain two in a row. |
| `startOfLineOnly` | `false` | The trigger counts only at the start of the text or straight after a line break. |
| `debounce` | `0` | How long to wait, in milliseconds, after the last keystroke before searching. |
| `appendSpace` | `true` | Adds a space after the inserted text, unless whitespace already follows it. |

A trigger counts only at the start of the text or after whitespace or punctuation, so `ana@example.com` doesn't open the list. The trigger character closest before the caret decides. Queries never span a line break, and a trigger inside an existing mention is ignored. The replaced range runs from the trigger to the caret; text after the caret is kept.

Search is cancellable. Each search gets its own `AbortSignal`. A search is aborted when a newer query replaces it, when the list closes, when its trigger changes, or when the attribute detaches. Late responses are discarded even if your function ignores the signal. A thrown or rejected search stores the error in `state.error`, and the list shows `errorText`. Errors never become unhandled rejections and are never logged. You can replace the `triggers` array or edit it in place, including swapping a trigger's `search`; either way the open query is aborted and run again with the new rules. An invalid or duplicate trigger throws a `TypeError`.

## Keyboard, pointer and composition

| Key, while the list is open | Action |
| --- | --- |
| Down / Up | Next / previous enabled option, wrapping around |
| Enter / Tab | Insert the active option |
| Escape | Close the list and keep the text. The same query won't reopen it, but typing a different one will. |
| Shift+Tab | Close the list and move focus as normal |

While the list is closed, the attribute handles no keys at all, so Enter, Tab, Escape and the arrow keys behave as normal. While a newer search is still loading, Enter is consumed and inserts nothing: the visible results belong to an older query. Clicking a visible option still inserts it. If the list is open but has no enabled option, Enter and Tab work as normal.

Options cancel `pointerdown` and `mousedown`, so focus stays in the field. Hovering an option makes it active, and clicking inserts it. Disabled items are shown with `aria-disabled="true"`, but they're skipped by the arrow keys and can't be inserted.

Nothing is intercepted while an input method is composing text (between `compositionstart` and `compositionend`, or when a key event has `isComposing` or `keyCode` 229). During composition, offsets are still recalculated, but no search runs. Triggers are checked again once composition ends. On Android, many keyboards send keyCode 229 for every key. There the arrow keys and Enter go to the field as normal, and the user picks an item by tapping it. Android behavior is best effort and hasn't been verified on devices.

## Inserting text

Insertion calls `setRangeText` and then dispatches a bubbling `input` event (`inputType: 'insertReplacementText'`), so `value.bind` and any `input.trigger` handlers see the new text. The plugin doesn't use `document.execCommand`. **The browser's native undo history isn't guaranteed to survive an insertion**: in some browsers, Ctrl/Cmd+Z after an insertion skips it or clears earlier steps. This hasn't been verified in any browser. Insertion respects `maxlength` (including any appended space) and rechecks disabled/readonly state after before-insert handlers. A length rejection leaves the text unchanged, returns false, and exposes a message in `state.insertionError` and the suggestion live region.

| Event (on the field, bubbles) | Detail | Notes |
| --- | --- | --- |
| `mention-before-insert` | `{ mention, item, query, replace: { start, end } }` | Cancellable. If the handler changes the text, moves the caret or closes the list, the insert is abandoned. |
| `mention-insert` | `{ mention, item }` | Dispatched after the `input` event, so bound values are already up to date. |
| `mention-remove` | `{ mention, reason: 'edit' \| 'external' \| 'invalid' }` | `edit`: the user changed the mention. `external`: the bound text changed. `invalid`: supplied mentions didn't match the text. |

Each `mention` in an event detail is a copy. `item` is the object your search returned.

## State and `au-mention-list`

`state.from-view` publishes one `MentionState` for each attribute instance. You can render it with `au-mention-list` or with your own markup. Its properties can be observed: `open`, `trigger`, `query`, `range`, `items`, `activeIndex`, `activeId`, `loading`, `error`, `anchor` (viewport `{ top, bottom, left, height }` of the trigger character) and `listboxId`. Its methods are `optionId(index)`, `select(index)`, `activate(index)` and `close()`. Change the state only through these methods.

`au-mention-list` takes these bindables:

- `state`
- `label` (the listbox's accessible name, default "Suggestions")
- `loading-text`, `empty-text` and `error-text`
- `count-text` (a function from a count to an announcement)
- `position`: `caret` (the default) or `none`

The `item` slot exposes `$host.item`, `$host.index`, `$host.active`, `$host.query` and `$host.trigger`. The default content is the label, followed by the description. Labels are always rendered as text and never as HTML.

The element doesn't ship any CSS. It renders these classes, which you need to style:

- `.au-mention-list`: the popup.
- `.au-mention-list__options`: the listbox.
- `.au-mention-list__option`: each option. The active one has `[data-active]` and `aria-selected="true"`.
- `.au-mention-list__message`: the loading, empty and error messages, told apart by `[data-kind]`.

The status live region is visually hidden with inline styles.

```css
.au-mention-list { z-index: 20; min-width: 14rem; max-height: 16rem; overflow: auto; background: Canvas; color: CanvasText; border: 1px solid GrayText; }
.au-mention-list__option[data-active] { background: Highlight; color: HighlightText; }
.au-mention-list__option[aria-disabled="true"] { opacity: .5; }
```

## Accessibility

- A `<textarea>` keeps its textbox role, because `role="combobox"` would present it as a single-line field. It gets `aria-autocomplete="list"`, and while the list is open it also gets `aria-controls` and `aria-activedescendant`.
- An `<input>` gets `role="combobox"`, `aria-autocomplete="list"` and `aria-expanded`.
- When the attribute detaches, every ARIA attribute it changed is set back to the value it had before. That includes a `role` or `aria-controls` that was already there.
- The live region in `au-mention-list` announces result counts, loading, empty results and errors.
- How well screen readers support `aria-activedescendant` on a textarea varies. These semantics follow WAI-ARIA, but they've been tested only in jsdom, not with VoiceOver, NVDA or JAWS.

## Positioning

With `position="caret"`, the popup uses `position: fixed` at the trigger's viewport coordinates. If there isn't room below, it flips above. It is kept inside the viewport horizontally, and it is placed again when the page scrolls or the window resizes.

The coordinates come from a hidden copy of the field that duplicates its font, padding, borders, wrapping, scroll offset and text direction (`getCaretRect` is exported). This is an approximation:

- It ignores CSS transforms on ancestors. Inside a transformed ancestor, `position: fixed` is relative to that ancestor instead of the viewport.
- In mixed-direction text, the result can be off.
- An `<input>` scrolled horizontally is measured approximately.

In those cases, or to keep the popup inside a dialog, use `position="none"` and position `.au-mention-list` with your own CSS.

## Configuration

`AureliaMentionsConfiguration.configure({ maxResults, maxQueryLength, debounce, appendSpace })` sets defaults for triggers that don't set their own. The options are copied and frozen for each registration. Invalid values throw a `TypeError`.

## Exports

- **Registration and resources:** `AureliaMentionsConfiguration`, `MentionsAttribute` (`mentions`), `AuMentionList` (`au-mention-list`), `MentionState`, `IMentionsOptions`, `defaultMentionsOptions`.
- **Pure helpers** for server code or custom editors:
  - `findTrigger(text, caret, rules, exclude?)`
  - `findTextEdit(previous, next, caret?)`
  - `shiftMentions(mentions, edit)`
  - `rebaseMentions(previous, next, mentions, caret?)`
  - `normalizeMentions(text, mentions)`
  - `getCaretRect(field, index)`
  - `DEFAULT_MAX_QUERY_LENGTH`
- **Types:** `MentionTrigger`, `MentionItem`, `MentionEntity`, `MentionRange`, `TextEdit`, `TriggerRule`, `TriggerMatch`, `RebaseResult`, `MentionsOptions`, `MentionAnchor`, `MentionBeforeInsertDetail`, `MentionInsertDetail`, `MentionRemoveDetail`, `MentionStateController`.

## Not supported in v0.1

- `contenteditable` and rich-text editors, including Froala.
- `<input>` types other than text, search, url, tel and password.
- Highlighting mentions inside the field.
- A markup format for storing mentions.
- Offsets counted in code points.
- Fuzzy ranking: your search function orders the results.
- Exact cursor placement in mixed-direction text.
- Trigger strings longer than one character.

Requires Aurelia `^2.0.0-rc.2`. Build with `npm run build -w aurelia2-mentions`; test with `npm test -w aurelia2-mentions -- --runInBand`.
