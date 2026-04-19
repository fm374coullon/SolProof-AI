import { MODELS, PIPELINE_STEPS, PROMPT_SEEDS } from "./modules/data.js";
import { runInference, validateRunRequest, verifyBundle } from "./modules/engine.js";
import { createDemoWalletAddress, loadState, saveState } from "./modules/state.js";

const elements = {
  walletButton: document.querySelector("#walletButton"),
  walletState: document.querySelector("#walletState"),
  selectedTier: document.querySelector("#selectedTier"),
  executionMode: document.querySelector("#executionMode"),
  burnPreview: document.querySelector("#burnPreview"),
  proofBalance: document.querySelector("#proofBalance"),
  totalBurned: document.querySelector("#totalBurned"),
  historyCount: document.querySelector("#historyCount"),
  modelGrid: document.querySelector("#modelGrid"),
  inferenceForm: document.querySelector("#inferenceForm"),
  promptInput: document.querySelector("#promptInput"),
  fileInput: document.querySelector("#fileInput"),
  pipelineState: document.querySelector("#pipelineState"),
  progressBar: document.querySelector("#progressBar"),
  logList: document.querySelector("#logList"),
  resultPanel: document.querySelector("#resultPanel"),
  historyList: document.querySelector("#historyList"),
  runButton: document.querySelector("#runButton"),
  copyBundleButton: document.querySelector("#copyBundleButton"),
  verifyBundleButton: document.querySelector("#verifyBundleButton"),
  modelHint: document.querySelector("#modelHint"),
  quickActions: document.querySelectorAll("[data-seed]")
};

const appState = {
  ...loadState(),
  isRunning: false
};

function selectedModel() {
  return MODELS.find((model) => model.id === appState.selectedModelId) || MODELS[0];
}

function setPipeline(progress, label) {
  elements.progressBar.style.width = `${progress}%`;
  elements.pipelineState.textContent = label;
}

function addLog(type, message, meta = "") {
  const entry = document.createElement("article");
  entry.className = `log-entry ${type}`;

  const now = new Date();
  const stamp = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  entry.innerHTML = `
    <strong>${message}</strong>
    <span class="log-meta">${stamp}${meta ? ` | ${meta}` : ""}</span>
  `;

  elements.logList.prepend(entry);
}

function resetLogs() {
  elements.logList.innerHTML = "";
}

function renderModelGrid() {
  const current = selectedModel();

  elements.modelGrid.innerHTML = MODELS.map((model) => {
    const selected = model.id === current.id ? "selected" : "";

    return `
      <article class="model-card ${selected}" data-model-id="${model.id}">
        <div class="model-card-header">
          <h4 class="model-name">${model.name}</h4>
          <span class="tier-badge tier-${model.tier}">${model.tier.toUpperCase()}</span>
        </div>
        <p>${model.description}</p>
        <div class="model-meta">
          <span>Burn: ${model.proofBurn} PROOF</span>
          <span>Constraints: ${(model.constraints / 1024).toFixed(0)}K</span>
          <span>Latency: ${model.latency}</span>
          <span>${model.modeLabel}</span>
        </div>
      </article>
    `;
  }).join("");

  for (const card of elements.modelGrid.querySelectorAll("[data-model-id]")) {
    card.addEventListener("click", () => {
      appState.selectedModelId = card.dataset.modelId;
      saveState(appState);
      renderAll();
    });
  }
}

function renderWallet() {
  if (appState.connected) {
    elements.walletButton.textContent = `Disconnect ${appState.walletAddress}`;
    elements.walletState.textContent = `Wallet connected | ${appState.walletAddress}`;
    elements.walletState.className = "status-pill";
  } else {
    elements.walletButton.textContent = "Connect Wallet";
    elements.walletState.textContent = "Wallet disconnected";
    elements.walletState.className = "status-pill status-pill-soft";
  }
}

function renderBalances() {
  elements.proofBalance.textContent = String(appState.proofBalance);
  elements.totalBurned.textContent = String(appState.totalBurned);
  elements.historyCount.textContent = `${appState.history.length} Runs`;
}

function renderExecutionMode() {
  const model = selectedModel();
  const requiresWallet = model.tier === "pro";

  elements.selectedTier.textContent = `${model.tier.toUpperCase()} | ${model.name}`;
  elements.executionMode.textContent = requiresWallet ? "Pro Verification" : "Trial Verification";
  elements.burnPreview.textContent = `${model.proofBurn} PROOF burn`;
  elements.modelHint.textContent = model.promptHint;
}

