import { DI } from 'aurelia';
import type {
  CommandPaletteCommand,
  CommandPaletteConfigurationOptions,
  CommandPaletteDispose,
  CommandPaletteListener,
  CommandPaletteState,
} from './types';

export class CommandPaletteService {
  private commands: CommandPaletteCommand[] = [];
  private listeners = new Set<CommandPaletteListener>();
  private state: CommandPaletteState = {
    open: false,
    query: '',
    commands: this.commands,
  };

  public options: Required<CommandPaletteConfigurationOptions> = {
    maxResults: 20,
    placeholder: 'Search commands',
    emptyText: 'No commands found',
  };

  public configure(options: CommandPaletteConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
    this.notify();
  }

  public register(command: CommandPaletteCommand | CommandPaletteCommand[]): CommandPaletteDispose {
    const commands = Array.isArray(command) ? command : [command];
    this.commands.push(...commands);
    this.notify();

    return {
      dispose: () => {
        this.commands = this.commands.filter((entry) => !commands.includes(entry));
        this.notify();
      },
    };
  }

  public subscribe(listener: CommandPaletteListener): CommandPaletteDispose {
    this.listeners.add(listener);
    listener(this.snapshot());

    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public open(query = ''): void {
    this.state.open = true;
    this.state.query = query;
    this.notify();
  }

  public close(): void {
    this.state.open = false;
    this.state.query = '';
    this.notify();
  }

  public toggle(query = ''): void {
    if (this.state.open) {
      this.close();
    } else {
      this.open(query);
    }
  }

  public setQuery(query: string): void {
    this.state.query = query;
    this.notify();
  }

  public getState(): CommandPaletteState {
    return this.snapshot();
  }

  public search(query = this.state.query, commands = this.commands, maxResults = this.options.maxResults): CommandPaletteCommand[] {
    const normalized = query.trim().toLowerCase();
    const visible = commands.filter((command) => !command.hidden);

    if (!normalized) {
      return visible.slice(0, maxResults);
    }

    return visible
      .map((command) => ({
        command,
        score: scoreCommand(command, normalized),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
      .map((entry) => entry.command)
      .slice(0, maxResults);
  }

  public async execute(command: CommandPaletteCommand): Promise<void> {
    if (command.disabled) return;
    await command.action?.(command);
    this.close();
  }

  private snapshot(): CommandPaletteState {
    return {
      open: this.state.open,
      query: this.state.query,
      commands: [...this.commands],
    };
  }

  private notify(): void {
    this.state.commands = this.commands;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export const ICommandPaletteService = DI.createInterface<ICommandPaletteService>('ICommandPaletteService', x => x.singleton(CommandPaletteService));
export interface ICommandPaletteService extends CommandPaletteService {}

function scoreCommand(command: CommandPaletteCommand, query: string): number {
  const haystacks = [
    command.title,
    command.subtitle,
    command.section,
    command.shortcut,
    ...(command.keywords ?? []),
  ].filter(Boolean).map((value) => String(value).toLowerCase());

  let best = 0;
  for (const value of haystacks) {
    if (value === query) best = Math.max(best, 100);
    else if (value.startsWith(query)) best = Math.max(best, 75);
    else if (value.includes(query)) best = Math.max(best, 45);
    else if (fuzzyIncludes(value, query)) best = Math.max(best, 25);
  }

  return best;
}

function fuzzyIncludes(value: string, query: string): boolean {
  let index = 0;
  for (const char of value) {
    if (char === query[index]) {
      index += 1;
    }
    if (index === query.length) return true;
  }
  return false;
}
