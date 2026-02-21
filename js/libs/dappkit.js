import { ethers } from "./ethers.min.js";

// ============================================================
// WNS CONTRACT CONFIGURATION
// ============================================================

const WNS_CONTRACT_ADDRESS = "0x0000000000696760E15f265e828DB644A0c242EB";

const WNS_ABI = [
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }],
    name: "reverseResolve",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "name", type: "string" }],
    name: "resolve",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

const STORAGE_KEYS = {
  CHAIN_ID: "connectCurrentChainId",
  LAST_WALLET: "connectLastWallet",
  IS_CONNECTED: "connectConnected",
};

const TIMINGS = {
  NOTIFICATION_DURATION: 5000,
  NOTIFICATION_HIDE_DELAY: 400,
  TRANSACTION_REMOVE_DELAY: 5000,
  COPY_FEEDBACK_DURATION: 2000,
};

const PROVIDER_EVENTS = ["accountsChanged", "chainChanged", "disconnect"];
const CONNECT_STATE_KEYS = [
  STORAGE_KEYS.CHAIN_ID,
  STORAGE_KEYS.LAST_WALLET,
  STORAGE_KEYS.IS_CONNECTED,
];
const ENS_EMPTY_RESULT = { name: null, avatar: null };

const COPY_ICONS = {
  copy: `<svg class="copy-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  success: '<polyline points="20 6 9 17 4 12"/>',
  error:
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
};

export const networkConfigs = {
  ethereum: {
    name: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    chainId: 1,
    icon: "./assets/img/eth.png",
    explorerUrl: "https://etherscan.io/tx/",
    showInUI: true,
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function normalizeChainId(chainId) {
  if (typeof chainId === "string") chainId = chainId.trim();
  if (!chainId && chainId !== 0) return NaN;
  const parsed = Number(chainId);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function chainIdToHex(chainId) {
  const normalized = normalizeChainId(chainId);
  if (!Number.isFinite(normalized)) return null;
  return `0x${normalized.toString(16)}`;
}

function shortenMiddle(value, startChars, endChars) {
  if (!value) return "";
  return `${value.substring(0, startChars)}...${value.substring(value.length - endChars)}`;
}

function shortenAddress(address, startChars = 5, endChars = 4) {
  return shortenMiddle(address, startChars, endChars);
}

function shortenHash(hash, startChars = 6, endChars = 4) {
  return shortenMiddle(hash, startChars, endChars);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getVisibleNetworks() {
  return Object.entries(networkConfigs).filter(([, config]) => config.showInUI);
}

function getNetworkByChainId(chainId) {
  const normalized = normalizeChainId(chainId);
  return Object.values(networkConfigs).find(
    (net) => net.chainId === normalized,
  );
}

function hasChainChanged(previousChainId, nextChainId) {
  const prev = normalizeChainId(previousChainId);
  const next = normalizeChainId(nextChainId);
  return Number.isFinite(next) && next !== prev;
}

export function getRpcUrl(network) {
  const customRpc = localStorage.getItem(`${network}-rpc`);
  return customRpc || networkConfigs[network].rpcUrl;
}

function getEthereumProvider() {
  return new ethers.JsonRpcProvider(getRpcUrl("ethereum"));
}

function removeElementWithDelay(element, delay, onRemove) {
  element.classList.add("hide");
  setTimeout(() => {
    element?.parentNode?.removeChild(element);
    onRemove?.();
  }, delay);
}

function onReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback);
    return;
  }
  callback();
}

// ============================================================
// RPC MODAL
// ============================================================

const rpcModal = document.getElementById("rpc-modal");
const rpcCloseBtn = document.getElementsByClassName("rpc-close-btn")[0];
const rpcInputs = document.getElementById("rpc-inputs");
const saveRpcBtn = document.getElementById("save-rpc-btn");

function toggleRpcModal(show) {
  rpcModal?.classList.toggle("show", show);
}

function populateRpcInputs() {
  if (!rpcInputs) return;

  rpcInputs.innerHTML = "";

  getVisibleNetworks().forEach(([network, networkConfig]) => {
    const div = document.createElement("div");
    const label = document.createElement("label");
    label.innerText = networkConfig.name;

    const input = document.createElement("input");
    input.id = `${network}-rpc`;
    input.placeholder = "Enter custom RPC URL";

    const customRpc = localStorage.getItem(`${network}-rpc`);
    if (customRpc) input.value = customRpc;

    div.appendChild(label);
    div.appendChild(input);
    rpcInputs.appendChild(div);
  });
}

function saveRpcSettings() {
  getVisibleNetworks().forEach(([network]) => {
    const input = document.getElementById(`${network}-rpc`);
    if (!input) return;

    if (input.value) {
      localStorage.setItem(`${network}-rpc`, input.value);
    } else {
      localStorage.removeItem(`${network}-rpc`);
    }
  });

  toggleRpcModal(false);
}

rpcCloseBtn?.addEventListener("click", () => toggleRpcModal(false));
saveRpcBtn?.addEventListener("click", saveRpcSettings);

window.addEventListener("click", (e) => {
  if (e.target === rpcModal) toggleRpcModal(false);
});

// ============================================================
// COPY TO CLIPBOARD
// ============================================================

class Copy {
  static initialized = false;
  static elements = new WeakSet();

  static init() {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener("click", this.handleClick.bind(this), true);
    this.setupObserver();
    this.enhanceAll();
  }

  static setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;

          if (node.matches?.("[data-copy]")) this.enhance(node);
          node
            .querySelectorAll?.("[data-copy]")
            ?.forEach((el) => this.enhance(el));
        });
      });
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  static enhanceAll() {
    document.querySelectorAll("[data-copy]").forEach((el) => this.enhance(el));
  }

  static enhance(el) {
    if (this.elements.has(el)) return;

    el.title ||= "Click to copy";

    if (!el.querySelector(".copy-icon-svg")) {
      el.insertAdjacentHTML("beforeend", COPY_ICONS.copy);
    }

    this.elements.add(el);
  }

  static handleClick(e) {
    const el = e.target.closest("[data-copy]");
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    const text = el.getAttribute("data-copy");
    this.copy(text, el);
  }

  static async copy(text, el) {
    try {
      await navigator.clipboard.writeText(text);
      this.showFeedback(el, true);
      return true;
    } catch (err) {
      console.warn("Copy failed:", err);
      this.showFeedback(el, false);
      return false;
    }
  }

  static showFeedback(el, success) {
    if (!el) return;

    const svg = el.querySelector("svg");
    if (!svg) return;

    const prevInner = svg.innerHTML;
    const prevTitle = el.title;

    svg.innerHTML = success ? COPY_ICONS.success : COPY_ICONS.error;
    el.title = success ? "Copied!" : "Copy failed";
    el.classList.add(success ? "copy-success" : "copy-error");

    setTimeout(() => {
      svg.innerHTML = prevInner;
      el.title = prevTitle || "Click to copy";
      el.classList.remove("copy-success", "copy-error");
    }, TIMINGS.COPY_FEEDBACK_DURATION);
  }

  static destroy() {
    this.observer?.disconnect();
    this.initialized = false;
  }
}

onReady(() => Copy.init());

// ============================================================
// NOTIFICATIONS
// ============================================================

export class Notification {
  static container = null;
  static notifications = new Map();
  static transactions = new Map();
  static idCounter = 0;
  static initialized = false;

  static init() {
    if (this.initialized) return;

    this.container = document.getElementById("notificationContainer");

    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "notificationContainer";
      document.body.appendChild(this.container);
    }

    this.initialized = true;
  }

  static show(message, type = "info", options = {}) {
    this.init();

    const config = {
      duration: TIMINGS.NOTIFICATION_DURATION,
      closable: true,
      showProgress: true,
      html: false,
      ...options,
    };

    const id = ++this.idCounter;
    const notification = this.createNotification(id, message, type, config);

    this.notifications.set(id, {
      element: notification,
      config,
      timeoutId: null,
    });

    this.container.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add("show"));

    if (config.duration > 0) {
      this.scheduleHide(id, config.duration);
    }

    return id;
  }

  static createNotification(id, message, type, config) {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.setAttribute("data-id", id);

    const safeMessage = config.html ? message : escapeHtml(message);

    notification.innerHTML = `
      <div class="notif-content">
        <div class="notif-message">
          <span>${safeMessage}</span>
        </div>
        ${config.closable ? `<button class="notif-close">&times;</button>` : ""}
        ${config.showProgress && config.duration > 0 ? `<div class="progress-bar" style="animation-duration: ${config.duration}ms"></div>` : ""}
      </div>
    `;

    if (config.closable) {
      notification
        .querySelector(".notif-close")
        .addEventListener("click", () => this.hide(id));
    }

    return notification;
  }

  static track(tx, options = {}) {
    this.init();

    const config = {
      label: "Transaction",
      onPending: null,
      onSuccess: null,
      onError: null,
      autoRemove: true,
      removeDelay: TIMINGS.TRANSACTION_REMOVE_DELAY,
      ...options,
    };

    const id = tx.hash;
    if (this.transactions.has(id)) return id;

    const txElement = this.createTransaction(
      id,
      tx.hash,
      Number(tx.chainId),
      config,
    );
    this.container.appendChild(txElement);

    this.transactions.set(id, {
      element: txElement,
      config,
      status: "pending",
      tx,
    });

    requestAnimationFrame(() => txElement.classList.add("show"));
    this.watchTransaction(id, config);

    return id;
  }

  static createTransaction(id, txHash, chainId, config) {
    const tx = document.createElement("div");
    tx.className = "notification tx-notification pending";
    tx.setAttribute("data-id", id);

    const explorerUrl = this.getExplorerUrl(txHash, chainId);

    tx.innerHTML = `
      <div class="notif-content">
        <div class="tx-icon">
          <div class="tx-spinner"></div>
        </div>
        <div class="tx-details">
          <div class="tx-label">${escapeHtml(config.label)}</div>
          <div class="tx-hash">
            <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer">${shortenHash(txHash)}</a>
          </div>
        </div>
        <div class="tx-status">Pending</div>
        <button class="notif-close">&times;</button>
      </div>
    `;

    tx.querySelector(".notif-close").addEventListener("click", () =>
      this.removeTransaction(id),
    );

    return tx;
  }

  static getExplorerUrl(txHash, chainId) {
    const network = getNetworkByChainId(chainId);
    return network?.explorerUrl
      ? `${network.explorerUrl}${txHash}`
      : `https://etherscan.io/tx/${txHash}`;
  }

  static async watchTransaction(id, config) {
    const txData = this.transactions.get(id);
    if (!txData) return;

    try {
      config.onPending?.(txData.tx.hash);

      const receipt = await txData.tx.wait();
      if (!this.transactions.has(id)) return;

      if (receipt.status === 1) {
        this.updateTransactionStatus(id, "success", "Confirmed");
        config.onSuccess?.(receipt);
      } else {
        this.updateTransactionStatus(id, "failed", "Failed");
        config.onError?.(new Error("Transaction failed"));
      }
    } catch (error) {
      if (!this.transactions.has(id)) return;

      this.updateTransactionStatus(id, "failed", "Failed");
      config.onError?.(error);
    } finally {
      if (config.autoRemove && this.transactions.has(id)) {
        setTimeout(() => this.removeTransaction(id), config.removeDelay);
      }
    }
  }

  static updateTransactionStatus(id, status, statusText) {
    const txData = this.transactions.get(id);
    if (!txData) return;

    txData.status = status;
    txData.element.classList.remove("pending", "success", "failed");
    txData.element.classList.add(status);

    const statusEl = txData.element.querySelector(".tx-status");
    if (statusEl) statusEl.textContent = statusText;

    const spinner = txData.element.querySelector(".tx-spinner");
    if (spinner && status !== "pending") spinner.remove();
  }

  static removeTransaction(id) {
    const txData = this.transactions.get(id);
    if (!txData) return;
    removeElementWithDelay(
      txData.element,
      TIMINGS.NOTIFICATION_HIDE_DELAY,
      () => this.transactions.delete(id),
    );
  }

  static hide(id) {
    const notif = this.notifications.get(id);
    if (!notif) return;

    if (notif.timeoutId) clearTimeout(notif.timeoutId);
    removeElementWithDelay(notif.element, TIMINGS.NOTIFICATION_HIDE_DELAY, () =>
      this.notifications.delete(id),
    );
  }

  static scheduleHide(id, delay) {
    const notif = this.notifications.get(id);
    if (notif) {
      notif.timeoutId = setTimeout(() => this.hide(id), delay);
    }
  }

  static clearTransactions() {
    this.transactions.forEach((_, id) => this.removeTransaction(id));
  }

  static clearAll() {
    this.notifications.forEach((_, id) => this.hide(id));
    this.transactions.forEach((_, id) => this.removeTransaction(id));
  }
}

