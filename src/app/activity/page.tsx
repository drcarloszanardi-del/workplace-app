"use client";

import { useEffect, useState } from "react";

function fmt(raw?: string) {
  if (!raw) return "sin fecha";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("es-AR");
}

type ActivityPayload = {
  status?: Record<string, any>;
  recentEvents?: Record<string, any>[];
  staleMinutes?: number;
  watchdog?: Record<string, any>;
};

function fmtBoolean(value: unknown, yes = "si", no = "no") {
  return value ? yes : no;
}

function nowLabel() {
  return new Date().toLocaleString("es-AR");
}

function isAdministrativeArtifact(raw: unknown) {
  const artifact = String(raw || "").trim().toLowerCase();
  if (!artifact) return false;
  if (
    [
      "current_status.json",
      "activity.log.jsonl",
      "prioridades.md",
      "memory.md",
      "last_run.json",
      "jarvis.log",
      "jarvis.lock",
    ].some((blocked) => artifact.endsWith(blocked))
  ) {
    return true;
  }
  return (
    artifact.includes("/state/") ||
    artifact.includes("/logs/") ||
    artifact.includes("/memory/")
  );
}

function artifactKindLabel(raw: unknown) {
  const artifact = String(raw || "").trim();
  if (!artifact) return "sin artefacto";
  return isAdministrativeArtifact(artifact)
    ? "administrativo"
    : "material o externo";
}

function isWorkplaceArtifact(raw: unknown) {
  const artifact = String(raw || "").trim().toLowerCase();
  if (!artifact) return false;
  return [
    "/src/app/activity/",
    "/src/app/api/activity/",
    "/src/app/layout.tsx",
    "/src/lib/pilar-server.ts",
    "/src/lib/pilar-data.ts",
    "/src/lib/pilar-dashboard-data.ts",
    "/src/data/flujo-fondos.json",
    "src/app/activity/",
    "src/app/api/activity/",
    "src/app/layout.tsx",
    "src/lib/pilar-server.ts",
    "src/lib/pilar-data.ts",
    "src/lib/pilar-dashboard-data.ts",
    "src/data/flujo-fondos.json",
  ].some((marker) => artifact.includes(marker));
}

function isWorkplaceFocus(status: Record<string, any>) {
  if (typeof status.workplace_focus_visible === "boolean") {
    return status.workplace_focus_visible;
  }
  const task = String(status.task || "").trim().toUpperCase();
  const watchdogTask = String(status.watchdog?.task || "")
    .trim()
    .toUpperCase();
  const artifact = String(
    status.last_material_artifact || status.watchdog_artifact || status.last_artifact || "",
  ).trim();
  return (
    task.startsWith("APP-001") ||
    watchdogTask.startsWith("APP-001") ||
    isWorkplaceArtifact(artifact)
  );
}

function classifyEventReality(event: Record<string, any>) {
  const evidenceClass = String(event.evidence_class || "").toLowerCase();
  const eventName = String(event.event || "").toLowerCase();
  const artifact = String(event.artifact || "").trim();
  const note = String(event.note || "").toLowerCase();
  const materialMarker = evidenceClass || eventName;
  const hasArtifact = Boolean(artifact);
  const adminOnly = hasArtifact && isAdministrativeArtifact(artifact);
  const noteLooksAdministrative =
    note.includes("solo hubo estado interno") ||
    note.includes("promesa") ||
    note.includes("intencion sin entregable") ||
    note.includes("build_needed") ||
    note.includes("bloqueo") ||
    note.includes("timeout") ||
    note.includes("sin entregable");
  const administrativeMarkers = [
    "decision",
    "status_update",
    "log_update",
    "instruction_only",
    "promise",
    "topic_sync",
    "idle",
    "parse_error",
    "build_needed",
    "blocked",
    "timeout",
  ];

  if (
    ["build_ok", "test_ok", "commit", "push", "deploy", "deliverable"].includes(
      materialMarker,
    ) &&
    !adminOnly
  ) {
    return {
      label: "SI",
      tone: "bg-emerald-500/15 text-emerald-200",
      reason: "evidencia verificable",
    };
  }

  if (
    adminOnly ||
    administrativeMarkers.includes(materialMarker) ||
    noteLooksAdministrative
  ) {
    return {
      label: "DUDOSO",
      tone: "bg-amber-500/15 text-amber-100",
      reason: adminOnly
        ? "solo toca artefactos administrativos"
        : "solo hubo estado interno o promesa",
    };
  }

  if (["code_change", "document_change", "artifact"].includes(materialMarker)) {
    return {
      label: "DUDOSO",
      tone: "bg-amber-500/15 text-amber-100",
      reason: "cambio material pendiente de validacion",
    };
  }

  return {
    label: hasArtifact ? "NO" : "DUDOSO",
    tone: hasArtifact
      ? "bg-rose-500/15 text-rose-100"
      : "bg-amber-500/15 text-amber-100",
    reason: hasArtifact
      ? "sin validacion material suficiente"
      : "sin evidencia material ni administrativa verificable",
  };
}

function getPushSummary(status: Record<string, any>) {
  const push = String(status.watchdog_push_at || "").trim();
  return push ? fmt(push) : "sin push reciente visible";
}

function getDeploySummary(status: Record<string, any>) {
  const deploy = String(status.watchdog_deploy_at || "").trim();
  return deploy ? fmt(deploy) : "sin deploy verificable reciente";
}

function getBuildSummary(status: Record<string, any>) {
  if (!status.watchdog_build_ok) return "sin build o test OK reciente";
  const label = String(status.watchdog_build_label || "build o test OK").trim();
  const build = String(
    status.watchdog_build_at ||
      status.last_verified_at ||
      status.watchdog_ts ||
      status.last_evidence_at ||
      "",
  ).trim();
  return build ? `${label}: ${fmt(build)}` : `${label} sin fecha clara`;
}

