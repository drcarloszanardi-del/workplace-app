import fs from 'fs/promises';
import { NextResponse } from 'next/server';
import activitySnapshot from '@/data/activity-snapshot.json';
import flujoFondosSnapshot from '@/data/flujo-fondos.json';
import { getMergedStatus } from '@/lib/workplace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const workspaceRoot = process.env.WORKPLACE_SOURCE_ROOT || '/Users/jarvis/.openclaw/workspace';
const statusPath = `${workspaceRoot}/CURRENT_STATUS.json`;
const logPath = `${workspaceRoot}/ACTIVITY.log.jsonl`;
const watchdogPath = `${workspaceRoot}/state/jarvis_watchdog/last_run.json`;
const codexConsultStatusPath = `${workspaceRoot}/state/codex_consult/status.json`;
const appRoot = process.env.WORKPLACE_APP_ROOT || '/Users/jarvis/workplace-app';
const pilarServerSourcePath = `${appRoot}/src/lib/pilar-server.ts`;
const pilarDataSourcePath = `${appRoot}/src/lib/pilar-data.ts`;
const staleMinutes = Number(process.env.JARVIS_ACTIVITY_STALE_MINUTES || 20);
const adminArtifacts = new Set([
  'CURRENT_STATUS.json',
  'ACTIVITY.log.jsonl',
  'PRIORIDADES.md',
  'MEMORY.md',
  'last_run.json',
  'jarvis.log',
  'jarvis.lock',
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
const materialPathMarkers = ['/src/', '/app/', '/components/', '/lib/', '/public/', '/docs/'];
const materialFileExtensions = ['.tsx', '.ts', '.js', '.jsx', '.py', '.md', '.html', '.css', '.pdf', '.doc', '.docx', '.csv', '.xlsx'];
const materialJsonMarkers = ['/src/data/', '/data/', '/public/', '/docs/'];
const administrativePathMarkers = ['/state/', '/logs/', '/memory/'];
const app001ArtifactMarkers = [
  '/src/app/activity/',
  '/src/app/api/activity/',
  '/src/app/layout.tsx',
  '/src/lib/pilar-server.ts',
  '/src/lib/pilar-data.ts',
  '/src/lib/pilar-dashboard-data.ts',
  '/src/data/flujo-fondos.json',
  'src/app/activity/',
  'src/app/api/activity/',
  'src/app/layout.tsx',
  'src/lib/pilar-server.ts',
  'src/lib/pilar-data.ts',
  'src/lib/pilar-dashboard-data.ts',
  'src/data/flujo-fondos.json',
];
const codexPatchArtifactMarkers = [
  '/src/lib/pilar-server.ts',
  '/src/lib/pilar-data.ts',
  '/src/lib/pilar-dashboard-data.ts',
  '/src/data/flujo-fondos.json',
  '/src/app/api/pilar/dashboard/route.ts',
  '/src/app/dashboard/page.tsx',
  '/src/app/page.tsx',
  'src/lib/pilar-server.ts',
  'src/lib/pilar-data.ts',
  'src/lib/pilar-dashboard-data.ts',
  'src/data/flujo-fondos.json',
  'src/app/api/pilar/dashboard/route.ts',
  'src/app/dashboard/page.tsx',
  'src/app/page.tsx',
];
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
  return materialPathMarkers.some((marker) => artifact.includes(marker))
    || materialFileExtensions.some((extension) => artifact.endsWith(extension));
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

function looksLikeApp001Artifact(raw?: string) {
  const artifact = String(raw || '').trim().toLowerCase();
  if (!artifact) return false;
  return app001ArtifactMarkers.some((marker) => artifact.includes(marker));
}

function eventLooksLikeWorkplaceFocus(event: any) {
  const task = String(event?.task || '').trim().toUpperCase();
  const artifact = String(event?.artifact || '').trim().toLowerCase();
  return task.startsWith('APP-001') || looksLikeApp001Artifact(artifact);
}

function looksLikeCodexPatchArtifact(raw?: string) {
  const artifact = String(raw || '').trim().toLowerCase();
  if (!artifact) return false;
  return codexPatchArtifactMarkers.some((marker) => artifact.includes(marker));
}

function collectEvidenceSnapshot(events: any[], options?: { app001Only?: boolean }) {
  const app001Only = Boolean(options?.app001Only);
  const visibleEvents = app001Only
    ? events.filter((event) => eventLooksLikeWorkplaceFocus(event))
    : events;
  const sourceEvents = visibleEvents.length ? visibleEvents : events;

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

  for (const event of sourceEvents) {
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

function inspectPilarServerSource(raw: string) {
  const source = String(raw || '');
  const usesFs = /from\s+['"]fs|from\s+['"]node:fs|require\(['"]fs|require\(['"]node:fs/.test(source);
  const usesPath = /from\s+['"]path|from\s+['"]node:path|require\(['"]path|require\(['"]node:path/.test(source);
  const usesProcessCwd = /process\.cwd\s*\(/.test(source);
  const usesDynamicImport = /import\s*\(/.test(source);
  const usesDynamicRequire = /require\s*\((?!['"](?:fs|node:fs|path|node:path|@supabase\/supabase-js)['"])/.test(source);
  const usesJsonParse = /JSON\.parse\s*\(/.test(source);
  const riskFlags = [
    usesFs ? 'fs' : null,
    usesPath ? 'path' : null,
    usesProcessCwd ? 'process.cwd()' : null,
    usesDynamicImport ? 'import()' : null,
    usesDynamicRequire ? 'require() dinamico' : null,
    usesJsonParse ? 'JSON.parse() runtime' : null,
  ].filter(Boolean) as string[];
  return {
    sourceAvailable: Boolean(source.trim()),
    usesFs,
    usesPath,
    usesProcessCwd,
    usesDynamicImport,
    usesDynamicRequire,
    usesJsonParse,
    riskFlags,
    runtimeRiskDetected: riskFlags.length > 0,
    dataAccessMode: riskFlags.length > 0 ? 'runtime_fragile' : 'env_supabase_only',
  };
}

function inspectPilarDataSource(raw: string) {
  const source = String(raw || '');
  const hasStaticJsonImport = /import\s+\w+\s+from\s+['"][^'"]*flujo-fondos\.json['"]/.test(source);
  const exportsGetter = /export\s+function\s+getFlujoData\s*\(/.test(source);
  return {
    sourceAvailable: Boolean(source.trim()),
    hasStaticJsonImport,
    exportsGetter,
    bundleSafeDataSource: hasStaticJsonImport && exportsGetter,
  };
}

async function readRepoSnapshot() {
  return activitySnapshot || null;
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
  const pendingMetricsSource = String(flujoFondos?.pendingMetricsSource || '').trim();
  const pendingMetricsRecalculatedFromJsonAt = String(flujoFondos?.pendingMetricsRecalculatedFromJsonAt || '').trim();
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
  const sourceUsesSummaryFallback = pendingMetricsSource === 'summary_totals_fallback';
  const sourceUsesRecordsPreviewFallback = pendingMetricsSource === 'records_preview_fallback';
  const usingDerivedPending = (metricsLooksInconsistent || !metricsPendingIsValid || fallbackRecalculated || sourceUsesSummaryFallback || sourceUsesRecordsPreviewFallback) && hasPending;
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
      : sourceUsesRecordsPreviewFallback
        ? 'saldo abierto recompuesto desde recordsPreview'
        : fallbackRecalculated || sourceUsesSummaryFallback
          ? 'saldo abierto recompuesto desde el JSON visible, con regeneración completa todavía pendiente'
          : usingDerivedPending
            ? 'saldo abierto reconstruido desde el JSON visible'
            : 'saldo abierto validado con la última regeneración',
    data_pending_source_note: stale
      ? metricsLooksInconsistent
        ? 'metrics.totalPending vino en cero aunque hay pendientes abiertos. El tablero muestra el monto recomponiéndolo desde pendingByCategory del JSON actual, pero sigue haciendo falta regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
        : sourceUsesRecordsPreviewFallback
          ? 'El saldo pendiente visible se recompuso desde recordsPreview del JSON actual. Sirve para mostrar el monto, pero queda pendiente regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
          : 'El saldo pendiente visible sale del JSON actual. Sirve para mostrar el monto, pero queda pendiente regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
      : sourceUsesRecordsPreviewFallback
        ? 'Se recompuso metrics.totalPending desde recordsPreview del JSON actual sin releer el Excel. Sirve para destrabar el tablero, pero la regeneración completa de src/data/flujo-fondos.json sigue pendiente fuera del cron.'
        : fallbackRecalculated || sourceUsesSummaryFallback
          ? 'Se recompuso metrics.totalPending desde el JSON actual sin releer el Excel. Sirve para destrabar el tablero, pero la regeneración completa de src/data/flujo-fondos.json sigue pendiente fuera del cron.'
          : metricsLooksInconsistent
            ? 'metrics.totalPending vino en cero aunque hay pendientes abiertos y el tablero recompuso el monto sumando pendingByCategory del JSON actual.'
            : usingDerivedPending
              ? 'metrics.totalPending no estaba disponible y el tablero recompuso el monto sumando pendingByCategory del JSON actual.'
              : 'Saldo pendiente visible alineado con la última regeneración disponible.',
    data_pending_source_origin: stale ? (metricsLooksInconsistent ? 'stale_json_inconsistent_metrics' : sourceUsesRecordsPreviewFallback ? 'stale_records_preview_fallback' : 'stale_json') : sourceUsesRecordsPreviewFallback ? 'records_preview_fallback' : (fallbackRecalculated || sourceUsesSummaryFallback) ? 'json_pending_recalc_fallback' : usingDerivedPending ? 'summary_fallback' : 'metrics_total_pending',
    data_pending_source_reconstructed: usingDerivedPending,
    data_pending_source_recalculated_at: pendingMetricsRecalculatedFromJsonAt || null,
    data_total_pending: totalPending,
    data_open_pending_count: typeof openPendingCount === 'number' ? openPendingCount : null,
    data_pending_source_stale_hours: staleHours,
    data_pending_source_verified: !stale && !fallbackRecalculated && !sourceUsesSummaryFallback && !sourceUsesRecordsPreviewFallback,
    data_needs_regeneration: stale || metricsLooksInconsistent || fallbackRecalculated || sourceUsesSummaryFallback || sourceUsesRecordsPreviewFallback,
    data_regeneration_reason: stale
      ? 'La última regeneración visible supera 24 horas y conviene rehacer src/data/flujo-fondos.json fuera del cron.'
      : sourceUsesRecordsPreviewFallback
        ? 'Se recompuso metrics.totalPending desde recordsPreview del JSON actual, pero todavía falta regenerar src/data/flujo-fondos.json desde Excel fuera del cron.'
        : fallbackRecalculated || sourceUsesSummaryFallback
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

    const [statusRaw, logRaw, watchdogRaw, codexConsultRaw, pilarServerSourceRaw, pilarDataSourceRaw] = await Promise.all([
      fs.readFile(statusPath, 'utf8').catch(() => ''),
      fs.readFile(logPath, 'utf8').catch(() => ''),
      fs.readFile(watchdogPath, 'utf8').catch(() => ''),
      fs.readFile(codexConsultStatusPath, 'utf8').catch(() => ''),
      fs.readFile(pilarServerSourcePath, 'utf8').catch(() => ''),
      fs.readFile(pilarDataSourcePath, 'utf8').catch(() => ''),
    ]);

    const parsedStatus = safeParseJson(statusRaw, null);
    const watchdog = safeParseJson(watchdogRaw, null);
    const codexConsult = safeParseJson(codexConsultRaw, null);
    const pilarServerInspection = inspectPilarServerSource(pilarServerSourceRaw);
    const pilarDataInspection = inspectPilarDataSource(pilarDataSourceRaw);
    const flujoFondos = flujoFondosSnapshot;
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
    const watchdogArtifact = String(watchdog?.artifact || '').trim();
    const watchdogArtifactIsAdministrative = isAdministrativeArtifact(watchdogArtifact);
    const shouldPreferDerivedTruth =
      (derivedTruth.truthSignal === 'SI' && watchdogSignal !== 'SI') ||
      (watchdogSignal === 'SI' &&
        (derivedTruth.truthSignal !== 'SI' || watchdogArtifactIsAdministrative));
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
    const evidenceSnapshot = collectEvidenceSnapshot(snapshotEvents.length ? snapshotEvents : events, {
      app001Only: true,
    });
    const fallbackMaterialArtifact = looksMaterialArtifact(status?.last_artifact) ? status.last_artifact : null;
    const fallbackMaterialAt = fallbackMaterialArtifact ? status?.last_evidence_at || null : null;
    const datasetPendingSource = getDatasetPendingSource(flujoFondos);
    const lastVisibleArtifact = String(
      evidenceSnapshot.lastPendingArtifact
        || evidenceSnapshot.lastMaterialArtifact
        || watchdog?.artifact
        || status?.last_artifact
        || '',
    ).trim();
    const workplaceTaskVisible = String(status?.task || '').trim().toUpperCase().startsWith('APP-001')
      || String(watchdog?.task || '').trim().toUpperCase().startsWith('APP-001');
    const workplaceEventVisible = [...snapshotEvents, ...events].some((event) => eventLooksLikeWorkplaceFocus(event));
    const workplaceFocusVisible = workplaceTaskVisible
      || workplaceEventVisible
      || looksLikeApp001Artifact(lastVisibleArtifact);

    const truthBelongsToOtherFront = !workplaceFocusVisible
      && (truth.truthSignal === 'SI' || truth.evidenceKind === 'pending_material');

    const focusAwareTruth = truthBelongsToOtherFront
      ? {
          ...truth,
          truthSignal: 'DUDOSO',
          truthColor: 'yellow',
          truthReason: truth.evidenceKind === 'pending_material'
            ? 'hay cambio material reciente, pero pertenece a otro frente y no debe leerse como avance directo de APP-001'
            : 'hay evidencia real reciente, pero pertenece a otro frente y no debe leerse como avance directo de APP-001',
          validationGap: 'falta evidencia material reciente dentro de workplace-app para marcar SI en APP-001',
        }
      : truth;
    const truthScope = truthBelongsToOtherFront
      ? 'other_front'
      : workplaceFocusVisible
        ? 'app_001'
        : 'global';
    const otherFrontReason = (() => {
      const visibleTask = String(status?.task || watchdog?.task || '').trim();
      if (visibleTask && !visibleTask.toUpperCase().startsWith('APP-001')) {
        return `La evidencia reciente existe, pero apunta a ${visibleTask} y el semáforo se degrada para no inflar APP-001.`;
      }
      if (lastVisibleArtifact && !looksLikeApp001Artifact(lastVisibleArtifact)) {
        return `La evidencia reciente existe, pero el último artefacto visible (${lastVisibleArtifact}) no pertenece a workplace-app y el semáforo se degrada para no inflar APP-001.`;
      }
      return 'La evidencia reciente existe, pero apunta a otro frente y el semáforo se degrada para no inflar APP-001.';
    })();
    const truthScopeReason = truthBelongsToOtherFront
      ? otherFrontReason
      : workplaceFocusVisible
        ? 'La evidencia reciente visible apunta al foco APP-001 o a un artefacto dentro de workplace-app.'
        : 'No hay evidencia reciente suficiente para atribuir el semáforo a un frente material concreto.';
    const evidenceFrontLabel = truthBelongsToOtherFront
      ? 'otro frente'
      : workplaceFocusVisible
        ? 'APP-001 directo'
        : 'global o incierto';
    const codexConsultState = String(codexConsult?.state || '').trim();
    const codexConsultAnswered = codexConsultState === 'answered';
    const codexAnsweredAt = parseDate(String(codexConsult?.latest_answered_at || '').trim());
    const latestWorkplaceEvidenceAt = parseDate(
      String(
        evidenceSnapshot.lastPendingAt
          || evidenceSnapshot.lastMaterialAt
          || status?.last_evidence_at
          || '',
      ).trim(),
    );
    const codexPatchConfirmedByInspection = Boolean(
      codexConsultAnswered
      && pilarServerInspection.sourceAvailable
      && !pilarServerInspection.runtimeRiskDetected
      && pilarDataInspection.sourceAvailable
      && pilarDataInspection.bundleSafeDataSource,
    );
    const codexRelevantArtifactVisible = looksLikeCodexPatchArtifact(lastVisibleArtifact);
    const codexHasPostAnswerEvidence = Boolean(
      codexConsultAnswered
      && codexAnsweredAt
      && latestWorkplaceEvidenceAt
      && latestWorkplaceEvidenceAt.getTime() >= codexAnsweredAt.getTime()
      && codexRelevantArtifactVisible
    );
    const codexConsultApplied = Boolean(codexPatchConfirmedByInspection && codexHasPostAnswerEvidence);
    const codexPatchInspectionSummary = codexPatchConfirmedByInspection
      ? codexHasPostAnswerEvidence
        ? 'src/lib/pilar-server.ts quedó sin carga runtime frágil, src/lib/pilar-data.ts usa import estático de flujo-fondos.json y ya hay evidencia local posterior a la respuesta'
        : 'la inspección local confirma pilar-server bundle-safe + pilar-data con import estático, pero todavía falta evidencia local posterior a la respuesta'
      : pilarServerInspection.sourceAvailable && pilarDataInspection.sourceAvailable
        ? 'la inspección local todavía no confirma simultáneamente pilar-server bundle-safe + pilar-data con import estático'
        : 'la activity API no pudo inspeccionar localmente pilar-server o pilar-data';
    const codexConsultActionStatus = codexConsultAnswered
      ? codexConsultApplied
        ? `respuesta aplicada: ${codexPatchInspectionSummary}`
        : codexPatchConfirmedByInspection
          ? 'respuesta leida e inspección bundle-safe confirmada, pero falta evidencia local posterior a la respuesta'
          : codexHasPostAnswerEvidence
            ? 'hay evidencia local posterior a la respuesta, pero la inspección todavía no confirma que el parche bundle-safe quedó aplicado'
            : 'respuesta leida, falta aplicar un paso chico verificable'
      : codexConsultState === 'pending' || codexConsultState === 'processing'
        ? 'consulta tecnica en curso'
        : 'sin consulta activa';

    const payload = {
      ok: true,
      status: {
        ...status,
        derived_state: derivedState,
        ...focusAwareTruth,
        truth_signal_display: `Trabajando de verdad: ${focusAwareTruth.truthSignal}`,
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
        deploy_blocked: Boolean(status?.deploy_blocked || watchdog?.deploy_blocked),
        deploy_error: String(status?.deploy_error || watchdog?.deploy_error || '').trim() || null,
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
        validation_gap: focusAwareTruth.validationGap || null,
        workplace_focus_visible: workplaceFocusVisible,
        workplace_focus_reason: workplaceFocusVisible
          ? 'la evidencia visible apunta al foco APP-001 o a un artefacto dentro de workplace-app'
          : truthBelongsToOtherFront
            ? otherFrontReason
            : 'no hay evidencia material reciente suficiente dentro de workplace-app para leer el semáforo como avance directo de APP-001',
        truth_scope: truthScope,
        truth_scope_reason: truthScopeReason,
        evidence_front_label: evidenceFrontLabel,
        codex_consult_state: codexConsultState || null,
        codex_consult_answered_at: String(codexConsult?.latest_answered_at || '').trim() || null,
        codex_consult_answer_path: String(codexConsult?.latest_answer_path || '').trim() || null,
        codex_consult_instruction: String(codexConsult?.instruction_for_jarvis || '').trim() || null,
        codex_consult_applied: codexConsultAnswered ? codexConsultApplied : null,
        codex_consult_post_answer_evidence: codexConsultAnswered ? codexHasPostAnswerEvidence : null,
        codex_consult_action_status: codexConsultActionStatus,
        codex_patch_inspection_summary: codexConsultAnswered ? codexPatchInspectionSummary : null,
        pilar_server_source_available: pilarServerInspection.sourceAvailable,
        pilar_server_runtime_risk_detected: pilarServerInspection.runtimeRiskDetected,
        pilar_server_runtime_risk_flags: pilarServerInspection.riskFlags,
        pilar_server_data_access_mode: pilarServerInspection.dataAccessMode,
        pilar_server_runtime_risk_summary: pilarServerInspection.sourceAvailable
          ? pilarServerInspection.runtimeRiskDetected
            ? `revisar src/lib/pilar-server.ts: hay señales de carga runtime frágil (${pilarServerInspection.riskFlags.join(', ')})`
            : 'src/lib/pilar-server.ts quedó en modo bundle-safe: sin fs, path, process.cwd(), import() dinámico ni require() dinámico; solo env + Supabase'
          : 'src/lib/pilar-server.ts no se pudo inspeccionar desde activity API',
        pilar_data_bundle_safe: pilarDataInspection.sourceAvailable ? pilarDataInspection.bundleSafeDataSource : null,
        pilar_data_source_summary: pilarDataInspection.sourceAvailable
          ? pilarDataInspection.bundleSafeDataSource
            ? 'src/lib/pilar-data.ts importa flujo-fondos.json de forma estática y expone getFlujoData()'
            : 'revisar src/lib/pilar-data.ts: falta import estático de flujo-fondos.json o getter explícito'
          : 'src/lib/pilar-data.ts no se pudo inspeccionar desde activity API',
        pilar_vercel_bundle_verdict: (() => {
          if (!pilarServerInspection.sourceAvailable || !pilarDataInspection.sourceAvailable) {
            return 'sin veredicto visible';
          }
          if (pilarServerInspection.runtimeRiskDetected) {
            return `riesgo runtime detectado en src/lib/pilar-server.ts (${pilarServerInspection.riskFlags.join(', ')})`;
          }
          if (!pilarDataInspection.bundleSafeDataSource) {
            return 'pendiente revisar src/lib/pilar-data.ts para dejar import estático bundle-safe';
          }
          return 'ruta de datos bundle-safe visible para Vercel: env + Supabase en pilar-server y JSON estático en pilar-data';
        })(),
        stale_minutes: staleMinutes,
        evidence_age_minutes: evidenceAgeMinutes,
        evidence_freshness: (() => {
          if (evidenceAgeMinutes == null) return 'unknown';
          return evidenceAgeMinutes > staleMinutes ? 'stale' : 'fresh';
        })(),
      },
      watchdog,
      recentEvents: events,
      staleMinutes,
    };

    const repoSnapshot = await readRepoSnapshot();
    const statusLooksEmpty = !payload.status || (!payload.status.task && !payload.status.last_artifact && !payload.status.last_material_artifact);
    const recentEventsLookEmpty = !Array.isArray(payload.recentEvents) || payload.recentEvents.length === 0;

    if (repoSnapshot && statusLooksEmpty && recentEventsLookEmpty) {
      return NextResponse.json(repoSnapshot, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'unknown error' },
      { status: 500 },
    );
  }
}
