import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import { getMergedStatus } from '@/lib/workplace';

export const dynamic = 'force-dynamic';

const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';
const statusPath = `${workspaceRoot}/CURRENT_STATUS.json`;
const logPath = `${workspaceRoot}/ACTIVITY.log.jsonl`;
const watchdogPath = `${workspaceRoot}/state/jarvis_watchdog/last_run.json`;
const flujoFondosDataPath = `${process.cwd()}/src/data/flujo-fondos.json`;
const staleMinutes = Number(process.env.JARVIS_ACTIVITY_STALE_MINUTES || 20);
const adminArtifacts = new Set([
  'CURRENT_STATUS.json',
  'ACTIVITY.log.jsonl',
  'PRIORIDADES.md',
  'MEMORY.md',
]);
const adminEvidenceClasses = new Set([
  'decision',
  'status_update',
  'log_update',
  'instruction_only',
  'promise',
  'topic_sync',
  'idle',
  'parse_error',
  'build_needed',
  'blocked',
  'timeout',
]);
const verifiedEvidenceClasses = new Set(['build_ok', 'test_ok', 'commit', 'push', 'deploy', 'deliverable']);
const pendingMaterialEvidenceClasses = new Set(['code_change', 'document_change', 'artifact']);
const materialTokens = ['src/', 'app/', 'components/', 'lib/', '.tsx', '.ts', '.js', '.jsx', '.py', '.md', '.pdf', '.doc', '.docx', '.csv', '.xlsx'];
const materialJsonMarkers = ['/src/data/', '/data/', '/public/', '/docs/'];
const administrativePathMarkers = ['/state/', '/logs/', '/memory/'];
const administrativeNoteMarkers = [
  'solo hubo estado interno',
  'promesa',
  'intencion sin entregable',
  'build_needed',
  'bloqueo',
  'timeout',
  'sin entregable',
];

function looksMaterialArtifact(raw?: string) {
  const artifact = String(raw || '').trim().toLowerCase();
  if (!artifact || isAdministrativeArtifact(artifact)) return false;
  if (artifact.endsWith('.json')) {
    return materialJsonMarkers.some((marker) => artifact.includes(marker));
  }
  return materialTokens.some((token) => artifact.includes(token));
}

function isAdministrativeArtifact(raw?: string) {
  const artifact = String(raw || '').trim().toLowerCase();
  const artifactName = artifact.split('/').pop() || '';
  if (adminArtifacts.has(artifactName)) return true;
  return administrativePathMarkers.some((marker) => artifact.includes(marker));
}

function noteLooksAdministrative(raw?: string) {
  const note = String(raw || '').toLowerCase();
  if (!note) return false;
  return administrativeNoteMarkers.some((marker) => note.includes(marker));
}