function getPendingSummary(status: Record<string, any>) {
  const pendingArtifact = String(status.last_pending_artifact || "").trim();
  const pendingAt = String(status.last_pending_at || "").trim();
  const diffSummary = String(status.watchdog_git_status_short || "").trim();

  if (pendingArtifact && pendingAt)
    return `${pendingArtifact} · ${fmt(pendingAt)}`;
  if (pendingArtifact) return pendingArtifact;
  if (pendingAt) return fmt(pendingAt);
  if (diffSummary)
    return `hay diff local sin artefacto pendiente clasificado · ${diffSummary}`;
  return "sin cambio pendiente visible";
}

function getNextVerificationStep(status: Record<string, any>) {
  const pendingArtifact = String(status.last_pending_artifact || "").trim();
  const pendingLabel = pendingArtifact.split("/").pop() || pendingArtifact;

  if (status.data_needs_regeneration) {
    return "recalcular o regenerar src/data/flujo-fondos.json fuera del cron y dejar validación liviana";
  }
  if (pendingArtifact.endsWith(".tsx") || pendingArtifact.endsWith(".ts")) {
    return pendingLabel
      ? `correr una validación liviana de ${pendingLabel} y dejar commit visible`
      : "correr una validación liviana del archivo tocado y dejar commit visible";
  }
  if (pendingArtifact.endsWith(".json")) {
    return pendingLabel
      ? `validar ${pendingLabel} y dejar trazabilidad clara de su regeneración o recálculo`
      : "validar el JSON y dejar trazabilidad clara de su regeneración o recálculo";
  }
  if (pendingArtifact) {
    return `dejar una prueba verificable de ${pendingLabel || "el artefacto pendiente"} (build, test, commit o entregable)`;
  }
  return "producir un cambio material verificable y luego validarlo";
}

function getEvidenceFreshnessSummary(status: Record<string, any>) {
  const age =
    typeof status.evidence_age_minutes === "number"
      ? status.evidence_age_minutes
      : null;
  const freshness = String(status.evidence_freshness || "").trim();
  const staleMinutes =
    typeof status.stale_minutes === "number" ? status.stale_minutes : null;
  if (age == null) return "sin referencia de antigüedad";
  if (freshness === "stale")
    return staleMinutes != null
      ? `${age} min (vencida, umbral ${staleMinutes} min)`
      : `${age} min (vencida)`;
  if (freshness === "fresh")
    return staleMinutes != null
      ? `${age} min (vigente, umbral ${staleMinutes} min)`
      : `${age} min (vigente)`;
  return `${age} min (sin clasificar)`;
}

function getRealArtifactSummary(status: Record<string, any>) {
  const materialArtifact = String(status.last_material_artifact || "").trim();
  const watchdogArtifact = String(status.watchdog_artifact || "").trim();
  const artifact =
    materialArtifact ||
    (watchdogArtifact && !isAdministrativeArtifact(watchdogArtifact)
      ? watchdogArtifact
      : "");
  const at = String(
    status.last_material_at || status.last_evidence_at || "",
  ).trim();
  if (!artifact && !at) return "sin artefacto material reciente";
  if (artifact && at) return `${artifact} · ${fmt(at)}`;
  return artifact || fmt(at);
}

function getTruthScopeReasonSummary(status: Record<string, any>) {
  return String(status.truth_scope_reason || "").trim() || "sin motivo visible";
}

function getVerifiedSummary(status: Record<string, any>) {
  const artifact = String(status.last_verified_artifact || "").trim();
  const at = String(status.last_verified_at || "").trim();
  if (!artifact && !at) return "sin prueba verificable reciente";
  if (artifact && at) return `${artifact} · ${fmt(at)}`;
  return artifact || fmt(at);
}

function getCommitSummary(status: Record<string, any>) {
  const commit = String(status.watchdog_commit_hash || "").trim();
  const at = String(status.watchdog_commit_at || "").trim();
  if (commit && at) return `${commit} · ${fmt(at)}`;
  if (commit) return commit;
  if (at) return fmt(at);
  return "sin commit reciente visible";
}

function getDeliverableSummary(status: Record<string, any>) {
  const artifact = String(status.last_deliverable_artifact || "").trim();
  const deliveredAt = String(status.last_deliverable_at || "").trim();
  if (artifact && deliveredAt) return `${artifact} · ${fmt(deliveredAt)}`;
  if (artifact) return artifact;
  if (deliveredAt) return fmt(deliveredAt);
  return "sin entregable verificable visible";
}

function getDataSourceSummary(status: Record<string, any>) {
  const source = String(status.data_source_workbook || "").trim();
  const generatedAt = String(status.data_generated_at || "").trim();
  if (source && generatedAt) return `${source} · ${fmt(generatedAt)}`;
  if (source) return source;
  if (generatedAt) return fmt(generatedAt);
  return "sin dataset visible";
}

function getCodexConsultSummary(status: Record<string, any>) {
  const state = String(status.codex_consult_state || "").trim();
  if (!state) return "sin consulta visible";
  if (state === "answered") {
    const answeredAt = String(status.codex_consult_answered_at || "").trim();
    return answeredAt ? `respondida · ${fmt(answeredAt)}` : "respondida";
  }
  if (state === "pending" || state === "processing") {
    return `en curso: ${state}`;
  }
  return state;
}

function getCodexConsultInstructionSummary(status: Record<string, any>) {
  const instruction = String(status.codex_consult_instruction || "").trim();
  if (!instruction) return "sin instrucción visible";
  return instruction;
}

function getCodexConsultActionSummary(status: Record<string, any>) {
  const action = String(status.codex_consult_action_status || "").trim();
  if (!action) return "sin acción visible";
  return action;
}

function getCodexConsultAppliedSummary(status: Record<string, any>) {
  if (status.codex_consult_applied === true) {
    return "sí, ya quedó aplicado con evidencia local";
  }
  if (status.codex_consult_applied === false) {
    return "no todavía, falta un paso chico verificable";
  }
  return "sin verificación visible";
}

function getCodexPostAnswerEvidenceSummary(status: Record<string, any>) {
  if (status.codex_consult_post_answer_evidence === true) {
    return "sí, hubo evidencia local posterior a la respuesta";
  }
  if (status.codex_consult_post_answer_evidence === false) {
    return "no, todavía no aparece evidencia local posterior a la respuesta";
  }
  return "sin dato visible";
}

