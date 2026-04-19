const STORAGE_KEY = "solproof-mvp-state";

const defaultState = {
  connected: false,
  walletAddress: "",
  proofBalance: 0,
  totalBurned: 0,
  selectedModelId: "gemini-flash-zkml",
  history: [],
  activeBundle: null
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState };
    }

    const parsed = JSON.parse(raw);
    const state = {
      ...defaultState,
      ...parsed,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      activeBundle: parsed.activeBundle || null
    };

    if (!state.activeBundle && state.history[0]?.bundle) {
      state.activeBundle = state.history[0].bundle;
    }

    return state;
  } catch (error) {
    return { ...defaultState };
  }
}

export function saveState(state) {
  const persistedState = {
    connected: Boolean(state.connected),
    walletAddress: state.walletAddress || "",
    proofBalance: Number.isFinite(state.proofBalance) ? state.proofBalance : 0,
    totalBurned: Number.isFinite(state.totalBurned) ? state.totalBurned : 0,
    selectedModelId: state.selectedModelId || defaultState.selectedModelId,
    history: Array.isArray(state.history) ? state.history : [],
    activeBundle: state.activeBundle || null
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
}

export function createDemoWalletAddress() {
  const body = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `PROOF-${body}`;
}
