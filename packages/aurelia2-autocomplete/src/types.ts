export interface AutocompleteOption<T = unknown> {
  value: T;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
}

export interface AutocompleteSearchContext<T = unknown> {
  query: string;
  options: AutocompleteOption<T>[];
}

export type AutocompleteSearch<T = unknown> = (
  context: AutocompleteSearchContext<T>
) => AutocompleteOption<T>[] | Promise<AutocompleteOption<T>[]>;

export interface AutocompleteConfigurationOptions {
  maxResults?: number;
  minLength?: number;
  noResultsText?: string;
  placeholder?: string;
}

export interface AutocompleteSelectDetail<T = unknown> {
  option: AutocompleteOption<T>;
  selected: AutocompleteOption<T> | AutocompleteOption<T>[] | null;
}
