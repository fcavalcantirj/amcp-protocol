/**
 * SOUL drift detection utilities
 *
 * Detects changes in an agent's SOUL.md (identity document) and classifies
 * the severity of the change. Used during checkpoint creation to track
 * whether an agent's core identity has shifted.
 *
 * Severity classification:
 *   0 lines changed = none
 *   1-4 lines changed = minor
 *   5-20 lines changed = moderate
 *   >20 lines changed = major
 */

import { sha256 } from '@noble/hashes/sha256';

/** Drift severity levels */
export type DriftSeverity = 'none' | 'minor' | 'moderate' | 'major';

/** Result of drift detection between two SOUL versions */
export interface DriftResult {
  /** Whether any drift was detected */
  drifted: boolean;
  /** Severity classification based on lines changed */
  severity: DriftSeverity;
  /** Number of lines that changed */
  lines_changed: number;
  /** First few lines of the diff, for logging (absent if no drift) */
  diff_snippet?: string;
}

/**
 * Compute SHA-256 hash of SOUL content
 *
 * @param soulContent - Full text content of SOUL.md
 * @returns Hex-encoded SHA-256 hash string
 */
export function computeSoulHash(soulContent: string): string {
  const bytes = new TextEncoder().encode(soulContent);
  const hashBytes = sha256(bytes);
  return Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Detect drift between two versions of a SOUL document
 *
 * @param previousHash - SHA-256 hash of the previous SOUL content
 * @param currentHash - SHA-256 hash of the current SOUL content
 * @param previousContent - Full text of the previous SOUL.md
 * @param currentContent - Full text of the current SOUL.md
 * @returns DriftResult with severity classification
 */
export function detectSoulDrift(
  previousHash: string,
  currentHash: string,
  previousContent: string,
  currentContent: string
): DriftResult {
  // Fast path: identical hashes means no drift
  if (previousHash === currentHash) {
    return { drifted: false, severity: 'none', lines_changed: 0 };
  }

  const prevLines = previousContent.split('\n');
  const currLines = currentContent.split('\n');
  const { changedLines, diffLines } = computeLineDiff(prevLines, currLines);

  const severity = classifySeverity(changedLines);
  const diff_snippet = diffLines.length > 0 ? diffLines.slice(0, 5).join('\n') : undefined;

  return {
    drifted: true,
    severity,
    lines_changed: changedLines,
    diff_snippet,
  };
}

/**
 * Classify severity based on number of changed lines
 */
function classifySeverity(linesChanged: number): DriftSeverity {
  if (linesChanged === 0) return 'none';
  if (linesChanged <= 4) return 'minor';
  if (linesChanged <= 20) return 'moderate';
  return 'major';
}

/**
 * Compute line-level diff using positional comparison.
 *
 * Counts lines that differ at each position. For lines that exist in one
 * version but not the other (length mismatch), each extra line counts as 1.
 *
 * A changed line (different content at same position) counts as 1.
 * An added or removed line counts as 1.
 */
function computeLineDiff(
  prevLines: string[],
  currLines: string[]
): { changedLines: number; diffLines: string[] } {
  const maxLen = Math.max(prevLines.length, currLines.length);
  const diffLines: string[] = [];
  let changedLines = 0;

  for (let i = 0; i < maxLen; i++) {
    const prev = i < prevLines.length ? prevLines[i] : undefined;
    const curr = i < currLines.length ? currLines[i] : undefined;

    if (prev === curr) continue;

    changedLines++;

    if (prev !== undefined && curr !== undefined) {
      // Line changed
      diffLines.push(`- ${prev}`);
      diffLines.push(`+ ${curr}`);
    } else if (prev !== undefined) {
      // Line deleted
      diffLines.push(`- ${prev}`);
    } else {
      // Line added
      diffLines.push(`+ ${curr}`);
    }
  }

  return { changedLines, diffLines };
}
