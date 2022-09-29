import { INotificationConfig } from "./config";
import Humane from "humane-js";
import extend from "extend";
import { DI, IPlatform } from "@aurelia/kernel";
import { I18N } from '@aurelia/i18n';

export const INotification = DI.createInterface<INotification>('INotification', x => x.singleton(Notification));
export interface INotification extends Notification {}

export class Notification {
  readonly humane = Humane;
  protected notify;

  constructor(
    @INotificationConfig readonly config: INotificationConfig,
    @IPlatform readonly platform: IPlatform,
    @I18N readonly i18n: I18N
  ) {
    this.setBaseCls();

    for (let key in config.notifications) {
      if (config.notifications.hasOwnProperty(key)) {
        this[key] = this.spawn(config.notifications[key]);
      }
    }
  }

  setBaseCls(baseCls = this.config.defaults.baseCls) {
    this.humane.baseCls = baseCls ? baseCls : this.humane.baseCls;

    this.notify = this.humane.create();
  }

  spawn(addnDefaults) {
    addnDefaults =
      typeof addnDefaults === "string"
        ? { addnCls: addnDefaults }
        : addnDefaults;
    let defaults = extend({}, this.config.defaults, addnDefaults);

    return (message, options) => {
      return this.log(message, options, defaults);
    };
  }

  translate(options = {}, defaults = {}) {
    let joined = extend({}, this.config, defaults, options);

    return joined.translate;
  }

  log(message, options = {}, defaults = this.config.defaults) {
    if (this.translate(options, defaults)) {
      if (message instanceof Array) {
        message = message.map(item => this.i18n.tr(item));
      } else {
        message = this.i18n.tr(message);
      }
    }

    return new Promise(resolve => {
      return this.notify.log(message, options, resolve, defaults);
    });
  }

  remove() {
    return new Promise(resolve => {
      return this.notify.remove(resolve);
    });
  }

  /**
   * Notify 'note' (translated if applicable) using humane.log.
   *
   * @param {string|string[]}  message|multi-line message.
   * @param {{}}               [options] for this particular notification.
   * @param {{}}               [defaults] for this type of notification.
   *
   */
  note(message, options = {}, defaults = this.config.defaults) {} // eslint-disable-line  no-empty-function

  /**
   * Notify 'success' (translated if applicable) using humane.log.
   *
   * @param {string|string[]}  message|multi-line message.
   * @param {{}}               [options] for this particular notification.
   * @param {{}}               [defaults] for this type of notification.
   *
   */
  success(message, options = {}, defaults = this.config.defaults) {} // eslint-disable-line  no-empty-function

  /**
   * Notify 'error' (translated if applicable) using humane.log.
   *
   * @param {string|string[]}  message|multi-line message.
   * @param {{}}               [options] for this particular notification.
   * @param {{}}               [defaults] for this type of notification.
   *
   */
  error(message, options = {}, defaults = this.config.defaults) {} // eslint-disable-line  no-empty-function

  /**
   * Notify 'info' (translated if applicable) using humane.log.
   *
   * @param {string|string[]}  message|multi-line message.
   * @param {{}}               [options] for this particular notification.
   * @param {{}}               [defaults] for this type of notification.
   *
   */
  info(message, options = {}, defaults = this.config.defaults) {} // eslint-disable-line  no-empty-function
}