// ============================================================
// WALLET CONNECTION
// ============================================================

export class ConnectWallet {
  constructor(options = {}) {
    this.networkConfigs = options.networkConfigs || networkConfigs;
    this.providers = [];
    this.storage = options.storage || window.localStorage;
    this.currentProvider = null;
    this.providerListeners = null;
    this.nameResolutionOrder = options.nameResolutionOrder || "wns-first";
    this.showUnsupportedNetworkNotification =
      options.showUnsupportedNetworkNotification !== false;
    this.unsupportedNetworkNotificationId = null;

    const networks = Object.values(this.networkConfigs);
    this.chainIdToName = Object.fromEntries(
      networks.map((cfg) => [cfg.chainId, cfg.name]),
    );
    this.allowedChains = networks
      .filter((cfg) => cfg.showInUI)
      .map((cfg) => cfg.chainId);

    onReady(() => this.init());
  }

  init() {
    this.discoverElements();
    this.bindEvents();
    this.setupUIEvents();
    this.requestProviders();
    this.restoreState();
    this.render();
  }

  discoverElements() {
    this.elements = {
      connectBtn: document.querySelector("#connect-btn"),
      connectModal: document.querySelector("#connect-modal"),
      connectChainList: document.querySelector("#connect-chain-list"),
      connectWalletList: document.querySelector("#connect-wallet-list"),
      connectRpc: document.querySelector("#connect-rpc"),
    };
  }

