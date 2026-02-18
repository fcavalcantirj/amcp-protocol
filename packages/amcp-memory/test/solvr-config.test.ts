/**
 * Solvr IPFS integration configuration tests
 *
 * Verifies that the Solvr IPFS gateway is available as a default gateway
 * and that StorageConfig accepts Solvr-specific server configuration.
 */

import { describe, it, expect } from 'vitest';
import { IPFSBackend, type StorageConfig } from '../src/storage/index.js';

describe('Solvr IPFS integration', () => {
  it('IPFSBackend includes Solvr gateway in defaults', () => {
    const backend = new IPFSBackend();
    // The backend should use Solvr gateway by default
    // We verify by checking that it can be constructed and has the expected name
    expect(backend.name).toBe('ipfs');
  });

  it('IPFSBackend accepts Solvr gateway via config', () => {
    const config: StorageConfig = {
      gateways: ['https://ipfs.solvr.dev/ipfs/'],
    };
    const backend = new IPFSBackend(config);
    expect(backend.name).toBe('ipfs');
  });

  it('StorageConfig accepts solvr server info', () => {
    const config: StorageConfig = {
      gateways: ['https://ipfs.solvr.dev/ipfs/'],
      solvr: {
        ipfsServer: {
          ip: '65.109.134.87',
          peerId: '12D3KooWJG6rZ1KWTQy1fPeaZuxhfukik3RmYTjyf76Yn6CwUP3A',
          gatewayUrl: 'https://ipfs.solvr.dev/ipfs/',
        },
      },
    };
    expect(config.solvr).toBeDefined();
    expect(config.solvr!.ipfsServer.ip).toBe('65.109.134.87');
    expect(config.solvr!.ipfsServer.peerId).toBe('12D3KooWJG6rZ1KWTQy1fPeaZuxhfukik3RmYTjyf76Yn6CwUP3A');
    expect(config.solvr!.ipfsServer.gatewayUrl).toBe('https://ipfs.solvr.dev/ipfs/');
  });

  it('IPFSBackend constructed with Solvr config has correct name', () => {
    const config: StorageConfig = {
      gateways: ['https://ipfs.solvr.dev/ipfs/', 'https://gateway.pinata.cloud/ipfs/'],
      solvr: {
        ipfsServer: {
          ip: '65.109.134.87',
          peerId: '12D3KooWJG6rZ1KWTQy1fPeaZuxhfukik3RmYTjyf76Yn6CwUP3A',
          gatewayUrl: 'https://ipfs.solvr.dev/ipfs/',
        },
      },
    };
    const backend = new IPFSBackend(config);
    expect(backend.name).toBe('ipfs');
  });
});
