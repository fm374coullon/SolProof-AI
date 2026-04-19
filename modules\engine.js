const encoder = new TextEncoder();

export function normalizeInput(text) {
  return text.trim().replace(/\s+/g, " ");
}

async function sha256Hex(value) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(hashBuffer)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function scoreWords(text, positiveWords, negativeWords) {
  let score = 0;

  for (const word of positiveWords) {
    if (text.includes(word)) {
      score += 1;
    }
  }

  for (const word of negativeWords) {
    if (text.includes(word)) {
      score -= 1;
    }
  }

  return score;
}

function inferByModel(modelId, rawText, fileMeta) {
  const text = normalizeInput(rawText).toLowerCase();
  const attachmentNote = fileMeta
    ? ` Attachment detected: ${fileMeta.name} (${fileMeta.type || "unknown"}, ${fileMeta.size} bytes).`
    : "";

  if (modelId === "gemini-sentiment") {
    const score = scoreWords(
      text,
      ["sharp", "real", "fast", "strong", "bullish", "great", "trust", "love", "clear"],
      ["bad", "weak", "slow", "bearish", "risk", "rug", "broken", "angry"]
    );
    const sentiment = score > 1 ? "Positive" : score < 0 ? "Negative" : "Neutral";

    return {
      summary: `${sentiment} market sentiment detected with confidence-weighted lexical scoring.`,
      output: {
        sentiment,
        confidence: Number(Math.min(0.97, 0.62 + Math.abs(score) * 0.08).toFixed(2)),
        rationale:
          score > 1
            ? "The input uses optimistic language and shipping-oriented signals."
            : score < 0
              ? "The input leans toward caution, failure, or risk-oriented framing."
              : "The input mixes or lacks strong directional sentiment cues."
      }
    };
  }

  if (modelId === "gemini-fraud") {
    const riskSignals = [
      text.includes("unknown_pool") && "Unknown pool route",
      text.includes("flagged_mixers=true") && "Mixer adjacency",
      /velocity=\d+/i.test(text) && "Elevated transfer velocity",
      /recipient_age=\d+h/i.test(text) && "Fresh recipient address",
      /amount=\d{4,}/i.test(text) && "Large notional size"
    ].filter(Boolean);

    const riskLevel =
      riskSignals.length >= 4 ? "High" : riskSignals.length >= 2 ? "Medium" : "Low";

    return {
      summary: `${riskLevel} fraud probability inferred from transaction-pattern heuristics.`,
      output: {
        riskLevel,
        flaggedSignals: riskSignals,
        recommendedAction:
          riskLevel === "High"
            ? "Hold execution and require manual verification."
            : riskLevel === "Medium"
              ? "Throttle and request a secondary proof."
              : "Allow with monitoring."
      }
    };
  }

  if (modelId === "gemini-vision") {
    const labels = [];
    const joined = `${text} ${fileMeta?.name || ""}`.toLowerCase();

    if (joined.includes("chart")) labels.push("Chart");
    if (joined.includes("wallet")) labels.push("Wallet UI");
    if (joined.includes("nft")) labels.push("NFT");
    if (joined.includes("receipt") || joined.includes("invoice")) labels.push("Document");
    if (labels.length === 0) labels.push("General visual asset");

    return {
      summary: "Visual classification simulated from scene description and attachment metadata.",
      output: {
        labels,
        attachment: fileMeta?.name || "No attachment",
        note:
          "This MVP uses metadata-assisted classification. Replace this module with real multimodal inference later."
      }
    };
  }

  const domain =
    text.includes("risk") || text.includes("borrow") || text.includes("collateral")
      ? "DeFi risk"
      : text.includes("nft")
        ? "NFT provenance"
        : text.includes("health")
          ? "Healthcare"
          : "General AI";

  return {
    summary: `${domain} classification produced from lightweight text heuristics.${attachmentNote}`,
    output: {
      domain,
      trustSignal:
        domain === "DeFi risk"
          ? "Input indicates leverage and movement patterns worth auditing."
          : "Input classified successfully for downstream verification.",
      nextStep:
        domain === "DeFi risk"
          ? "Escalate to Pro verification for stronger integrity guarantees."
          : "Bundle into a proof record and archive."
    }
  };
}

function generatePseudoProofHex(seed, desiredLength) {
  const expanded = [];

  for (let index = 0; expanded.length < desiredLength; index += 1) {
    const source = `${seed}:${index.toString(16).padStart(2, "0")}`;
    for (let cursor = 0; cursor < source.length && expanded.length < desiredLength; cursor += 1) {
      expanded.push(source.charCodeAt(cursor).toString(16).padStart(2, "0"));
    }
  }

  return expanded.join("").slice(0, desiredLength);
}

