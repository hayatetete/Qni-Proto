export const MIN_QUBIT_COUNT = 1;
export const MAX_QUBIT_COUNT = 32;
export const MAX_ALL_STEP_AMPLITUDE_QUBITS = 12;
export const MAX_SIMULATION_PAYLOAD_BYTES = 256 * 1024;

const defaultBackendUrl =
  import.meta.env.MODE === "development"
    ? "http://127.0.0.1:8000/backend.json"
    : "/backend.json";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || defaultBackendUrl;
