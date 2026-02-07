import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./dappkit.js";

const wallet = new ConnectWallet();

// =============================================================
// CONSTANTS & CONFIGURATION
// =============================================================

const CHUNK_SIZE = 100; // Items to render per chunk
const LAZY_LOAD_ROOT_MARGIN = "100px";
const LAZY_OBSERVER_BATCH_SIZE = 50;

// =============================================================
// STATE MANAGEMENT
// =============================================================

const state = {
  metadata: [],
  filteredMetadata: [],
  activeFilters: [],
  renderQueue: [],
  isRendering: false,
  lazyLoadObserver: null,
};

// =============================================================
// INITIALIZATION
// =============================================================

document.addEventListener("DOMContentLoaded", async () => {
  await loadMetadata();
  setupLazyLoading();
  displayGallery(state.metadata);
  populateAvailableFilters();
  setupEventListeners();
  setupWalletListeners();
});

// =============================================================
// DATA LOADING
// =============================================================

async function loadMetadata() {
  try {
    const response = await fetch("Ooman_metadata.json");
    state.metadata = await response.json();
    state.filteredMetadata = [...state.metadata];
    console.log(`Loaded ${state.metadata.length} items`);
  } catch (error) {
    console.error("Error loading metadata:", error);
    showError("Error loading metadata. Please check console.");
  }
}

function showError(message) {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
}

// =============================================================
// LAZY LOADING SYSTEM
// =============================================================

function setupLazyLoading() {
  const options = {
    root: null,
    rootMargin: LAZY_LOAD_ROOT_MARGIN,
    threshold: 0,
  };

  state.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadImage(entry.target, observer);
      }
    });
  }, options);
}

function loadImage(img, observer) {
  const src = img.dataset.src;
  if (!src) return;

  img.src = src;
  img.removeAttribute("data-src");
  img.classList.remove("lazy");
  img.classList.add("loaded");
  observer.unobserve(img);
}

function observeLazyImages() {
  if (!state.lazyLoadObserver) return;

  const lazyImages = document.querySelectorAll("img.lazy");
  let index = 0;

  function observeBatch() {
    const batch = Array.from(lazyImages).slice(
      index,
      index + LAZY_OBSERVER_BATCH_SIZE,
    );
    batch.forEach((img) => state.lazyLoadObserver.observe(img));

    index += LAZY_OBSERVER_BATCH_SIZE;
    if (index < lazyImages.length) {
      requestAnimationFrame(observeBatch);
    }
  }

  observeBatch();
}

// =============================================================
// FILTER MANAGEMENT
// =============================================================

function toggleFilters() {
  const content = document.querySelector(".filters-content");
  const header = document.querySelector(".filters-header");
  const isCollapsed = content.classList.contains("collapsed");

  content.classList.toggle("collapsed", !isCollapsed);
  header.classList.toggle("expanded", isCollapsed);
}

function addFilter(traitType, value) {
  const exists = state.activeFilters.some(
    (f) => f.trait_type === traitType && f.value === value,
  );
  if (exists) return;

  state.activeFilters.push({ trait_type: traitType, value: value });
  updateActiveFiltersDisplay();
  applyFilters();
}

function removeFilter(traitType, value) {
  state.activeFilters = state.activeFilters.filter(
    (f) => !(f.trait_type === traitType && f.value === value),
  );
  updateActiveFiltersDisplay();
  applyFilters();
}

function updateActiveFiltersDisplay() {
  const container = document.getElementById("active-filters");
  if (!container) return;

  if (state.activeFilters.length === 0) {
    container.innerHTML = '<span class="no-filters">No active filters</span>';
    return;
  }

  container.innerHTML = state.activeFilters
    .map((filter) => createActiveFilterTag(filter))
    .join("");
}

function createActiveFilterTag(filter) {
  return `
    <span class="active-filter-tag" onclick="removeFilter('${filter.trait_type}', '${filter.value}')">
      ${filter.trait_type}: ${filter.value}
      <span class="remove-icon">×</span>
    </span>
  `;
}

