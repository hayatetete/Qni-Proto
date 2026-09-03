import {
  BACKEND_URL,
  MAX_ALL_STEP_AMPLITUDE_QUBITS,
  MAX_QUBIT_COUNT,
  MAX_SIMULATION_PAYLOAD_BYTES,
} from "./constants";
const useGpu = import.meta.env.VITE_USE_GPU === "true";
const circuitResultCache = new Map();
const circuitRequestsInFlight = new Map();

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
  const simulationSeed = event.data.simulationSeed;
  const selectedStep = Number(untilStepIndex);
  const cacheKey = JSON.stringify({
    steps,
    qubitCount,
    amplitudeIndices,
    useGpu,
    simulationSeed,
    requestType,
  });
  if (qubitCount < 1 || qubitCount > MAX_QUBIT_COUNT) {
    self.postMessage({ type: "error", requestId, message: `QniNotebook supports 1-${MAX_QUBIT_COUNT} qubits.` });
    self.postMessage({ type: "finish", requestId });
    return;
  }
  async function call_backend() {
    try {
      const cachedResults = circuitResultCache.get(cacheKey);
      if (cachedResults?.[selectedStep]?.amplitudes) {
        postResults(cachedResults, true);
        return;
      }
      if (cachedResults) circuitResultCache.delete(cacheKey);

      const params = new URLSearchParams({
        id: circuitJson,
        qubitCount: qubitCount,
        untilStepIndex: untilStepIndex,
        amplitudeIndices: amplitudeIndices,
        steps: JSON.stringify(steps),
        useGpu: useGpu,
        requestType: requestType,
        simulationSeed: simulationSeed,
        includeAllAmplitudes: String(
          qubitCount <= MAX_ALL_STEP_AMPLITUDE_QUBITS,
        ),
      });
      if (new TextEncoder().encode(params.toString()).byteLength > MAX_SIMULATION_PAYLOAD_BYTES) {
        throw new Error("Circuit payload exceeds the 256 KiB demo limit.");
      }

      let request = circuitRequestsInFlight.get(cacheKey);
      if (!request) {
        request = fetch(BACKEND_URL, {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }).then(async (response) => {
          if (!response.ok) {
            let detail = "";
            try { detail = (await response.json()).error || ""; } catch { /* no JSON body */ }
            throw new Error(detail || `Simulation failed (HTTP ${response.status}).`);
          }
          const results = await response.json();
          circuitResultCache.clear();
          circuitResultCache.set(cacheKey, results);
          return results;
        }).finally(() => circuitRequestsInFlight.delete(cacheKey));
        circuitRequestsInFlight.set(cacheKey, request);
      }

      postResults(await request, false);
    } catch (error) {
      console.error(error);
      self.postMessage({
        type: "error",
        requestId,
        message: error instanceof Error ? error.message : "Simulation failed.",
      });
      self.postMessage({ type: "finish", requestId });
    }
  }

  function postResults(jsondata, cached) {
    if (requestType === "circuit") {
      for (let i = 0; i < jsondata.length; i++) {
        const stepResult = jsondata[i];
        const hasCheckpointData =
          Object.keys(stepResult["measuredBits"] || {}).length > 0 ||
          Object.keys(stepResult["blochVectors"] || {}).length > 0;
        if (cached && i !== selectedStep && !hasCheckpointData) continue;
        self.postMessage({
          type: "step",
          requestId,
          step: i,
          amplitudes: i === selectedStep ? stepResult["amplitudes"] : undefined,
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
    self.postMessage({ type: "finish", requestId });
  }

  call_backend();
});
