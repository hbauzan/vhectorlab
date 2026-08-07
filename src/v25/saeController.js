/**
 * VHectorLab-3D v25 SAE orchestration for Compare (train / toggle / encode).
 * Reuses RemoteProvider + saeReplace / saeFraming / saeFilterBridge — no math fork.
 */
import {
  applySaeToCompare,
  cloneCompareRaw,
  collectCompareEmbeddings,
} from '../core/saeReplace.js';
import {
  computeDimSpanScale,
  inferRawDim,
  inferSaeDim,
} from '../core/saeFraming.js';
import {
  filterModeForSaeOn,
  restoreFilterAfterSae,
  snapshotFilterForSae,
} from '../ui/saeFilterBridge.js';
import {
  computeActivationMetrics,
  formatSaeTrainProgress,
  loadSaeSettings,
  saveSaeSettings,
} from '../ui/saeControlsDefaults.js';

/**
 * @param {{
 *   provider: { saeStatus: Function, saeTrain: Function, saeEncode: Function, saeClear: Function },
 *   canvas: { renderCompare: Function, setDimSpanScale: Function, setVizConfig: Function, getViz: Function, setSpatialConfig?: Function, getSpatial?: Function },
 *   compare: { updateCompareResults: Function, saeUi: object },
 *   rightDock: { syncViz: Function },
 *   modal: { show: Function, confirm?: Function },
 *   getWorkspaceMode: () => string,
 * }} deps
 */
