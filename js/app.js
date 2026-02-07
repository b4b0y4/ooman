import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./libs/dappkit.js";

// =============================================================
// CONFIG
// =============================================================

const CONFIG = {
  CHUNK_COUNT: 10,
  CHUNK_PATTERN: "./data/Ooman_metadata_{i}.json",
  INITIAL_CHUNKS: 1,
  RENDER_CHUNK_SIZE: 100,
  LAZY_ROOT_MARGIN: "100px",
  LAZY_BATCH_SIZE: 50,
};

// =============================================================
// STATE
// =============================================================

const state = {
  metadata: [],
  filteredMetadata: [],
  activeFilters: [],
  lazyLoadObserver: null,
};

const wallet = new ConnectWallet();

// =============================================================
// INIT
// =============================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupLazyLoading();
  await loadMetadata();
  setupWalletListeners();
});

// =============================================================
// DATA LOADING
// =============================================================

const getChunkFiles = () =>
  Array.from({ length: CONFIG.CHUNK_COUNT }, (_, i) =>
    CONFIG.CHUNK_PATTERN.replace("{i}", i + 1),
  );

const fetchChunk = async (file) => {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  return res.json();
};

const deferExecution = (fn) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 100);

async function loadMetadata() {
  try {
    const files = getChunkFiles();
    const [initial, remaining] = [
      files.slice(0, CONFIG.INITIAL_CHUNKS),
      files.slice(CONFIG.INITIAL_CHUNKS),
    ];

    const results = await Promise.allSettled(initial.map(fetchChunk));
    state.metadata = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    state.filteredMetadata = [...state.metadata];

    // Initial render
    renderGallery(state.metadata);
    updateFilters();
    updateCount();

    console.log(
      `Loaded ${state.metadata.length} items from ${initial.length} chunks`,
    );

    // Background load remaining chunks
    deferExecution(() => loadBackground(remaining));
  } catch (error) {
    showError("Failed to load metadata. Please refresh.");
    console.error(error);
  }
}

async function loadBackground(files) {
  if (!files.length || !window.Worker) return;

  console.log("Using worker loader (universal)");

  const worker = new Worker("./js/workers/metadata_worker.js", {
    type: "module",
  });

  worker.postMessage({
    files,
    batchSize: 200, // tune this
  });

  worker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === "batch") {
      const data = msg.data;

      state.metadata.push(...data);

      if (state.activeFilters.length === 0) {
        state.filteredMetadata.push(...data);
        // Only append every other batch to reduce DOM operations
        if (state.metadata.length % 400 === 0 || msg.final) {
          appendItems(data);
        }
      }

      // Throttle filter updates - only update every 400 items
      if (state.metadata.length % 400 === 0) {
        updateFilters();
        updateCount();
      }
    }

    if (msg.type === "error") {
      console.warn("Worker chunk failed:", msg.file, msg.error);
    }

    if (msg.type === "done") {
      console.log("Worker loading complete");
      worker.terminate();
    }
  };
}

// =============================================================
// LAZY LOADING
// =============================================================

function setupLazyLoading() {
  state.lazyLoadObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.replace("lazy", "loaded");
          state.lazyLoadObserver.unobserve(img);
        }
      });
    },
    { rootMargin: CONFIG.LAZY_ROOT_MARGIN, threshold: 0 },
  );
}

const observeLazyImages = () => {
  const images = document.querySelectorAll("img.lazy");
  const batches = Math.ceil(images.length / CONFIG.LAZY_BATCH_SIZE);

  const observeBatch = (index) => {
    if (index >= batches) return;
    const start = index * CONFIG.LAZY_BATCH_SIZE;
    const batch = Array.from(images).slice(
      start,
      start + CONFIG.LAZY_BATCH_SIZE,
    );
    batch.forEach((img) => state.lazyLoadObserver.observe(img));
    requestAnimationFrame(() => observeBatch(index + 1));
  };

  observeBatch(0);
};

// =============================================================
// FILTERS
// =============================================================

const matchesFilter = (item, filter) =>
  item.attributes.some(
    (attr) =>
      attr.trait_type === filter.trait_type && attr.value === filter.value,
  );

const matchesAllFilters = (item) =>
  state.activeFilters.every((filter) => matchesFilter(item, filter));

