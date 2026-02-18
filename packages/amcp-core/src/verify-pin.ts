/**
 * Cross-provider CID verification
 *
 * Checks CID availability across multiple IPFS pinning providers
 * to verify checkpoint redundancy and content consistency.
 */

import { type PinningProvider, PinStatus } from './pinning.js';

/** Per-provider availability result */
export interface ProviderAvailability {
  name: string;
  available: boolean;
}

/** Result of cross-provider pin verification */
export interface PinVerificationResult {
  /** True if at least one provider has the CID pinned */
  verified: boolean;
  /** Per-provider availability status */
  providers: ProviderAvailability[];
  /** True if all providers that have the CID agree (content-addressed consistency) */
  contentMatch: boolean;
}

/**
 * Verify a CID is pinned across multiple providers
 *
 * Checks each provider's status for the given CID in parallel.
 * A CID is content-addressed, so if multiple providers report it as
 * Pinned, the content is guaranteed to match (same hash = same content).
 *
 * @param cid - Content identifier to verify
 * @param providers - Array of PinningProvider instances to check
 * @returns Verification result with per-provider availability
 */
export async function verifyPinAcrossProviders(
  cid: string,
  providers: PinningProvider[],
): Promise<PinVerificationResult> {
  if (providers.length === 0) {
    return { verified: false, providers: [], contentMatch: false };
  }

  const settled = await Promise.allSettled(
    providers.map(p => p.status(cid)),
  );

  const providerResults: ProviderAvailability[] = settled.map((result, i) => ({
    name: providers[i].name,
    available: result.status === 'fulfilled' && result.value === PinStatus.Pinned,
  }));

  const availableCount = providerResults.filter(p => p.available).length;
  const verified = availableCount > 0;

  // contentMatch is true if all providers agree the CID is available
  // (CIDs are content-addressed, so same CID = same content)
  const contentMatch = availableCount === providers.length;

  return { verified, providers: providerResults, contentMatch };
}
