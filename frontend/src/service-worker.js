import { Simulator } from "@qni/simulator";
import { BACKEND_URL, MAX_QUBIT_COUNT, MAX_SIMULATION_PAYLOAD_BYTES } from "./constants";
const useGpu = import.meta.env.VITE_USE_GPU === "true";

// Install SW
self.addEventListener("install", () => {
  console.log("ServiceWorker installed");
});

// TODO: Qni の runSimulator にあたるハンドラを実行
self.addEventListener("message", (event) => {
  const circuitJson = event.data.circuitJson;
  const qubitCount = event.data.qubitCount;
  const untilStepIndex = event.data.untilStepIndex;
  const amplitudeIndices = event.data.amplitudeIndices;
  const steps = event.data.steps;
  const requestType = event.data.requestType || "circuit";
  const requestId = event.data.requestId;
  if (qubitCount < 1 || qubitCount > MAX_QUBIT_COUNT) {
    self.postMessage({ type: "error", requestId, message: `This demo supports 1-${MAX_QUBIT_COUNT} qubits.` });
    self.postMessage({ type: "finish", requestId });
    return;
  }
  const simulator = new Simulator("0".repeat(qubitCount));
  const vector = simulator.state.matrix.clone();
  const amplitudes = [];

  for (let i = 0; i < vector.height; i++) {
    const c = vector.element(0, i);
    if (c.isOk()) {
      amplitudes.push([c.value.real, c.value.imag]);
    }
  }

  async function call_backend() {
    try {
      const params = new URLSearchParams({
        id: circuitJson,
        qubitCount: qubitCount,
        untilStepIndex: untilStepIndex,
        amplitudeIndices: amplitudeIndices,
        steps: JSON.stringify(steps),
        useGpu: useGpu,
        requestType: requestType,
      });
      if (new TextEncoder().encode(params.toString()).byteLength > MAX_SIMULATION_PAYLOAD_BYTES) {
        throw new Error("Circuit payload exceeds the 256 KiB demo limit.");
      }

      const response = await fetch(BACKEND_URL, {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        if (response.status === 502) {
          console.error(
            "502 Bad Gateway: The backend server is currently down. It is likely that the uWSGI server is down."
          );
        } else {
          console.error(
            `HTTP error ${response.status}: ${response.statusText}`
          );
        }

        let detail = "";
        try { detail = (await response.json()).error || ""; } catch { /* no JSON body */ }
        throw new Error(detail || `Simulation failed (HTTP ${response.status}).`);
      }

      const jsondata = await response.json();

      if (requestType === "circuit") {
        for (let i = 0; i < jsondata.length; i++) {
          const stepResult = jsondata[i];
          self.postMessage({
            type: "step",
            requestId,
            step: i,
            amplitudes: stepResult["amplitudes"],
            blochVectors: stepResult["blochVectors"],
            measuredBits: stepResult["measuredBits"],
            flags: {},
          });
        }
      } else if (requestType === "export") {
        self.postMessage({
          type: "export",
          requestId,
          qasm3: jsondata.qasm3,
        });
      }
    } catch (error) {
      console.error(error);
      self.postMessage({
        type: "error",
        requestId,
        message: error instanceof Error ? error.message : "Simulation failed.",
      });
    }

    self.postMessage({ type: "finish", requestId });
  }

  call_backend();
});