export function createSaeController(deps) {
  let saeSettings = loadSaeSettings();
  /** @type {object|null} */
  let saeStatus = null;
  /** @type {object|null} */
  let rawCompareData = null;
  /** @type {{ previousMode: string }|null} */
  let filterSnapshot = null;
  let preSaeThreadWidth = null;
  let trainBusy = false;
  let trainStartedAt = 0;
  let pollTimer = null;
  let pollInFlight = false;
  let seenRunning = false;
  let postDone = false;
  let elapsedTimer = null;

  const ui = () => deps.compare?.saeUi;

  const applyStatusLine = () => {
    const status = saeStatus;
    const trained = !!(status && status.is_trained);
    const training = status?.training || {};
    const progress = formatSaeTrainProgress(training);
    const busy = !!trainBusy || progress.busy;
    const elapsedSec =
      busy && trainStartedAt
        ? Math.max(0, Math.floor((Date.now() - trainStartedAt) / 1000))
        : 0;

    let line = 'SAE not trained — train on current scope';
    if (busy) line = progress.label;
    else if (training.status === 'failed') {
      line = `Train failed: ${training.error_message || 'unknown error'}`;
    } else if (trained) {
      const cfg = status.config || {};
      const n = status.metrics?.total_vectors ?? training.n_vectors;
      const saved = status.persisted ? 'saved' : 'in memory';
      line =
        `SAE ready (${saved}) — ${cfg.hidden_dim || '?'}D · k=${cfg.k ?? '?'}` +
        (n != null ? ` · n=${n}` : '');
    }

    const saeUi = ui();
    if (!saeUi) return;
    saeUi.setStatus(line);
    saeUi.setTrainBusy(busy, { trained });
    if (!busy) saeUi.setTrainLabel(trained);
    if (busy) {
      saeUi.setProgress({
        visible: true,
        label: progress.label,
        meta: `${progress.meta} · working ${elapsedSec}s`,
        current: progress.current,
        total: progress.total,
        percent: progress.percent,
        indeterminate: progress.indeterminate || progress.percent < 2,
      });
    } else {
      saeUi.setProgress({ visible: false });
      if (trained && status.metrics) {
        saeUi.setMetrics({
          trainMse: status.metrics.mse,
          deadFeaturesPct: status.metrics.dead_features_pct,
        });
      }
    }
    if (!busy) saeUi.syncFromSettings();
  };

  const stopPoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    pollInFlight = false;
  };

  const stopElapsed = () => {
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = null;
  };

  const finishTrainBusy = () => {
    trainBusy = false;
    trainStartedAt = 0;
    stopElapsed();
    stopPoll();
    seenRunning = false;
    postDone = false;
  };

  const refreshStatus = async () => {
    try {
      const next = await deps.provider.saeStatus();
      if (next) saeStatus = next;
    } catch {
      /* keep */
    }
    applyStatusLine();
    return saeStatus;
  };

  const applyFilterMode = (mode) => {
    deps.canvas.setVizConfig({ vizFilterMode: mode });
    deps.rightDock.syncViz({ vizFilterMode: mode }, { emit: false });
  };

  const applyDimSpan = (saeData, rawData) => {
    const span = computeDimSpanScale(inferRawDim(rawData), inferSaeDim(saeData));
    deps.canvas.setDimSpanScale(span);
    if (preSaeThreadWidth == null && deps.canvas.getSpatial) {
      preSaeThreadWidth = deps.canvas.getSpatial().threadWidth;
    }
    if (deps.canvas.setSpatialConfig && preSaeThreadWidth != null) {
      const boosted = Math.min(0.2, preSaeThreadWidth * Math.min(span, 4));
      deps.canvas.setSpatialConfig({ threadWidth: boosted });
      deps.rightDock.syncSpatial?.({ threadWidth: boosted });
    }
  };

  const clearFraming = () => {
    deps.canvas.setDimSpanScale(1);
    if (preSaeThreadWidth != null && deps.canvas.setSpatialConfig) {
      deps.canvas.setSpatialConfig({ threadWidth: preSaeThreadWidth });
      deps.rightDock.syncSpatial?.({ threadWidth: preSaeThreadWidth });
      preSaeThreadWidth = null;
    }
  };

  const restoreRaw = () => {
    clearFraming();
    const restored = restoreFilterAfterSae(filterSnapshot);
    filterSnapshot = null;
    if (restored != null) applyFilterMode(restored);
    if (rawCompareData) {
      const raw = cloneCompareRaw(rawCompareData);
      deps.compare.updateCompareResults(raw);
      deps.canvas.renderCompare(raw);
    }
    applyStatusLine();
  };

  const encode = async () => {
    if (!rawCompareData) return;
    const saeUi = ui();
    try {
      const embeddings = collectCompareEmbeddings(rawCompareData);
      const n = embeddings.length;
      saeUi?.setProgress({
        visible: true,
        label: `Encoding (0/${n})…`,
        current: 0,
        total: n || 1,
      });
      const encoded = await deps.provider.saeEncode(embeddings);
      const saeData = applySaeToCompare(rawCompareData, encoded.activations);
      if (rawCompareData.items) {
        saeData.items = saeData.items.map((item, i) => {
          const raw = rawCompareData.items[i];
          if (!raw) return item;
          return { ...item, groupId: raw.groupId, groupLabel: raw.groupLabel };
        });
      }
      deps.compare.updateCompareResults(saeData);
      if (!filterSnapshot) {
        filterSnapshot = snapshotFilterForSae(deps.canvas.getViz()?.vizFilterMode);
      }
      applyFilterMode(filterModeForSaeOn());
      applyDimSpan(saeData, rawCompareData);
      deps.canvas.renderCompare(saeData);
      const batch =
        encoded.batch_metrics || computeActivationMetrics(encoded.activations);
      saeUi?.setMetrics({
        l0: batch.l0,
        sparsity: batch.sparsity,
        activeFeatures: batch.active_features ?? batch.activeFeatures,
        trainMse: saeStatus?.metrics?.mse,
        deadFeaturesPct: saeStatus?.metrics?.dead_features_pct,
      });
    } catch (e) {
      deps.modal.show('SAE ENCODE ERROR', e.message || 'Could not encode with SAE.');
      saeSettings = { ...saeSettings, enabled: false };
      saveSaeSettings(saeSettings);
      saeUi?.setToggleEnabled(false);
      restoreRaw();
    } finally {
      saeUi?.setProgress({ visible: false });
    }
  };

  const startPolling = () => {
    stopPoll();
    const tick = async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        await refreshStatus();
        const st = saeStatus?.training?.status;
        if (st === 'training') seenRunning = true;
        const terminal = st === 'success' || st === 'failed';
        if (terminal && (seenRunning || postDone)) {
          stopPoll();
          const wasBusy = trainBusy;
          finishTrainBusy();
          await refreshStatus();
          if (st === 'success' && wasBusy && saeSettings.enabled) {
            await encode();
          }
          applyStatusLine();
        }
      } finally {
        pollInFlight = false;
      }
    };
    pollTimer = setInterval(tick, 250);
    tick();
  };

  return {
    rememberRawCompare(data) {
      if (data?.items?.length) rawCompareData = cloneCompareRaw(data);
    },
    getRawCompare: () => rawCompareData,
    getSettings: () => ({ ...saeSettings }),
    setSettings(next) {
      saeSettings = next;
      saveSaeSettings(next);
    },
    refreshStatus,
    forceDisable() {
      if (!saeSettings.enabled) return;
      saeSettings = { ...saeSettings, enabled: false };
      saveSaeSettings(saeSettings);
      ui()?.setToggleEnabled(false);
      restoreRaw();
    },
    async onToggle(enabled) {
      if (deps.getWorkspaceMode() !== 'COMPARE') {
        deps.modal.show('COMPARE ONLY', 'Clean/Denoise (SAE) is available in Compare mode.');
        saeSettings = { ...saeSettings, enabled: false };
        saveSaeSettings(saeSettings);
        ui()?.setToggleEnabled(false);
        return;
      }
      saeSettings = { ...saeSettings, enabled };
      saveSaeSettings(saeSettings);
      if (!enabled) {
        restoreRaw();
        return;
      }
      if (!saeStatus?.is_trained) await refreshStatus();
      if (!saeStatus?.is_trained) {
        deps.modal.show('SAE NOT TRAINED', 'Train SAE on the current Compare scope first.');
        saeSettings = { ...saeSettings, enabled: false };
        saveSaeSettings(saeSettings);
        ui()?.setToggleEnabled(false);
        return;
      }
      if (!rawCompareData) {
        deps.modal.show('NO SCOPE DATA', 'Visualize first, then enable Clean/Denoise.');
        saeSettings = { ...saeSettings, enabled: false };
        saveSaeSettings(saeSettings);
        ui()?.setToggleEnabled(false);
        return;
      }
      await encode();
    },
    async onTrain(settings) {
      if (deps.getWorkspaceMode() !== 'COMPARE') {
        deps.modal.show('COMPARE ONLY', 'Train SAE is available in Compare mode.');
        return;
      }
      if (trainBusy) return;
      if (!saeStatus) await refreshStatus();
      if (saeStatus?.is_trained) {
        const ok = deps.modal.confirm
          ? await deps.modal.confirm(
              'RETRAIN SAE',
              'Delete the saved SAE checkpoint and train again on the current Compare scope?',
            )
          : true;
        if (!ok) return;
        try {
          await deps.provider.saeClear();
        } catch (e) {
          deps.modal.show('SAE CLEAR ERROR', e.message || 'Could not delete saved SAE.');
          return;
        }
        saeStatus = { ...(saeStatus || {}), is_trained: false, persisted: false };
        if (saeSettings.enabled) {
          saeSettings = { ...saeSettings, enabled: false };
          saveSaeSettings(saeSettings);
          ui()?.setToggleEnabled(false);
          restoreRaw();
        }
      }
      const embeddings = rawCompareData
        ? collectCompareEmbeddings(rawCompareData)
        : null;
      if (!embeddings || embeddings.length < 2) {
        deps.modal.show(
          'NO SCOPE DATA',
          'Visualize first, then Train SAE on those tokens.',
        );
        return;
      }
      saeSettings = { ...saeSettings, ...settings };
      saveSaeSettings(saeSettings);
      const epochs = settings.epochs;
      trainBusy = true;
      trainStartedAt = Date.now();
      elapsedTimer = setInterval(() => applyStatusLine(), 1000);
      saeStatus = {
        ...(saeStatus || {}),
        is_trained: false,
        training: {
          status: 'training',
          phase_key: 'preparing',
          message: `Starting train — ${embeddings.length} vectors · up to ${epochs} epochs…`,
          current_epoch: 0,
          total_epochs: epochs,
          remaining_epochs: epochs,
          percent: 0,
          n_vectors: embeddings.length,
        },
      };
      applyStatusLine();
      seenRunning = false;
      postDone = false;
      startPolling();
      try {
        await deps.provider.saeTrain({
          embeddings,
          hidden_dim: settings.hiddenDim,
          k: settings.k,
          epochs,
          lr: settings.lr,
          batch_size: settings.batchSize,
          auto_scale: true,
        });
        postDone = true;
      } catch (e) {
        const msg = e.message || '';
        if (/already in progress/i.test(msg)) {
          postDone = true;
        } else {
          finishTrainBusy();
          deps.modal.show('SAE TRAIN ERROR', msg || 'Could not start SAE training.');
          applyStatusLine();
        }
      }
    },
  };
}