function applyFilters() {
  if (state.activeFilters.length === 0) {
    state.filteredMetadata = [...state.metadata];
  } else {
    state.filteredMetadata = state.metadata.filter((item) =>
      state.activeFilters.every((filter) =>
        item.attributes
          .filter((attr) => attr.trait_type === filter.trait_type)
          .some((attr) => attr.value === filter.value),
      ),
    );
  }

  displayGallery(state.filteredMetadata);
  updateResultsCount(state.filteredMetadata.length, state.metadata.length);
}

function populateAvailableFilters() {
  const container = document.getElementById("available-filters");
  if (!container || state.metadata.length === 0) return;

  const traitValueCounts = buildTraitValueCounts();
  removeRedundantTraits(traitValueCounts);

  const sortedTraitTypes = sortTraitTypes(Object.keys(traitValueCounts));
  const fragment = buildFiltersFragment(sortedTraitTypes, traitValueCounts);

  container.innerHTML = "";
  container.appendChild(fragment);
}

function buildTraitValueCounts() {
  const counts = {};

  state.metadata.forEach((item) => {
    item.attributes.forEach((attr) => {
      if (!counts[attr.trait_type]) {
        counts[attr.trait_type] = {};
      }
      counts[attr.trait_type][attr.value] =
        (counts[attr.trait_type][attr.value] || 0) + 1;
    });
  });

  return counts;
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

function sortTraitTypes(traitTypes) {
  const traitOrder = [
    "Background",
    "Type",
    "Skin",
    "Head",
    "Eyes",
    "Mouth",
    "Facial Hair",
    "Earring",
    "Necklace",
  ];

  return traitTypes.sort((a, b) => {
    const indexA = traitOrder.indexOf(a);
    const indexB = traitOrder.indexOf(b);
    return (
      (indexA === -1 ? traitOrder.length : indexA) -
      (indexB === -1 ? traitOrder.length : indexB)
    );
  });
}

function buildFiltersFragment(sortedTraitTypes, traitValueCounts) {
  const fragment = document.createDocumentFragment();

  sortedTraitTypes.forEach((traitType) => {
    const values = Object.entries(traitValueCounts[traitType])
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value);

    const categoryDiv = createFilterCategory(traitType, values);
    fragment.appendChild(categoryDiv);
  });

  return fragment;
}

function colorizeText(text) {
  return text
    .split("")
    .map((char, i) => {
      if (char === "#") return '<span class="c6"> #</span>';
      return `<span class="c${(i % 6) + 1}">${char}</span>`;
    })
    .join("");
}

function createFilterCategory(traitType, values) {
  const categoryDiv = document.createElement("div");
  categoryDiv.className = "filter-category";
  categoryDiv.dataset.trait = traitType;

  const valuesHtml = values
    .map((value) => createFilterValueHtml(traitType, value))
    .join("");

  categoryDiv.innerHTML = `
    <div class="filter-category-title">${colorizeText(traitType)}</div>
    <div class="filter-values">${valuesHtml}</div>
  `;

  return categoryDiv;
}

function createFilterValueHtml(traitType, value) {
  return `<span class="filter-value" onclick="addFilter('${traitType}', '${value}')">${value}</span>`;
}

function updateResultsCount(filtered, total) {
  const countEl = document.getElementById("results-count");
  if (!countEl) return;

  countEl.textContent =
    filtered === total
      ? `Showing all ${total} items`
      : `Showing ${filtered} of ${total} items`;
}

// =============================================================
// GALLERY RENDERING
// =============================================================

function displayGallery(items) {
  const gallery = document.getElementById("gallery");

  // Cancel ongoing rendering
  state.renderQueue = [];
  state.isRendering = false;

  if (items.length === 0) {
    gallery.innerHTML =
      '<div class="empty-state"><p>No items match the selected filters.</p></div>';
    return;
  }

  gallery.innerHTML = "";

  if (items.length > CHUNK_SIZE) {
    renderChunks(gallery, items);
  } else {
    renderAll(gallery, items);
  }
}

