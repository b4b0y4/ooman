import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./dappkit.js";

const wallet = new ConnectWallet();

// Pixel Punks Gallery App with Lazy Loading
let metadata = [];
let filteredMetadata = [];
let currentClaimItem = null;
let activeFilters = []; // Array of {trait_type, value} objects
let lazyLoadObserver = null;

// Virtual scrolling configuration
const CHUNK_SIZE = 100; // Number of items to render per chunk
const CHUNK_DELAY = 16; // ms between chunks (~60fps)
let renderQueue = [];
let isRendering = false;

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  await loadMetadata();
  setupLazyLoading();
  displayGallery(metadata);
  populateAvailableFilters();
  setupEventListeners();
});

// Setup Intersection Observer for lazy loading
function setupLazyLoading() {
  const options = {
    root: null, // viewport
    rootMargin: "100px", // Increased buffer for smoother scrolling
    threshold: 0,
  };

  lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;

        if (src) {
          // Use decode() for better performance
          img.src = src;
          img.removeAttribute("data-src");
          img.classList.remove("lazy");
          img.classList.add("loaded");
          observer.unobserve(img);
        }
      }
    });
  }, options);
}

// Observe all lazy load images (batch processing for large numbers)
function observeLazyImages() {
  if (!lazyLoadObserver) return;

  const lazyImages = document.querySelectorAll("img.lazy");

  // Process in smaller batches to avoid blocking
  const batchSize = 50;
  let index = 0;

  function observeBatch() {
    const batch = Array.from(lazyImages).slice(index, index + batchSize);
    batch.forEach((img) => {
      lazyLoadObserver.observe(img);
    });

    index += batchSize;
    if (index < lazyImages.length) {
      requestAnimationFrame(observeBatch);
    }
  }

  observeBatch();
}

// Load metadata from JSON file
async function loadMetadata() {
  try {
    const response = await fetch("Ooman_metadata.json");
    metadata = await response.json();
    filteredMetadata = [...metadata];
    console.log(`Loaded ${metadata.length} items`);
  } catch (error) {
    console.error("Error loading metadata:", error);
    document.getElementById("gallery").innerHTML =
      '<div class="empty-state"><p>Error loading metadata. Please check console.</p></div>';
  }
}

// Toggle filter panel
function toggleFilters() {
  const content = document.querySelector(".filters-content");
  const header = document.querySelector(".filters-header");
  const isCollapsed = content.classList.contains("collapsed");

  if (isCollapsed) {
    content.classList.remove("collapsed");
    header.classList.add("expanded");
  } else {
    content.classList.add("collapsed");
    header.classList.remove("expanded");
  }
}

// Add filter when clicking on a trait
function addFilter(traitType, value) {
  // Check if this filter already exists
  const exists = activeFilters.some(
    (f) => f.trait_type === traitType && f.value === value,
  );
  if (exists) return;

  // Add the filter
  activeFilters.push({ trait_type: traitType, value: value });

  // Update display
  updateActiveFiltersDisplay();
  applyFilters();
}

// Remove a specific filter
function removeFilter(traitType, value) {
  activeFilters = activeFilters.filter(
    (f) => !(f.trait_type === traitType && f.value === value),
  );
  updateActiveFiltersDisplay();
  applyFilters();
}

// Update the active filters display
function updateActiveFiltersDisplay() {
  const container = document.getElementById("active-filters");
  if (!container) return;

  if (activeFilters.length === 0) {
    container.innerHTML = '<span class="no-filters">No active filters</span>';
    return;
  }

  container.innerHTML = activeFilters
    .map(
      (filter) => `
    <span class="active-filter-tag" onclick="removeFilter('${filter.trait_type}', '${filter.value}')">
      ${filter.trait_type}: ${filter.value}
      <span class="remove-icon">×</span>
    </span>
  `,
    )
    .join("");
}

