"""Controlled self-evolution: analyse history, propose changes, apply only with human approval.

Analysis is plain counting over stored evaluations, so every proposal can be traced back to
its evidence. Nothing here changes a prompt or the rubric except approve() and rollback().
"""

import copy
import logging
from collections import Counter, defaultdict
from typing import Any

from sqlalchemy import select

from app.core.config import Settings
from app.core.errors import ProposalNotFoundError, ProposalStateError
from app.db.models import (
    AgentMemory,
    Evaluation,
    EvaluationCheck,
    EvolutionProposal,
    LessonRun,
    PromptVersion,
    RubricVersion,
    utcnow,
)
from app.db.session import session_scope
from app.memory.memory_store import (
    CORRECTION_STRATEGY,
    CRITERION_GUIDANCE,
    GLOBAL_TOPIC,
    TOPIC_PATTERN,
)
from app.prompts.generator_prompt import GENERATOR_PROMPT_NAME
from app.validators.rubric import CRITERION_NAMES, assert_additive_change

logger = logging.getLogger(__name__)

PENDING = "PENDING"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
ROLLED_BACK = "ROLLED_BACK"

GENERATOR_PROMPT_CHANGE = "generator_prompt"
INSTRUCTIONAL_STRATEGY = "instructional_strategy"
TOPIC_GUIDANCE = "topic_guidance"
RUBRIC_IMPROVEMENT = "rubric_improvement"

_IMPROVEMENTS_HEADING = "\n\nApproved improvements from past evaluations:"
_MIN_TOPIC_RUNS = 2
_TOPIC_FAILURE_RATE = 0.5
_MIN_EXHAUSTED_RUNS = 2


def _proposal_dict(proposal: EvolutionProposal) -> dict[str, Any]:
    return {
        "id": proposal.id,
        "proposal_type": proposal.proposal_type,
        "target": proposal.target,
        "criterion_id": proposal.criterion_id,
        "topic_key": proposal.topic_key,
        "title": proposal.title,
        "proposed_change": proposal.proposed_change,
        "rationale": proposal.rationale,
        "evidence": proposal.evidence,
        "status": proposal.status,
        "previous_version": proposal.previous_version,
        "resulting_version": proposal.resulting_version,
        "baseline_metrics": proposal.baseline_metrics,
        "decided_by": proposal.decided_by,
        "decision_note": proposal.decision_note,
        "decided_at": proposal.decided_at,
        "created_at": proposal.created_at,
    }