function collectEvidenceSnapshot(events: any[]) {
  const snapshot = {
    lastMaterialArtifact: null as string | null,
    lastMaterialAt: null as string | null,
    lastPendingArtifact: null as string | null,
    lastPendingAt: null as string | null,
    lastVerifiedArtifact: null as string | null,
    lastVerifiedAt: null as string | null,
    lastBuildLabel: null as string | null,
    lastBuildAt: null as string | null,
    lastCommitHash: null as string | null,
    lastCommitAt: null as string | null,
    lastPushAt: null as string | null,
    lastDeployAt: null as string | null,
    lastDeliverableArtifact: null as string | null,
    lastDeliverableAt: null as string | null,
    adminTrail: null as string | null,
    adminTrailAt: null as string | null,
  };

  for (const event of events) {
    const artifact = String(event?.artifact || '').trim();
    const evidenceClass = String(event?.evidence_class || event?.event || '').toLowerCase();
    const note = String(event?.note || '').trim();
    const artifactLabel = artifact || note || null;
    const isAdminOnly = isAdministrativeArtifact(artifact);
    const isMaterialEvent = verifiedEvidenceClasses.has(evidenceClass) || pendingMaterialEvidenceClasses.has(evidenceClass);
    const isAdministrativeEvent = adminEvidenceClasses.has(evidenceClass) || noteLooksAdministrative(note);

    if (!snapshot.adminTrail && artifactLabel && (isAdminOnly || isAdministrativeEvent || (!artifact && !isMaterialEvent))) {
      snapshot.adminTrail = artifactLabel;
      snapshot.adminTrailAt = String(event?.ts || '');
    }

    if (!snapshot.lastMaterialArtifact && artifact && !isAdminOnly && (isMaterialEvent || looksMaterialArtifact(artifact))) {
      snapshot.lastMaterialArtifact = artifact;
      snapshot.lastMaterialAt = String(event?.ts || '');
    }

    if (!snapshot.lastPendingArtifact && artifact && !isAdminOnly && pendingMaterialEvidenceClasses.has(evidenceClass)) {
      snapshot.lastPendingArtifact = artifact;
      snapshot.lastPendingAt = String(event?.ts || '');
    }

    if (!snapshot.lastBuildAt && ['build_ok', 'test_ok'].includes(evidenceClass)) {
      snapshot.lastBuildAt = String(event?.ts || '');
      snapshot.lastBuildLabel = evidenceClass === 'test_ok' ? 'test OK' : 'build OK';
      if (!snapshot.lastVerifiedAt) {
        snapshot.lastVerifiedAt = String(event?.ts || '');
        snapshot.lastVerifiedArtifact = artifact || note || (evidenceClass === 'test_ok' ? 'test OK' : 'build OK');
      }
    }

    if (!snapshot.lastCommitAt && evidenceClass === 'commit') {
      snapshot.lastCommitAt = String(event?.ts || '');
      snapshot.lastCommitHash = String(event?.commit_hash || event?.note || '').trim() || null;
      if (!snapshot.lastVerifiedAt) {
        snapshot.lastVerifiedAt = String(event?.ts || '');
        snapshot.lastVerifiedArtifact = snapshot.lastCommitHash ? `commit ${snapshot.lastCommitHash}` : artifact || note || 'commit';
      }
    }

    if (!snapshot.lastPushAt && evidenceClass === 'push') {
      snapshot.lastPushAt = String(event?.ts || '');
      if (!snapshot.lastVerifiedAt) {
        snapshot.lastVerifiedAt = String(event?.ts || '');
        snapshot.lastVerifiedArtifact = artifact || note || 'push';
      }
    }

    if (!snapshot.lastDeployAt && evidenceClass === 'deploy') {
      snapshot.lastDeployAt = String(event?.ts || '');
      if (!snapshot.lastVerifiedAt) {
        snapshot.lastVerifiedAt = String(event?.ts || '');
        snapshot.lastVerifiedArtifact = artifact || note || 'deploy';
      }
    }

    if (!snapshot.lastDeliverableAt && evidenceClass === 'deliverable') {
      snapshot.lastDeliverableAt = String(event?.ts || '');
      snapshot.lastDeliverableArtifact = artifact || note || 'deliverable';
      if (!snapshot.lastVerifiedAt) {
        snapshot.lastVerifiedAt = String(event?.ts || '');
        snapshot.lastVerifiedArtifact = artifact || note || 'deliverable';
      }
    }

    if (!snapshot.lastVerifiedAt && verifiedEvidenceClasses.has(evidenceClass) && !isAdminOnly) {
      snapshot.lastVerifiedAt = String(event?.ts || '');
      snapshot.lastVerifiedArtifact = artifact || note || evidenceClass;
    }
  }

  return snapshot;
}

