import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./dappkit.js";

const wallet = new ConnectWallet();

// =============================================================
// CONSTANTS & CONFIGURATION
// =============================================================

const CHUNK_SIZE = 100; // Items to render per chunk
const LAZY_LOAD_ROOT_MARGIN = "100px";
const LAZY_OBSERVER_BATCH_SIZE = 50;

// TODO: Add your contract details here
const CONTRACT_ADDRESS = "0x..."; // Your NFT contract address
const CONTRACT_ABI = []; // Your contract ABI

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
  claimedItems: new Set(), // Will be populated from blockchain
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
// BLOCKCHAIN CLAIM VERIFICATION
// =============================================================

/**
 * Check if a specific NFT is claimed by calling your smart contract
 * Replace this with your actual contract call
 */
async function isClaimedOnChain(tokenId) {
  try {
    if (!wallet.isConnected()) {
      return false;
    }

    const provider = wallet.getEthersProvider();
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider,
    );

    // Example: Check if token exists (has been minted)
    // Replace with your actual contract method
    // const owner = await contract.ownerOf(tokenId);
    // return owner !== ethers.ZeroAddress;

    // OR if you have a specific "claimed" mapping:
    // return await contract.isClaimed(tokenId);

    // Temporary placeholder - returns false until you implement
    return false;
  } catch (error) {
    // If token doesn't exist or error, it's not claimed
    return false;
  }
}

/**
 * Load all claimed NFTs from the blockchain
 * This will be called when wallet connects or page loads
 */
async function loadClaimedFromBlockchain() {
  if (!wallet.isConnected()) {
    state.claimedItems.clear();
    return;
  }

  try {
    const provider = wallet.getEthersProvider();
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider,
    );

    // Method 1: If you have a totalSupply() and can iterate
    // const totalSupply = await contract.totalSupply();
    // for (let i = 0; i < totalSupply; i++) {
    //   const tokenId = await contract.tokenByIndex(i);
    //   const metadata = state.metadata.find(m => m.tokenId === tokenId);
    //   if (metadata) {
    //     state.claimedItems.add(metadata.name);
    //   }
    // }

    // Method 2: If you have a mapping of tokenId => claimed
    // for (const item of state.metadata) {
    //   const claimed = await contract.isClaimed(item.tokenId);
    //   if (claimed) {
    //     state.claimedItems.add(item.name);
    //   }
    // }

    // Method 3: Query events for Mint/Claim events
    // const filter = contract.filters.Claimed();
    // const events = await contract.queryFilter(filter);
    // events.forEach(event => {
    //   const tokenId = event.args.tokenId;
    //   const metadata = state.metadata.find(m => m.tokenId === tokenId);
    //   if (metadata) {
    //     state.claimedItems.add(metadata.name);
    //   }
    // });

    console.log(
      `Loaded ${state.claimedItems.size} claimed items from blockchain`,
    );

    // Refresh the gallery to show claimed badges
    displayGallery(state.filteredMetadata);
  } catch (error) {
    console.error("Error loading claimed items from blockchain:", error);
  }
}

/**
 * Check if an item is claimed (from our loaded state)
 */
function isClaimed(itemName) {
  return state.claimedItems.has(itemName);
}

/**
 * Mark an item as claimed (update local state only)
 */
function markAsClaimed(itemName) {
  state.claimedItems.add(itemName);
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

function createFilterCategory(traitType, values) {
  const categoryDiv = document.createElement("div");
  categoryDiv.className = "filter-category";
  categoryDiv.dataset.trait = traitType;

  const valuesHtml = values
    .map((value) => createFilterValueHtml(traitType, value))
    .join("");

  categoryDiv.innerHTML = `
    <div class="filter-category-title">${traitType}</div>
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

  const claimedBadge = isClaimed(item.name)
    ? '<span class="claimed-badge">CLAIMED</span>'
    : "";

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
      <div class="svg-id">${item.name}${claimedBadge}</div>
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
  const modalTitle = document.getElementById("modal-title");
  const modalTraits = document.getElementById("modal-traits");
  const downloadBtn = document.getElementById("modal-download");
  const claimBtn = document.getElementById("modal-claim");

  const itemIsClaimed = isClaimed(itemName);

  modalImg.src = item.image;
  modalTitle.textContent = item.name;
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

  // Hide claim button if already claimed
  if (itemIsClaimed) {
    claimBtn.style.display = "none";
  } else {
    claimBtn.style.display = "";
    claimBtn.onclick = () => {
      claim(itemName);
      closeItemModal();
    };
  }

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
  const base64Data = item.image.replace("data:image/svg+xml;base64,", "");
  const svgData = atob(base64Data);

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

    // TODO: Replace with your actual smart contract mint call
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer,
    );

    // Example mint call - adjust to your contract's method
    // const tx = await contract.mint(item.tokenId, { value: ethers.parseEther("0.01") });

    // Temporary placeholder transaction
    const account = await wallet.getAccount();
    const tx = await signer.sendTransaction({
      to: account,
      value: 0,
    });

    Notification.track(tx, {
      label: `Minting ${item.name}`,
    });

    // Wait for transaction confirmation
    await tx.wait();

    // Mark as claimed after successful transaction
    markAsClaimed(itemName);

    // Refresh the gallery to show the claimed badge
    displayGallery(state.filteredMetadata);

    console.log("Minting NFT:", item.name);
    console.log("Metadata:", item);

    Notification.show(`Successfully claimed ${item.name}!`, "success");
  } catch (error) {
    Notification.show("Mint failed: " + error.message, "danger");
    console.error("Mint error:", error);
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

    // Load claimed items from blockchain when wallet connects
    await loadClaimedFromBlockchain();
  });

  wallet.onDisconnect(() => {
    Notification.show("Wallet disconnected", "warning");

    // Clear claimed items when wallet disconnects
    state.claimedItems.clear();
    displayGallery(state.filteredMetadata);
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
