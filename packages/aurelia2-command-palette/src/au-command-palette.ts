import { bindable, BindingMode, customElement, INode, resolve } from 'aurelia';
import { ICommandPaletteService } from './command-palette-service';
import type { CommandPaletteCommand, CommandPaletteDispose } from './types';
import template from './au-command-palette.html';

const identity = <T>(value: T): T => value;

@customElement({
  name: 'au-command-palette',
  template,
})
export class AuCommandPaletteCustomElement {
  @bindable({ mode: BindingMode.twoWay }) public open = false;
  @bindable({ mode: BindingMode.twoWay }) public query = '';
  @bindable({ set: identity }) public commands: CommandPaletteCommand[] = [];
  @bindable public placeholder: string | null = null;
  @bindable public emptyText: string | null = null;
  @bindable public maxResults: number | null = null;
  @bindable public closeOnSelect = true;

  public results: CommandPaletteCommand[] = [];
  public activeIndex = 0;
  public placeholderText = '';
  public emptyTextValue = '';

  private readonly host = resolve(INode) as HTMLElement;
  private readonly palette = resolve(ICommandPaletteService);
  private subscription: CommandPaletteDispose | null = null;
  private serviceCommands: CommandPaletteCommand[] = [];
  private syncingService = false;

  public binding(): void {
    const initialOpen = this.open;
    const initialQuery = this.query;
    this.placeholderText = this.placeholder ?? this.palette.options.placeholder;
    this.emptyTextValue = this.emptyText ?? this.palette.options.emptyText;
    this.subscription = this.palette.subscribe((state) => {
      this.syncingService = true;
      this.open = state.open;
      this.query = state.query;
      this.serviceCommands = state.commands;
      this.syncingService = false;
      this.recompute();
    });
    if (initialOpen) {
      this.palette.open(initialQuery);
    }
    this.recompute();
  }

  public attached(): void {
    if (this.open) {
      this.focusInput();
    }
  }

  public detached(): void {
    this.subscription?.dispose();
    this.subscription = null;
  }

  public openChanged(): void {
    if (!this.syncingService) {
      if (this.open) this.palette.open(this.query);
      else this.palette.close();
    }
    if (this.open) {
      this.focusInput();
    }
  }

  public queryChanged(): void {
    if (!this.syncingService) {
      this.palette.setQuery(this.query);
    }
    this.recompute();
  }

  public commandsChanged(): void {
    this.recompute();
  }

  public placeholderChanged(): void {
    this.placeholderText = this.placeholder ?? this.palette.options.placeholder;
  }

  public emptyTextChanged(): void {
    this.emptyTextValue = this.emptyText ?? this.palette.options.emptyText;
  }

  public maxResultsChanged(): void {
    this.recompute();
  }

  public onBackdropClick(event: MouseEvent): void {
    event.stopPropagation();
    this.close();
  }

  public onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(-1);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const command = this.results[this.activeIndex];
      if (command) void this.select(command);
    }
  }

  public async select(command: CommandPaletteCommand): Promise<void> {
    if (command.disabled) return;
    await command.action?.(command);
    this.host.dispatchEvent(new CustomEvent('command-palette-select', {
      bubbles: true,
      detail: command,
    }));
    if (this.closeOnSelect) {
      this.close();
    }
  }

  public close(): void {
    this.open = false;
    this.query = '';
    this.palette.close();
    this.host.dispatchEvent(new CustomEvent('command-palette-close', { bubbles: true }));
  }

  private recompute(): void {
    const commands = [...this.serviceCommands, ...this.commands];
    const max = this.maxResults ?? this.palette.options.maxResults;
    this.results = this.palette.search(this.query, commands, max);
    if (this.activeIndex >= this.results.length) {
      this.activeIndex = Math.max(0, this.results.length - 1);
    }
  }

  private move(delta: number): void {
    if (this.results.length === 0) return;
    this.activeIndex = (this.activeIndex + delta + this.results.length) % this.results.length;
  }

  private focusInput(): void {
    queueMicrotask(() => {
      this.host.querySelector<HTMLInputElement>('.au-cp-input')?.focus();
    });
  }
}