function getCodexConsultAnswerPathSummary(status: Record<string, any>) {
  const answerPath = String(status.codex_consult_answer_path || "").trim();
  if (!answerPath) return "sin respuesta visible";
  return answerPath;
}

function getCodexPatchInspectionSummary(status: Record<string, any>) {
  const summary = String(status.codex_patch_inspection_summary || "").trim();
  if (!summary) return "sin inspección visible del parche sugerido por Codex";
  return summary;
}

function getPilarServerRiskSummary(status: Record<string, any>) {
  const summary = String(status.pilar_server_runtime_risk_summary || "").trim();
  if (!summary) return "sin revisión visible de src/lib/pilar-server.ts";
  return summary;
}

function getPilarServerAccessModeSummary(status: Record<string, any>) {
  const mode = String(status.pilar_server_data_access_mode || "").trim();
  if (!mode) return "sin modo visible";
  if (mode === "env_supabase_only") return "env_supabase_only · bundle-safe";
  if (mode === "runtime_fragile") return "runtime_fragile · revisar carga runtime";
  return mode;
}

function getPilarDataSourceSummary(status: Record<string, any>) {
  const summary = String(status.pilar_data_source_summary || "").trim();
  if (!summary) return "sin revisión visible de src/lib/pilar-data.ts";
  return summary;
}

function getDatasetFreshnessSummary(status: Record<string, any>) {
  const generatedAt = String(status.data_generated_at || "").trim();
  if (!generatedAt) return "sin dataset visible";
  const date = new Date(generatedAt);
  if (Number.isNaN(date.getTime())) return "dataset visible con fecha invalida";
  const ageHours = Math.max(
    0,
    Math.round((Date.now() - date.getTime()) / 3600000),
  );
  if (ageHours <= 24) return `${ageHours} h desde la regeneracion`;
  const ageDays = Math.round(ageHours / 24);
  return `${ageDays} d desde la regeneracion`;
}

function getPendingSourceSummary(status: Record<string, any>) {
  const label = String(status.data_pending_source_label || "").trim();
  const note = String(status.data_pending_source_note || "").trim();
  const origin = String(status.data_pending_source_origin || "").trim();
  const reconstructed = Boolean(status.data_pending_source_reconstructed);
  const openPendingCount =
    typeof status.data_open_pending_count === "number"
      ? status.data_open_pending_count
      : null;
  const staleHours =
    typeof status.data_pending_source_stale_hours === "number"
      ? status.data_pending_source_stale_hours
      : null;
  const verified = Boolean(status.data_pending_source_verified);
  const recalculatedAt = String(
    status.data_pending_source_recalculated_at || "",
  ).trim();
  const totalPending =
    typeof status.data_total_pending === "number"
      ? status.data_total_pending.toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        })
      : null;
  const originLabel =
    origin === "summary_fallback"
      ? " · monto recompuesto desde pendingByCategory"
      : origin === "json_pending_recalc_fallback"
        ? " · monto recompuesto desde el JSON actual"
        : origin === "records_preview_fallback"
          ? " · monto recompuesto desde recordsPreview del JSON actual"
          : origin === "metrics_total_pending"
            ? " · monto leído desde metrics.totalPending"
            : origin === "stale_records_preview_fallback"
              ? " · monto visible en recordsPreview de un JSON vencido"
              : origin === "stale_json" || origin === "stale_json_inconsistent_metrics"
                ? " · monto visible en JSON vencido"
                : reconstructed
                  ? " · monto recompuesto desde pendingByCategory"
                  : "";
  const countLabel =
    openPendingCount == null
      ? ""
      : ` · ${openPendingCount} movimiento${openPendingCount === 1 ? "" : "s"} abierto${openPendingCount === 1 ? "" : "s"}`;
  const amountLabel = totalPending !== null ? ` · ${totalPending}` : "";
  const freshnessLabel =
    staleHours == null
      ? ""
      : verified
        ? ` · regenerado hace ${staleHours} h`
        : ` · última regeneración hace ${staleHours} h`;
  const fallbackStamp =
    recalculatedAt && !verified
      ? ` · fallback recalculado ${fmt(recalculatedAt)}`
      : "";
  if (label && note)
    return `${label}${originLabel}${countLabel}${amountLabel}${freshnessLabel}${fallbackStamp} · ${note}`;
  if (label)
    return `${label}${originLabel}${countLabel}${amountLabel}${freshnessLabel}${fallbackStamp}`;
  if (note)
    return totalPending !== null
      ? `${totalPending}${originLabel}${freshnessLabel}${fallbackStamp} · ${note}`
      : `${note}${originLabel}${freshnessLabel}${fallbackStamp}`;
  return totalPending ?? "sin saldo pendiente clasificado";
}

function getPendingSourceAction(status: Record<string, any>) {
  const verified = Boolean(status.data_pending_source_verified);
  const origin = String(status.data_pending_source_origin || "").trim();
  const staleHours =
    typeof status.data_pending_source_stale_hours === "number"
      ? status.data_pending_source_stale_hours
      : null;

  if (verified) return "sin acción manual inmediata";
  if (
    origin === "json_pending_recalc_fallback" ||
    origin === "records_preview_fallback"
  ) {
    return "si hace falta un paso corto ahora, correr npm run flujo:data:recalc-pending; la regeneración completa con .venv + openpyxl queda fuera del cron";
  }
  if (
    origin === "stale_json" ||
    origin === "stale_json_inconsistent_metrics" ||
    origin === "stale_records_preview_fallback"
  ) {
    return staleHours != null && staleHours > 24
      ? "dataset vencido: usar npm run flujo:data:recalc-pending solo como paso corto y dejar la regeneración completa fuera del cron"
      : "revisar si el saldo visible sigue apoyado en un JSON vencido y, si hace falta un paso corto, usar npm run flujo:data:recalc-pending";
  }
  return "si hace falta validar el saldo, usar la guía docs/flujo-data-regeneration.md";
}

