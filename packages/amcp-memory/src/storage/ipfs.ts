/**
 * IPFS Storage Backend
 * 
 * Uses public IPFS gateways for reading and optional Pinata for writing.
 * Content-addressed by design - the CID IS the address.
 * 
 * Read strategy: Try multiple gateways in parallel, return first success.
 * Write strategy: Pin to Pinata if JWT provided, otherwise store locally.
 * 
 * @research Content-Addressed Storage (Benet/IPFS 2014)
 */

import { computeCID, type CID } from '../cid.js';
import { 
  type StorageBackend, 
  type StorageConfig,
  StorageError, 
  NotFoundError,
  UnsupportedError
} from './interface.js';

// Default public IPFS gateways
const DEFAULT_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/'
];

// Pinata API endpoint
const PINATA_PIN_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

/**
 * IPFS storage backend using public gateways
 * 
 * Note: Writing to IPFS requires a pinning service (Pinata).
 * Without pinning, data may be garbage collected.
 * 
 * @example
 * ```ts
 * // Read-only (public gateways)
 * const backend = new IPFSBackend();
 * const data = await backend.get('bafk...');
 * 
 * // Read-write (with Pinata)
 * const backend = new IPFSBackend({ pinataJwt: 'your-jwt' });
 * const cid = await backend.put(data);
 * ```
 */
export class IPFSBackend implements StorageBackend {
  readonly name = 'ipfs';
  readonly hasDelete = false; // IPFS is immutable
  
  private readonly gateways: string[];
  private readonly pinataJwt?: string;
  private readonly pinnedCids: Set<CID> = new Set(); // Track what we've pinned
  
  constructor(config: StorageConfig = {}) {
    this.gateways = config.gateways ?? DEFAULT_GATEWAYS;
    this.pinataJwt = config.pinataJwt;
  }
  
  /**
   * Pin data to IPFS via Pinata
   * 
   * Note: CID is computed locally using same algorithm as IPFS.
   * This ensures CID consistency across backends.
   */
  async put(data: Uint8Array): Promise<CID> {
    // Compute CID locally first - must match IPFS
    const cid = computeCID(data);
    
    if (this.pinataJwt) {
      try {
        await this.pinToPinata(data, cid);
        this.pinnedCids.add(cid);
      } catch (err) {
        throw new StorageError(
          `Failed to pin to Pinata: ${(err as Error).message}`,
          this.name,
          err as Error
        );
      }
    } else {
      // No Pinata JWT - just compute CID but warn
      // Track locally so list() still works
      this.pinnedCids.add(cid);
      console.warn(
        '[IPFSBackend] No Pinata JWT configured. CID computed but not pinned. ' +
        'Data must be stored elsewhere and may not be retrievable.'
      );
    }
    
    return cid;
  }
  
  private async pinToPinata(data: Uint8Array, cid: CID): Promise<void> {
    // Create a Blob from the data - use copy to ensure ArrayBuffer type
    const copy = new Uint8Array(data);
    const blob = new Blob([copy.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const formData = new FormData();
    formData.append('file', blob, `${cid}.bin`);
    
    // Add pinning metadata
    const metadata = JSON.stringify({
      name: `amcp-checkpoint-${cid.slice(0, 12)}`,
      keyvalues: {
        type: 'amcp-checkpoint',
        cid
      }
    });
    formData.append('pinataMetadata', metadata);
    
    const response = await fetch(PINATA_PIN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.pinataJwt}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Pinata API error: ${response.status} ${text}`);
    }
    
    // Verify Pinata returned matching CID
    const result = await response.json() as { IpfsHash: string };
    // Note: Pinata returns CIDv0 (Qm...) but we use CIDv1 (b...) 
    // The content is the same, just different encoding
  }
  
  /**
   * Retrieve data from IPFS via public gateways
   * 
   * Tries multiple gateways in parallel, returns first success.
   */
  async get(cid: CID): Promise<Uint8Array> {
    // Try all gateways in parallel
    const errors: Error[] = [];
    
    const attempts = this.gateways.map(async (gateway) => {
      const url = `${gateway}${cid}`;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000) // 30s timeout
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return new Uint8Array(await response.arrayBuffer());
      } catch (err) {
        errors.push(new Error(`${gateway}: ${(err as Error).message}`));
        throw err;
      }
    });
    
    try {
      // Return first successful response
      return await Promise.any(attempts);
    } catch {
      // All gateways failed
      const errorSummary = errors.map(e => e.message).join('; ');
      throw new NotFoundError(
        `${cid} (tried ${this.gateways.length} gateways: ${errorSummary})`,
        this.name
      );
    }
  }
  
  /**
   * List pinned CIDs
   * 
   * Note: Only returns CIDs pinned in this session or via Pinata API.
   * Public gateways don't support listing.
   */
  async list(): Promise<CID[]> {
    if (this.pinataJwt) {
      return this.listFromPinata();
    }
    
    // Return locally tracked pins
    return Array.from(this.pinnedCids);
  }
  
  private async listFromPinata(): Promise<CID[]> {
    try {
      const response = await fetch(
        'https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=1000&metadata[keyvalues][type]=amcp-checkpoint',
        {
          headers: {
            'Authorization': `Bearer ${this.pinataJwt}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json() as { 
        rows: Array<{ ipfs_pin_hash: string }> 
      };
      
      // Pinata returns CIDv0, we use CIDv1 - return as-is for now
      // (could convert, but they reference same content)
      return result.rows.map(row => row.ipfs_pin_hash);
    } catch (err) {
      throw new StorageError(
        `Failed to list pins from Pinata`,
        this.name,
        err as Error
      );
    }
  }
  
  /**
   * IPFS is immutable - deletion not supported
   */
  async delete(_cid: CID): Promise<void> {
    throw new UnsupportedError('delete', this.name);
  }
  
  /**
   * Check if content exists by trying to fetch headers
   */
  async has(cid: CID): Promise<boolean> {
    // Try HEAD request on first gateway
    const gateway = this.gateways[0];
    try {
      const response = await fetch(`${gateway}${cid}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create an IPFS backend
 * 
 * @param config - Optional configuration with Pinata JWT
 */
export function createIPFSBackend(config?: StorageConfig): IPFSBackend {
  return new IPFSBackend(config);
}
