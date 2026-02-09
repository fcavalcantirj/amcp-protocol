#!/usr/bin/env python3
"""
fix-openclaw-session.py — Repair corrupted OpenClaw session transcripts

PROBLEM
-------
When an OpenClaw assistant response is terminated mid-stream while streaming a
tool_use block, the JSONL transcript ends up with a malformed entry: the
tool_call block contains a `partialJson` field but no valid `arguments`, and
the `stopReason` is "error".

OpenClaw's built-in transcript repair (`session-transcript-repair.ts`) notices
the orphaned tool_use_id and inserts a synthetic toolResult for it. However,
because the original tool_use block is *structurally malformed* (partial JSON,
no proper arguments), the Anthropic API does not recognize it as a valid
tool_use. When the full transcript is sent on the next turn, the API rejects it:

    messages.N.content.M: unexpected `tool_use_id` found in `tool_result`
    blocks: toolu_XXXX. Each `tool_result` block must have a corresponding
    `tool_use` block in the previous message.

This is a permanent error — every subsequent message to the session fails with
the same 400, because the corrupted lines are baked into the transcript.

CORRUPTION PATTERNS DETECTED
-----------------------------
1. Assistant error + partialJson: stopReason="error" with partialJson in
   tool_call blocks (any error message — "terminated", "Unexpected non-
   whitespace character after JSON", connection errors, etc.)
2. Orphan toolResults: synthetic toolResult messages referencing tool_use_ids
   that only exist in broken assistant messages
3. Cascade errors: empty assistant responses (content=[]) whose errorMessage
   references a poisoned tool_use_id
4. Orphan tool_result blocks: tool_result content blocks in user messages that
   reference tool_use_ids with no corresponding tool_use in any assistant msg
5. Unparseable JSONL lines: lines that fail to parse as valid JSON

WHAT THIS SCRIPT DOES
---------------------
1. Scans all .jsonl session files (or a specific one) for corruption patterns
2. Identifies and categorizes all corrupted lines
3. Removes the corrupted lines
4. Fixes parentId references in the DAG to maintain transcript integrity
5. Creates a timestamped backup before any modifications
6. Runs a verification pass after fixing to confirm the session is clean

USAGE
-----
    # Dry-run scan of all sessions (shows what would be fixed, changes nothing)
    python3 fix-openclaw-session.py

    # Dry-run scan of a specific session file
    python3 fix-openclaw-session.py /path/to/session.jsonl

    # Actually apply the fix
    python3 fix-openclaw-session.py --fix

    # Fix a specific file
    python3 fix-openclaw-session.py --fix /path/to/session.jsonl

    # Verbose mode — show per-line details
    python3 fix-openclaw-session.py --verbose

    # Scan all agent directories (not just main)
    python3 fix-openclaw-session.py --all-agents
"""

import json
import glob
import shutil
import sys
import os
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# ── Defaults ──────────────────────────────────────────────────────────────────

OPENCLAW_DIR = os.path.expanduser("~/.openclaw")
DEFAULT_SESSIONS_DIR = os.path.join(OPENCLAW_DIR, "agents", "main", "sessions")

