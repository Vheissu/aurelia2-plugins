import { DI } from '@aurelia/kernel';

const DEFAULT_PRIORITY = 10;

export type HookPriority = number;
export type ActionCallback<TArgs extends unknown[] = unknown[]> = (...args: TArgs) => void;
export type FilterCallback<TValue, TArgs extends unknown[] = unknown[]> = (value: TValue, ...args: TArgs) => TValue | Promise<TValue>;

interface HookEntry<TCallback> {
    callback: TCallback;
    priority: HookPriority;
    order: number;
}

export const IAureliaHooks = DI.createInterface<IAureliaHooks>('IAureliaHooks', x => x.singleton(AureliaHooks));
export interface IAureliaHooks extends AureliaHooks {}

export class AureliaHooks {
    private readonly actions = new Map<string, HookEntry<ActionCallback>[]>();
    private readonly filters = new Map<string, HookEntry<FilterCallback<unknown>>[]>();
    private order = 0;

    addAction<TArgs extends unknown[]>(name: string, callback: ActionCallback<TArgs>, priority: HookPriority = DEFAULT_PRIORITY): void {
        this.addHook(this.actions, name, callback as ActionCallback, priority);
    }

    addFilter<TValue, TArgs extends unknown[]>(name: string, callback: FilterCallback<TValue, TArgs>, priority: HookPriority = DEFAULT_PRIORITY): void {
        this.addHook(this.filters, name, callback as FilterCallback<unknown>, priority);
    }

    hasAction(name: string): boolean {
        return this.actions.has(name);
    }

    hasFilter(name: string): boolean {
        return this.filters.has(name);
    }

    getActions(name: string): ReadonlyArray<HookEntry<ActionCallback>> | undefined {
        return this.actions.get(name);
    }

    getFilters(name: string): ReadonlyArray<HookEntry<FilterCallback<unknown>>> | undefined {
        return this.filters.get(name);
    }

    removeAction<TArgs extends unknown[]>(name: string, callback: ActionCallback<TArgs>): void {
        this.removeHook(this.actions, name, callback as ActionCallback);
    }

    removeFilter<TValue, TArgs extends unknown[]>(name: string, callback: FilterCallback<TValue, TArgs>): void {
        this.removeHook(this.filters, name, callback as FilterCallback<unknown>);
    }

    doAction<TArgs extends unknown[]>(name: string, ...args: TArgs): void {
        const actions = this.getSortedHooks(this.actions.get(name));

        for (const hook of actions) {
            hook.callback(...args);
        }
    }

    applyFilter<TValue, TArgs extends unknown[]>(name: string, value: TValue, ...args: TArgs): TValue {
        const filters = this.getSortedHooks(this.filters.get(name));

        for (const hook of filters) {
            value = hook.callback(value, ...args) as TValue;
        }

        return value;
    }

    async applyFilterAsync<TValue, TArgs extends unknown[]>(name: string, value: TValue, ...args: TArgs): Promise<TValue> {
        const filters = this.getSortedHooks(this.filters.get(name));

        for (const hook of filters) {
            value = await hook.callback(value, ...args) as TValue;
        }

        return value;
    }

    private addHook<TCallback>(map: Map<string, HookEntry<TCallback>[]>, name: string, callback: TCallback, priority: HookPriority): void {
        const entries = map.get(name) ?? [];

        entries.push({
            callback,
            priority: Number.isFinite(priority) ? priority : DEFAULT_PRIORITY,
            order: this.order++,
        });

        map.set(name, entries);
    }

    private removeHook<TCallback>(map: Map<string, HookEntry<TCallback>[]>, name: string, callback: TCallback): void {
        const entries = map.get(name);

        if (!entries?.length) {
            return;
        }

        const remaining = entries.filter(entry => entry.callback !== callback);

        if (remaining.length) {
            map.set(name, remaining);
        } else {
            map.delete(name);
        }
    }

    private getSortedHooks<TCallback>(hooks?: HookEntry<TCallback>[]): HookEntry<TCallback>[] {
        if (!hooks?.length) {
            return [];
        }

        return hooks
            .slice()
            .sort((left, right) => (left.priority - right.priority) || (left.order - right.order));
    }
}