function renderHistory() {
  if (appState.history.length === 0) {
    elements.historyList.className = "history-list empty-state";
    elements.historyList.textContent = "No verification history yet.";
    return;
  }

  elements.historyList.className = "history-list";
  elements.historyList.innerHTML = appState.history
    .slice(0, 6)
    .map((entry, index) => {
      return `
        <article class="history-card" data-history-index="${index}">
          <div class="history-entry">
            <div>
              <strong>${entry.modelName}</strong>
              <div class="history-meta">${entry.summary}</div>
            </div>
            <span class="tier-badge tier-${entry.tier}">${entry.tier.toUpperCase()}</span>
          </div>
          <div class="model-meta">
            <span>Burned: ${entry.proofBurn}</span>
            <span>TX: ${entry.txId.slice(0, 12)}...</span>
            <span>${new Date(entry.timestamp).toLocaleString()}</span>
            <span>${entry.walletMode}</span>
          </div>
        </article>
      `;
    })
    .join("");

  for (const card of elements.historyList.querySelectorAll("[data-history-index]")) {
    card.addEventListener("click", () => {
      const entry = appState.history[Number(card.dataset.historyIndex)];
      if (!entry?.bundle) {
        addLog("warn", "Selected history item has no stored bundle.");
        return;
      }

      appState.activeBundle = entry.bundle;
      saveState(appState);
      renderResultPanel();
      addLog("info", "Loaded proof bundle from local history", entry.txId.slice(0, 12));
    });
  }
}

function renderResultPanel() {
  if (!appState.activeBundle) {
    elements.resultPanel.className = "result-panel empty-state";
    elements.resultPanel.textContent = "Run an inference to materialize the proof bundle.";
    return;
  }

  const { modelName, tier, proofBurn, result, verification } = appState.activeBundle;
  const verificationClass = verification?.ok ? "pass" : "fail";
  const verificationLabel = verification?.ok ? "Bundle verified" : "Bundle not verified";

  elements.resultPanel.className = "result-panel";
  elements.resultPanel.innerHTML = `
    <section class="proof-box">
      <div class="proof-topline">
        <div>
          <h4>${modelName}</h4>
          <p class="history-meta">${result.inference.summary}</p>
        </div>
        <div class="action-row">
          <span class="tier-badge tier-${tier}">${tier.toUpperCase()} / ${proofBurn} PROOF</span>
          <span class="verification-badge ${verificationClass}">${verificationLabel}</span>
        </div>
      </div>
      <div class="proof-grid">
        <div class="proof-kv">
          <span class="stat-label">Model ID</span>
          <code>${result.request.modelId}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Receipt Explorer</span>
          <code><a href="${result.receipt.explorerUrl}" target="_blank" rel="noreferrer">${result.receipt.explorerUrl}</a></code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Proof Hash</span>
          <code>${result.proof.proofHash}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Commitment</span>
          <code>${result.proof.commitment}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Public Input Hash</span>
          <code>${result.proof.publicInputHash}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Transaction ID</span>
          <code>${result.proof.txId}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Input Fingerprint</span>
          <code>${result.fingerprints.inputFingerprint}</code>
        </div>
        <div class="proof-kv">
          <span class="stat-label">Output Fingerprint</span>
          <code>${result.fingerprints.outputFingerprint}</code>
        </div>
      </div>
    </section>
    <section class="proof-box">
      <strong>Request Envelope</strong>
      <pre>${JSON.stringify(result.request, null, 2)}</pre>
    </section>
    <section class="proof-box">
      <strong>Inference Output</strong>
      <pre>${JSON.stringify(result.inference.output, null, 2)}</pre>
    </section>
    <section class="proof-box">
      <strong>Proof Bundle JSON</strong>
      <pre>${JSON.stringify(result, null, 2)}</pre>
    </section>
  `;
}

function renderAll() {
  renderModelGrid();
  renderWallet();
  renderBalances();
  renderExecutionMode();
  renderHistory();
  renderResultPanel();
}

function syncActiveBundleIntoHistory() {
  if (!appState.activeBundle?.result?.proof?.txId) {
    return;
  }

  const targetTxId = appState.activeBundle.result.proof.txId;
  const historyEntry = appState.history.find((entry) => entry.txId === targetTxId);

  if (historyEntry) {
    historyEntry.bundle = appState.activeBundle;
  }
}

function connectWallet() {
  appState.connected = true;
  appState.walletAddress = createDemoWalletAddress();
  if (appState.proofBalance === 0) {
    appState.proofBalance = 1000;
  }
  saveState(appState);
  renderAll();
  addLog("success", "Demo wallet connected", appState.walletAddress);
}

function disconnectWallet() {
  appState.connected = false;
  appState.walletAddress = "";
  saveState(appState);
  renderAll();
  addLog("warn", "Wallet disconnected");
}