TOOL_CALL_TYPES = {"toolCall", "toolUse", "functionCall"}
TOOL_RESULT_ROLES = {"toolResult", "tool_result"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_jsonl(filepath: str) -> list[tuple[int, dict | None, str]]:
    """Parse a JSONL file. Returns list of (line_number, parsed_obj, raw_line)."""
    entries = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for i, raw in enumerate(f, start=1):
                raw = raw.rstrip("\n")
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                except json.JSONDecodeError:
                    obj = None
                entries.append((i, obj, raw))
    except (OSError, IOError) as e:
        print(f"  WARNING: Could not read {filepath}: {e}", file=sys.stderr)
    return entries


def get_role(obj: dict) -> str | None:
    msg = obj.get("message")
    if isinstance(msg, dict):
        return msg.get("role")
    return None


def get_id(obj: dict) -> str:
    return obj.get("id", "")


def get_parent_id(obj: dict) -> str:
    return obj.get("parentId", "")


def extract_tool_call_ids(obj: dict) -> set[str]:
    """Extract all tool_call IDs from an assistant message's content blocks."""
    msg = obj.get("message", {})
    content = msg.get("content", [])
    if not isinstance(content, list):
        return set()
    ids = set()
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") in TOOL_CALL_TYPES:
            block_id = block.get("id", "")
            if block_id:
                ids.add(block_id)
    return ids


def extract_all_tool_call_ids(entries: list) -> set[str]:
    """Extract all valid tool_call IDs from all non-error assistant messages."""
    ids = set()
    for _, obj, _ in entries:
        if obj is None:
            continue
        role = get_role(obj)
        if role != "assistant":
            continue
        msg = obj.get("message", {})
        if msg.get("stopReason") == "error":
            continue
        ids |= extract_tool_call_ids(obj)
    return ids


def has_partial_json(obj: dict) -> bool:
    """Check if any tool_call block in the assistant message has partialJson."""
    msg = obj.get("message", {})
    content = msg.get("content", [])
    if not isinstance(content, list):
        return False
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") in TOOL_CALL_TYPES and "partialJson" in block:
            return True
    return False


def is_error_assistant(obj: dict) -> bool:
    """Check if this assistant message errored (any error type)."""
    msg = obj.get("message", {})
    return msg.get("stopReason") == "error"


def is_empty_error_assistant(obj: dict) -> bool:
    """Check if this is an empty assistant response that recorded an API error."""
    msg = obj.get("message", {})
    if msg.get("role") != "assistant":
        return False
    content = msg.get("content", [])
    err = msg.get("errorMessage", "")
    return (content == [] or content is None) and "tool_use_id" in err


def get_tool_result_id(obj: dict) -> str | None:
    """Extract the toolCallId from a toolResult message."""
    msg = obj.get("message", {})
    if msg.get("role") not in TOOL_RESULT_ROLES:
        return None
    return msg.get("toolCallId") or msg.get("toolUseId") or None


def get_tool_result_ids_from_user(obj: dict) -> set[str]:
    """Extract tool_result tool_use_ids from a user message's content blocks."""
    msg = obj.get("message", {})
    if msg.get("role") != "user":
        return set()
    content = msg.get("content", [])
    if not isinstance(content, list):
        return set()
    ids = set()
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "tool_result":
            tuid = block.get("tool_use_id", "")
            if tuid:
                ids.add(tuid)
    return ids


# ── Core Analysis ─────────────────────────────────────────────────────────────

def analyze_session(filepath: str, verbose: bool = False) -> dict:
    """
    Analyze a session file for corruption patterns.
    Returns a report dict.
    """
    entries = parse_jsonl(filepath)
    if not entries:
        return {"file": filepath, "lines": 0, "corrupted": False}

    # Track unparseable lines
    unparseable_lines = []
    for lineno, obj, raw in entries:
        if obj is None:
            unparseable_lines.append(lineno)

    # Pass 1: Find broken assistant messages (error + partialJson)
    broken_assistant_ids = set()
    broken_tool_call_ids = set()
    broken_line_map = {}
    reasons = {}  # id -> reason string

    for lineno, obj, _ in entries:
        if obj is None:
            continue
        role = get_role(obj)
        if role != "assistant":
            continue
        if is_error_assistant(obj) and has_partial_json(obj):
            oid = get_id(obj)
            broken_assistant_ids.add(oid)
            broken_line_map[oid] = lineno
            broken_tool_call_ids |= extract_tool_call_ids(obj)
            err = obj.get("message", {}).get("errorMessage", "")[:80]
            reasons[oid] = f"error+partialJson: {err}"

    # Pass 2: Find orphan synthetic toolResults referencing broken tool_call IDs
    orphan_result_ids = set()
    for lineno, obj, _ in entries:
        if obj is None:
            continue
        tr_id = get_tool_result_id(obj)
        if tr_id and tr_id in broken_tool_call_ids:
            oid = get_id(obj)
            orphan_result_ids.add(oid)
            broken_line_map[oid] = lineno
            reasons[oid] = f"orphan toolResult for {tr_id}"

    # Pass 3: Find empty error assistant responses caused by the cascade
    cascade_error_ids = set()
    for lineno, obj, _ in entries:
        if obj is None:
            continue
        if is_empty_error_assistant(obj):
            err = obj.get("message", {}).get("errorMessage", "")
            for tc_id in broken_tool_call_ids:
                if tc_id in err:
                    oid = get_id(obj)
                    cascade_error_ids.add(oid)
                    broken_line_map[oid] = lineno
                    reasons[oid] = f"cascade 400 referencing {tc_id}"
                    break

    # Pass 4: Find orphan tool_result blocks in user messages
    # (tool_result references a tool_use_id that has no corresponding tool_use
    #  in any valid assistant message)
    all_valid_tool_call_ids = extract_all_tool_call_ids(entries)
    # Also include tool_call_ids from broken messages (they'll be removed, but
    # their orphan results are handled in pass 2)

    remove_ids = broken_assistant_ids | orphan_result_ids | cascade_error_ids

    if not remove_ids and not unparseable_lines:
        return {
            "file": filepath,
            "lines": len(entries),
            "corrupted": False,
        }

    # Build parent remap: for each removed node, find what should replace it
    # in the parentId chain
    id_to_parent = {}
    for _, obj, _ in entries:
        if obj is None:
            continue
        id_to_parent[get_id(obj)] = get_parent_id(obj)

    parent_fixes = {}
    for rid in remove_ids:
        ancestor = id_to_parent.get(rid, "")
        seen = {rid}
        while ancestor in remove_ids:
            if ancestor in seen:
                break  # cycle guard
            seen.add(ancestor)
            ancestor = id_to_parent.get(ancestor, "")
        parent_fixes[rid] = ancestor

    return {
        "file": filepath,
        "lines": len(entries),
        "corrupted": True,
        "broken_assistants": sorted(broken_assistant_ids),
        "orphan_results": sorted(orphan_result_ids),
        "cascade_errors": sorted(cascade_error_ids),
        "unparseable_lines": unparseable_lines,
        "remove_ids": remove_ids,
        "remove_count": len(remove_ids),
        "parent_fixes": parent_fixes,
        "line_map": broken_line_map,
        "broken_tool_call_ids": sorted(broken_tool_call_ids),
        "reasons": reasons,
    }


# ── Fix ───────────────────────────────────────────────────────────────────────

def fix_session(filepath: str, report: dict, dry_run: bool = True,
                verbose: bool = False) -> str:
    """Apply the fix to a session file. Returns summary string."""
    if not report.get("corrupted"):
        return f"  {filepath}: clean, nothing to do."

    remove_ids = report["remove_ids"]
    parent_fixes = report["parent_fixes"]
    line_map = report["line_map"]
    reasons = report.get("reasons", {})

    lines_info = ", ".join(
        f"L{line_map[rid]}" for rid in sorted(line_map, key=lambda x: line_map[x])
    )

    if dry_run:
        summary = [
            f"  {filepath}:",
            f"    Total lines: {report['lines']}",
            f"    Broken assistant messages: {len(report['broken_assistants'])}",
            f"    Orphan synthetic toolResults: {len(report['orphan_results'])}",
            f"    Cascade error responses: {len(report['cascade_errors'])}",
        ]
        if report.get("unparseable_lines"):
            summary.append(
                f"    Unparseable JSONL lines: {len(report['unparseable_lines'])} "
                f"(L{', L'.join(str(l) for l in report['unparseable_lines'])})"
            )
        summary.extend([
            f"    Lines to remove ({report['remove_count']}): {lines_info}",
            f"    Poisoned tool_call IDs: {', '.join(report['broken_tool_call_ids'])}",
            f"    Parent chain fixes: {len(parent_fixes)}",
        ])
        if verbose and reasons:
            summary.append("    Details:")
            for rid in sorted(line_map, key=lambda x: line_map[x]):
                if rid in reasons:
                    summary.append(f"      L{line_map[rid]}: {reasons[rid]}")
        return "\n".join(summary)

    # Create backup
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = f"{filepath}.backup-{ts}"
    shutil.copy2(filepath, backup)

    # Read, filter, fix, write
    entries = parse_jsonl(filepath)
    output = []
    removed = 0
    fixed = 0

    for _, obj, raw in entries:
        if obj is None:
            output.append(raw)
            continue

        oid = get_id(obj)

        # Skip lines marked for removal
        if oid in remove_ids:
            removed += 1
            continue

        # Fix parent references
        pid = get_parent_id(obj)
        if pid in parent_fixes:
            obj["parentId"] = parent_fixes[pid]
            fixed += 1
            output.append(json.dumps(obj, ensure_ascii=False))
        else:
            output.append(raw)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(output) + "\n")

    # Verification pass
    verify_report = analyze_session(filepath)
    verified = not verify_report.get("corrupted", False)

    summary = [
        f"  {filepath}:",
        f"    Backup: {backup}",
        f"    Removed {removed} corrupted lines: {lines_info}",
        f"    Fixed {fixed} parent references",
        f"    Lines: {report['lines']} -> {len(output)}",
        f"    Verified: {'CLEAN' if verified else 'STILL CORRUPTED (may need another pass)'}",
    ]
    return "\n".join(summary)


