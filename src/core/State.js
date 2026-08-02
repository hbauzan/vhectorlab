/**
 * Normalize render mode to the supported product surface.
 * Unknown / retired modes (e.g. legacy "MESH") fall back to POINTS.
 * @param {string} [mode]
 * @returns {"POINTS"|"RIBBONS"}
 */
export function normalizeRenderMode(mode) {
  return mode === "RIBBONS" ? "RIBBONS" : "POINTS";
}

/**
 * Reactive Application State for VectorLab 3D.
 */
export class AppState {
  constructor() {
    this.wordA = "king";
    this.wordB = "man";
    this.wordC = "woman";
    this.topK = 10;
    this.renderMode = "POINTS"; // "POINTS" | "RIBBONS"
    this.workspaceMode = "ARITHMETIC"; // "ARITHMETIC" | "COMPARE"

    this.backendConnected = false;
    this.arithmeticData = null;
    this.compareData = null;
    this.hoveredTelemetry = null;

    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => l(this));
  }

  setArithmeticData(data) {
    this.arithmeticData = data;
    this.notify();
  }

  setCompareData(data) {
    this.compareData = data;
    this.notify();
  }

  setWorkspaceMode(mode) {
    this.workspaceMode = mode;
    this.notify();
  }

  setHoveredTelemetry(telemetry) {
    this.hoveredTelemetry = telemetry;
    this.notify();
  }

  setRenderMode(mode) {
    this.renderMode = normalizeRenderMode(mode);
    this.notify();
  }

  setBackendConnected(connected) {
    this.backendConnected = connected;
    this.notify();
  }
}

export const state = new AppState();