  isAllowed(chainId) {
    return this.allowedChains.includes(normalizeChainId(chainId));
  }

  bindEvents() {
    window.addEventListener("eip6963:announceProvider", (event) =>
      this.handleProviderAnnounce(event),
    );
    window.addEventListener("focus", () =>
      this.verifyConnectionState({ allowUiDisconnect: true, retries: 1 }),
    );
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      this.verifyConnectionState({ allowUiDisconnect: true, retries: 1 });
    });
  }

  setupUIEvents() {
    if (this.elements.connectBtn) {
      this.elements.connectBtn.addEventListener("click", (event) => {
        if (event.target.closest("[data-copy]")) return;
        event.stopPropagation();
        this.toggleModal();
      });
    }

    this.elements.connectModal?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => this.hideModal());

    this.elements.connectRpc?.addEventListener("click", () => {
      populateRpcInputs();
      toggleRpcModal(true);
      this.hideModal();
    });
  }

  requestProviders() {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  setStorageState(key, value) {
    if (value === null || value === undefined || value === "") {
      this.storage.removeItem(key);
      return;
    }
    this.storage.setItem(key, value);
  }

  handleProviderAnnounce(event) {
    const { detail: providerDetail } = event;
    const providerName = providerDetail.info.name;
    const exists = this.providers.some((p) => p.info.name === providerName);
    if (exists) return;

    this.providers.push(providerDetail);
    this.render();

    if (this.isConnected() && this.getLastWallet() === providerName) {
      this.syncConnectedProviderState(providerDetail);
    }
  }

  async requestProviderState(provider, accountMethod = "eth_accounts") {
    return Promise.all([
      provider.request({ method: accountMethod }),
      provider.request({ method: "eth_chainId" }),
    ]);
  }

  createButton(config, onClick) {
    const button = document.createElement("button");
    button.innerHTML = `<img src="${config.icon}">${config.name}<span class="connect-dot" style="display: none"></span>`;
    button.onclick = onClick;
    return button;
  }

  async connectWallet(name) {
    const provider = this.getProviderDetail(name);
    if (!provider) return;

    try {
      const [accounts, chainId] = await this.requestProviderState(
        provider.provider,
        "eth_requestAccounts",
      );

      this.setupProviderEvents(provider);
      this.applyConnectedState({
        accounts,
        chainId,
        providerName: provider.info.name,
      });

      if (this.onConnectCallback) {
        this.onConnectCallback({
          accounts,
          chainId,
          provider: provider.info.name,
        });
      }

      return { accounts, chainId, provider: provider.provider };
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    }
  }

  setupProviderEvents(provider) {
    if (this.currentProvider === provider.provider) return;

    this.removeProviderEvents();

    this.currentProvider = provider.provider;
    const recover = () =>
      this.verifyConnectionState({ allowUiDisconnect: true, retries: 2 });
    this.providerListeners = {
      accountsChanged: (accounts) =>
        accounts.length > 0 ? this.updateAddress(accounts[0]) : recover(),
      chainChanged: (chainId) => this.handleChainChanged(chainId),
      disconnect: recover,
    };

    if (typeof this.currentProvider?.on !== "function") return;
    PROVIDER_EVENTS.forEach((eventName) => {
      this.currentProvider.on(eventName, this.providerListeners[eventName]);
    });
  }

  removeProviderEvents() {
    if (!this.currentProvider || !this.providerListeners) return;

    if (typeof this.currentProvider.removeListener === "function") {
      PROVIDER_EVENTS.forEach((eventName) => {
        this.currentProvider.removeListener(
          eventName,
          this.providerListeners[eventName],
        );
      });
      return;
    }

    this.currentProvider.removeAllListeners?.();
  }

  async syncConnectedProviderState(providerDetail) {
    if (!providerDetail?.provider) return;

    this.setupProviderEvents(providerDetail);

    try {
      const [accounts, chainId] = await this.requestProviderState(
        providerDetail.provider,
      );
      this.applyConnectedState({
        accounts,
        chainId,
        providerName: providerDetail.info.name,
      });
    } catch {
      this.render();
    }
  }

  applyDisconnectedState() {
    const hadConnectedState =
      this.storage.getItem(STORAGE_KEYS.IS_CONNECTED) === "true" ||
      Boolean(this.getLastWallet()) ||
      Boolean(this.getCurrentChainId());
    if (!hadConnectedState) return;

    this.removeProviderEvents();
    this.currentProvider = null;
    this.providerListeners = null;

    CONNECT_STATE_KEYS.forEach((key) => this.storage.removeItem(key));

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }

    if (this.elements.connectBtn) {
      this.elements.connectBtn.innerHTML = "Connect";
      this.elements.connectBtn.classList.remove("connected", "name-resolved");
    }

    this.elements.connectModal?.classList.remove("show");
    this.render();
  }

  async verifyConnectionState(options = {}) {
    const {
      allowUiDisconnect = false,
      retries = 0,
      retryDelayMs = 250,
    } = options;
    const provider = this.currentProvider || this.getConnectedProvider();
    if (!provider) return;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const [accounts, chainId] = await this.requestProviderState(provider);
        if (Array.isArray(accounts) && accounts.length > 0) {
          const previousChainId = this.getCurrentChainId();

          this.applyConnectedState({
            accounts,
            chainId,
            providerName: this.getLastWallet(),
            render: false,
          });

          if (hasChainChanged(previousChainId, chainId)) {
            this.emitChainChange(chainId);
          }
          this.render();
          return;
        }
      } catch {}

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      if (allowUiDisconnect) {
        this.applyDisconnectedState();
      }
      return;
    }
  }

  handleChainChanged(chainId) {
    const previousChainId = this.getCurrentChainId();
    this.updateNetworkStatus(chainId);
    this.syncUnsupportedNetworkNotice(chainId);
    if (hasChainChanged(previousChainId, chainId)) {
      this.emitChainChange(chainId);
    }
    this.render();
  }

  emitChainChange(chainId) {
    if (!this.onChainChangeCallback) return;
    const normalized = normalizeChainId(chainId);
    const name = this.chainIdToName[normalized] || `Unknown (${chainId})`;
    const allowed = this.isAllowed(chainId);

    this.onChainChangeCallback({
      chainId: normalized,
      hexChainId: chainIdToHex(normalized),
      name,
      allowed,
    });
  }

  applyConnectedState({ accounts, chainId, providerName, render = true }) {
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account) return;

    this.setStorageState(STORAGE_KEYS.IS_CONNECTED, "true");
    this.setStorageState(STORAGE_KEYS.LAST_WALLET, providerName);
    this.updateAddress(account);
    this.updateNetworkStatus(chainId);
    this.syncUnsupportedNetworkNotice(chainId);
    if (render) this.render();
  }

  showUnsupportedNetworkNotice() {
    if (!this.showUnsupportedNetworkNotification) return;
    if (this.unsupportedNetworkNotificationId) {
      Notification.hide(this.unsupportedNetworkNotificationId);
    }
    this.unsupportedNetworkNotificationId = Notification.show(
      "Please switch to a supported network.",
      "error",
      { duration: 0 },
    );
  }

  hideUnsupportedNetworkNotice() {
    if (!this.unsupportedNetworkNotificationId) return;
    Notification.hide(this.unsupportedNetworkNotificationId);
    this.unsupportedNetworkNotificationId = null;
  }

  syncUnsupportedNetworkNotice(chainId) {
    const normalized = normalizeChainId(chainId);
    if (!Number.isFinite(normalized)) return;
    this.isAllowed(normalized)
      ? this.hideUnsupportedNetworkNotice()
      : this.showUnsupportedNetworkNotice();
  }

  updateAddress(address) {
    if (!this.elements.connectBtn) return;

    const short = shortenAddress(address);
    this.elements.connectBtn.innerHTML = `
      <span class="connect-address-text">${short}</span>
      <span class="connect-copy-btn" data-copy="${address}"></span>
    `;
    this.elements.connectBtn.classList.add("connected");
    this.elements.connectBtn.classList.remove("name-resolved");
    this.elements.connectBtn.setAttribute("data-address", address);
    this.resolveName(address);
  }

  async resolveWNS(address) {
    try {
      const wnsContract = new ethers.Contract(
        WNS_CONTRACT_ADDRESS,
        WNS_ABI,
        getEthereumProvider(),
      );
      const wnsName = await wnsContract.reverseResolve(address);
      return wnsName || null;
    } catch {
      return null;
    }
  }

  async resolveENS(address) {
    try {
      const mainnetProvider = getEthereumProvider();
      const ensName = await mainnetProvider.lookupAddress(address);
      if (!ensName) return ENS_EMPTY_RESULT;

      const avatar = await mainnetProvider.getAvatar(ensName);
      return { name: ensName, avatar };
    } catch {
      return ENS_EMPTY_RESULT;
    }
  }

  async resolveName(address) {
    if (!this.elements.connectBtn) return;

    const short = shortenAddress(address);
    const resolutionOrder =
      this.nameResolutionOrder === "wns-first"
        ? ["wns", "ens"]
        : ["ens", "wns"];
    const resolvers = {
      wns: async () => {
        const name = await this.resolveWNS(address);
        return name ? { name, avatar: null, source: "wns" } : null;
      },
      ens: async () => {
        const { name, avatar } = await this.resolveENS(address);
        return name ? { name, avatar, source: "ens" } : null;
      },
    };
    let resolved = null;

    try {
      for (const source of resolutionOrder) {
        resolved = await resolvers[source]();
        if (resolved) break;
      }

      if (!resolved?.name) return;

      let buttonContent = `
        <div class="name-details">
          <div class="resolved-name">${resolved.name}</div>
          <div class="named-address-row">
            <span class="named-address">${short}</span>
            <span class="connect-copy-btn" data-copy="${address}"></span>
          </div>
        </div>
      `;

      if (resolved.avatar) {
        buttonContent += `<img src="${resolved.avatar}" style="border-radius: 50%">`;
      }

      this.elements.connectBtn.innerHTML = buttonContent;
      this.elements.connectBtn.classList.add("name-resolved");
      this.elements.connectBtn.setAttribute("data-address", address);
      this.elements.connectBtn.setAttribute(
        "data-resolution-source",
        resolved.source,
      );
    } catch {}
  }

  async switchNetwork(networkConfig) {
    const provider = this.getConnectedProvider();
    if (!provider) return;

    try {
      const chainIdHex = chainIdToHex(networkConfig.chainId);
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
      this.hideModal();
      this.updateNetworkStatus(networkConfig.chainId);
      this.render();
    } catch (error) {
      console.error("Network switch failed:", error);
      throw error;
    }
  }

  updateNetworkStatus(chainId) {
    const normalized = normalizeChainId(chainId);
    if (!Number.isFinite(normalized)) return;
    this.setStorageState(STORAGE_KEYS.CHAIN_ID, chainIdToHex(normalized));
  }

  async disconnect() {
    const provider = this.getConnectedProvider();

    try {
      await provider?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      console.error("Disconnect failed:", error);
    }

    this.applyDisconnectedState();
  }

  toggleModal() {
    this.elements.connectModal?.classList.toggle("show");
  }

  hideModal() {
    this.elements.connectModal?.classList.remove("show");
  }

  render() {
    this.renderWalletProviders();
    this.renderChainList();
    this.renderGetWallet();
  }

  renderWalletProviders() {
    if (!this.elements.connectWalletList) return;

    this.elements.connectWalletList.innerHTML = "";

    this.providers.forEach((provider) => {
      const button = this.createButton(provider.info, () => {
        this.hideModal();
        this.connectWallet(provider.info.name);
      });

      const isConnected = provider.info.name === this.getLastWallet();
      button.querySelector(".connect-dot").style.display = isConnected
        ? "inline-block"
        : "none";

      this.elements.connectWalletList.appendChild(button);
    });
  }

  renderChainList() {
    if (!this.elements.connectChainList) return;

    this.elements.connectChainList.innerHTML = "";
    const currentChainId = normalizeChainId(this.getCurrentChainId());
    const isConnected = this.isConnected();
    const networksToShow = getVisibleNetworks();
    const isSingleNetwork = networksToShow.length === 1;

    this.elements.connectChainList.classList.toggle(
      "single-network",
      isSingleNetwork,
    );

    networksToShow.forEach(([networkName, networkConfig]) => {
      const button = document.createElement("button");
      button.id = `connect-${networkName}`;
      button.title = networkConfig.name;
      button.classList.toggle("chain-single", isSingleNetwork);
      button.innerHTML = isSingleNetwork
        ? `<img src="${networkConfig.icon}" alt="${networkConfig.name}"><span class="connect-name">${networkConfig.name}</span>`
        : `<img src="${networkConfig.icon}" alt="${networkConfig.name}">`;

      button.onclick = () => this.switchNetwork(networkConfig);

      const indicator = document.createElement("span");
      indicator.className = `connect-dot${isSingleNetwork ? "" : "-icon"}`;
      button.appendChild(indicator);

      indicator.style.display =
        isConnected && networkConfig.chainId === currentChainId
          ? "inline-block"
          : "none";

      this.elements.connectChainList.appendChild(button);
    });
  }

  renderGetWallet() {
    const getWalletEl = document.querySelector("#connect-get-wallet");
    if (getWalletEl)
      getWalletEl.style.display = this.providers.length ? "none" : "block";
  }

  restoreState() {
    const storedChainId =
      this.getCurrentChainId() ||
      chainIdToHex(this.networkConfigs.ethereum.chainId);
    this.updateNetworkStatus(storedChainId);
    this.syncUnsupportedNetworkNotice(storedChainId);

    const providerDetail =
      this.isConnected() && this.getProviderDetail(this.getLastWallet());
    if (providerDetail) this.syncConnectedProviderState(providerDetail);
  }

  isConnected() {
    return this.storage.getItem(STORAGE_KEYS.IS_CONNECTED) === "true";
  }

  getCurrentChainId() {
    return this.storage.getItem(STORAGE_KEYS.CHAIN_ID);
  }

  getLastWallet() {
    return this.storage.getItem(STORAGE_KEYS.LAST_WALLET);
  }

  getProviderDetail(name) {
    if (!name) return null;
    return this.providers.find((p) => p.info.name === name) || null;
  }

  getConnectedProvider() {
    return this.getProviderDetail(this.getLastWallet())?.provider;
  }

  async getAccount() {
    const provider = this.getConnectedProvider();
    if (!provider) return null;

    try {
      const accounts = await provider.request({ method: "eth_accounts" });
      return accounts[0] || null;
    } catch (error) {
      console.error("Failed to get account:", error);
      return null;
    }
  }

  async getChainId() {
    const provider = this.getConnectedProvider();
    if (!provider) return null;

    try {
      const raw = await provider.request({ method: "eth_chainId" });
      return normalizeChainId(raw);
    } catch (error) {
      console.error("Failed to get chain ID:", error);
      return null;
    }
  }

  getProvider() {
    return this.getConnectedProvider();
  }

  getEthersProvider() {
    const provider = this.getConnectedProvider();
    return provider ? new ethers.BrowserProvider(provider) : null;
  }

  onConnect(callback) {
    this.onConnectCallback = callback;
  }

  onDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }

  onChainChange(callback) {
    this.onChainChangeCallback = callback;
  }

  setNameResolutionOrder(order) {
    if (order !== "wns-first" && order !== "ens-first") {
      console.warn(
        'Invalid name resolution order. Use "wns-first" or "ens-first"',
      );
      return;
    }

    this.nameResolutionOrder = order;

    if (this.isConnected()) {
      this.getAccount().then((address) => address && this.resolveName(address));
    }
  }

  getNameResolutionOrder() {
    return this.nameResolutionOrder;
  }
}
