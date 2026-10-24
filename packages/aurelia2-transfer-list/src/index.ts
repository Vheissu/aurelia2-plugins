import { IContainer, Registration } from 'aurelia';
import {
  defaultTransferListMessages,
  ITransferListOptions,
  type TransferListMessages,
  type TransferListOptions,
} from './messages.js';
import { AuTransferList } from './transfer-list.js';

export {
  defaultTransferListMessages,
  ITransferListOptions,
  type TransferListMessages,
  type TransferListOptions,
} from './messages.js';
export {
  AuTransferList,
  TransferPane,
  type TransferAction,
  type TransferRow,
  type TransferSide,
} from './transfer-list.js';
export {
  isTransferKey,
  reorderKeys,
  transfer,
  type TransferChange,
  type TransferDirection,
  type TransferKey,
  type TransferLimit,
} from './transfer.js';

export interface TransferListConfigurationOptions {
  messages?: Partial<TransferListMessages>;
}
function configure(options: TransferListConfigurationOptions = {}) {
  const messages = { ...defaultTransferListMessages, ...options.messages };
  for (const [key, value] of Object.entries(messages))
    if (typeof value !== typeof defaultTransferListMessages[key as keyof TransferListMessages])
      throw new TypeError(
        `Transfer list message ${key} must be a ${typeof defaultTransferListMessages[key as keyof TransferListMessages]}`,
      );
  const value: Readonly<TransferListOptions> = Object.freeze({ messages: Object.freeze(messages) });
  return {
    register(container: IContainer) {
      return container.register(Registration.instance(ITransferListOptions, value), AuTransferList);
    },
  };
}
export const AureliaTransferListConfiguration = { ...configure(), configure };
