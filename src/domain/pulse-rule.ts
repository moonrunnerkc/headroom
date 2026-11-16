import type { PulsePolicyConfig } from './pulse-policy-config';

export type RuleStatus =
  | { readonly kind: 'awaiting-baseline' }
  | {
      readonly kind: 'available';
      readonly baselineBpm: number;
      readonly thresholdBpm: number;
      readonly rearmBelowBpm: number;
    }
  | {
      readonly kind: 'unavailable';
      readonly baselineBpm: number;
      readonly thresholdBpm: number;
    };

function qualifyingIncrease(baselineBpm: number, config: PulsePolicyConfig): number {
  return Math.max(config.minIncreaseBpm, baselineBpm * config.minIncreaseFraction);
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) throw new RangeError('median of an empty sample');
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1] ?? upper;
  return (lower + upper) / 2;
}

export function ruleForBaseline(baselineBpm: number, config: PulsePolicyConfig): RuleStatus {
  const increase = qualifyingIncrease(baselineBpm, config);
  const thresholdBpm = baselineBpm + increase;
  // A reading must exceed the threshold, and readings above the operating range are rejected.
  if (thresholdBpm >= config.operatingRangeBpm.max) {
    return { kind: 'unavailable', baselineBpm, thresholdBpm };
  }
  return {
    kind: 'available',
    baselineBpm,
    thresholdBpm,
    rearmBelowBpm: baselineBpm + increase / 2,
  };
}
