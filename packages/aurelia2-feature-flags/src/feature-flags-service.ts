import { DI } from 'aurelia';
import type {
  FeatureFlagContext,
  FeatureFlagDefinition,
  FeatureFlagDispose,
  FeatureFlagEvaluation,
  FeatureFlagInput,
  FeatureFlagListener,
  FeatureFlagMap,
  FeatureFlagPrimitive,
  FeatureFlagProvider,
  FeatureFlagsConfigurationOptions,
  FeatureFlagVariant,
} from './types';

const defaultOptions: Required<FeatureFlagsConfigurationOptions> = {
  flags: {},
  context: {},
  providers: [],
  missingValue: false,
  percentageContextKey: 'userId',
};

export class FeatureFlagsService {
  public options: Required<FeatureFlagsConfigurationOptions> = { ...defaultOptions };

  private flags: FeatureFlagMap = {};
  private context: FeatureFlagContext = {};
  private listeners = new Set<FeatureFlagListener>();
  private providerSubscriptions: FeatureFlagDispose[] = [];

  public configure(options: FeatureFlagsConfigurationOptions = {}): void {
    this.providerSubscriptions.forEach((subscription) => subscription.dispose());
    this.providerSubscriptions = [];

    this.options = {
      ...defaultOptions,
      ...options,
      context: {
        ...defaultOptions.context,
        ...options.context,
      },
      flags: {
        ...defaultOptions.flags,
        ...options.flags,
      },
      providers: options.providers ?? [],
    };
    this.flags = { ...this.options.flags };
    this.context = { ...this.options.context };

    for (const provider of this.options.providers) {
      const subscription = provider.subscribe?.(() => {
        void this.refresh();
      });
      if (subscription) {
        this.providerSubscriptions.push(subscription);
      }
    }
  }

  public getContext(): FeatureFlagContext {
    return { ...this.context };
  }

  public setContext(context: FeatureFlagContext): void {
    this.context = {
      ...this.context,
      ...context,
      traits: {
        ...(this.context.traits ?? {}),
        ...(context.traits ?? {}),
      },
    };
    this.emitAll();
  }

  public setFlags(flags: FeatureFlagMap): void {
    this.flags = { ...this.flags, ...flags };
    this.emitAll();
  }

  public async refresh(context: FeatureFlagContext = this.context): Promise<FeatureFlagMap> {
    const providerFlags: FeatureFlagMap = {};
    for (const provider of this.options.providers) {
      Object.assign(providerFlags, await provider.load(context));
    }
    this.flags = {
      ...this.options.flags,
      ...providerFlags,
    };
    this.emitAll();
    return { ...this.flags };
  }

  public evaluate(key: string, context: FeatureFlagContext = this.context): FeatureFlagEvaluation {
    const input = this.flags[key];
    if (input === undefined) {
      return {
        key,
        enabled: this.options.missingValue,
        value: this.options.missingValue,
        variant: null,
        reason: 'missing',
        matchedRule: null,
      };
    }

    const flag = normalizeFlag(input);

    if (flag.enabled === false) {
      return result(key, false, flag.defaultValue ?? false, null, 'disabled', null);
    }

    for (const dependency of flag.requires ?? []) {
      if (!this.isEnabled(dependency, context)) {
        return result(key, false, flag.defaultValue ?? false, null, 'dependency', null);
      }
    }

    for (const rule of flag.rules ?? []) {
      if (!ruleMatches(rule.when, rule.operator ?? 'equals', rule.value, rule.values, context)) continue;
      const variant = rule.variant
        ? flag.variants?.find((entry) => entry.value === rule.variant) ?? null
        : null;
      const served = variant?.value ?? rule.serve ?? rule.enabled ?? flag.value ?? true;
      return result(key, Boolean(rule.enabled ?? served), served, variant, 'rule', rule);
    }

    if (flag.rollout !== undefined) {
      const bucket = percentageBucket(`${key}:${String(readPath(context, this.options.percentageContextKey) ?? '')}`);
      if (bucket >= clamp(flag.rollout, 0, 100)) {
        return result(key, false, flag.defaultValue ?? false, null, 'rollout', null);
      }
    }

    if (flag.variants?.length) {
      const variant = pickVariant(flag.variants, `${key}:${String(readPath(context, this.options.percentageContextKey) ?? '')}`);
      return result(key, true, variant?.value ?? flag.value ?? true, variant, 'variant', null);
    }

    const value = flag.value ?? flag.enabled ?? true;
    return result(key, Boolean(flag.enabled ?? value), value, null, 'enabled', null);
  }

  public isEnabled(key: string, context: FeatureFlagContext = this.context): boolean {
    return this.evaluate(key, context).enabled;
  }

  public variation<T extends FeatureFlagPrimitive = FeatureFlagPrimitive>(
    key: string,
    fallback: T,
    context: FeatureFlagContext = this.context
  ): T | FeatureFlagPrimitive {
    const evaluation = this.evaluate(key, context);
    return evaluation.value ?? fallback;
  }

  public onChange(listener: FeatureFlagListener): FeatureFlagDispose {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private emitAll(): void {
    for (const key of Object.keys(this.flags)) {
      const evaluation = this.evaluate(key);
      for (const listener of this.listeners) {
        listener(evaluation);
      }
    }
  }
}

export const IFeatureFlags = DI.createInterface<IFeatureFlags>('IFeatureFlags', (x) => x.singleton(FeatureFlagsService));
export interface IFeatureFlags extends FeatureFlagsService {}

function normalizeFlag(input: FeatureFlagInput): FeatureFlagDefinition {
  return typeof input === 'boolean'
    ? { enabled: input, value: input }
    : input;
}

function result(
  key: string,
  enabled: boolean,
  value: FeatureFlagPrimitive,
  variant: FeatureFlagVariant | null,
  reason: FeatureFlagEvaluation['reason'],
  matchedRule: FeatureFlagEvaluation['matchedRule']
): FeatureFlagEvaluation {
  return { key, enabled, value, variant, reason, matchedRule };
}

function ruleMatches(
  path: string,
  operator: string,
  value: unknown,
  values: unknown[] | undefined,
  context: FeatureFlagContext
): boolean {
  const actual = readPath(context, path);
  switch (operator) {
    case 'notEquals':
      return actual !== value;
    case 'includes':
      return Array.isArray(actual) ? actual.includes(value) : String(actual ?? '').includes(String(value ?? ''));
    case 'in':
      return (values ?? []).includes(actual);
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'truthy':
      return Boolean(actual);
    case 'equals':
    default:
      return actual === value;
  }
}

function readPath(source: FeatureFlagContext, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

function percentageBucket(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

function pickVariant(variants: FeatureFlagVariant[], seed: string): FeatureFlagVariant | null {
  const total = variants.reduce((sum, variant) => sum + Math.max(variant.weight, 0), 0);
  if (total <= 0) return null;

  let bucket = (percentageBucket(seed) / 100) * total;
  for (const variant of variants) {
    bucket -= Math.max(variant.weight, 0);
    if (bucket < 0) return variant;
  }

  return variants[variants.length - 1] ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