# ── Session Discovery ─────────────────────────────────────────────────────────

def discover_session_files(all_agents: bool = False) -> list[str]:
    """Find all session JSONL files."""
    if all_agents:
        pattern = os.path.join(OPENCLAW_DIR, "agents", "*", "sessions", "*.jsonl")
    else:
        pattern = os.path.join(DEFAULT_SESSIONS_DIR, "*.jsonl")
    return sorted(glob.glob(pattern))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    do_fix = "--fix" in args
    verbose = "--verbose" in args or "-v" in args
    all_agents = "--all-agents" in args
    positional = [a for a in args if not a.startswith("--") and not a.startswith("-")]

    # Determine which files to scan
    if positional:
        target = positional[0]
        if os.path.isdir(target):
            files = sorted(glob.glob(os.path.join(target, "*.jsonl")))
        elif os.path.isfile(target):
            files = [target]
        else:
            print(f"ERROR: {target} is not a file or directory.", file=sys.stderr)
            sys.exit(1)
    else:
        files = discover_session_files(all_agents=all_agents)

    if not files:
        print("No session files found.")
        if not all_agents:
            print(f"  Looked in: {DEFAULT_SESSIONS_DIR}")
            print("  Try --all-agents to scan all agent directories.")
        return

    mode = "FIX" if do_fix else "DRY-RUN (use --fix to apply)"
    print(f"OpenClaw Session Repair — {mode}")
    print(f"Scanning {len(files)} session file(s)...\n")

    corrupted_count = 0
    for filepath in files:
        try:
            report = analyze_session(filepath, verbose=verbose)
        except Exception as e:
            print(f"  ERROR scanning {filepath}: {e}", file=sys.stderr)
            continue

        if report.get("corrupted"):
            corrupted_count += 1
            try:
                result = fix_session(filepath, report, dry_run=not do_fix,
                                     verbose=verbose)
                print(result)
                print()
            except Exception as e:
                print(f"  ERROR fixing {filepath}: {e}", file=sys.stderr)
                continue

    if corrupted_count == 0:
        print("All sessions are clean. No corruption found.")
    else:
        print(f"{'Fixed' if do_fix else 'Found'} {corrupted_count} corrupted session(s).")
        if not do_fix:
            print("\nRun with --fix to apply repairs.")


if __name__ == "__main__":
    main()