function toggleFilters() {
  const content = document.querySelector(".filters-content");
  const header = document.querySelector(".filters-header");
  content.classList.toggle("collapsed");
  header.classList.toggle("expanded");
}

function addFilter(traitType, value) {
  if (
    state.activeFilters.some(
      (f) => f.trait_type === traitType && f.value === value,
    )
  ) {
    return;
  }
  state.activeFilters.push({ trait_type: traitType, value });
  applyFilters();
}

function removeFilter(traitType, value) {
  state.activeFilters = state.activeFilters.filter(
    (f) => !(f.trait_type === traitType && f.value === value),
  );
  applyFilters();
}

function applyFilters() {
  state.filteredMetadata =
    state.activeFilters.length === 0
      ? [...state.metadata]
      : state.metadata.filter(matchesAllFilters);

  renderGallery(state.filteredMetadata);
  updateActiveFiltersUI();
  updateCount();
}

function updateActiveFiltersUI() {
  const container = document.getElementById("active-filters");
  if (!container) return;

  container.innerHTML =
    state.activeFilters.length === 0
      ? '<span class="no-filters">No active filters</span>'
      : state.activeFilters
          .map(
            (f) => `
            <span class="active-filter-tag" onclick="removeFilter('${f.trait_type}', '${f.value}')">
              ${f.trait_type}: ${f.value}
              <span class="remove-icon">×</span>
            </span>
          `,
          )
          .join("");
}