function safeParseJson(raw: string, fallback: any = null) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function parseDate(raw?: string) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getEvidenceAgeMinutes(raw?: string) {
  const date = parseDate(raw);
  if (!date) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function getDatasetPendingSource(flujoFondos: any) {
  const generatedAt = parseDate(flujoFondos?.generatedAt);
  const pendingRecalculatedAt = parseDate(flujoFondos?.pendingMetricsRecalculatedFromJsonAt);
  const metricsPending = flujoFondos?.metrics?.totalPending;
  const derivedPending = Array.isArray(flujoFondos?.summary)
    ? flujoFondos.summary.reduce((acc: number, month: any) => {
        const pendingByCategory = month?.pendingByCategory;
        if (!pendingByCategory || typeof pendingByCategory !== 'object') return acc;
        const monthPending = Object.values(pendingByCategory).reduce((monthAcc: number, value: any) => {
          return typeof value === 'number' && Number.isFinite(value) ? monthAcc + value : monthAcc;
        }, 0);
        return acc + monthPending;
      }, 0)
    : null;
  const openPendingCount = flujoFondos?.metrics?.openPendingCount;
  const metricsPendingIsValid = typeof metricsPending === 'number' && Number.isFinite(metricsPending);
  const derivedPendingIsValid = typeof derivedPending === 'number' && Number.isFinite(derivedPending);
  const metricsLooksInconsistent = metricsPendingIsValid
    && derivedPendingIsValid
    && metricsPending === 0
    && derivedPending > 0
    && typeof openPendingCount === 'number'
    && openPendingCount > 0;
  const totalPending = metricsLooksInconsistent
    ? derivedPending
    : metricsPendingIsValid
      ? metricsPending
      : derivedPendingIsValid
        ? derivedPending
        : null;
  const hasPending = typeof totalPending === 'number' && Number.isFinite(totalPending);
  const fallbackRecalculated = Boolean(pendingRecalculatedAt);
  const usingDerivedPending = (metricsLooksInconsistent || !metricsPendingIsValid || fallbackRecalculated) && hasPending;
  const staleHours = generatedAt
    ? Math.max(0, Math.round((Date.now() - generatedAt.getTime()) / 3600000))
    : null;
  const stale = staleHours == null ? true : staleHours > 24;

  if (!hasPending) {
    return {
      data_pending_source_label: 'sin saldo reconstruido',
      data_pending_source_note: 'falta regenerar flujo-fondos.json para exponer el saldo abierto total',
      data_pending_source_origin: 'missing',
      data_pending_source_reconstructed: false,
      data_total_pending: null,
      data_open_pending_count: typeof openPendingCount === 'number' ? openPendingCount : null,
      data_needs_regeneration: true,
      data_regeneration_reason: 'metrics.totalPending ausente o inválido en el JSON actual',
    };
  }

  return {
    data_pending_source_label: stale
      ? 'saldo abierto visible, pero sostenido por un dataset vencido'
      : fallbackRecalculated
        ? 'saldo abierto recompuesto desde el JSON visible, con regeneración completa todavía pendiente'
        : usingDerivedPending
          ? 'saldo abierto reconstruido desde el JSON visible'
          : 'saldo abierto validado con la última regeneración',
    data_pending_source_note: stale
      ? metricsLooksInconsistent
        ? 'metrics.totalPending vino en cero aunque hay pendientes abiertos. El tablero muestra el monto recomponiéndolo desde pendingByCategory del JSON actual, pero sigue haciendo falta regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
        : 'El saldo pendiente visible sale del JSON actual. Sirve para mostrar el monto, pero queda pendiente regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
      : fallbackRecalculated
        ? 'Se recompuso metrics.totalPending desde el JSON actual sin releer el Excel. Sirve para destrabar el tablero, pero la regeneración completa de src/data/flujo-fondos.json sigue pendiente fuera del cron.'
        : metricsLooksInconsistent
          ? 'metrics.totalPending vino en cero aunque hay pendientes abiertos y el tablero recompuso el monto sumando pendingByCategory del JSON actual.'
          : usingDerivedPending
            ? 'metrics.totalPending no estaba disponible y el tablero recompuso el monto sumando pendingByCategory del JSON actual.'
            : 'Saldo pendiente visible alineado con la última regeneración disponible.',
    data_pending_source_origin: stale ? (metricsLooksInconsistent ? 'stale_json_inconsistent_metrics' : 'stale_json') : fallbackRecalculated ? 'json_pending_recalc_fallback' : usingDerivedPending ? 'summary_fallback' : 'metrics_total_pending',
    data_pending_source_reconstructed: usingDerivedPending,
    data_total_pending: totalPending,
    data_open_pending_count: typeof openPendingCount === 'number' ? openPendingCount : null,
    data_pending_source_stale_hours: staleHours,
    data_pending_source_verified: !stale && !fallbackRecalculated,
    data_needs_regeneration: stale || metricsLooksInconsistent || fallbackRecalculated,
    data_regeneration_reason: stale
      ? 'La última regeneración visible supera 24 horas y conviene rehacer src/data/flujo-fondos.json fuera del cron.'
      : fallbackRecalculated
        ? 'Se recompuso metrics.totalPending desde el JSON actual, pero todavía falta regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
        : metricsLooksInconsistent
          ? 'metrics.totalPending quedó inconsistente frente a pendingByCategory y conviene regenerar src/data/flujo-fondos.json fuera del cron.'
          : '',
  };
}

function deriveState(status: any) {
  const last = parseDate(status?.last_evidence_at);
  if (!last) return 'available';
  const diffMin = (Date.now() - last.getTime()) / 60000;
  if (status?.state === 'blocked') return 'blocked';
  if (diffMin > staleMinutes) return 'stale';
  return status?.state || 'available';
}

function deriveTruthSignal(status: any) {
  const last = parseDate(status?.last_evidence_at);
  if (!last) {
    return {
      truthSignal: 'NO',
      truthColor: 'red',
      truthReason: 'sin evidencia reciente verificable',
      evidenceKind: 'none',
      validationGap: 'falta una evidencia material reciente y verificable',
    };
  }

  const diffMin = (Date.now() - last.getTime()) / 60000;
  const evidenceClass = String(status?.evidence_class || '').toLowerCase();
  const eventName = String(status?.event || '').toLowerCase();
  const materialMarker = evidenceClass || eventName;
  const note = String(status?.note || '').toLowerCase();
  const isAdminOnly = isAdministrativeArtifact(status?.last_artifact);
  const isVerifiedMaterial = verifiedEvidenceClasses.has(materialMarker) && !isAdminOnly;
  const isPendingMaterial = pendingMaterialEvidenceClasses.has(materialMarker) && !isAdminOnly;
  const isAdministrativeEvent = isAdminOnly || adminEvidenceClasses.has(evidenceClass) || adminEvidenceClasses.has(eventName);
  const administrativeNote = noteLooksAdministrative(note);

  if (isVerifiedMaterial && diffMin <= staleMinutes) {
    return {
      truthSignal: 'SI',
      truthColor: 'green',
      truthReason: 'hay evidencia material reciente verificable',
      evidenceKind: 'material',
      validationGap: 'ninguno',
    };
  }

  if (isPendingMaterial && diffMin <= staleMinutes) {
    return {
      truthSignal: 'DUDOSO',
      truthColor: 'yellow',
      truthReason: 'hay cambio material pendiente de build, test, commit o deploy',
      evidenceKind: 'pending_material',
      validationGap: 'falta build, test, commit, push o deploy para marcar SI',
    };
  }

  if (isAdministrativeEvent || administrativeNote) {
    return {
      truthSignal: 'DUDOSO',
      truthColor: 'yellow',
      truthReason: materialMarker === 'promise' || note.includes('promesa') || note.includes('intencion sin entregable')
        ? 'solo hubo promesa o intencion sin entregable'
        : note.includes('build_needed')
          ? 'solo hubo decision operativa de build pendiente'
          : note.includes('bloqueo') || note.includes('timeout')
            ? 'solo hubo bloqueo operativo sin entregable'
            : 'solo hubo estado interno',
      evidenceKind: 'administrative',
      validationGap: 'falta evidencia material verificable fuera de notas o estados internos',
    };
  }

  return {
    truthSignal: 'NO',
    truthColor: 'red',
    truthReason: diffMin > staleMinutes ? 'la evidencia material quedo vieja' : 'no hay evidencia material valida',
    evidenceKind: isVerifiedMaterial || isPendingMaterial ? 'stale_material' : 'unknown',
    validationGap: diffMin > staleMinutes ? 'falta una validacion reciente del ultimo artefacto material' : 'falta evidencia material verificable',
  };
}

export async function GET() {
  try {
    const merged = await getMergedStatus();
    const active = Object.values(merged.frentes || {}).find((frente: any) => frente?.avanceAutonomo === 'si') as any;

    const [statusRaw, logRaw, watchdogRaw, flujoFondosRaw] = await Promise.all([
      fs.readFile(statusPath, 'utf8').catch(() => ''),
      fs.readFile(logPath, 'utf8').catch(() => ''),
      fs.readFile(watchdogPath, 'utf8').catch(() => ''),
      fs.readFile(flujoFondosDataPath, 'utf8').catch(() => ''),
    ]);

    const parsedStatus = safeParseJson(statusRaw, null);
    const watchdog = safeParseJson(watchdogRaw, null);
    const flujoFondos = safeParseJson(flujoFondosRaw, null);
    const lines = logRaw.split('\n').filter(Boolean);
    const snapshotEvents = lines.slice(-200).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: 'parse_error', raw: line };
      }
    }).reverse();
    const recentEvents = snapshotEvents.slice(0, 25);

    const fallbackStatus = {
      state: active ? 'working' : 'available',
      task: active?.proximaTarea || active?.ultimoAvance || 'sin tarea',
      last_evidence_at: merged.lastHeartbeat,
      last_artifact: active?.nombre || 'Workplace',
      note: active?.faseActual || 'Avance autónomo en curso',
    };

    const status = parsedStatus && parsedStatus.task ? parsedStatus : fallbackStatus;
    const derivedState = deriveState(status);
    const derivedTruth = deriveTruthSignal(status);
    const watchdogSignal = String(watchdog?.truth_signal || '').toUpperCase();
    const evidenceAgeMinutes = getEvidenceAgeMinutes(status?.last_evidence_at);
    const evidenceIsFresh = evidenceAgeMinutes != null && evidenceAgeMinutes <= staleMinutes;
    const watchdogReason = String(watchdog?.reason || '').toLowerCase();
    const shouldPreferDerivedTruth = derivedTruth.truthSignal === 'SI' && watchdogSignal !== 'SI';
    const truth = watchdog && watchdogSignal !== 'NO_DATA' && evidenceIsFresh && !shouldPreferDerivedTruth ? {
      truthSignal: watchdog.truth_signal,
      truthColor: watchdog.truth_color,
      truthReason: watchdog.reason,
      evidenceKind: watchdog.evidence_class,
      validationGap:
        watchdogSignal === 'SI'
          ? 'ninguna, ya hay validacion verificable'
          : watchdogSignal === 'DUDOSO'
            ? watchdogReason.includes('solo hubo estado interno') || watchdogReason.includes('worker activo')
              ? 'solo hubo estado interno; falta evidencia material verificable reciente'
              : 'falta build, test, commit, push o deploy para marcar SI'
            : derivedTruth.validationGap,
    } : shouldPreferDerivedTruth
      ? {
          ...derivedTruth,
          truthReason: 'hay evidencia material verificable reciente aunque el watchdog todavia no la refleje',
        }
      : derivedTruth;

    const events = recentEvents.length
      ? recentEvents
      : [
          {
            event: active ? 'topic_sync' : 'idle',
            state: active ? 'working' : 'available',
            task: fallbackStatus.task,
            artifact: fallbackStatus.last_artifact,
            note: fallbackStatus.note,
            ts: merged.lastHeartbeat,
          },
        ];
    const evidenceSnapshot = collectEvidenceSnapshot(snapshotEvents.length ? snapshotEvents : events);
    const fallbackMaterialArtifact = looksMaterialArtifact(status?.last_artifact) ? status.last_artifact : null;
    const fallbackMaterialAt = fallbackMaterialArtifact ? status?.last_evidence_at || null : null;
    const datasetPendingSource = getDatasetPendingSource(flujoFondos);

    return NextResponse.json({
      ok: true,
      status: {
        ...status,
        derived_state: derivedState,
        ...truth,
        watchdog,
        watchdog_status: watchdog?.status || null,
        watchdog_ts: watchdog?.ts || null,
        watchdog_truth_signal: watchdog?.truth_signal || null,
        watchdog_truth_color: watchdog?.truth_color || null,
        watchdog_reason: watchdog?.reason || null,
        watchdog_artifact:
          watchdog?.artifact ||
          evidenceSnapshot.lastMaterialArtifact ||
          (looksMaterialArtifact(status?.last_artifact) ? status.last_artifact : null),
        watchdog_build_ok: watchdog?.build_ok || Boolean(evidenceSnapshot.lastBuildAt),
        watchdog_build_at: watchdog?.build_at || evidenceSnapshot.lastBuildAt || null,
        watchdog_build_label: evidenceSnapshot.lastBuildLabel || null,
        watchdog_commit_hash: watchdog?.commit_hash || evidenceSnapshot.lastCommitHash || null,
        watchdog_commit_at: watchdog?.commit_at || evidenceSnapshot.lastCommitAt || null,
        watchdog_push_at: watchdog?.push_at || evidenceSnapshot.lastPushAt || null,
        watchdog_deploy_at: watchdog?.deploy_at || evidenceSnapshot.lastDeployAt || null,
        watchdog_git_diff_stat: watchdog?.git_diff_stat || null,
        watchdog_git_status_short: watchdog?.git_status_short || null,
        data_generated_at: flujoFondos?.generatedAt || null,
        data_source_workbook: flujoFondos?.sourceWorkbook || null,
        ...datasetPendingSource,
        build_needed: Boolean(status?.build_needed || watchdog?.build_needed),
        last_material_artifact: evidenceSnapshot.lastMaterialArtifact || fallbackMaterialArtifact,
        last_material_at: evidenceSnapshot.lastMaterialAt || fallbackMaterialAt,
        last_pending_artifact: evidenceSnapshot.lastPendingArtifact || (pendingMaterialEvidenceClasses.has(String(status?.evidence_class || '').toLowerCase()) && looksMaterialArtifact(status?.last_artifact) ? status.last_artifact : null),
        last_pending_at: evidenceSnapshot.lastPendingAt || (pendingMaterialEvidenceClasses.has(String(status?.evidence_class || '').toLowerCase()) ? status?.last_evidence_at || null : null),
        last_verified_artifact: evidenceSnapshot.lastVerifiedArtifact || (verifiedEvidenceClasses.has(String(status?.evidence_class || '').toLowerCase()) && looksMaterialArtifact(status?.last_artifact) ? status.last_artifact : null),
        last_verified_at: evidenceSnapshot.lastVerifiedAt || (verifiedEvidenceClasses.has(String(status?.evidence_class || '').toLowerCase()) ? status?.last_evidence_at || null : null),
        last_deliverable_artifact: evidenceSnapshot.lastDeliverableArtifact || null,
        last_deliverable_at: evidenceSnapshot.lastDeliverableAt || null,
        admin_trail: evidenceSnapshot.adminTrail || null,
        admin_trail_at: evidenceSnapshot.adminTrailAt || null,
        validation_gap: truth.validationGap || null,
        evidence_age_minutes: evidenceAgeMinutes,
        evidence_freshness: (() => {
          if (evidenceAgeMinutes == null) return 'unknown';
          return evidenceAgeMinutes > staleMinutes ? 'stale' : 'fresh';
        })(),
      },
      watchdog,
      recentEvents: events,
      staleMinutes,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 },
    );
  }
}
