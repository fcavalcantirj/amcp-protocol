#!/usr/bin/env python3
"""
AMCP HumanEval Benchmark Runner

Runs HumanEval problems and produces structured JSON output.
This is the foundation for agent skill benchmarking.

Usage:
    python humaneval_runner.py --problems 10 --output results.json
    python humaneval_runner.py --problem-ids "HumanEval/0,HumanEval/1"
"""

import argparse
import json
import sys
import time
from datetime import datetime
from typing import Optional
from pathlib import Path

from human_eval.data import read_problems
from human_eval.execution import check_correctness

# Deterministic subset for quick benchmarks
QUICK_SUBSET = [
    "HumanEval/0",   # has_close_elements
    "HumanEval/1",   # separate_paren_groups
    "HumanEval/2",   # truncate_number
    "HumanEval/4",   # mean_absolute_deviation
    "HumanEval/5",   # intersperse
    "HumanEval/6",   # parse_nested_parens
    "HumanEval/7",   # filter_by_substring
    "HumanEval/8",   # sum_product
    "HumanEval/9",   # rolling_max
    "HumanEval/10",  # make_palindrome
]

STANDARD_SUBSET = QUICK_SUBSET + [
    "HumanEval/11",  # string_xor
    "HumanEval/12",  # longest
    "HumanEval/13",  # greatest_common_divisor
    "HumanEval/14",  # all_prefixes
    "HumanEval/15",  # string_sequence
    "HumanEval/16",  # count_distinct_characters
    "HumanEval/17",  # parse_music
    "HumanEval/18",  # how_many_times
    "HumanEval/19",  # sort_numbers
    "HumanEval/20",  # find_closest_elements
    "HumanEval/21",  # rescale_to_unit
    "HumanEval/22",  # filter_integers
    "HumanEval/23",  # strlen
    "HumanEval/24",  # largest_divisor
    "HumanEval/25",  # factorize
    "HumanEval/26",  # remove_duplicates
    "HumanEval/27",  # flip_case
    "HumanEval/28",  # concatenate
    "HumanEval/29",  # filter_by_prefix
    "HumanEval/30",  # get_positive
]


def load_solutions(solutions_file: str) -> dict[str, str]:
    """Load solutions from JSON file."""
    with open(solutions_file) as f:
        return json.load(f)


def evaluate_solution(
    task_id: str,
    prompt: str,
    solution: str,
    test: str,
    entry_point: str,
    timeout: float = 5.0
) -> dict:
    """Evaluate a single solution."""
    # Combine prompt and solution
    full_code = prompt + solution
    
    # Run tests
    start_time = time.time()
    result = check_correctness(
        problem={"task_id": task_id, "prompt": prompt, "test": test, "entry_point": entry_point},
        completion=solution,
        timeout=timeout
    )
    elapsed_time = time.time() - start_time
    
    return {
        "task_id": task_id,
        "passed": result["passed"],
        "result": result.get("result", ""),
        "time_seconds": elapsed_time,
    }


def run_benchmark(
    solutions: dict[str, str],
    problem_ids: Optional[list[str]] = None,
    tier: str = "quick"
) -> dict:
    """Run benchmark and return structured results."""
    
    problems = read_problems()
    
    # Determine which problems to run
    if problem_ids:
        ids_to_run = problem_ids
    elif tier == "quick":
        ids_to_run = QUICK_SUBSET
    elif tier == "standard":
        ids_to_run = STANDARD_SUBSET
    else:  # full
        ids_to_run = list(problems.keys())
    
    results = []
    passed = 0
    failed = 0
    skipped = 0
    
    for task_id in ids_to_run:
        if task_id not in problems:
            print(f"Warning: {task_id} not found in problems", file=sys.stderr)
            skipped += 1
            continue
            
        if task_id not in solutions:
            print(f"Warning: No solution for {task_id}", file=sys.stderr)
            results.append({
                "task_id": task_id,
                "passed": False,
                "result": "NO_SOLUTION",
                "time_seconds": 0,
            })
            failed += 1
            continue
        
        problem = problems[task_id]
        result = evaluate_solution(
            task_id=task_id,
            prompt=problem["prompt"],
            solution=solutions[task_id],
            test=problem["test"],
            entry_point=problem["entry_point"]
        )
        
        results.append(result)
        if result["passed"]:
            passed += 1
        else:
            failed += 1
    
    total = passed + failed
    accuracy = passed / total if total > 0 else 0
    
    return {
        "benchmark": "HumanEval",
        "version": "1.0.0",
        "tier": tier,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "accuracy": accuracy,
            "accuracy_percent": round(accuracy * 100, 2),
        },
        "tasks": results,
    }


def main():
    parser = argparse.ArgumentParser(description="AMCP HumanEval Benchmark Runner")
    parser.add_argument("--solutions", required=True, help="JSON file with solutions")
    parser.add_argument("--output", help="Output JSON file (default: stdout)")
    parser.add_argument("--tier", choices=["quick", "standard", "full"], default="quick")
    parser.add_argument("--problem-ids", help="Comma-separated problem IDs to run")
    
    args = parser.parse_args()
    
    solutions = load_solutions(args.solutions)
    
    problem_ids = None
    if args.problem_ids:
        problem_ids = [p.strip() for p in args.problem_ids.split(",")]
    
    results = run_benchmark(solutions, problem_ids=problem_ids, tier=args.tier)
    
    output = json.dumps(results, indent=2)
    
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Results written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
