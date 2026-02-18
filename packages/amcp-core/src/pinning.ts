/**
 * PinningProvider — abstraction for IPFS pinning services
 *
 * Provides a unified interface for pinning CIDs to remote IPFS pinning services.
 * Built-in providers: PinataProvider, SolvrProvider.
 */

/**
 * Status of a pin request
 */
export enum PinStatus {
  Queued = 'queued',
  Pinning = 'pinning',
  Pinned = 'pinned',
  Failed = 'failed',
}

/**
 * Result of a pin operation
 */
export interface PinResult {
  cid: string;
  requestId: string;
  status: PinStatus;
}

/**
 * Configuration for a pinning provider
 */
export interface PinningProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

/** Max pin completion timeout in ms (default: 5 minutes) */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Max number of retries on 429/5xx errors */
const DEFAULT_MAX_RETRIES = 3;

/** Base delay for exponential backoff in ms */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Extended configuration for Solvr provider with retry and timeout options
 */
export interface SolvrProviderConfig extends PinningProviderConfig {
  /** Max time to wait for pin completion in ms (default: 5 minutes) */
  timeoutMs?: number;
  /** Max retries on 429/5xx errors (default: 3) */
  maxRetries?: number;
}

/**
 * Unified interface for IPFS pinning services.
 * Implementations: PinataProvider, SolvrProvider.
 */
export interface PinningProvider {
  /** Provider name identifier */
  readonly name: string;

  /** Pin a CID to the remote pinning service */
  pin(cid: string, name?: string): Promise<PinResult>;

  /** Unpin a CID from the remote pinning service */
  unpin(cid: string): Promise<void>;

  /** Check the pin status of a CID */
  status(cid: string): Promise<PinStatus>;
}

/**
 * Pinata IPFS pinning provider
 *
 * Uses the Pinata API to pin CIDs.
 * @see https://docs.pinata.cloud/
 */
export class PinataProvider implements PinningProvider {
  readonly name = 'pinata';
  readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: PinningProviderConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.pinata.cloud';
  }

  async pin(cid: string, name?: string): Promise<PinResult> {
    const response = await fetch(`${this.baseUrl}/pinning/pinByHash`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        hashToPin: cid,
        pinataMetadata: name ? { name } : undefined,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new PinataError(`Pinata pin failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      cid,
      requestId: data.id ?? cid,
      status: PinStatus.Queued,
    };
  }

  async unpin(cid: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new PinataError(`Pinata unpin failed (${response.status}): ${text}`);
    }
  }

  async status(cid: string): Promise<PinStatus> {
    const response = await fetch(`${this.baseUrl}/pinning/pinJobs?ipfs_pin_hash=${cid}&limit=1`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new PinataError(`Pinata status check failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    if (!data.rows || data.rows.length === 0) {
      return PinStatus.Pinned; // If no job found, assume pinned
    }

    const jobStatus = data.rows[0].status;
    switch (jobStatus) {
      case 'prechecking':
      case 'retrieving':
        return PinStatus.Pinning;
      case 'expired':
      case 'over_free_limit':
      case 'over_max_size':
      case 'invalid_object':
        return PinStatus.Failed;
      default:
        return PinStatus.Queued;
    }
  }
}

/**
 * Error thrown by Pinata provider operations
 */
export class PinataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinataError';
  }
}

/**
 * Solvr IPFS pinning provider
 *
 * Uses the Solvr API to pin CIDs.
 * Default endpoint: https://api.solvr.dev
 */
export class SolvrProvider implements PinningProvider {
  readonly name = 'solvr';
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  private readonly apiKey: string;

  constructor(config: SolvrProviderConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.solvr.dev';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async pin(cid: string, name?: string): Promise<PinResult> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/v1/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ cid, name }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SolvrAuthError(`Solvr authentication failed (${response.status})`);
      }
      const text = await response.text().catch(() => response.statusText);
      throw new SolvrPinError(`Solvr pin failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return {
      cid,
      requestId: data.requestId ?? data.id ?? cid,
      status: PinStatus.Queued,
    };
  }

  async unpin(cid: string): Promise<void> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/v1/pins/${cid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SolvrAuthError(`Solvr authentication failed (${response.status})`);
      }
      const text = await response.text().catch(() => response.statusText);
      throw new SolvrPinError(`Solvr unpin failed (${response.status}): ${text}`);
    }
  }

  async status(cid: string): Promise<PinStatus> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/v1/pins/${cid}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new SolvrAuthError(`Solvr authentication failed (${response.status})`);
      }
      const text = await response.text().catch(() => response.statusText);
      throw new SolvrPinError(`Solvr status check failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    const pinStatus = data.status?.toLowerCase();
    switch (pinStatus) {
      case 'pinned':
        return PinStatus.Pinned;
      case 'pinning':
        return PinStatus.Pinning;
      case 'failed':
        return PinStatus.Failed;
      case 'queued':
      default:
        return PinStatus.Queued;
    }
  }

  /**
   * Fetch with exponential backoff retry on 429/5xx errors and timeout.
   */
  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        clearTimeout(timeoutId);

        // Retry on 429 (rate limit) or 5xx (server error), unless last attempt
        if (attempt < this.maxRetries && (response.status === 429 || response.status >= 500)) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        // Check if the abort signal fired (timeout)
        if (controller.signal.aborted) {
          throw new SolvrTimeoutError(`Solvr request timed out after ${this.timeoutMs}ms`);
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < this.maxRetries) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    throw lastError ?? new SolvrPinError('Solvr request failed after all retries');
  }
}

/**
 * Error thrown by Solvr provider for pin operation failures
 */
export class SolvrPinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolvrPinError';
  }
}

/**
 * Error thrown by Solvr provider for authentication failures
 */
export class SolvrAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolvrAuthError';
  }
}

/**
 * Error thrown by Solvr provider for timeout failures
 */
export class SolvrTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolvrTimeoutError';
  }
}
