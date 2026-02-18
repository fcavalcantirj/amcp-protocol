/**
 * MultiProvider — pin to multiple IPFS pinning services for redundancy
 *
 * Calls all providers in parallel and tracks individual results.
 * Supports two modes:
 *   - requireOne (default): succeeds if at least one provider succeeds
 *   - requireAll: succeeds only if all providers succeed
 */

import { type PinningProvider, type PinResult, PinStatus } from './pinning.js';

/** Configuration for MultiProvider */
export interface MultiProviderOptions {
  /** If true, all providers must succeed. Default: false (any one success is OK). */
  requireAll?: boolean;
}

/** Individual provider result for tracking */
export interface ProviderResult {
  provider: string;
  success: boolean;
  cid?: string;
  error?: string;
}

/** Detailed pin result including per-provider status */
export interface MultiPinResult {
  cid: string;
  requestId: string;
  status: PinStatus;
  providerResults: ProviderResult[];
}

/**
 * Pins CIDs to multiple providers in parallel for redundancy.
 */
export class MultiProvider implements PinningProvider {
  readonly name = 'multi';
  private readonly providers: PinningProvider[];
  private readonly requireAll: boolean;

  constructor(providers: PinningProvider[], options?: MultiProviderOptions) {
    this.providers = providers;
    this.requireAll = options?.requireAll ?? false;
  }

  /**
   * Pin a CID to all providers in parallel.
   * In requireOne mode: returns first success, ignores failures.
   * In requireAll mode: throws if any provider fails.
   */
  async pin(cid: string, name?: string): Promise<PinResult> {
    const result = await this.pinWithDetails(cid, name);
    return { cid: result.cid, requestId: result.requestId, status: result.status };
  }

  /**
   * Pin with detailed per-provider results.
   */
  async pinWithDetails(cid: string, name?: string): Promise<MultiPinResult> {
    const settled = await Promise.allSettled(
      this.providers.map(p => p.pin(cid, name)),
    );

    const providerResults: ProviderResult[] = settled.map((result, i) => {
      const providerName = this.providers[i].name;
      if (result.status === 'fulfilled') {
        return { provider: providerName, success: true, cid: result.value.cid };
      }
      return {
        provider: providerName,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    const successes = providerResults.filter(r => r.success);
    const failures = providerResults.filter(r => !r.success);

    if (this.requireAll && failures.length > 0) {
      const failedNames = failures.map(f => f.provider).join(', ');
      throw new Error(`MultiProvider: providers failed (requireAll): ${failedNames}`);
    }

    if (successes.length === 0) {
      const errors = failures.map(f => `${f.provider}: ${f.error}`).join('; ');
      throw new Error(`MultiProvider: all providers failed: ${errors}`);
    }

    return {
      cid,
      requestId: `multi-${cid.slice(0, 12)}`,
      status: PinStatus.Pinned,
      providerResults,
    };
  }

  /**
   * Unpin from all providers (best-effort, ignores individual failures).
   */
  async unpin(cid: string): Promise<void> {
    await Promise.allSettled(this.providers.map(p => p.unpin(cid)));
  }

  /**
   * Check status across all providers.
   * Returns Pinned if any provider reports Pinned.
   */
  async status(cid: string): Promise<PinStatus> {
    const results = await Promise.allSettled(this.providers.map(p => p.status(cid)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value === PinStatus.Pinned) {
        return PinStatus.Pinned;
      }
    }

    // Check for any queued/pinning status
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value === PinStatus.Pinning) {
        return PinStatus.Pinning;
      }
      if (result.status === 'fulfilled' && result.value === PinStatus.Queued) {
        return PinStatus.Queued;
      }
    }

    return PinStatus.Failed;
  }
}
