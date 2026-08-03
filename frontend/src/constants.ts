export const MIN_QUBIT_COUNT = 1;
// The initial notebook demo intentionally uses a complete state vector.
export const MAX_QUBIT_COUNT = 8;
export const MAX_SIMULATION_PAYLOAD_BYTES = 256 * 1024;

const defaultBackendUrl =
  import.meta.env.MODE === "development"
    ? "http://127.0.0.1:8000/backend.json"
    : "/backend.json";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || defaultBackendUrl;
