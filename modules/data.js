export const MODELS = [
  {
    id: "gemini-flash-zkml",
    name: "Gemini Flash ZKML",
    description: "Fast text classification with lightweight proof generation.",
    tier: "trial",
    proofBurn: 0,
    constraints: 524288,
    latency: "1.5s - 3.0s",
    modeLabel: "Free local verification",
    minPromptLength: 20,
    promptHint: "Use this model for text categorization and broad intent labeling.",
    attachmentPolicy: "optional"
  },
  {
    id: "gemini-sentiment",
    name: "Gemini Sentiment",
    description: "Multi-language sentiment and confidence scoring for social text.",
    tier: "trial",
    proofBurn: 0,
    constraints: 262144,
    latency: "1.2s - 2.4s",
    modeLabel: "Free local verification",
    minPromptLength: 12,
    promptHint: "Best for social posts, launch feedback, and market-tone analysis.",
    attachmentPolicy: "optional"
  },
  {
    id: "gemini-vision",
    name: "Gemini Vision",
    description: "Image-or-scene classification for richer, higher-cost verification flows.",
    tier: "pro",
    proofBurn: 120,
    constraints: 1048576,
    latency: "3.0s - 5.2s",
    modeLabel: "Wallet + token burn",
    minPromptLength: 18,
    promptHint: "Provide a scene description and optionally attach a file for metadata-aware classification.",
    attachmentPolicy: "recommended"
  },
  {
    id: "gemini-fraud",
    name: "Gemini FraudDetect",
    description: "Transaction risk scoring for suspicious patterns and abnormal activity.",
    tier: "pro",
    proofBurn: 200,
    constraints: 2097152,
    latency: "4.2s - 6.8s",
    modeLabel: "Wallet + token burn",
    minPromptLength: 24,
    promptHint: "Use structured transaction context, addresses, routing clues, and velocity markers.",
    attachmentPolicy: "optional"
  }
];

export const PROMPT_SEEDS = {
  defi:
    "Wallet 7pV... deposited 125,000 USDC into a lending pool, borrowed 80,000 against a thin collateral asset, then bridged funds out within 5 minutes. Assess the risk level and explain why.",
  sentiment:
    "The launch looks sharp, the product finally feels real, and the team shipped faster than most Solana AI projects this cycle.",
  fraud:
    "txn_id=8fc29 amount=48950 token=USDC route=unknown_pool velocity=14m recipient_age=2h flagged_mixers=true"
};

export const PIPELINE_STEPS = [
  "Input committed",
  "Inference executed",
  "Commitment hashed",
  "Proof materialized",
  "Bundle verified",
  "Receipt archived"
];
