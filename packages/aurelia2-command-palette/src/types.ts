export type CommandAction = (command: CommandPaletteCommand) => void | Promise<void>;

export interface CommandPaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  section?: string;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  hidden?: boolean;
  action?: CommandAction;
}

export interface CommandPaletteState {
  open: boolean;
  query: string;
  commands: CommandPaletteCommand[];
}

export type CommandPaletteListener = (state: CommandPaletteState) => void;

export interface CommandPaletteDispose {
  dispose(): void;
}

export interface CommandPaletteConfigurationOptions {
  maxResults?: number;
  placeholder?: string;
  emptyText?: string;
}
