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

function isAdministrativeArtifact(raw: unknown) {
  const artifact = String(raw || "").trim().toLowerCase();
  if (!artifact) return false;
  if (
    [
      "current_status.json",
      "activity.log.jsonl",
      "prioridades.md",
      "memory.md",
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
        : origin === "metrics_total_pending"
          ? " · monto leído desde metrics.totalPending"
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
  if (label && note)
    return `${label}${originLabel}${countLabel}${amountLabel}${freshnessLabel} · ${note}`;
  if (label) return `${label}${originLabel}${countLabel}${amountLabel}${freshnessLabel}`;
  if (note)
    return totalPending !== null
      ? `${totalPending}${originLabel}${freshnessLabel} · ${note}`
      : `${note}${originLabel}${freshnessLabel}`;
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
  if (origin === "json_pending_recalc_fallback") {
    return "pendiente regenerar el dataset completo fuera del cron con .venv + openpyxl";
  }
  if (origin === "stale_json" || origin === "stale_json_inconsistent_metrics") {
    return staleHours != null && staleHours > 24
      ? "dataset vencido: regenerar flujo-fondos.json fuera del cron"
      : "revisar si el saldo visible sigue apoyado en un JSON vencido";
  }
  return "si hace falta validar el saldo, usar la guía docs/flujo-data-regeneration.md";
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
      const baseReason =
        regenerationReason ||
        "El dataset visible quedó vencido y conviene regenerarlo fuera del cron antes de marcar SI.";
      return `${baseReason} Si no entra una regeneración completa en este microciclo, usar solo python3 scripts/build_flujo_data.py --recalc-pending-from-json sobre src/data/flujo-fondos.json. Para regenerar completo afuera del cron, usar python3 -m venv /Users/jarvis/workplace-app/.venv && /Users/jarvis/workplace-app/.venv/bin/python -m pip install openpyxl && /Users/jarvis/workplace-app/.venv/bin/python scripts/build_flujo_data.py antes de validar.`;
    }
    if (
      pendingArtifact.includes("scripts/build_flujo_data.py") ||
      pendingArtifact.includes("src/data/flujo-fondos.json")
    ) {
      if (hasVisiblePendingAmount) {
        return `El saldo pendiente ya está visible en ${pendingArtifact}. Falta una validación verificable antes de marcar SI.`;
      }
      return `Falta una validación verificable para ${pendingArtifact}. Si regenerar desde Excel no entra en este microciclo, dejar build_needed y usar solo python3 scripts/build_flujo_data.py --recalc-pending-from-json sobre src/data/flujo-fondos.json. Para regenerar completo afuera del cron, usar python3 -m venv /Users/jarvis/workplace-app/.venv && /Users/jarvis/workplace-app/.venv/bin/python -m pip install openpyxl && /Users/jarvis/workplace-app/.venv/bin/python scripts/build_flujo_data.py antes de validar.`;
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
  const truthSignal = deriveTruthSignal(status, data.staleMinutes || 20);

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
        </header>

        <section
          className={`mt-6 rounded-[28px] border p-6 ${truthSignal.tone}`}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.25em]">
            Trabajando de verdad: {truthSignal.label}
          </div>
          <div className="mt-2 text-xs text-current/80">
            Referencia del semáforo: Trabajando de verdad: SI / NO / DUDOSO
          </div>
          <div className="mt-3 text-4xl font-semibold">{truthSignal.label}</div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-current/90">
            {truthSignal.reason}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-current/85">
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Último artefacto real: {getRealArtifactSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Última prueba verificable: {getVerifiedSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Último cambio pendiente: {getPendingSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Brecha actual: {truthSignal.validationGap}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Última actividad administrativa:{" "}
              {getAdministrativeSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Fuente del semáforo: {getTruthSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Dataset visible: {getDataSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Antigüedad del dataset: {getDatasetFreshnessSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Origen del saldo pendiente: {getPendingSourceSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Acción recomendada sobre saldo pendiente: {getPendingSourceAction(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Antigüedad de evidencia: {getEvidenceFreshnessSummary(status)}
            </span>
            <span className="rounded-full border border-current/20 bg-black/10 px-3 py-1">
              Build completo fuera de cron:{" "}
              {fmtBoolean(status.build_needed, "pendiente", "no requerido")}
            </span>
          </div>
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
                      python3 scripts/build_flujo_data.py --recalc-pending-from-json
                    </code>
                    sobre el JSON actual y luego validar con
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      python3 -m json.tool src/data/flujo-fondos.json &gt;/dev/null
                    </code>
                    y
                    <code className="mx-1 rounded bg-black/20 px-1 py-0.5">
                      git diff --check -- src/data/flujo-fondos.json scripts/build_flujo_data.py
                    </code>
                    .
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
              stale después de {data.staleMinutes || 20} min sin evidencia
            </div>
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
                          {String(event.artifact || "-")}
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
