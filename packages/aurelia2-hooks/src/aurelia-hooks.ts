import { DI } from 'aurelia';

export const IAureliaHooks = DI.createInterface<IAureliaHooks>('IAureliaHooks', x => x.singleton(AureliaHooks));
export interface IAureliaHooks extends AureliaHooks {}

export class AureliaHooks {
    private actions = {};
    private filters = {};
  
    addAction(name: string, callback, priority = 10) {
      this.actions[name] = this.actions[name] || [];
      this.actions[name].push({ priority, callback });
    }
  
    addFilter(name: string, callback, priority = 10) {
      this.filters[name] = this.filters[name] || [];
      this.filters[name].push({ priority, callback });
    }
  
    hasAction(name: string) {
      return this.actions[name] !== undefined;
    }
  
    hasFilter(name: string) {
      return this.filters[name] !== undefined;
    }
  
    getActions(name: string) {
      return this.actions[name];
    }
  
    getFilters(name: string) {
      return this.filters[name];
    }
  
    removeAction(name: string, callback) {
      if (this.actions[name]) {
        this.actions[name] = this.actions[name].filter(val => val.callback.name !== callback.name);
  
        if (this.actions[name].length === 0) {
          delete this.actions[name];
        }
      }
    }
  
    removeFilter(name: string, callback) {
      if (this.filters[name]) {
        this.filters[name] = this.filters[name].filter(val => val.callback.name !== callback.name);
  
        if (this.filters[name].length === 0) {
          delete this.filters[name];
        }
      }
    }
  
    doAction(name: string, ...args) {
      if (this.actions[name] && this.actions[name].length) {
        const actions = [];
  
        this.actions[name].map(hook => {
          actions[hook.priority] = actions[hook.priority] || [];
          actions[hook.priority].push(hook.callback);
        });
  
        actions.map(hooks => {
          hooks.map(callback => {
            callback(...args);
          });
        });
      }
    }
  
    applyFilter(name: string, value: unknown, ...args): any {
      if (this.filters[name] && this.filters[name].length) {
        const filters = [];
  
        this.filters[name].map(hook => {
          filters[hook.priority] = filters[hook.priority] || [];
          filters[hook.priority].push(hook.callback);
        });
  
        filters.map(hooks => {
          hooks.map(callback => {
            value = callback(value, ...args);
          });
        });
      }
  
      return value;
    }
  
    applyFilterAsync(name: string, value: unknown, ...args): any {
      return new Promise((resolve, reject) => {
        if (this.filters[name] && this.filters[name].length) {
          const filters = [];
    
          this.filters[name].map(hook => {
            filters[hook.priority] = filters[hook.priority] || [];
            filters[hook.priority].push(hook.callback);
          });
    
          filters.map(hooks => {
            hooks.map(async (callback) => {
              try {
                value = await callback(value, ...args);
                resolve(value);
              } catch (e) {
                reject(e);
              }
            });
          });
        } else {
          resolve(value);
        }
      });
    }
  }