async function copyActiveBundle() {
  if (!appState.activeBundle) {
    addLog("warn", "No proof bundle available to copy");
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(appState.activeBundle.result, null, 2));
  addLog("success", "Proof bundle copied to clipboard");
}

async function verifyActiveBundle() {
  if (!appState.activeBundle) {
    addLog("warn", "No active proof bundle to verify");
    return;
  }

  const model = MODELS.find((item) => item.id === appState.activeBundle.result.request.modelId);
  if (!model) {
    addLog("warn", "Bundle model configuration could not be found");
    return;
  }

  const verification = await verifyBundle(appState.activeBundle.result, model);
  appState.activeBundle.verification = verification;
  syncActiveBundleIntoHistory();
  saveState(appState);
  renderResultPanel();
  addLog(verification.ok ? "success" : "warn", verification.reason, model.name);
}

function readAttachmentMeta() {
  const file = elements.fileInput.files?.[0];

  if (!file) {
    return null;
  }

  return {
    name: file.name,
    type: file.type,
    size: file.size
  };
}

async function stepLog(index, message, type = "info", meta = "") {
  const progress = Math.round(((index + 1) / PIPELINE_STEPS.length) * 100);
  setPipeline(progress, PIPELINE_STEPS[index]);
  addLog(type, message, meta);
  await new Promise((resolve) => window.setTimeout(resolve, 220));
}

async function executeInference(event) {
  event.preventDefault();
  if (appState.isRunning) {
    return;
  }

  const prompt = elements.promptInput.value.trim();
  const model = selectedModel();
  const attachment = readAttachmentMeta();
  const requestValidation = validateRunRequest(model, prompt, attachment);

  if (requestValidation.issues.length > 0) {
    requestValidation.issues.forEach((issue) => addLog("warn", issue));
    return;
  }

  if (model.tier === "pro" && !appState.connected) {
    addLog("warn", "Connect wallet before using Pro models");
    return;
  }

  if (model.tier === "pro" && appState.proofBalance < model.proofBurn) {
    addLog("warn", "Insufficient PROOF balance for selected Pro model");
    return;
  }

  appState.isRunning = true;
  elements.runButton.disabled = true;
  setPipeline(4, "Preparing");
  resetLogs();

  try {
    await stepLog(0, "Input payload normalized and queued", "info", model.name);
    await stepLog(1, "Mock inference engine executed from first-principles MVP layer", "info");
    await stepLog(2, "Poseidon-style commitment substituted with deterministic SHA-256 commitment", "info");

    const result = await runInference(model, requestValidation.normalizedPrompt, attachment);

    await stepLog(3, "Proof artifact generated", "success", result.proof.protocol);
    const verification = await verifyBundle(result, model);
    await stepLog(4, verification.reason, verification.ok ? "success" : "warn");

    if (!verification.ok) {
      throw new Error(verification.reason);
    }

    if (model.tier === "pro") {
      appState.proofBalance -= model.proofBurn;
      appState.totalBurned += model.proofBurn;
      addLog("warn", `Burned ${model.proofBurn} PROOF from connected wallet`);
    } else {
      addLog("info", "Trial mode run completed with zero token burn");
    }

    await stepLog(5, "Run finalized and archived locally", "success");

    const historyEntry = {
      modelName: model.name,
      tier: model.tier,
      proofBurn: model.proofBurn,
      timestamp: result.timestamp,
      txId: result.proof.txId,
      summary: result.inference.summary,
      walletMode: model.tier === "pro" ? "Wallet verified" : "Local verification",
      bundle: {
        modelName: model.name,
        tier: model.tier,
        proofBurn: model.proofBurn,
        result,
        verification
      }
    };

    appState.activeBundle = historyEntry.bundle;
    appState.history.unshift(historyEntry);
    appState.history = appState.history.slice(0, 20);
    syncActiveBundleIntoHistory();
    saveState(appState);
    renderAll();
  } catch (error) {
    addLog("warn", `Execution failed: ${error instanceof Error ? error.message : String(error)}`);
    setPipeline(0, "Failed");
  } finally {
    appState.isRunning = false;
    elements.runButton.disabled = false;
  }
}

elements.walletButton.addEventListener("click", () => {
  if (appState.connected) {
    disconnectWallet();
  } else {
    connectWallet();
  }
});

elements.copyBundleButton.addEventListener("click", () => {
  copyActiveBundle();
});

elements.verifyBundleButton.addEventListener("click", () => {
  verifyActiveBundle();
});

elements.inferenceForm.addEventListener("submit", executeInference);

for (const button of elements.quickActions) {
  button.addEventListener("click", () => {
    elements.promptInput.value = PROMPT_SEEDS[button.dataset.seed] || "";
  });
}

renderAll();
setPipeline(0, "Idle");
