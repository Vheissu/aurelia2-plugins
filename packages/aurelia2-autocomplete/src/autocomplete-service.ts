import { DI } from 'aurelia';
import type { AutocompleteConfigurationOptions, AutocompleteOption } from './types';

export class AutocompleteService {
  public options: Required<AutocompleteConfigurationOptions> = {
    maxResults: 20,
    minLength: 0,
    noResultsText: 'No results found',
    placeholder: 'Search',
  };

  public configure(options: AutocompleteConfigurationOptions = {}): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  public filter<T>(
    options: AutocompleteOption<T>[],
    query: string,
    maxResults = this.options.maxResults,
    minLength = this.options.minLength
  ): AutocompleteOption<T>[] {
    const normalized = query.trim().toLowerCase();
    const visible = options.filter((option) => !option.disabled);

    if (normalized.length < minLength) {
      return [];
    }

    if (!normalized) {
      return visible.slice(0, maxResults);
    }

    return visible
      .map((option) => ({
        option,
        score: scoreOption(option, normalized),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label))
      .map((entry) => entry.option)
      .slice(0, maxResults);
  }
}

export const IAutocompleteService = DI.createInterface<IAutocompleteService>('IAutocompleteService', x => x.singleton(AutocompleteService));
export interface IAutocompleteService extends AutocompleteService {}

function scoreOption(option: AutocompleteOption, query: string): number {
  const haystacks = [
    option.label,
    option.description,
    ...(option.keywords ?? []),
  ].filter(Boolean).map((value) => String(value).toLowerCase());

  let best = 0;
  for (const value of haystacks) {
    if (value === query) best = Math.max(best, 100);
    else if (value.startsWith(query)) best = Math.max(best, 80);
    else if (value.includes(query)) best = Math.max(best, 50);
    else if (fuzzyIncludes(value, query)) best = Math.max(best, 20);
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