async function buildProofArtifacts(model, normalizedPrompt, fileMeta, inference, timestamp) {
  const inputFingerprint = await sha256Hex(
    `${model.id}:${normalizedPrompt}:${fileMeta?.name || "no-file"}:${fileMeta?.size || 0}`
  );
  const outputFingerprint = await sha256Hex(JSON.stringify(inference.output));
  const commitment = await sha256Hex(
    `${inputFingerprint}:${outputFingerprint}:${model.id}:${timestamp}`
  );
  const proofHash = await sha256Hex(`proof:${commitment}:${model.constraints}:${model.proofBurn}`);
  const txId = (await sha256Hex(`tx:${proofHash}`)).slice(0, 64);
  const publicInputHash = (await sha256Hex(`public:${inputFingerprint}:${model.tier}`)).slice(0, 64);

  return {
    inference,
    fingerprints: {
      inputFingerprint,
      outputFingerprint
    },
    proof: {
      protocol: "groth16-simulated",
      curve: "bn128-simulated",
      commitment,
      proofHash,
      publicInputHash,
      txId,
      pi_a: [`0x${generatePseudoProofHex(commitment, 64)}`, `0x${generatePseudoProofHex(proofHash, 64)}`, "0x1"],
      pi_b: [
        [`0x${generatePseudoProofHex(inputFingerprint, 32)}`, `0x${generatePseudoProofHex(outputFingerprint, 32)}`],
        [`0x${generatePseudoProofHex(publicInputHash, 32)}`, `0x${generatePseudoProofHex(txId, 32)}`],
        ["0x1", "0x0"]
      ],
      pi_c: [`0x${generatePseudoProofHex(txId, 64)}`, `0x${generatePseudoProofHex(commitment, 64)}`, "0x1"]
    },
    receipt: {
      network: "solana-devnet-simulated",
      explorerUrl: `https://solscan.io/tx/${txId}?cluster=devnet`,
      proofBurn: model.proofBurn,
      constraints: model.constraints,
      tier: model.tier,
      modelId: model.id,
      timestamp
    }
  };
}

export function validateRunRequest(model, prompt, fileMeta) {
  const normalizedPrompt = normalizeInput(prompt);
  const issues = [];

  if (!normalizedPrompt) {
    issues.push("Input payload is empty.");
  }

  if (normalizedPrompt.length > 0 && normalizedPrompt.length < model.minPromptLength) {
    issues.push(`Input is too short for ${model.name}. Minimum length is ${model.minPromptLength} characters.`);
  }

  if (model.id === "gemini-fraud" && !/=/.test(normalizedPrompt)) {
    issues.push("FraudDetect performs best with structured key=value style transaction context.");
  }

  if (model.id === "gemini-vision" && !fileMeta && normalizedPrompt.length < 40) {
    issues.push("Vision runs need either an attachment or a richer scene description.");
  }

  return {
    normalizedPrompt,
    issues
  };
}

export async function runInference(model, prompt, fileMeta) {
  const normalizedPrompt = normalizeInput(prompt);
  const timestamp = new Date().toISOString();
  const artifacts = await buildProofArtifacts(
    model,
    normalizedPrompt,
    fileMeta,
    inferByModel(model.id, normalizedPrompt, fileMeta),
    timestamp
  );

  return {
    request: {
      modelId: model.id,
      modelName: model.name,
      tier: model.tier,
      prompt: normalizedPrompt,
      attachment: fileMeta || null
    },
    timestamp,
    inference: artifacts.inference,
    fingerprints: artifacts.fingerprints,
    proof: artifacts.proof,
    receipt: artifacts.receipt
  };
}

export async function verifyBundle(bundle, model) {
  if (!bundle?.request || !bundle?.proof || !bundle?.receipt || !bundle?.inference) {
    return {
      ok: false,
      reason: "Bundle structure is incomplete."
    };
  }

  const normalizedPrompt = normalizeInput(bundle.request.prompt || "");
  const reconstructedInference = inferByModel(model.id, normalizedPrompt, bundle.request.attachment || null);
  const rebuilt = await buildProofArtifacts(
    model,
    normalizedPrompt,
    bundle.request.attachment || null,
    reconstructedInference,
    bundle.timestamp
  );

  const mismatches = [];

  if (JSON.stringify(bundle.inference.output) !== JSON.stringify(reconstructedInference.output)) {
    mismatches.push("Inference output mismatch");
  }

  if (bundle.proof.commitment !== rebuilt.proof.commitment) {
    mismatches.push("Commitment mismatch");
  }

  if (bundle.proof.proofHash !== rebuilt.proof.proofHash) {
    mismatches.push("Proof hash mismatch");
  }

  if (bundle.proof.publicInputHash !== rebuilt.proof.publicInputHash) {
    mismatches.push("Public input hash mismatch");
  }

  if (bundle.proof.txId !== rebuilt.proof.txId) {
    mismatches.push("Transaction id mismatch");
  }

  if (bundle.fingerprints?.inputFingerprint !== rebuilt.fingerprints.inputFingerprint) {
    mismatches.push("Input fingerprint mismatch");
  }

  if (bundle.fingerprints?.outputFingerprint !== rebuilt.fingerprints.outputFingerprint) {
    mismatches.push("Output fingerprint mismatch");
  }

  if (bundle.receipt.proofBurn !== model.proofBurn) {
    mismatches.push("Burn amount does not match model configuration");
  }

  if (bundle.request.modelId !== model.id || bundle.receipt.modelId !== model.id) {
    mismatches.push("Model identity mismatch");
  }

  return {
    ok: mismatches.length === 0,
    reason: mismatches.length === 0 ? "Bundle verified successfully." : mismatches.join("; "),
    reconstructed: rebuilt
  };
}