function renderAll(gallery, items) {
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    fragment.appendChild(createCardElement(item));
  });
  gallery.appendChild(fragment);
  observeLazyImages();
}

function renderChunks(gallery, items) {
  state.renderQueue = [...items];
  state.isRendering = true;

  let index = 0;

  function renderNextChunk() {
    if (!state.isRendering || index >= state.renderQueue.length) {
      state.isRendering = false;
      observeLazyImages();
      return;
    }

    const chunk = state.renderQueue.slice(index, index + CHUNK_SIZE);
    const fragment = document.createDocumentFragment();

    chunk.forEach((item) => {
      fragment.appendChild(createCardElement(item));
    });

    gallery.appendChild(fragment);
    index += CHUNK_SIZE;

    if (index < state.renderQueue.length) {
      requestAnimationFrame(renderNextChunk);
    } else {
      state.isRendering = false;
      observeLazyImages();
    }
  }

  requestAnimationFrame(renderNextChunk);
}

function createCardElement(item) {
  const div = document.createElement("div");
  div.className = "svg-card";
  div.setAttribute("data-id", item.name);
  div.onclick = () => openItemModal(item.name);

  const placeholderSvg =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E";

  div.innerHTML = `
    <div class="svg-preview">
      <img
        class="lazy"
        data-src="${item.image}"
        alt="${item.name}"
        src="${placeholderSvg}"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div class="svg-info">
      <div class="svg-id">${colorizeText(item.name)}</div>
    </div>
  `;

  return div;
}

// =============================================================
// MODAL MANAGEMENT
// =============================================================

function openItemModal(itemName) {
  const item = state.metadata.find((m) => m.name === itemName);
  if (!item) return;

  const modal = document.getElementById("item-modal");
  const modalImg = document.getElementById("modal-img");
  const modalImgMobile = document.getElementById("modal-img-mobile");
  const modalTitle = document.getElementById("modal-title");
  const modalTraits = document.getElementById("modal-traits");
  const downloadBtn = document.getElementById("modal-download");

  modalImg.src = item.image;
  if (modalImgMobile) modalImgMobile.src = item.image;
  modalTitle.innerHTML = colorizeText(item.name);
  modalTraits.innerHTML = item.attributes
    .map(
      (attr) => `
      <div class="modal-trait">
        <span class="modal-trait-type">${attr.trait_type}:</span>
        ${attr.value}
      </div>
    `,
    )
    .join("");

  downloadBtn.onclick = () => downloadSVG(item);

  const claimBtn = document.getElementById("modal-claim");
  claimBtn.onclick = () => {
    claim(itemName);
    closeItemModal();
  };

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeItemModal() {
  const modal = document.getElementById("item-modal");
  modal.classList.remove("show");
  document.body.style.overflow = "";
}

// =============================================================
// DOWNLOAD & CLAIM
// =============================================================

function downloadSVG(item) {
  const svgData = decodeURIComponent(
    item.image.replace("data:image/svg+xml;utf8,", ""),
  );

  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.name.replace(/\s+/g, "")}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
  closeItemModal();
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
    const tx = await signer.sendTransaction({
      to: account,
      value: 0,
    });

    Notification.track(tx, {
      label: `Claiming ${item.name}`,
    });
  } catch (error) {
    Notification.show("Claim failed: " + error.message, "danger");
  }
}

// =============================================================
// EVENT LISTENERS
// =============================================================

function setupEventListeners() {
  updateActiveFiltersDisplay();
}

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
// GLOBAL EXPORTS (for onclick handlers)
// =============================================================

window.toggleFilters = toggleFilters;
window.addFilter = addFilter;
window.removeFilter = removeFilter;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.downloadSVG = downloadSVG;
window.claim = claim;