function getPendingSourceCommand(status: Record<string, any>) {
  const verified = Boolean(status.data_pending_source_verified);
  const origin = String(status.data_pending_source_origin || "").trim();

  if (verified) return null;
  if (
    origin === "json_pending_recalc_fallback" ||
    origin === "records_preview_fallback" ||
    origin === "stale_json" ||
    origin === "stale_json_inconsistent_metrics" ||
    origin === "stale_records_preview_fallback"
  ) {
    return [
      "npm run flujo:data:recalc-pending",
      "python3 -m json.tool src/data/flujo-fondos.json >/dev/null",
      "git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py",
    ].join("\n");
  }

  return [
    "python3 -m venv .venv",
    ".venv/bin/python -m pip install openpyxl",
    ".venv/bin/python scripts/build_flujo_data.py",
    "python3 -m json.tool src/data/flujo-fondos.json >/dev/null",
    "git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py",
  ].join("\n");
}

function getAdministrativeSummary(status: Record<string, any>) {
  const artifact = String(
    status.admin_trail || status.watchdog_status || "",
  ).trim();
  const at = String(status.admin_trail_at || status.watchdog_ts || "").trim();
  if (!artifact && !at) return "sin actividad administrativa visible";
  if (artifact && at) return `${artifact} · ${fmt(at)}`;
  return artifact || fmt(at);
}

function getTruthSourceSummary(status: Record<string, any>) {
  const source =
    status.watchdog_truth_signal && status.evidence_freshness === "fresh"
      ? "watchdog"
      : "heuristica local";
  const at = String(status.watchdog_ts || status.last_evidence_at || "").trim();
  return at ? `${source} · ${fmt(at)}` : source;
}

function getTruthScopeSummary(status: Record<string, any>) {
  const scope = String(status.truth_scope || "").trim();
  const reason = String(status.truth_scope_reason || "").trim();
  const label = String(status.evidence_front_label || "").trim() ||
    (scope === "app_001"
      ? "APP-001 directo"
      : scope === "other_front"
        ? "otro frente"
        : "global o incierto");
  return reason ? `${label} · ${reason}` : label;
}

function getWorkplaceFocusSummary(status: Record<string, any>) {
  const visible = isWorkplaceFocus(status);
  const reason = String(status.workplace_focus_reason || "").trim();
  if (reason) return `${visible ? "sí" : "no"} · ${reason}`;
  return visible ? "sí" : "no";
}

function getNextOperationalStep(
  status: Record<string, any>,
  truthSignal: Record<string, any>,
) {
  if (truthSignal.label === "SI") {
    return status.build_needed
      ? "Hay evidencia verificable reciente, pero sigue pendiente el build completo fuera del cron antes de cerrar APP-001."
      : "APP-001 puede cerrarse y pasar al siguiente frente.";
  }
  const pendingArtifact = String(
    status.last_pending_artifact || status.watchdog_artifact || "",
  ).trim();
  const needsRegeneration = Boolean(status.data_needs_regeneration);
  const regenerationReason = String(
    status.data_regeneration_reason || "",
  ).trim();
  const hasVisiblePendingAmount = typeof status.data_total_pending === "number";
  if (truthSignal.label === "DUDOSO") {
    if (needsRegeneration) {
      const origin = String(status.data_pending_source_origin || "").trim();
      const fallbackHint =
        origin === "records_preview_fallback" ||
        origin === "stale_records_preview_fallback"
          ? "Si no entra una regeneración completa en este microciclo, el saldo puede seguir visible desde recordsPreview, pero hace falta regenerar src/data/flujo-fondos.json fuera del cron antes de marcar SI."
          : "Si no entra una regeneración completa en este microciclo, usar solo npm run flujo:data:recalc-pending para recomputar el saldo sobre src/data/flujo-fondos.json.";
      const baseReason =
        regenerationReason ||
        "El dataset visible quedó vencido y conviene regenerarlo fuera del cron antes de marcar SI.";
      return `${baseReason} ${fallbackHint} Para regenerar completo afuera del cron, usar python3 -m venv /Users/jarvis/workplace-app/.venv && /Users/jarvis/workplace-app/.venv/bin/python -m pip install openpyxl && /Users/jarvis/workplace-app/.venv/bin/python scripts/build_flujo_data.py antes de validar.`;
    }
    if (
      pendingArtifact.includes("scripts/build_flujo_data.py") ||
      pendingArtifact.includes("src/data/flujo-fondos.json")
    ) {
      if (hasVisiblePendingAmount) {
        return `El saldo pendiente ya está visible en ${pendingArtifact}. Falta una validación verificable antes de marcar SI.`;
      }
      return `Falta una validación verificable para ${pendingArtifact}. Si regenerar desde Excel no entra en este microciclo, dejar build_needed y usar solo npm run flujo:data:recalc-pending sobre src/data/flujo-fondos.json. Para regenerar completo afuera del cron, usar python3 -m venv /Users/jarvis/workplace-app/.venv && /Users/jarvis/workplace-app/.venv/bin/python -m pip install openpyxl && /Users/jarvis/workplace-app/.venv/bin/python scripts/build_flujo_data.py antes de validar.`;
    }
    return pendingArtifact
      ? `Falta una validación verificable para ${pendingArtifact}. Si el build completo no entra en este microciclo, registrar build_needed y validar afuera del cron.`
      : "Hay cambio material pendiente de validación verificable.";
  }
  return needsRegeneration
    ? regenerationReason || "Hace falta regenerar el dataset visible fuera del cron antes de cerrar APP-001."
    : "Hace falta un cambio material visible antes de cerrar APP-001.";
}