class EvolutionEngine:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def _include_demo(self) -> bool:
        return self.settings.evolution_include_demo_runs and not self.settings.is_production

    def _runs(self, session) -> list[LessonRun]:
        query = select(LessonRun)
        if not self._include_demo:
            query = query.where(LessonRun.demo_mode.is_(False))
        return list(session.scalars(query))

    def _analyse(self, session) -> dict[str, Any]:
        runs = self._runs(session)
        run_by_id = {run.id: run for run in runs}
        rows = session.execute(
            select(EvaluationCheck, Evaluation)
            .join(Evaluation, EvaluationCheck.evaluation_id == Evaluation.id)
            .where(EvaluationCheck.status == "FAIL")
        ).all()

        criteria: dict[str, dict[str, Any]] = {}
        sections: Counter[str] = Counter()
        first_attempt_failed: set[str] = set()
        topic_criteria: dict[str, Counter[str]] = defaultdict(Counter)
        for check, evaluation in rows:
            run = run_by_id.get(evaluation.run_id)
            if run is None:
                continue
            stats = criteria.setdefault(
                check.criterion_id,
                {"failures": 0, "demo_failures": 0, "runs": set()},
            )
            stats["failures"] += 1
            stats["demo_failures"] += 1 if run.demo_mode else 0
            stats["runs"].add(run.id)
            sections.update(check.affected_sections)
            topic_criteria[run.topic_key][check.criterion_id] += 1
            if evaluation.attempt_number == 1:
                first_attempt_failed.add(run.id)

        topics: dict[str, dict[str, int]] = defaultdict(lambda: {"runs": 0, "first_attempt_failures": 0})
        for run in runs:
            if run.attempts > 0:
                topics[run.topic_key]["runs"] += 1
                topics[run.topic_key]["first_attempt_failures"] += run.id in first_attempt_failed

        finished = [run for run in runs if run.status in ("PASS", "REJECTED")]
        regeneration = Counter(str(run.attempts) for run in finished)
        strategies = session.scalars(
            select(AgentMemory).where(
                AgentMemory.memory_type == CORRECTION_STRATEGY,
                AgentMemory.topic_key == GLOBAL_TOPIC,
                AgentMemory.is_active,
            )
        ).all()
        return {
            "total_runs": len(runs),
            "demo_runs": sum(run.demo_mode for run in runs),
            "includes_demo_runs": self._include_demo,
            "frequent_failures": [
                {
                    "criterion_id": cid,
                    "criterion_name": CRITERION_NAMES[cid],
                    "failures": stats["failures"],
                    "demo_failures": stats["demo_failures"],
                    "runs_affected": len(stats["runs"]),
                }
                for cid, stats in sorted(criteria.items(), key=lambda item: -item[1]["failures"])
            ],
            "content_weaknesses": [{"section": name, "failures": count} for name, count in sections.most_common()],
            "regeneration_patterns": {
                "attempts_distribution": dict(regeneration),
                "runs_needing_regeneration": sum(run.attempts > 1 for run in finished),
                "runs_finished": len(finished),
            },
            "effective_strategies": [
                {
                    "criterion_id": item.criterion_id,
                    "strategy": item.content,
                    "successes": item.success_count,
                    "demo_occurrences": item.demo_occurrences,
                }
                for item in strategies
            ],
            "topic_failure_rates": [
                {
                    "topic_key": topic,
                    "runs": stats["runs"],
                    "first_attempt_failures": stats["first_attempt_failures"],
                    "failure_rate": round(stats["first_attempt_failures"] / stats["runs"], 3),
                    "top_criterion": topic_criteria[topic].most_common(1)[0][0] if topic_criteria[topic] else None,
                }
                for topic, stats in sorted(topics.items())
            ],
        }

    def analysis(self) -> dict[str, Any]:
        with session_scope() as session:
            return self._analyse(session)

    def _exhausted_counts(self, session) -> Counter[str]:
        """Criteria still failing on the last attempt of rejected runs."""
        rejected = [run for run in self._runs(session) if run.status == "REJECTED"]
        counts: Counter[str] = Counter()
        for run in rejected:
            if run.evaluations:
                counts.update(check.criterion_id for check in run.evaluations[-1].checks if check.status == "FAIL")
        return counts

    def _should_propose(self, session, fingerprint: str, count: int, step: int) -> bool:
        existing = session.scalars(
            select(EvolutionProposal).where(EvolutionProposal.fingerprint == fingerprint)
        ).all()
        if any(item.status in (PENDING, APPROVED) for item in existing):
            return False
        # A rejected or rolled-back idea only returns once clearly more evidence exists.
        return all(count >= item.evidence.get("count", 0) + step for item in existing)

    def generate_proposals(self) -> list[dict[str, Any]]:
        """Create proposals where the evidence meets its threshold. Applies nothing."""
        created: list[EvolutionProposal] = []
        with session_scope() as session:
            analysis = self._analyse(session)

            def propose(fingerprint: str, count: int, step: int, **fields: Any) -> None:
                if self._should_propose(session, fingerprint, count, step):
                    proposal = EvolutionProposal(fingerprint=fingerprint, status=PENDING, **fields)
                    session.add(proposal)
                    created.append(proposal)

            for item in analysis["frequent_failures"]:
                if item["failures"] < self.settings.evolution_min_failures:
                    continue
                cid = item["criterion_id"]
                propose(
                    f"{GENERATOR_PROMPT_CHANGE}:{cid}",
                    item["failures"],
                    self.settings.evolution_min_failures,
                    proposal_type=GENERATOR_PROMPT_CHANGE,
                    target=GENERATOR_PROMPT_NAME,
                    criterion_id=cid,
                    title=f"Strengthen generator instructions for {cid} {item['criterion_name']}",
                    proposed_change=CRITERION_GUIDANCE[cid],
                    rationale=f"{cid} failed {item['failures']} times across {item['runs_affected']} runs.",
                    evidence={
                        "count": item["failures"],
                        "demo_failures": item["demo_failures"],
                        "organic_failures": item["failures"] - item["demo_failures"],
                        "runs_affected": item["runs_affected"],
                    },
                )

            for item in analysis["effective_strategies"]:
                if item["successes"] < self.settings.evolution_min_strategy_successes:
                    continue
                cid = item["criterion_id"]
                propose(
                    f"{INSTRUCTIONAL_STRATEGY}:{cid}",
                    item["successes"],
                    self.settings.evolution_min_strategy_successes,
                    proposal_type=INSTRUCTIONAL_STRATEGY,
                    target=GENERATOR_PROMPT_NAME,
                    criterion_id=cid,
                    title=f"Adopt the proven correction strategy for {cid} {CRITERION_NAMES[cid]}",
                    proposed_change=item["strategy"],
                    rationale=f"This correction made {cid} pass on {item['successes']} revisions.",
                    evidence={
                        "count": item["successes"],
                        "demo_occurrences": item["demo_occurrences"],
                    },
                )

            for item in analysis["topic_failure_rates"]:
                if (
                    item["runs"] < _MIN_TOPIC_RUNS
                    or item["failure_rate"] < _TOPIC_FAILURE_RATE
                    or not item["top_criterion"]
                ):
                    continue
                cid = item["top_criterion"]
                propose(
                    f"{TOPIC_GUIDANCE}:{item['topic_key']}",
                    item["first_attempt_failures"],
                    _MIN_TOPIC_RUNS,
                    proposal_type=TOPIC_GUIDANCE,
                    target="memory",
                    criterion_id=cid,
                    topic_key=item["topic_key"],
                    title=f"Add topic guidance for '{item['topic_key']}'",
                    proposed_change=CRITERION_GUIDANCE[cid],
                    rationale=(
                        f"{item['first_attempt_failures']} of {item['runs']} runs on this topic failed "
                        f"on the first attempt, most often on {cid}."
                    ),
                    evidence={
                        "count": item["first_attempt_failures"],
                        "runs": item["runs"],
                        "failure_rate": item["failure_rate"],
                        "top_criterion": cid,
                    },
                )

            for cid, count in self._exhausted_counts(session).items():
                if count < _MIN_EXHAUSTED_RUNS:
                    continue
                propose(
                    f"{RUBRIC_IMPROVEMENT}:{cid}",
                    count,
                    _MIN_EXHAUSTED_RUNS,
                    proposal_type=RUBRIC_IMPROVEMENT,
                    target="rubric",
                    criterion_id=cid,
                    title=f"Add evaluator guidance for {cid} {CRITERION_NAMES[cid]}",
                    proposed_change=(
                        f"When {cid} fails, quote the exact passage at fault and name the exact change needed, "
                        "so the next revision has clear direction."
                    ),
                    rationale=f"{cid} was still failing at the end of {count} rejected runs, so revisions are not resolving it.",
                    evidence={"count": count, "rejected_runs": count},
                )
            session.flush()
            return [_proposal_dict(proposal) for proposal in created]

    def list_proposals(self, status: str | None = None) -> list[dict[str, Any]]:
        with session_scope() as session:
            query = select(EvolutionProposal).order_by(EvolutionProposal.created_at.desc())
            if status:
                query = query.where(EvolutionProposal.status == status)
            return [_proposal_dict(proposal) for proposal in session.scalars(query)]

    def _get(self, session, proposal_id: str) -> EvolutionProposal:
        proposal = session.get(EvolutionProposal, proposal_id)
        if proposal is None:
            raise ProposalNotFoundError(f"Proposal {proposal_id} was not found.")
        return proposal

    def _baseline(self, session, proposal: EvolutionProposal) -> dict[str, Any]:
        analysis = self._analyse(session)
        failures = next(
            (
                item["failures"]
                for item in analysis["frequent_failures"]
                if item["criterion_id"] == proposal.criterion_id
            ),
            0,
        )
        return {"total_runs": analysis["total_runs"], "criterion_failures": failures}

    def approve(self, proposal_id: str, reviewer: str, note: str | None) -> dict[str, Any]:
        with session_scope() as session:
            proposal = self._get(session, proposal_id)
            if proposal.status != PENDING:
                raise ProposalStateError(f"Only a pending proposal can be approved. This one is {proposal.status}.")
            proposal.baseline_metrics = self._baseline(session, proposal)
            if proposal.proposal_type in (GENERATOR_PROMPT_CHANGE, INSTRUCTIONAL_STRATEGY):
                self._apply_prompt_change(session, proposal, reviewer)
            elif proposal.proposal_type == RUBRIC_IMPROVEMENT:
                self._apply_rubric_change(session, proposal, reviewer)
            elif proposal.proposal_type == TOPIC_GUIDANCE:
                self._apply_topic_guidance(session, proposal)
            proposal.status = APPROVED
            proposal.decided_by = reviewer
            proposal.decision_note = note
            proposal.decided_at = utcnow()
            session.flush()
            return _proposal_dict(proposal)

    def _apply_prompt_change(self, session, proposal: EvolutionProposal, reviewer: str) -> None:
        active = session.scalars(
            select(PromptVersion).where(PromptVersion.name == proposal.target, PromptVersion.is_active)
        ).one()
        content = active.content
        if _IMPROVEMENTS_HEADING not in content:
            content += _IMPROVEMENTS_HEADING
        content += f"\n- {proposal.proposed_change}"
        active.is_active = False
        session.flush()  # Only one active row may exist per prompt.
        session.add(
            PromptVersion(
                name=proposal.target,
                version=active.version + 1,
                content=content,
                is_active=True,
                change_summary=proposal.title,
                source_proposal_id=proposal.id,
                created_by=reviewer,
            )
        )
        proposal.previous_version = active.version
        proposal.resulting_version = active.version + 1

    def _apply_rubric_change(self, session, proposal: EvolutionProposal, reviewer: str) -> None:
        active = session.scalars(select(RubricVersion).where(RubricVersion.is_active)).one()
        definition = copy.deepcopy(active.definition)
        for criterion in definition["criteria"]:
            if criterion["id"] == proposal.criterion_id:
                criterion.setdefault("additional_guidance", []).append(proposal.proposed_change)
        assert_additive_change(active.definition, definition)
        active.is_active = False
        session.flush()
        session.add(
            RubricVersion(
                version=active.version + 1,
                definition=definition,
                is_active=True,
                change_summary=proposal.title,
                source_proposal_id=proposal.id,
                created_by=reviewer,
            )
        )
        proposal.previous_version = active.version
        proposal.resulting_version = active.version + 1

    def _apply_topic_guidance(self, session, proposal: EvolutionProposal) -> None:
        record = AgentMemory(
            memory_type=TOPIC_PATTERN,
            topic_key=proposal.topic_key,
            memory_key=proposal.id,
            criterion_id=proposal.criterion_id,
            content=proposal.proposed_change,
            occurrences=1,
            details={"proposal_id": proposal.id},
        )
        session.add(record)
        session.flush()
        proposal.applied_memory_id = record.id

    def reject(self, proposal_id: str, reviewer: str, note: str | None) -> dict[str, Any]:
        with session_scope() as session:
            proposal = self._get(session, proposal_id)
            if proposal.status != PENDING:
                raise ProposalStateError(f"Only a pending proposal can be rejected. This one is {proposal.status}.")
            proposal.status = REJECTED
            proposal.decided_by = reviewer
            proposal.decision_note = note
            proposal.decided_at = utcnow()
            session.flush()
            return _proposal_dict(proposal)

    def rollback(self, proposal_id: str, reviewer: str, note: str | None) -> dict[str, Any]:
        with session_scope() as session:
            proposal = self._get(session, proposal_id)
            if proposal.status != APPROVED:
                raise ProposalStateError(f"Only an approved proposal can be rolled back. This one is {proposal.status}.")
            if proposal.proposal_type == TOPIC_GUIDANCE:
                record = session.get(AgentMemory, proposal.applied_memory_id)
                if record is not None:
                    record.is_active = False
            else:
                self._restore_previous_version(session, proposal)
            proposal.status = ROLLED_BACK
            proposal.decided_by = reviewer
            proposal.decision_note = note
            proposal.decided_at = utcnow()
            session.flush()
            return _proposal_dict(proposal)

    def _restore_previous_version(self, session, proposal: EvolutionProposal) -> None:
        if proposal.proposal_type == RUBRIC_IMPROVEMENT:
            rows = {row.version: row for row in session.scalars(select(RubricVersion))}
        else:
            rows = {
                row.version: row
                for row in session.scalars(select(PromptVersion).where(PromptVersion.name == proposal.target))
            }
        current = rows.get(proposal.resulting_version)
        if current is None or not current.is_active:
            raise ProposalStateError(
                "A newer version has been applied since this proposal. Roll that one back first."
            )
        current.is_active = False
        session.flush()
        rows[proposal.previous_version].is_active = True

    def prompt_versions(self) -> list[dict[str, Any]]:
        with session_scope() as session:
            rows = session.scalars(
                select(PromptVersion).order_by(PromptVersion.name, PromptVersion.version.desc())
            ).all()
            return [
                {
                    "id": row.id,
                    "name": row.name,
                    "version": row.version,
                    "content": row.content,
                    "is_active": row.is_active,
                    "change_summary": row.change_summary,
                    "source_proposal_id": row.source_proposal_id,
                    "created_by": row.created_by,
                    "created_at": row.created_at,
                }
                for row in rows
            ]

    def metrics(self) -> list[dict[str, Any]]:
        """Outcomes per generator prompt version, to show whether a change actually helped."""
        with session_scope() as session:
            grouped: dict[int, dict[str, Any]] = {}
            for run in self._runs(session):
                if run.status not in ("PASS", "REJECTED") or run.prompt_version is None:
                    continue
                stats = grouped.setdefault(
                    run.prompt_version,
                    {"runs": 0, "demo_runs": 0, "passed": 0, "first_attempt_passes": 0, "attempts": 0, "failures": Counter()},
                )
                stats["runs"] += 1
                stats["demo_runs"] += run.demo_mode
                stats["passed"] += run.status == "PASS"
                stats["first_attempt_passes"] += run.status == "PASS" and run.attempts == 1
                stats["attempts"] += run.attempts
                for evaluation in run.evaluations:
                    stats["failures"].update(
                        check.criterion_id for check in evaluation.checks if check.status == "FAIL"
                    )
            return [
                {
                    "prompt_version": version,
                    "runs": stats["runs"],
                    "demo_runs": stats["demo_runs"],
                    "pass_rate": round(stats["passed"] / stats["runs"], 3),
                    "first_attempt_pass_rate": round(stats["first_attempt_passes"] / stats["runs"], 3),
                    "average_attempts": round(stats["attempts"] / stats["runs"], 2),
                    "criterion_failures": dict(stats["failures"]),
                }
                for version, stats in sorted(grouped.items())
            ]

    def safe_generate_proposals(self) -> None:
        """Analysis must never be able to change a run's outcome."""
        try:
            self.generate_proposals()
        except Exception:
            logger.exception("evolution_analysis_failed")
