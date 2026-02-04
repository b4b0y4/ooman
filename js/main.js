import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./dappkit.js";

const wallet = new ConnectWallet();

// Pixel Punks Gallery App with Lazy Loading
let metadata = [];
let filteredMetadata = [];
let currentClaimItem = null;
let activeFilters = []; // Array of {trait_type, value} objects
let lazyLoadObserver = null;

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
    rootMargin: "50px", // Start loading 50px before entering viewport
    threshold: 0.01,
  };

  lazyLoadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;

        if (src) {
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

// Observe all lazy load images
function observeLazyImages() {
  const lazyImages = document.querySelectorAll("img.lazy");
  lazyImages.forEach((img) => {
    if (lazyLoadObserver) {
      lazyLoadObserver.observe(img);
    }
  });
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

  // Extract all unique traits and their values
  const traitValues = {};
  metadata.forEach((item) => {
    item.attributes.forEach((attr) => {
      if (!traitValues[attr.trait_type]) {
        traitValues[attr.trait_type] = new Set();
      }
      traitValues[attr.trait_type].add(attr.value);
    });
  });

  // Remove duplicate values from skin and eyes that already exist in type
  if (traitValues["Type"]) {
    const typeValuesLower = new Set(
      [...traitValues["Type"]].map((v) => v.toLowerCase()),
    );

    if (traitValues["Skin"]) {
      traitValues["Skin"] = new Set(
        [...traitValues["Skin"]].filter(
          (value) => !typeValuesLower.has(value.toLowerCase()),
        ),
      );
    }

    if (traitValues["Eyes"]) {
      traitValues["Eyes"] = new Set(
        [...traitValues["Eyes"]].filter(
          (value) => !typeValuesLower.has(value.toLowerCase()),
        ),
      );
    }
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

  // Sort trait types
  const sortedTraitTypes = Object.keys(traitValues).sort((a, b) => {
    const indexA = traitOrder.indexOf(a);
    const indexB = traitOrder.indexOf(b);
    const posA = indexA === -1 ? traitOrder.length : indexA;
    const posB = indexB === -1 ? traitOrder.length : indexB;
    return posA - posB;
  });

  // Build HTML
  container.innerHTML = sortedTraitTypes
    .map((traitType) => {
      const values = Array.from(traitValues[traitType]).sort();
      const valuesHtml = values
        .map((value) => {
          const escapedType = traitType.replace(/'/g, "\\'");
          const escapedValue = value.replace(/'/g, "\\'");
          return `<span class="filter-value" onclick="addFilter('${escapedType}', '${escapedValue}')">${value}</span>`;
        })
        .join("");

      return `
      <div class="filter-category">
        <div class="filter-category-title">${traitType}</div>
        <div class="filter-values">${valuesHtml}</div>
      </div>
    `;
    })
    .join("");
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

// Display gallery items
function displayGallery(items) {
  const gallery = document.getElementById("gallery");

  if (items.length === 0) {
    gallery.innerHTML =
      '<div class="empty-state"><p>No items match the selected filters.</p></div>';
    return;
  }

  gallery.innerHTML = items.map((item) => createCardHTML(item)).join("");

  // Set up lazy loading for newly added images
  observeLazyImages();
}

// Create card HTML with lazy loading
function createCardHTML(item) {
  const id = item.name;
  const traits = item.attributes
    .map(
      (attr) =>
        `<span class="trait"><span class="trait-label">${attr.trait_type}:</span> ${attr.value}</span>`,
    )
    .join("");

  return `
    <div class="svg-card" data-id="${id}">
      <div class="svg-preview">
        <img
          class="lazy"
          data-src="${item.image}"
          alt="${item.name}"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E"
        />
      </div>
      <div class="svg-info">
        <div class="traits-section">
          <div class="traits-header" onclick="toggleTraits(this)">
            <div class="svg-id">${item.name}</div>
          </div>
          <div class="svg-traits">${traits}</div>
        </div>
      </div>
      <div class="svg-actions">
        <button class="btn-download" onclick="downloadSVG('${id}', '${item.name}')">Download</button>
        <button class="btn-claim" onclick="claim('${id}')">Claim</button>
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
}

// Demo transaction tracker
// document.querySelector("#demo-tx")?.addEventListener("click", async () => {
//   if (!wallet.isConnected()) {
//     Notification.show("Please connect your wallet first", "warning");
//     return;
//   }

//   try {
//     const provider = wallet.getEthersProvider();
//     const signer = await provider.getSigner();

//     // Demo transaction (send 0 ETH to self)
//     const account = await wallet.getAccount();
//     const tx = await signer.sendTransaction({
//       to: account,
//       value: 0,
//     });

//     Notification.track(tx, {
//       label: "Demo Transaction",
//     });
//   } catch (error) {
//     Notification.show("Transaction failed: " + error.message, "danger");
//   }
// });
// Confirm claim (placeholder for integration)
function claim() {
  if (!currentClaimItem) return;

  // This is where you would integrate with your smart contract
  console.log("Claiming NFT:", currentClaimItem.name);
  console.log("Metadata:", currentClaimItem);

  // Placeholder - show alert for now
  alert(
    `Claim initiated for ${currentClaimItem.name}!\n\nIntegrate your wallet connection and smart contract here.`,
  );
}

// Setup event listeners
function setupEventListeners() {
  // Initialize active filters display
  updateActiveFiltersDisplay();

  // claim button
  document.getElementById("confirm-claim-btn").addEventListener("click", claim);
}

// Toggle traits tooltip
function toggleTraits(header) {
  const tooltip = header.nextElementSibling;
  const isVisible = tooltip.classList.contains("visible");

  // Close all other tooltips first
  document
    .querySelectorAll(".svg-traits.visible")
    .forEach((t) => t.classList.remove("visible"));

  if (!isVisible) {
    tooltip.classList.add("visible");
  }
}

// Close tooltip when clicking outside
document.addEventListener("click", (e) => {
  if (!e.target.closest(".traits-section")) {
    document
      .querySelectorAll(".svg-traits.visible")
      .forEach((t) => t.classList.remove("visible"));
  }
});

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
window.toggleTraits = toggleTraits;

window.downloadSVG = downloadSVG;
window.claim = claim;