function deriveTruthSignal(status: Record<string, any>, staleMinutes = 20) {
  const watchdog = status.watchdog || {};
  const watchdogSignal = String(
    status.watchdog_truth_signal ||
      status.truthSignal ||
      watchdog.truth_signal ||
      "",
  ).toUpperCase();
  const pendingArtifact = String(status.last_pending_artifact || "").trim();
  const pendingAt = String(status.last_pending_at || "").trim();
  const verifiedAt = String(
    status.last_verified_at || status.watchdog_build_at || "",
  ).trim();
  const detectedAt = String(
    status.last_material_at || pendingAt || status.last_evidence_at || "",
  ).trim();
  const materialAt = verifiedAt || detectedAt;
  const materialEvidence = String(
    status.last_material_artifact ||
      status.watchdog_artifact ||
      watchdog.artifact ||
      pendingArtifact ||
      "",
  ).trim();
  const adminEvidence = String(
    status.admin_trail ||
      watchdog.git_diff_stat ||
      watchdog.status ||
      "sin actividad administrativa reciente",
  );
  const evidenceAgeMinutes =
    typeof status.evidence_age_minutes === "number"
      ? status.evidence_age_minutes
      : null;
  const evidenceIsFresh =
    evidenceAgeMinutes == null ? false : evidenceAgeMinutes <= staleMinutes;

  if (["SI", "NO", "DUDOSO"].includes(watchdogSignal) && evidenceIsFresh) {
    const toneMap: Record<string, string> = {
      SI: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
      DUDOSO: "border-amber-400/30 bg-amber-500/10 text-amber-100",
      NO: "border-rose-400/30 bg-rose-500/10 text-rose-100",
    };
    const materialAt =
      watchdogSignal === "SI"
        ? verifiedAt || detectedAt
        : detectedAt || verifiedAt;
    return {
      label: watchdogSignal,
      tone: toneMap[watchdogSignal],
      reason: String(
        status.watchdog_reason ||
          status.truthReason ||
          watchdog.reason ||
          "watchdog objetivo",
      ),
      materialEvidence:
        materialEvidence ||
        (watchdogSignal === "NO"
          ? "sin artefacto material reciente"
          : "sin artefacto material claro"),
      materialAt,
      materialAtLabel:
        watchdogSignal === "SI"
          ? "Última evidencia material validada"
          : "Última evidencia material detectada",
      adminEvidence,
      pendingArtifact,
      pendingAt,
      validationGap: String(status.validation_gap || "sin brecha explicita"),
    };
  }

  const evidenceClass = String(status.evidence_class || "").toLowerCase();
  const note = String(status.note || "").toLowerCase();
  const lastArtifact = String(status.last_artifact || "");
  const realArtifact = lastArtifact && !isAdministrativeArtifact(lastArtifact);

  if (
    ["build_ok", "test_ok", "commit", "push", "deploy", "deliverable"].includes(
      evidenceClass,
    )
  ) {
    return {
      label: "SI",
      tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
      reason: realArtifact
        ? "Hay evidencia material verificable."
        : "Hay evidencia marcada como material.",
      materialEvidence:
        materialEvidence ||
        (realArtifact
          ? lastArtifact
          : "evidencia material sin artefacto claro"),
      materialAt,
      materialAtLabel: "Última evidencia material validada",
      adminEvidence,
      pendingArtifact,
      pendingAt,
      validationGap: "ninguna, ya hay validacion verificable",
    };
  }

  if (["code_change", "document_change", "artifact"].includes(evidenceClass)) {
    return {
      label: "DUDOSO",
      tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
      reason: realArtifact
        ? "Hay cambio material, pero sigue pendiente una validacion verificable."
        : "Hay cambio material sin validacion verificable.",
      materialEvidence:
        materialEvidence ||
        (realArtifact ? lastArtifact : "cambio material sin artefacto claro"),
      materialAt: String(
        status.last_material_at || status.last_evidence_at || "",
      ),
      materialAtLabel: "Última evidencia material detectada",
      adminEvidence:
        pendingArtifact ||
        "falta build, test, commit, push o deploy para marcar SI",
      pendingArtifact,
      pendingAt,
      validationGap: "falta build, test, commit, push o deploy para marcar SI",
    };
  }

  if (
    ["instruction_only", "promise"].includes(evidenceClass) ||
    note.includes("no cuenta como producto real") ||
    note.includes("solo hubo estado interno")
  ) {
    return {
      label: "DUDOSO",
      tone: "border-amber-400/30 bg-amber-500/10 text-amber-100",
      reason:
        evidenceClass === "promise"
          ? "Solo hubo promesa o intencion sin entregable real."
          : "Solo hubo estado interno, pedido operativo o nota sin entregable real.",
      materialEvidence: materialEvidence || "sin evidencia material reciente",
      materialAt,
      materialAtLabel: "Última evidencia material detectada",
      adminEvidence,
      pendingArtifact,
      pendingAt,
      validationGap:
        "falta evidencia material verificable fuera de notas o estados internos",
    };
  }

  return {
    label: "NO",
    tone: "border-rose-400/30 bg-rose-500/10 text-rose-100",
    reason: materialEvidence
      ? "No hay validacion reciente para el ultimo artefacto material."
      : "No aparece evidencia material reciente.",
    materialEvidence: materialEvidence || "sin evidencia material reciente",
    materialAt,
    materialAtLabel: "Última evidencia material detectada",
    adminEvidence,
    pendingArtifact,
    pendingAt,
    validationGap: materialEvidence
      ? "falta una validacion reciente del ultimo artefacto material"
      : "falta evidencia material reciente",
  };
}

