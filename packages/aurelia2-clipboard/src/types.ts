export interface ClipboardOptions {
  trim?: boolean;
  preferNative?: boolean;
}

export interface ClipboardConfigurationOptions {
  preferNative?: boolean;
  trim?: boolean;
}

export interface ClipboardResult {
  text: string;
  native: boolean;
}

export type ClipboardCallback = (result: ClipboardResult) => void;
export type ClipboardErrorCallback = (error: unknown) => void;