// Apply filters
function applyFilters() {
  if (activeFilters.length === 0) {
    filteredMetadata = [...metadata];
  } else {
    filteredMetadata = metadata.filter((item) => {
      // Item must match ALL active filters
      return activeFilters.every((filter) => {
        // An item can have multiple attributes with the same trait_type
        // Check if ANY of the item's attributes with this trait_type matches the filter value
        const matchingAttrs = item.attributes.filter(
          (attr) => attr.trait_type === filter.trait_type,
        );
        return matchingAttrs.some((attr) => attr.value === filter.value);
      });
    });
  }

  displayGallery(filteredMetadata);
  updateResultsCount(filteredMetadata.length, metadata.length);
}

// Populate available filters display
function populateAvailableFilters() {
  const container = document.getElementById("available-filters");
  if (!container || metadata.length === 0) return;

  // Extract traits and count frequency
  const traitValueCounts = {};
  metadata.forEach((item) => {
    item.attributes.forEach((attr) => {
      if (!traitValueCounts[attr.trait_type]) {
        traitValueCounts[attr.trait_type] = {};
      }
      traitValueCounts[attr.trait_type][attr.value] =
        (traitValueCounts[attr.trait_type][attr.value] || 0) + 1;
    });
  });

  // Remove duplicates from Skin/Eyes that exist in Type
  if (traitValueCounts["Type"]) {
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

  // Define trait order
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

  const sortedTraitTypes = Object.keys(traitValueCounts).sort((a, b) => {
    const indexA = traitOrder.indexOf(a);
    const indexB = traitOrder.indexOf(b);
    return (
      (indexA === -1 ? traitOrder.length : indexA) -
      (indexB === -1 ? traitOrder.length : indexB)
    );
  });

  // Build HTML with all values as clickable buttons
  const fragment = document.createDocumentFragment();

  sortedTraitTypes.forEach((traitType) => {
    const values = Object.entries(traitValueCounts[traitType])
      .sort((a, b) => b[1] - a[1]) // Sort by frequency (most common first)
      .map(([value]) => value);

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

    fragment.appendChild(categoryDiv);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function createFilterValueHtml(traitType, value) {
  const escapedType = traitType.replace(/'/g, "\\'");
  const escapedValue = value.replace(/'/g, "\\'");
  return `<span class="filter-value" onclick="addFilter('${escapedType}', '${escapedValue}')">${value}</span>`;
}

// Update results count display
function updateResultsCount(filtered, total) {
  const countEl = document.getElementById("results-count");
  if (filtered === total) {
    countEl.textContent = `Showing all ${total} items`;
  } else {
    countEl.textContent = `Showing ${filtered} of ${total} items`;
  }
}

// Display gallery items with chunked rendering
function displayGallery(items) {
  const gallery = document.getElementById("gallery");

  // Cancel any ongoing rendering
  renderQueue = [];
  isRendering = false;

  if (items.length === 0) {
    gallery.innerHTML =
      '<div class="empty-state"><p>No items match the selected filters.</p></div>';
    return;
  }

  // Clear gallery but keep reference
  gallery.innerHTML = "";

  // Use chunked rendering for large datasets
  if (items.length > CHUNK_SIZE) {
    renderChunks(gallery, items);
  } else {
    // Small datasets: render all at once
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const card = createCardElement(item);
      fragment.appendChild(card);
    });
    gallery.appendChild(fragment);
    observeLazyImages();
  }
}

// Create a card DOM element instead of HTML string
function createCardElement(item) {
  const div = document.createElement("div");
  div.className = "svg-card";
  div.setAttribute("data-id", item.name);
  div.onclick = () => openItemModal(item.name);

  div.innerHTML = `
    <div class="svg-preview">
      <img
        class="lazy"
        data-src="${item.image}"
        alt="${item.name}"
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E"
        loading="lazy"
        decoding="async"
      />
    </div>
    <div class="svg-info">
      <div class="svg-id">${item.name}</div>
    </div>
  `;

  return div;
}

// Render items in chunks using requestAnimationFrame
function renderChunks(gallery, items) {
  renderQueue = [...items];
  isRendering = true;

  let index = 0;

  function renderNextChunk() {
    if (!isRendering || index >= renderQueue.length) {
      isRendering = false;
      observeLazyImages();
      return;
    }

    const chunk = renderQueue.slice(index, index + CHUNK_SIZE);
    const fragment = document.createDocumentFragment();

    chunk.forEach((item) => {
      const card = createCardElement(item);
      fragment.appendChild(card);
    });

    gallery.appendChild(fragment);

    index += CHUNK_SIZE;

    if (index < renderQueue.length) {
      requestAnimationFrame(renderNextChunk);
    } else {
      isRendering = false;
      observeLazyImages();
    }
  }

  // Start rendering
  requestAnimationFrame(renderNextChunk);
}

// Create card HTML with lazy loading
function createCardHTML(item) {
  const id = item.name;

  return `
    <div class="svg-card" data-id="${id}" onclick="openItemModal('${id.replace(/'/g, "\\'")}')">
      <div class="svg-preview">
        <img
          class="lazy"
          data-src="${item.image}"
          alt="${item.name}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E"
        />
      </div>
      <div class="svg-info">
        <div class="svg-id">${item.name}</div>
      </div>
    </div>
  `;
}

// Download SVG
function downloadSVG(id, name) {
  const item = metadata.find((m) => m.name === name);
  if (!item) return;

  // Extract base64 data
  const base64Data = item.image.replace("data:image/svg+xml;base64,", "");
  const svgData = atob(base64Data);

  // Create blob and download
  const blob = new Blob([svgData], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/\s+/g, "")}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);

  // Close modal after download
  closeItemModal();
}

// Mint NFT function
async function claim(itemName) {
  const item = metadata.find((m) => m.name === itemName);
  if (!item) return;

  if (!wallet.isConnected()) {
    Notification.show("Please connect your wallet first", "warning");
    return;
  }

  try {
    const provider = wallet.getEthersProvider();
    const signer = await provider.getSigner();
    const account = await wallet.getAccount();

    // Dummy mint transaction (sends 0 ETH to self to simulate minting)
    // Replace this with your actual smart contract mint call:
    // const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    // const tx = await contract.mint(item.tokenId, { value: MINT_PRICE });

    const tx = await signer.sendTransaction({
      to: account,
      value: 0,
    });

    Notification.track(tx, {
      label: `Minting ${item.name}`,
    });

    console.log("Minting NFT:", item.name);
    console.log("Metadata:", item);
  } catch (error) {
    Notification.show("Mint failed: " + error.message, "danger");
    console.error("Mint error:", error);
  }
}

// Open item modal with download/claim actions
function openItemModal(itemName) {
  const item = metadata.find((m) => m.name === itemName);
  if (!item) return;

  const modal = document.getElementById("item-modal");
  const modalImg = document.getElementById("modal-img");
  const modalTitle = document.getElementById("modal-title");
  const modalTraits = document.getElementById("modal-traits");
  const downloadBtn = document.getElementById("modal-download");
  const claimBtn = document.getElementById("modal-claim");

  modalImg.src = item.image;
  modalTitle.textContent = item.name;

  modalTraits.innerHTML = item.attributes
    .map(
      (attr) =>
        `<div class="modal-trait"><span class="modal-trait-type">${attr.trait_type}:</span> ${attr.value}</div>`,
    )
    .join("");

  downloadBtn.onclick = () => downloadSVG(itemName, itemName);
  claimBtn.onclick = () => {
    claim(itemName);
    closeItemModal();
  };

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

// Close item modal
function closeItemModal() {
  const modal = document.getElementById("item-modal");
  modal.classList.remove("show");
  document.body.style.overflow = "";
}

// Setup event listeners
function setupEventListeners() {
  // Initialize active filters display
  updateActiveFiltersDisplay();

  // claim button
  document.getElementById("confirm-claim-btn").addEventListener("click", claim);
}

document.addEventListener("DOMContentLoaded", () => {
  wallet.onConnect((data) => {
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
});

// Make functions globally available for onclick handlers
window.toggleFilters = toggleFilters;
window.addFilter = addFilter;
window.removeFilter = removeFilter;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.downloadSVG = downloadSVG;
window.claim = claim;
