import { DI } from 'aurelia';
import type { TransferKey } from './transfer.js';

/** Visible and announced text. Override any entry with `configure({ messages })`. */
export interface TransferListMessages {
  addSelected: string;
  addAll: string;
  removeSelected: string;
  removeAll: string;
  moveUp: string;
  moveDown: string;
  actions: string;
  empty: string;
  noMatches: string;
  filter(label: string): string;
  heading(label: string, shown: number, total: number): string;
  help(orderable: boolean): string;
  unavailable(key: TransferKey): string;
  added(count: number, targetLabel: string, total: number): string;
  removed(count: number, targetLabel: string, total: number): string;
  reordered(label: string, position: number, total: number): string;
  reorderedMany(count: number): string;
  deselected(count: number): string;
  cancelled: string;
  stale: string;
  disabled: string;
  noSelection(label: string): string;
  noneShown(label: string): string;
  limit(max: number, remaining: number): string;
  filtered: string;
  atTop: string;
  atBottom: string;
}
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);
export const defaultTransferListMessages: Readonly<TransferListMessages> = Object.freeze({
  addSelected: 'Add selected',
  addAll: 'Add all shown',
  removeSelected: 'Remove selected',
  removeAll: 'Remove all shown',
  moveUp: 'Move up',
  moveDown: 'Move down',
  actions: 'Transfer actions',
  empty: 'No items',
  noMatches: 'No matching items',
  filter: (label: string) => `Filter ${label}`,
  heading: (label: string, shown: number, total: number) =>
    shown === total ? `${label} (${total})` : `${label} (${shown} of ${total})`,
  help: (orderable: boolean) =>
    `Space selects, Shift with arrows extends the selection, Control or Command A selects all, Enter moves the selection to the other list${orderable ? ', Alt with Up or Down reorders' : ''}.`,
  unavailable: (key: TransferKey) => `Unavailable item (${String(key)})`,
  added: (count: number, label: string, total: number) => `${count} added. ${label}: ${total}.`,
  removed: (count: number, label: string, total: number) => `${count} removed. ${label}: ${total}.`,
  reordered: (label: string, position: number, total: number) =>
    `${label} moved to position ${position} of ${total}.`,
  reorderedMany: (count: number) => `${count} items moved.`,
  deselected: (count: number) =>
    `${count} hidden ${plural(count, 'item was', 'items were')} deselected.`,
  cancelled: 'Change cancelled.',
  stale: 'Change cancelled because the list changed.',
  disabled: 'The list is disabled.',
  noSelection: (label: string) => `Select items in ${label} first.`,
  noneShown: (label: string) => `No items are shown in ${label}.`,
  limit: (max: number, remaining: number) =>
    `At most ${max} can be selected; ${remaining} more can be added.`,
  filtered: 'Clear the filter to reorder.',
  atTop: 'Already at the top.',
  atBottom: 'Already at the bottom.',
});
export interface TransferListOptions {
  messages: Readonly<TransferListMessages>;
}
export const ITransferListOptions = DI.createInterface<Readonly<TransferListOptions>>(
  'ITransferListOptions',
  (x) => x.instance(Object.freeze({ messages: defaultTransferListMessages })),
);