function updateFilters() {
  const traits = {};

  state.metadata.forEach((item) => {
    item.attributes.forEach((attr) => {
      if (!traits[attr.trait_type]) traits[attr.trait_type] = {};
      if (!traits[attr.trait_type][attr.value]) {
        traits[attr.trait_type][attr.value] = 0;
      }
      traits[attr.trait_type][attr.value]++;
    });
  });

  removeRedundantTraits(traits);

  const container = document.getElementById("available-filters");

  const sortedTraits = Object.keys(traits);
  const fragment = document.createDocumentFragment();

  sortedTraits.forEach((traitType) => {
    const values = Object.entries(traits[traitType])
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value);

    fragment.appendChild(createFilterCategoryElement(traitType, values));
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function removeRedundantTraits(traitValueCounts) {
  if (!traitValueCounts["Type"]) return;

  const typeValuesLower = new Set(
    Object.keys(traitValueCounts["Type"]).map((v) => v.toLowerCase()),
  );

  ["Skin", "Eyes"].forEach((trait) => {
    if (traitValueCounts[trait]) {
      Object.keys(traitValueCounts[trait]).forEach((value) => {
        if (typeValuesLower.has(value.toLowerCase())) {
          delete traitValueCounts[trait][value];
        }
      });
    }
  });
}

const colorize = (text) =>
  text
    .split("")
    .map((char, i) =>
      char === "#"
        ? '<span class="c6"> #</span>'
        : `<span class="c${(i % 6) + 1}">${char}</span>`,
    )
    .join("");

function createFilterCategoryElement(traitType, values) {
  const div = document.createElement("div");
  div.className = "filter-category";
  div.dataset.trait = traitType;

  const valuesHtml = values
    .map(
      (value) =>
        `<span class="filter-value" onclick="addFilter('${traitType}', '${value}')">${value}</span>`,
    )
    .join("");

  div.innerHTML = `
    <div class="filter-category-title">${colorize(traitType)}</div>
    <div class="filter-values">${valuesHtml}</div>
  `;

  return div;
}

// =============================================================
// GALLERY RENDERING
// =============================================================

const placeholder =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E";

const createCard = (item) => {
  const div = document.createElement("div");
  div.className = "svg-card";
  div.dataset.id = item.name;
  div.onclick = () => openModal(item.name);
  div.innerHTML = `
    <div class="svg-preview">
      <img class="lazy" data-src="${item.image}" alt="${item.name}" src="${placeholder}" loading="lazy" decoding="async" />
    </div>
    <div class="svg-info">
      <div class="svg-id">${colorize(item.name)}</div>
    </div>
  `;
  return div;
};

function appendItems(items) {
  const gallery = document.getElementById("gallery");
  const fragment = document.createDocumentFragment();
  items.forEach((item) => fragment.appendChild(createCard(item)));
  gallery.appendChild(fragment);
  observeLazyImages();
  updateCount();
}

function renderGallery(items) {
  const gallery = document.getElementById("gallery");

  if (items.length === 0) {
    gallery.innerHTML =
      '<div class="empty-state"><p>No items match the selected filters.</p></div>';
    return;
  }

  gallery.innerHTML = "";

  if (items.length <= CONFIG.RENDER_CHUNK_SIZE) {
    appendItems(items);
  } else {
    renderChunked(items);
  }
}

function renderChunked(items) {
  const gallery = document.getElementById("gallery");
  let index = 0;

  const renderNext = () => {
    if (index >= items.length) {
      observeLazyImages();
      return;
    }

    const chunk = items.slice(index, index + CONFIG.RENDER_CHUNK_SIZE);
    const fragment = document.createDocumentFragment();
    chunk.forEach((item) => fragment.appendChild(createCard(item)));
    gallery.appendChild(fragment);

    index += CONFIG.RENDER_CHUNK_SIZE;
    requestAnimationFrame(renderNext);
  };

  renderNext();
}

const updateCount = () => {
  const el = document.getElementById("results-count");
  if (!el) return;
  const { length: filtered } = state.filteredMetadata;
  const { length: total } = state.metadata;
  el.textContent =
    filtered === total
      ? `Showing all ${total} items`
      : `Showing ${filtered} of ${total} items`;
};

const showError = (msg) => {
  document.getElementById("gallery").innerHTML =
    `<div class="empty-state"><p>${msg}</p></div>`;
};

// =============================================================
// MODAL
// =============================================================

function openModal(itemName) {
  const item = state.metadata.find((m) => m.name === itemName);
  if (!item) return;

  const modal = document.getElementById("item-modal");

  document.getElementById("modal-img").src = item.image;
  const mobilImg = document.getElementById("modal-img-mobile");
  if (mobilImg) mobilImg.src = item.image;

  document.getElementById("modal-title").innerHTML = colorize(item.name);
  document.getElementById("modal-traits").innerHTML = item.attributes
    .map(
      (attr) => `
      <div class="modal-trait">
        <span class="modal-trait-type">${attr.trait_type}:</span>
        ${attr.value}
      </div>
    `,
    )
    .join("");

  document.getElementById("modal-download").onclick = () => download(item);
  document.getElementById("modal-claim").onclick = () => {
    claim(itemName);
    closeModal();
  };

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

const closeModal = () => {
  document.getElementById("item-modal").classList.remove("show");
  document.body.style.overflow = "";
};

// =============================================================
// DOWNLOAD & CLAIM
// =============================================================

function download(item) {
  const svgData = decodeURIComponent(
    item.image.replace("data:image/svg+xml;utf8,", ""),
  );
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.name.replace(/\s+/g, "")}.svg`;
  link.click();

  URL.revokeObjectURL(url);
  closeModal();
}

async function claim(itemName) {
  const item = state.metadata.find((m) => m.name === itemName);
  if (!item) return;

  if (!wallet.isConnected()) {
    Notification.show("Please connect your wallet first", "warning");
    return;
  }

  try {
    const provider = wallet.getEthersProvider();
    const signer = await provider.getSigner();
    const account = await wallet.getAccount();
    const tx = await signer.sendTransaction({ to: account, value: 0 });
    Notification.track(tx, { label: `Claiming ${item.name}` });
  } catch (error) {
    Notification.show(
      "Claim failed: " + error.message.split("(")[0].trim(),
      "danger",
    );
  }
}

// =============================================================
// WALLET
// =============================================================

function setupWalletListeners() {
  wallet.onConnect(async (data) => {
    const account = data.accounts[0];
    const shortAccount = `${account.slice(0, 6)}...${account.slice(-4)}`;
    Notification.show(
      `Connected to ${wallet.getLastWallet()} account ${shortAccount}`,
      "success",
    );
  });

  wallet.onDisconnect(() => {
    Notification.show("Wallet disconnected", "warning");
  });
}

// =============================================================
// EXPORTS
// =============================================================

Object.assign(window, {
  toggleFilters,
  addFilter,
  removeFilter,
  openItemModal: openModal,
  closeItemModal: closeModal,
  downloadSVG: download,
  claim,
});
