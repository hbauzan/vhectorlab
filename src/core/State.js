/**
 * Reactive Application State for VectorLab 3D.
 */
export class AppState {
  constructor() {
    this.wordA = "king";
    this.wordB = "man";
    this.wordC = "woman";
    this.topK = 10;
    this.renderMode = "POINTS"; // "POINTS" | "MESH" | "RIBBONS"

    this.backendConnected = false;
    this.arithmeticData = null;
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

  setHoveredTelemetry(telemetry) {
    this.hoveredTelemetry = telemetry;
    this.notify();
  }

  setRenderMode(mode) {
    this.renderMode = mode;
    this.notify();
  }

  setBackendConnected(connected) {
    this.backendConnected = connected;
    this.notify();
  }
}

export const state = new AppState();