export default function ActivityPage() {
  const [data, setData] = useState<ActivityPayload>({
    status: { derived_state: "loading" },
    recentEvents: [],
    staleMinutes: 20,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        if (!res.ok) return;
        const next = await res.json();
        if (!cancelled) setData(next);
      } catch {}
    };
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const status = data.status || {};
  const recentEvents = Array.isArray(data.recentEvents)
    ? data.recentEvents
    : [];
  const effectiveStaleMinutes =
    typeof status.stale_minutes === "number" ? status.stale_minutes : data.staleMinutes || 20;
  const truthSignal = deriveTruthSignal(status, effectiveStaleMinutes);
  const pendingSourceVerified = Boolean(status.data_pending_source_verified);
  const pendingSourceCommand = getPendingSourceCommand(status);
  const workplaceFocusVisible = isWorkplaceFocus(status);
  const eventRealitySummary = recentEvents.reduce(
    (acc, event) => {
      const reality = classifyEventReality(event);
      if (reality.label === "SI") acc.real += 1;
      else if (reality.label === "DUDOSO") acc.dubious += 1;
      else acc.no += 1;
      return acc;
    },
    { real: 0, dubious: 0, no: 0 },
  );

  return (
    <main className="min-h-screen bg-[#07111f] px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Jarvis activity
          </div>
          <h1 className="mt-3 text-4xl font-semibold">
            Evidencia real de trabajo
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Esta vista muestra estado actual y eventos recientes derivados de
            evidencia local verificable, y separa evidencia material de
            actividad administrativa.
          </p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            CURRENT_STATUS, logs, memoria y prioridades no alcanzan por sí
            solos para marcar SI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1">
              SI: build, test, commit, push, deploy o entregable verificable
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1">
              DUDOSO: cambio real pendiente de validación o solo hubo estado interno
            </span>
            <span className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1">
              NO: sin evidencia material reciente
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/90">
                Cuenta como evidencia material
              </div>
              <div className="mt-2 leading-6">
                Cambio real en app, código, documento o PDF, más build o test OK, commit, push, deploy o entregable verificable.
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/90">
                No cuenta como evidencia material
              </div>
              <div className="mt-2 leading-6">
                Solo estado interno, logs, memoria, prioridades, decisiones o promesas sin validación verificable.
              </div>
            </div>
          </div>
        </header>

        <section
          className={`mt-6 rounded-[28px] border p-6 ${truthSignal.tone}`}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.25em]">
            {String(status.truth_signal_display || `Trabajando de verdad: ${truthSignal.label}`)}
          </div>
          <div className="mt-2 text-xs text-current/80">
            Referencia del semáforo: Trabajando de verdad: SI / NO / DUDOSO
          </div>
          <div className="mt-2 text-xs text-current/70">
            Esta vista se actualiza sola cada 30 segundos para reflejar evidencia local reciente.
          </div>
          <div className="mt-2 text-xs text-current/70">
            Última lectura local de esta pantalla: {nowLabel()}.
          </div>
          <div className="mt-3 text-4xl font-semibold">{truthSignal.label}</div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-current/90">
            {truthSignal.reason}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-current/85">
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Último artefacto material: {getRealArtifactSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Tipo del último artefacto visible:{" "}
              {artifactKindLabel(
                status.last_material_artifact ||
                  status.watchdog_artifact ||
                  status.last_artifact,
              )}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Última prueba verificable: {getVerifiedSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Commit visible: {getCommitSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Último cambio pendiente: {getPendingSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Brecha actual: {truthSignal.validationGap}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Siguiente validación sugerida: {getNextVerificationStep(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Última actividad administrativa:{" "}
              {getAdministrativeSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Fuente del semáforo: {getTruthSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Frente de la última evidencia: {String(status.evidence_front_label || "sin clasificar")}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Alcance del semáforo: {getTruthScopeSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Motivo del alcance: {getTruthScopeReasonSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Antigüedad de la evidencia: {getEvidenceFreshnessSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Foco APP-001 visible: {getWorkplaceFocusSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Dataset visible: {getDataSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Consulta Codex: {getCodexConsultSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Instrucción Codex: {getCodexConsultInstructionSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Acción sobre Codex: {getCodexConsultActionSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Aplicación de Codex: {getCodexConsultAppliedSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Evidencia posterior a Codex: {getCodexPostAnswerEvidenceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Inspección del parche Codex: {getCodexPatchInspectionSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Respuesta Codex: {getCodexConsultAnswerPathSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Pilar server compartido: {getPilarServerRiskSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Modo de acceso Pilar: {getPilarServerAccessModeSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Pilar data estático: {getPilarDataSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Antigüedad del dataset: {getDatasetFreshnessSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Regeneración pendiente: {fmtBoolean(status.data_needs_regeneration, "sí", "no")}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Origen del saldo pendiente: {getPendingSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Acción recomendada sobre saldo pendiente: {getPendingSourceAction(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Build completo fuera de cron:{" "}
              {fmtBoolean(status.build_needed, "pendiente", "no requerido")}
            </span>
          </div>
          {!workplaceFocusVisible ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-50/90">
                La evidencia reciente visible no pertenece al foco APP-001
              </div>
              <div className="mt-2">
                {String(status.workplace_focus_reason || "La evidencia visible reciente pertenece a otro frente y no debe leerse como avance directo de Workplace hasta volver a ver un archivo dentro de /Users/jarvis/workplace-app o una tarea APP-001.")}
              </div>
              <div className="mt-2">
                El semáforo muestra actividad real de Jarvis, pero no debería leerse como avance directo de Workplace hasta volver a ver un archivo dentro de <code className="rounded bg-black/20 px-1 py-0.5 text-[11px]">/Users/jarvis/workplace-app</code> o una tarea APP-001.
              </div>
              <div className="mt-2 text-xs text-amber-50/80">
                Tarea visible: {String(status.task || "sin tarea")} · artefacto visible: {String(status.last_material_artifact || status.watchdog_artifact || status.last_artifact || "sin artefacto")}
              </div>
            </div>
          ) : null}
          {status.watchdog_status === "ERROR" ? (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-50/90">
                El worker quedó con error reciente
              </div>
              <div className="mt-2">
                El semáforo puede seguir mostrando evidencia material reciente, pero el cron necesita revisión porque el último ciclo cerró con error.
              </div>
              <div className="mt-2 text-xs text-rose-50/80">
                Estado visible: {String(status.watchdog_status || "sin dato")} · razón: {String(status.watchdog_reason || status.watchdog?.reason || "sin detalle")}
              </div>
              <div className="mt-2 text-xs text-rose-50/80">
                Último error / artefacto: {String(status.watchdog_artifact || status.last_artifact || "sin artefacto")} · {fmt(String(status.watchdog_ts || status.last_evidence_at || ""))}
              </div>
            </div>
          ) : null}
          {!pendingSourceVerified ? (
            <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-50/90">
                Saldo pendiente visible, pero no validado desde Excel fresco
              </div>
              <div className="mt-2">
                El monto puede estar visible en pantalla, pero por ahora se apoya en el JSON actual o en una reconstrucción local. No debe leerse como validación fresca desde el Excel hasta regenerar el dataset fuera del cron.
              </div>
              <div className="mt-2 text-xs text-amber-50/80">
                Estado actual: {getPendingSourceSummary(status)}
              </div>
              <div className="mt-2 text-xs text-amber-50/80">
                Acción recomendada: {getPendingSourceAction(status)}
              </div>
              {pendingSourceCommand ? (
                <div className="mt-3 rounded-xl border border-amber-300/15 bg-black/15 p-3 text-[11px] text-amber-50/90">
                  <div className="uppercase tracking-[0.16em] text-amber-200/80">
                    Comando sugerido fuera del cron
                  </div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono leading-5 text-amber-50/95">
                    {pendingSourceCommand}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
          {status.deploy_blocked ? (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-50/90">
                Deploy público bloqueado por credenciales
              </div>
              <div className="mt-2">
                El build puede estar listo, pero hoy no existe una URL pública verificable porque falta una credencial válida de plataforma.
              </div>
              <div className="mt-2 text-xs text-rose-50/80">
                Bloqueo actual: {String(status.deploy_error || "sin detalle visible")}
              </div>
              <div className="mt-2 text-xs text-rose-50/80">
                Siguiente decisión operativa: definir plataforma destino y credencial válida para publicar sin login interactivo.
              </div>
              <div className="mt-3 rounded-xl border border-rose-200/15 bg-black/15 p-3 text-[11px] leading-5 text-rose-50/90">
                <div className="uppercase tracking-[0.16em] text-rose-100/80">
                  Mínimo para destrabar Vercel
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Elegir plataforma destino, por ejemplo Vercel.</li>
                  <li>Entregar una credencial válida con permiso para crear o linkear el proyecto.</li>
                  <li>Evitar login interactivo dentro del flujo operativo.</li>
                </ul>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-rose-200/10 bg-black/20 p-2 font-mono text-[11px] leading-5 text-rose-50/95">
{`VERCEL_TOKEN=... npx vercel --prod --yes --token "$VERCEL_TOKEN"`}
                </pre>
              </div>
            </div>
          ) : null}
          {truthSignal.label !== "SI" ? (
            <div className="mt-5 rounded-2xl border border-current/20 bg-black/15 p-4 text-sm text-current/95">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-current/80">
                Por qué no marca SI todavía
              </div>
              <div className="mt-2">{truthSignal.validationGap}</div>
              <div className="mt-2 text-xs text-current/80">
                Último pendiente visible:{" "}
                {truthSignal.pendingArtifact
                  ? `${truthSignal.pendingArtifact} · ${fmt(truthSignal.pendingAt)}`
                  : "sin cambio pendiente visible"}
              </div>
              <div className="mt-2 text-xs text-current/80">
                Siguiente validación sugerida: {getNextVerificationStep(status)}
              </div>
              {status.data_needs_regeneration ? (
                <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                  <div className="font-semibold uppercase tracking-[0.2em] text-amber-50/90">
                    Dataset pendiente de regeneración
                  </div>
                  <div className="mt-2">
                    {String(
                      status.data_regeneration_reason ||
                        "Hace falta regenerar src/data/flujo-fondos.json fuera del cron.",
                    )}
                  </div>
                  <div className="mt-2 text-amber-50/80">
                    Mientras tanto, el saldo pendiente visible puede venir del
                    JSON actual y no de una regeneración fresca desde Excel.
                  </div>
                  <div className="mt-2 text-amber-50/80">
                    Regeneración completa recomendada por Codex, fuera del cron:
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      python3 -m venv .venv &amp;&amp; .venv/bin/python -m pip install openpyxl &amp;&amp; .venv/bin/python scripts/build_flujo_data.py
                    </code>
                    . No commitear
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      .venv/
                    </code>
                    .
                  </div>
                  <div className="mt-2 text-amber-50/80">
                    Si hace falta solo recomponer el saldo abierto antes de esa regeneración completa, usar
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      npm run flujo:data:recalc-pending
                    </code>
                    (equivale a
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      python3 scripts/build_flujo_data.py --recalc-pending-from-json
                    </code>
                    ) para recalcular
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      metrics.totalPending
                    </code>
                    sobre el JSON actual, sin releer el Excel y dejando claro que la regeneración completa sigue pendiente.
                  </div>
                  <div className="mt-3 rounded-2xl border border-amber-200/15 bg-black/15 p-3 text-amber-50/90">
                    <div className="font-semibold uppercase tracking-[0.2em] text-amber-100/90">
                      Validación liviana antes de marcar avance real
                    </div>
                    <div className="mt-2">
                      Si el microciclo no permite regenerar desde Excel, al menos conviene dejar verificable el paso corto sobre el JSON actual.
                    </div>
                    <ul className="mt-2 list-disc space-y-2 pl-5">
                      <li>
                        <code className="rounded bg-black/20 px-1 py-0.5">
                          python3 -m json.tool src/data/flujo-fondos.json &gt;/dev/null
                        </code>
                      </li>
                      <li>
                        <code className="rounded bg-black/20 px-1 py-0.5">
                          grep -n &apos;&quot;totalPending&quot;&apos; src/data/flujo-fondos.json
                        </code>
                      </li>
                      <li>
                        <code className="rounded bg-black/20 px-1 py-0.5">
                          git diff -- src/data/flujo-fondos.json scripts/build_flujo_data.py
                        </code>
                      </li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-current/20 bg-black/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-current/80">
                Evidencia material
              </div>
              <div className="mt-2 text-sm text-current/95">
                {truthSignal.materialEvidence}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                {truthSignal.materialAtLabel}: {fmt(truthSignal.materialAt)}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                Última prueba verificable: {getVerifiedSummary(status)}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                Último commit / push / deploy:{" "}
                {`${getCommitSummary(status)} | ${getPushSummary(status)} | ${getDeploySummary(status)}`}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                Cambio pendiente visible:{" "}
                {truthSignal.pendingArtifact
                  ? `${truthSignal.pendingArtifact} · ${fmt(truthSignal.pendingAt)}`
                  : "sin cambio pendiente visible"}
              </div>
              <div className="mt-3 text-xs leading-5 text-current/80">
                Cuenta si hubo cambio real en app, codigo, documento, PDF, build
                o test OK, commit, push, deploy o entregable verificable.
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                Para pasar a SI: {truthSignal.validationGap}
              </div>
            </div>
            <div className="rounded-2xl border border-current/20 bg-black/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-current/80">
                Actividad administrativa
              </div>
              <div className="mt-2 text-sm text-current/95">
                {truthSignal.adminEvidence}
              </div>
              <div className="mt-2 text-xs leading-5 text-current/80">
                Último rastro administrativo:{" "}
                {status.admin_trail
                  ? `${status.admin_trail} · ${fmt(status.admin_trail_at)}`
                  : "sin rastro claro"}
                .
              </div>
              <div className="mt-3 text-xs leading-5 text-current/80">
                No cuenta si solo hubo CURRENT_STATUS.json, ACTIVITY.log.jsonl,
                PRIORIDADES.md, MEMORY.md, carpetas state/logs/memory,
                decisiones o promesas. Watchdog visible:{" "}
                {fmtBoolean(
                  status.watchdog_status && status.watchdog_status !== "ERROR",
                  "activo",
                  "sin confirmacion",
                )}
                . Diff abierto:{" "}
                {status.watchdog_git_status_short ||
                  "sin cambios locales visibles"}
                .
              </div>
            </div>
            <div className="rounded-2xl border border-current/20 bg-black/10 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-current/80">
                Diferencia clave
              </div>
              <div className="mt-2 text-sm text-current/95">
                {truthSignal.label === "SI"
                  ? "La pantalla puede sostener que Jarvis esta produciendo algo real porque aparece una validacion verificable reciente."
                  : truthSignal.label === "DUDOSO"
                    ? "Hay trabajo potencialmente real, pero todavia no alcanza para afirmar produccion verificable sin build, test, commit, push o deploy."
                    : "La pantalla no deberia sugerir trabajo real: solo hay notas internas, rastros administrativos o evidencia vieja."}
              </div>
              <div className="mt-3 text-xs leading-5 text-current/80">
                Produccion real = artefacto material con prueba verificable.
                Solo notas/logs = estado interno sin validacion externa.
              </div>
              <div className="mt-3 rounded-2xl border border-current/15 bg-black/15 p-3 text-xs leading-5 text-current/90">
                <div className="font-semibold uppercase tracking-[0.2em] text-current/80">
                  Siguiente hito operativo
                </div>
                <div className="mt-2">
                  {getNextOperationalStep(status, truthSignal)}
                </div>
                {status.build_needed ? (
                  <div className="mt-2 text-current/80">
                    El watchdog ya marca que el build completo debe validarse
                    fuera de este microciclo.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Estado derivado", status.derived_state || "available"],
            ["Tarea", status.task || "sin tarea"],
            ["Última evidencia", fmt(status.last_evidence_at)],
            ["Watchdog", status.watchdog_status || "sin watchdog"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#0b1730] p-5"
            >
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-3 break-words text-xl font-semibold">
                {String(value)}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Último artefacto real", getRealArtifactSummary(status)],
            ["Último cambio pendiente", getPendingSummary(status)],
            ["Última prueba verificable", getVerifiedSummary(status)],
            ["Último build o test OK", getBuildSummary(status)],
            ["Último commit", getCommitSummary(status)],
            ["Último push", getPushSummary(status)],
            ["Último deploy", getDeploySummary(status)],
            ["Último entregable verificable", getDeliverableSummary(status)],
            ["Dataset visible", getDataSourceSummary(status)],
            ["Antigüedad del dataset", getDatasetFreshnessSummary(status)],
            [
              "Regeneración pendiente",
              fmtBoolean(status.data_needs_regeneration, "sí", "no"),
            ],
            ["Origen del saldo pendiente", getPendingSourceSummary(status)],
            ["Antigüedad de evidencia", getEvidenceFreshnessSummary(status)],
            [
              "Build completo fuera de cron",
              fmtBoolean(status.build_needed, "pendiente", "no requerido"),
            ],
            [
              "Diff local pendiente",
              status.watchdog_git_status_short ||
                "sin cambios locales visibles",
            ],
            ["Acción sobre consulta Codex", getCodexConsultActionSummary(status)],
            ["Respuesta Codex aplicada", getCodexConsultAppliedSummary(status)],
            ["Evidencia posterior a Codex", getCodexPostAnswerEvidenceSummary(status)],
            ["Inspección del parche Codex", getCodexPatchInspectionSummary(status)],
            [
              "Actividad administrativa visible",
              status.admin_trail ||
                status.watchdog_git_diff_stat ||
                status.watchdog_status ||
                "sin rastro administrativo claro",
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-cyan-400/10 bg-[#081326] p-5"
            >
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-3 break-words text-base font-semibold text-slate-100">
                {String(value)}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-400">Eventos recientes</div>
              <h2 className="mt-1 text-2xl font-semibold">
                Últimos 25 eventos
              </h2>
            </div>
            <div className="text-xs text-slate-500">
              stale después de {effectiveStaleMinutes} min sin evidencia
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              SI verificable: {eventRealitySummary.real}
            </span>
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">
              DUDOSO o pendiente: {eventRealitySummary.dubious}
            </span>
            <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-rose-100">
              NO material: {eventRealitySummary.no}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-[#0b1730] text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Hora</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-left font-medium">Tarea</th>
                  <th className="px-4 py-3 text-left font-medium">Artefacto</th>
                  <th className="px-4 py-3 text-left font-medium">Nota</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Cuenta como real
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Por qué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[#07111f]">
                {recentEvents.length ? (
                  recentEvents.map((event, idx) => {
                    const reality = classifyEventReality(event);
                    return (
                      <tr key={`${event.ts || "row"}-${idx}`}>
                        <td className="px-4 py-3 text-slate-300">
                          {fmt(String(event.ts || ""))}
                        </td>
                        <td className="px-4 py-3">
                          {String(event.event || "-")}
                        </td>
                        <td className="px-4 py-3">
                          {String(event.task || "-")}
                        </td>
                        <td className="px-4 py-3">
                          <div>{String(event.artifact || "-")}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            {artifactKindLabel(event.artifact)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {String(event.note || "-")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${reality.tone}`}
                          >
                            {reality.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {reality.reason}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      Sin eventos recientes cargados desde ACTIVITY.log.jsonl
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
