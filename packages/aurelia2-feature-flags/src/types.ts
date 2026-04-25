export type MaybePromise<T> = T | Promise<T>;
export type FeatureFlagPrimitive = boolean | string | number | null;

export interface FeatureFlagContext {
  userId?: string;
  roles?: string[];
  groups?: string[];
  traits?: Record<string, unknown>;
  [key: string]: unknown;
}

export type FeatureFlagOperator =
  | 'equals'
  | 'notEquals'
  | 'includes'
  | 'in'
  | 'exists'
  | 'truthy';

export interface FeatureFlagRule {
  when: string;
  operator?: FeatureFlagOperator;
  value?: unknown;
  values?: unknown[];
  enabled?: boolean;
  serve?: FeatureFlagPrimitive;
  variant?: string;
}

export interface FeatureFlagVariant {
  value: string;
  weight: number;
  payload?: unknown;
}

export interface FeatureFlagDefinition {
  enabled?: boolean;
  value?: FeatureFlagPrimitive;
  defaultValue?: FeatureFlagPrimitive;
  rollout?: number;
  rules?: FeatureFlagRule[];
  variants?: FeatureFlagVariant[];
  requires?: string[];
}

export type FeatureFlagInput = boolean | FeatureFlagDefinition;
export type FeatureFlagMap = Record<string, FeatureFlagInput>;

export interface FeatureFlagProvider {
  load(context: FeatureFlagContext): MaybePromise<FeatureFlagMap>;
  subscribe?(listener: () => void): FeatureFlagDispose;
}

export interface FeatureFlagDispose {
  dispose(): void;
}

export interface FeatureFlagEvaluation {
  key: string;
  enabled: boolean;
  value: FeatureFlagPrimitive;
  variant: FeatureFlagVariant | null;
  reason: 'missing' | 'disabled' | 'enabled' | 'rule' | 'dependency' | 'rollout' | 'variant';
  matchedRule: FeatureFlagRule | null;
}

export interface FeatureFlagsConfigurationOptions {
  flags?: FeatureFlagMap;
  context?: FeatureFlagContext;
  providers?: FeatureFlagProvider[];
  missingValue?: boolean;
  percentageContextKey?: string;
}

export type FeatureFlagListener = (evaluation: FeatureFlagEvaluation) => void;
