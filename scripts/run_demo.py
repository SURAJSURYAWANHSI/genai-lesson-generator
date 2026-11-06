"""Runs the assessment demonstration against a live backend and saves the results.

Usage (backend already running):
    backend/.venv/Scripts/python scripts/run_demo.py [--base-url http://127.0.0.1:8000]

Each of the 12 expected steps from the brief is checked against the data the API returned.
Exit code 0 means every step was confirmed.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import httpx

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "outputs" / "demo"
DEMO_REQUEST = {
    "topic": "Introduction to RAG (Retrieval-Augmented Generation)",
    "demo_mode": True,
    "error_injection": "missing_practical_example",
    "max_retries": 2,
}


def stream_run(client: httpx.Client) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    stages: list[dict[str, Any]] = []
    final: dict[str, Any] | None = None
    event = None
    with client.stream("POST", "/api/v1/lessons/generate/stream", json=DEMO_REQUEST) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line.startswith("event: "):
                event = line[7:]
            elif line.startswith("data: "):
                data = json.loads(line[6:])
                if event == "stage":
                    stages.append(data)
                    if data["event"] == "complete":
                        print(f"  [{data['attempt']}] {data['node']}")
                elif event == "complete":
                    final = data
                elif event == "error":
                    raise SystemExit(f"The run failed: {data['message']}")
    if final is None:
        raise SystemExit("The stream ended without a final result.")
    return stages, final


def lesson_to_markdown(lesson: dict[str, Any]) -> str:
    example = lesson["practical_example"]
    lines = [f"# {lesson['title']}", "", "## Introduction", lesson["introduction"], "",
             "## What it means", lesson["what_it_means"], "", "## Why it matters", lesson["why_it_matters"], "",
             "## Important components"]
    lines += [f"- **{item['name']}:** {item['explanation']}" for item in lesson["important_components"]]
    lines += ["", "## Step by step"]
    lines += [f"{step['step_number']}. **{step['title']}:** {step['explanation']}" for step in lesson["step_by_step_process"]]
    lines += ["", "## Real-world analogy", lesson["real_world_analogy"], "", "## Practical example", example["scenario"], "",
              f"**Question:** {example['starting_input']}", "", "**Documents:**"]
    lines += [f"- *{item['title']}:* {item['content']}" for item in example["source_materials"]]
    lines += ["", f"**Selected:** {', '.join(example['selected_materials'])}", "", "**Prompt given to the model:**", "",
              "```text", example["intermediate_step"], "```", "", f"**Answer:** {example['final_result']}", "",
              "## Example walkthrough"]
    lines += [f"{step['step_number']}. {step['action']} {step['result']}" for step in lesson["example_walkthrough"]]
    lines += ["", "## Terminology"]
    lines += [f"- **{item['term']}:** {item['simple_explanation']}" for item in lesson["terminology"]]
    lines += ["", "## Common mistakes"]
    lines += [f"- **{item['misconception']}** {item['correction']}" for item in lesson["common_mistakes"]]
    lines += ["", "## Summary", lesson["summary"], "", "## Key takeaways"]
    lines += [f"- {item}" for item in lesson["key_takeaways"]]
    lines += ["", "## Check your knowledge"]
    lines += [f"{item['number']}. {item['question']}" for item in lesson["knowledge_check_questions"]]
    lines += ["", "## Answers"]
    lines += [f"{item['number']}. {item['answer']}" for item in lesson["knowledge_check_answers"]]
    return "\n".join(lines) + "\n"


def write_json(name: str, data: Any) -> None:
    (OUTPUT_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    with httpx.Client(base_url=args.base_url, timeout=900) as client:
        health = client.get("/api/v1/health").json()
        print(f"Provider: {health['generator_provider']} ({health['generator_model']}), mock mode: {health['mock_mode']}")
        print("Running the workflow:")
        _, final = stream_run(client)
        run_id = final["run_id"]
        detail = client.get(f"/api/v1/lessons/{run_id}").json()
        versions = client.get(f"/api/v1/lessons/{run_id}/versions").json()
        evaluations = client.get(f"/api/v1/lessons/{run_id}/evaluations").json()
        rejections = client.get(f"/api/v1/lessons/{run_id}/rejections").json()
        strategies = client.get("/api/v1/memory", params={"memory_type": "correction_strategy"}).json()

    first_failed = [c["criterion_id"] for c in evaluations[0]["checks"] if c["status"] == "FAIL"] if evaluations else []
    steps: list[tuple[str, bool, str]] = [
        ("Generate initial lesson", len(versions) >= 1 and versions[0]["source"] == "generator", f"version 1 from {versions[0]['model_provider']}"),
        ("Inject the deliberate error", versions[0]["is_injected"], str(versions[0]["injected_error_type"])),
        ("Evaluator identifies Q07 failure", "Q07" in first_failed, f"failed: {first_failed}"),
        ("Lesson receives FAIL status", evaluations[0]["status"] == "FAIL", evaluations[0]["status"]),
        ("Rejection log records evidence", bool(rejections) and bool(rejections[0]["failed_checks"][0]["evidence"]), rejections[0]["failed_checks"][0]["evidence"][:90] if rejections else ""),
        ("Retry agent generates correction feedback", bool(rejections and rejections[0]["generator_feedback"]), f"revise: {rejections[0]['generator_feedback']['sections_to_revise']}" if rejections else ""),
        ("Generator creates revised lesson", len(versions) >= 2 and versions[1]["source"] == "revision", f"changed: {versions[1]['changed_sections']}" if len(versions) > 1 else ""),
        ("Evaluator checks revised lesson", len(evaluations) >= 2, f"{len(evaluations)} evaluations"),
        ("Lesson passes all criteria", bool(evaluations) and all(c["status"] == "PASS" for c in evaluations[-1]["checks"]), f"{sum(c['status'] == 'PASS' for c in evaluations[-1]['checks'])}/10 PASS"),
        ("Final lesson is published", final["status"] == "PASS" and final["final_lesson"] is not None, f"status {final['status']}, version {detail['final_version']}"),
        ("Rejection log remains accessible", len(rejections) >= 1, f"{len(rejections)} entries at /lessons/{run_id}/rejections"),
        ("Memory records the correction strategy", any(s["criterion_id"] == "Q07" and s["source_run_id"] == run_id for s in strategies), "Q07 strategy from this run"),
    ]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    if final["final_lesson"]:
        (OUTPUT_DIR / "final_lesson.md").write_text(lesson_to_markdown(final["final_lesson"]), encoding="utf-8")
        write_json("final_lesson.json", final["final_lesson"])
    write_json("evaluation_report.json", evaluations)
    write_json("rejection_log.json", rejections)
    write_json("error_injection.json", detail["error_injection"])

    print("\nExpected behaviour:")
    report = [
        "# Assessment demonstration result", "",
        f"- Run ID: `{run_id}`",
        f"- Provider: {health['generator_provider']} ({health['generator_model']})",
        f"- Mock mode: {health['mock_mode']}",
        f"- Status: {final['status']} after {final['attempts']} generations",
        f"- Injection: {detail['error_injection']['type']}, detected {detail['error_injection']['detected']}, corrected {detail['error_injection']['corrected']}",
        "", "| # | Step | Result | Detail |", "|---|---|---|---|",
    ]
    for number, (name, passed, info) in enumerate(steps, start=1):
        print(f"  {'OK  ' if passed else 'FAIL'} {number:>2}. {name}: {info}")
        report.append(f"| {number} | {name} | {'OK' if passed else 'FAIL'} | {info.replace('|', '/')} |")
    (OUTPUT_DIR / "demo_result.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    confirmed = all(passed for _, passed, _ in steps)
    print(f"\n{'All 12 steps confirmed.' if confirmed else 'Some steps FAILED.'} Results saved in {OUTPUT_DIR}")
    return 0 if confirmed else 1


if __name__ == "__main__":
    sys.exit(main())
