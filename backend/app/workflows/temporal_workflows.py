"""Durable Temporal.io Workflows, Saga Compensation, Retry Policies & HITL Signals."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from temporalio import activity, workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.core.security import HITLSecurityManager
    from app.schemas.contracts import (
        ConversionGoal,
        DurationPreset,
        RMTADiagnosisRequest,
        SocialChannel,
        TAMClassification,
    )
    from app.services.domain_engines import (
        append_learned_rule_file,
        calculate_ice_and_hooks,
        diagnose_rmta,
        generate_parametric_script,
    )
    from app.services.social_connectors import SocialCopyCraftEngine, get_connector_for_channel
    from app.workers.media_pipeline import run_full_media_pipeline


EXTERNAL_API_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=5),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=300),
    maximum_attempts=8,
)


@dataclass
class LifecycleWorkflowInput:
    project_id: str
    title: str
    impact: float
    confidence: float
    ease: float
    duration_preset: str = "STANDARD_SHORT"
    conversion_goal: str = "EMAIL_LEAD_CAPTURE"
    raw_media_url: str = ""
    channels: list[str] = field(default_factory=lambda: ["YouTube", "Instagram", "TikTok", "LinkedIn"])


@dataclass
class HITLApprovalSignal:
    token: str
    actor: str = "creator"


# --- Activities ---

@activity.defn
async def activity_research_and_score_ice(payload: dict[str, Any]) -> dict[str, Any]:
    res = calculate_ice_and_hooks(
        concept_title=payload["title"],
        impact=payload["impact"],
        confidence=payload["confidence"],
        ease=payload["ease"],
        tam_classification=TAMClassification(payload.get("tam_classification", "CORE_80")),
    )
    return res.model_dump(mode="json")


@activity.defn
async def activity_generate_parametric_script(payload: dict[str, Any]) -> dict[str, Any]:
    blocks, ab_variants, cta = generate_parametric_script(
        topic=payload["title"],
        preset=DurationPreset(payload.get("duration_preset", "STANDARD_SHORT")),
        goal=ConversionGoal(payload.get("conversion_goal", "EMAIL_LEAD_CAPTURE")),
    )
    return {
        "blocks": [b.model_dump(mode="json") for b in blocks],
        "ab_variants": [v.model_dump(mode="json") for v in ab_variants],
        "cta_text": cta,
    }


@activity.defn
async def activity_process_media_pipeline(payload: dict[str, Any]) -> dict[str, Any]:
    report = run_full_media_pipeline(
        project_id=payload["project_id"],
        raw_media_url=payload.get("raw_media_url", ""),
        script_text_hint=payload.get("script_text_hint"),
    )
    return report.model_dump(mode="json")


@activity.defn
async def activity_publish_social_channels(payload: dict[str, Any]) -> list[dict[str, Any]]:
    engine = SocialCopyCraftEngine()
    goal = ConversionGoal(payload.get("conversion_goal", "EMAIL_LEAD_CAPTURE"))
    copies = engine.generate_all_channels(
        headline=payload["title"],
        core_value=payload.get("core_value", payload["title"]),
        debate_question=payload.get("debate_question", "¿Sistemas o más horas manuales?"),
        thesis_points=payload.get("thesis_points", ["Sistemas > volumen", "Mide Watch Time Share"]),
        chapters=payload.get("chapters", [{"time": "00:00", "title": "Gancho"}]),
        goal=goal,
    )
    copy_by_channel = {c["channel"]: c for c in copies}
    results: list[dict[str, Any]] = []
    sec_mgr = HITLSecurityManager()

    for ch_name in payload.get("channels", ["YouTube", "Instagram", "TikTok", "LinkedIn"]):
        channel = SocialChannel(ch_name)
        connector = get_connector_for_channel(channel)
        pub_res = await connector.publish(
            project_id=payload["project_id"],
            payload=copy_by_channel[ch_name],
            hitl_token=payload["hitl_token"],
            actor=payload.get("actor", "creator"),
            security_manager=sec_mgr,
        )
        results.append(pub_res)
    return results


@activity.defn
async def activity_run_closed_loop_audit(payload: dict[str, Any]) -> dict[str, Any]:
    req = RMTADiagnosisRequest(
        window_type=payload.get("window_type", "7d"),
        views=payload.get("views", 32000),
        baseline_views=payload.get("baseline_views", 10000),
        hold_rate_3s=payload.get("hold_rate_3s", 68.0),
        completion_rate=payload.get("completion_rate", 56.0),
        sends_per_reach=payload.get("sends_per_reach", 2.9),
    )
    diag = diagnose_rmta(req)
    append_learned_rule_file(
        {
            "project_id": payload["project_id"],
            "rmta_classification": diag.rmta_classification,
            "diagnosis_layer": diag.diagnosis_layer,
            "rule_statement": diag.learned_rule_statement,
        }
    )
    return diag.model_dump(mode="json")


@activity.defn
async def activity_compensate_saga_rollback(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "compensated": True,
        "project_id": payload["project_id"],
        "reason": payload.get("reason", "Workflow rejected or failed"),
        "final_state": "ARCHIVED",
    }


# --- Workflows ---

@workflow.defn
class MediaProcessingWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await workflow.execute_activity(
            activity_process_media_pipeline,
            payload,
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )


@workflow.defn
class PublishingWorkflow:
    def __init__(self) -> None:
        self._publish_signal: HITLApprovalSignal | None = None
        self._rejected_reason: str | None = None

    @workflow.signal(name="ApprovePublishingTier3")
    def approve_publishing_tier3(self, signal: HITLApprovalSignal) -> None:
        self._publish_signal = signal

    @workflow.signal(name="RejectAndRevise")
    def reject_and_revise(self, reason: str) -> None:
        self._rejected_reason = reason

    @workflow.run
    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        await workflow.wait_condition(
            lambda: self._publish_signal is not None or self._rejected_reason is not None,
            timeout=timedelta(hours=1),
        )
        if self._rejected_reason is not None:
            return await workflow.execute_activity(
                activity_compensate_saga_rollback,
                {"project_id": payload["project_id"], "reason": self._rejected_reason},
                start_to_close_timeout=timedelta(seconds=30),
            )
        assert self._publish_signal is not None
        publish_payload = {
            **payload,
            "hitl_token": self._publish_signal.token,
            "actor": self._publish_signal.actor,
        }
        results = await workflow.execute_activity(
            activity_publish_social_channels,
            publish_payload,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        return {"status": "PUBLISHED_LIVE", "publications": results}


@workflow.defn
class AnalyticsAuditWorkflow:
    @workflow.run
    async def run(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        audit_results: list[dict[str, Any]] = []
        for window, wait_delta in [
            ("24h", timedelta(seconds=1)),
            ("7d", timedelta(seconds=1)),
            ("30d", timedelta(seconds=1)),
        ]:
            await workflow.sleep(wait_delta)
            res = await workflow.execute_activity(
                activity_run_closed_loop_audit,
                {**payload, "window_type": window},
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=EXTERNAL_API_RETRY_POLICY,
            )
            audit_results.append({"window": window, "diagnosis": res})
        return audit_results


@workflow.defn
class ContentLifecycleWorkflow:
    """Master FSM Orchestrator with Saga Compensation and Tier 2 + Tier 3 HITL Signals."""

    def __init__(self) -> None:
        self.current_state = "INIT"
        self._production_signal: HITLApprovalSignal | None = None
        self._publish_signal: HITLApprovalSignal | None = None
        self._rejected_reason: str | None = None

    @workflow.signal(name="ApproveProduction")
    def approve_production(self, signal: HITLApprovalSignal) -> None:
        self._production_signal = signal

    @workflow.signal(name="ApprovePublishingTier3")
    def approve_publishing_tier3(self, signal: HITLApprovalSignal) -> None:
        self._publish_signal = signal

    @workflow.signal(name="RejectAndRevise")
    def reject_and_revise(self, reason: str) -> None:
        self._rejected_reason = reason

    @workflow.query
    def get_state(self) -> str:
        return self.current_state

    @workflow.run
    async def run(self, inp: LifecycleWorkflowInput) -> dict[str, Any]:
        self.current_state = "CAPTURED"

        ice_res = await workflow.execute_activity(
            activity_research_and_score_ice,
            {"title": inp.title, "impact": inp.impact, "confidence": inp.confidence, "ease": inp.ease},
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        if not ice_res["threshold_met"]:
            self.current_state = "ARCHIVED"
            return await workflow.execute_activity(
                activity_compensate_saga_rollback,
                {"project_id": inp.project_id, "reason": f"ICE {ice_res['ice_score']} < 7.0"},
                start_to_close_timeout=timedelta(seconds=30),
            )

        self.current_state = "RESEARCHED_TRIAGED"
        script_res = await workflow.execute_activity(
            activity_generate_parametric_script,
            {
                "title": inp.title,
                "duration_preset": inp.duration_preset,
                "conversion_goal": inp.conversion_goal,
            },
            start_to_close_timeout=timedelta(minutes=3),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        self.current_state = "SCRIPTED_PACKAGED"

        # Tier 2 HITL Gate: Wait for ApproveProduction signal
        await workflow.wait_condition(
            lambda: self._production_signal is not None or self._rejected_reason is not None,
            timeout=timedelta(hours=24),
        )
        if self._rejected_reason:
            self.current_state = "ARCHIVED"
            return await workflow.execute_activity(
                activity_compensate_saga_rollback,
                {"project_id": inp.project_id, "reason": self._rejected_reason},
                start_to_close_timeout=timedelta(seconds=30),
            )

        self.current_state = "HITL_PENDING_PRODUCTION"
        media_qc = await workflow.execute_activity(
            activity_process_media_pipeline,
            {"project_id": inp.project_id, "raw_media_url": inp.raw_media_url},
            start_to_close_timeout=timedelta(minutes=10),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        self.current_state = "PRODUCED_VALIDATED"

        # Tier 3 HITL Gate: Wait for ApprovePublishingTier3 signal
        self.current_state = "HITL_PENDING_PUBLISH"
        await workflow.wait_condition(
            lambda: self._publish_signal is not None or self._rejected_reason is not None,
            timeout=timedelta(hours=1),
        )
        if self._rejected_reason:
            self.current_state = "ARCHIVED"
            return await workflow.execute_activity(
                activity_compensate_saga_rollback,
                {"project_id": inp.project_id, "reason": self._rejected_reason},
                start_to_close_timeout=timedelta(seconds=30),
            )

        assert self._publish_signal is not None
        pub_results = await workflow.execute_activity(
            activity_publish_social_channels,
            {
                "project_id": inp.project_id,
                "title": inp.title,
                "conversion_goal": inp.conversion_goal,
                "channels": inp.channels,
                "hitl_token": self._publish_signal.token,
                "actor": self._publish_signal.actor,
            },
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        self.current_state = "PUBLISHED_LIVE"

        audit = await workflow.execute_activity(
            activity_run_closed_loop_audit,
            {"project_id": inp.project_id, "window_type": "7d"},
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=EXTERNAL_API_RETRY_POLICY,
        )
        self.current_state = "AUDITED_CLOSED_LOOP"

        return {
            "project_id": inp.project_id,
            "final_state": self.current_state,
            "ice": ice_res,
            "script": script_res,
            "media_qc": media_qc,
            "publications": pub_results,
            "audit": audit,
        }
