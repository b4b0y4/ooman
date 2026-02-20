import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./libs/dappkit.js";

// =============================================================
// CONTRACT CONFIG
// =============================================================

const CONTRACT_CONFIG = {
  ADDRESS: "0x2E6966b72355e554e4C495E705D7c8b942a06756",

  ABI: [
    "function claim(uint256 tokenId, string calldata image, string calldata attributes, bytes32[] calldata proof) external",
    "function tokenURI(uint256 tokenId) external view returns (string memory)",
    "function getSVG(uint256 tokenId) external view returns (string memory)",
    "function getAttributes(uint256 tokenId) external view returns (string memory)",
    "function isMinted(uint256 tokenId) external view returns (bool)",
    "function MERKLE_ROOT() external view returns (bytes32)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "error AlreadyMinted()",
    "error InvalidProof()",
    "error InvalidTokenId()",
  ],
};

// =============================================================
// CONFIG
// =============================================================

const CONFIG = {
  DATA_CHUNK_COUNT: 10,
  DATA_CHUNK_PATTERN: "./data/Ooman_metadata_{i}.json",
  INITIAL_DATA_CHUNKS: 1,
  RENDER_BATCH_SIZE: 100,
  LAZY_ROOT_MARGIN: "100px",
  LAZY_LOAD_BATCH_SIZE: 50,
};

// =============================================================
// STATE
// =============================================================

const state = {
  metadata: [],
  filteredMetadata: [],
  activeFilters: [],
  lazyLoadObserver: null,
  renderedCards: new Map(),
};

const wallet = new ConnectWallet();

// =============================================================
// CONTRACT HELPERS
// =============================================================

function parseTokenId(name) {
  const match = name.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

async function isTokenMinted(tokenId) {
  if (!CONTRACT_CONFIG.ADDRESS) return false;

  try {
    let provider;
    if (wallet && wallet.isConnected()) {
      provider = wallet.getEthersProvider();
    } else {
      provider = new ethers.JsonRpcProvider(networkConfigs.ethereum.rpcUrl);
    }

    const contract = new ethers.Contract(
      CONTRACT_CONFIG.ADDRESS,
      CONTRACT_CONFIG.ABI,
      provider,
    );
    return await contract.isMinted(tokenId);
  } catch (error) {
    console.error("Error checking mint status:", error);
    return false;
  }
}

async function mintToken(item) {
  if (!wallet) {
    Notification.show("Wallet not initialized", "warning");
    return;
  }

  if (!wallet.isConnected()) {
    Notification.show("Please connect your wallet first", "warning");
    return;
  }

  if (!CONTRACT_CONFIG.ADDRESS) {
    Notification.show(
      "Contract not configured. Please set CONTRACT_CONFIG.ADDRESS",
      "warning",
    );
    return;
  }

  const tokenId = parseTokenId(item.name);
  if (tokenId === null) {
    Notification.show("Invalid token", "warning");
    return;
  }

  const alreadyMinted = await isTokenMinted(tokenId);
  if (alreadyMinted) {
    Notification.show("This token is already minted", "warning");
    return;
  }

  // Verify we have all required data
  if (
    !item.image ||
    !item.attributes ||
    !item.proof ||
    item.proof.length === 0
  ) {
    Notification.show("Missing proof data. Please reload the page.", "error");
    return;
  }

  const provider = wallet.getEthersProvider();
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(
    CONTRACT_CONFIG.ADDRESS,
    CONTRACT_CONFIG.ABI,
    signer,
  );

  Notification.show(`Minting ${item.name}...`, "info");

  try {
    const attributesString = item.attributes;

    const tx = await contract.claim(
      tokenId,
      item.image,
      attributesString,
      item.proof,
    );

    Notification.track(tx, {
      label: `Mint ${item.name}`,
    });
    await tx.wait();
  } catch (error) {
    // Decode custom errors
    if (error.data === "0x09bde339") {
      Notification.show(
        "Invalid proof: The data doesn't match the Merkle tree.",
        "error",
      );
    } else if (error.data === "0xdbe49be4") {
      Notification.show("This token has already been minted", "error");
    } else if (error.data === "0x82b42900") {
      Notification.show("Invalid token ID", "error");
    } else if (error.message?.includes("invalid proof")) {
      Notification.show(
        "Invalid proof: The data doesn't match the Merkle tree.",
        "error",
      );
    } else {
      Notification.show(
        `Failed to mint: ${error.message || error.reason || "Unknown error"}`,
        "error",
      );
    }
    throw error;
  }
}

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
  Array.from({ length: CONFIG.DATA_CHUNK_COUNT }, (_, i) =>
    CONFIG.DATA_CHUNK_PATTERN.replace("{i}", i + 1),
  );

const fetchChunkRaw = async (file) => {
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}`);
  return res.text();
};

const deferExecution = (fn) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 100);

async function loadMetadata() {
  try {
    const files = getChunkFiles();
    const [initial, remaining] = [
      files.slice(0, CONFIG.INITIAL_DATA_CHUNKS),
      files.slice(CONFIG.INITIAL_DATA_CHUNKS),
    ];

    // Fetch raw text to preserve exact JSON formatting
    const results = await Promise.allSettled(initial.map(fetchChunkRaw));
    state.metadata = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => {
        // Parse the JSON but extract exact attribute strings
        const rawText = r.value;
        const data = JSON.parse(rawText);

        // Handle new metadata format: array of objects with merkle_proof field
        if (Array.isArray(data)) {
          return data.map((item, index) => {
            // Extract the exact attributes string from the raw JSON
            // Find the position of this item's "name" field to locate the item boundary
            const namePattern = '"name": "' + item.name + '"';
            const itemStart = rawText.indexOf(namePattern);

            // Find the next item by looking for the next "name": "Ooman #..."
            // or end of array
            const nextMatch = rawText
              .substring(itemStart + namePattern.length)
              .match(/"name": "Ooman #\d+"/);
            const itemEnd = nextMatch
              ? itemStart + namePattern.length + nextMatch.index
              : rawText.length;
            const itemSection = rawText.substring(itemStart, itemEnd);

            // Find attributes in this section (handles escaped JSON string)
            const attrsMatch = itemSection.match(
              /"attributes":\s*"((?:\\.|[^"\\])*)"/,
            );

            // Extract the exact string as stored in the JSON (unescape it)
            let attributesString;
            if (attrsMatch) {
              // attrsMatch[1] contains the escaped content like [{\trait_type\":...}]
              // We need to unescape it to get the raw string
              attributesString = attrsMatch[1].replace(/\\(.)/g, "$1");
            } else {
              attributesString = item.attributes;
            }

            // Parse the string to get the array for UI
            const attributesParsed = JSON.parse(attributesString);

            return {
              ...item,
              proof: item.merkle_proof || item.proof,
              attributes: attributesString, // Exact string for contract
              attributesParsed: attributesParsed, // Array for UI
            };
          });
        }
        // Legacy format: object with proofs property
        return Object.values(data.proofs || {}).map((item) => ({
          ...item,
          attributes: item.attributes,
          attributesParsed:
            typeof item.attributes === "string"
              ? JSON.parse(item.attributes)
              : item.attributes,
        }));
      });

    state.filteredMetadata = [...state.metadata];

    renderGallery(state.metadata);
    updateFilters();
    updateCount();

    console.log(
      `Loaded ${state.metadata.length} items from ${initial.length} chunks`,
    );

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
    batchSize: 200,
  });

  worker.onmessage = (e) => {
    const msg = e.data;

    if (msg.type === "batch") {
      const data = msg.data;

      state.metadata.push(...data);

      if (state.activeFilters.length === 0) {
        state.filteredMetadata.push(...data);
        appendItems(data);
      }

      updateFilters();
      updateCount();
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
  const batches = Math.ceil(images.length / CONFIG.LAZY_LOAD_BATCH_SIZE);

  const observeBatch = (index) => {
    if (index >= batches) return;
    const start = index * CONFIG.LAZY_LOAD_BATCH_SIZE;
    const batch = Array.from(images).slice(
      start,
      start + CONFIG.LAZY_LOAD_BATCH_SIZE,
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
  item.attributesParsed.some(
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
    item.attributesParsed.forEach((attr) => {
      if (!traits[attr.trait_type]) traits[attr.trait_type] = {};
      if (!traits[attr.trait_type][attr.value]) {
        traits[attr.trait_type][attr.value] = 0;
      }
      traits[attr.trait_type][attr.value]++;
    });
  });

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

const svgToDataUri = (svg) => {
  if (svg.startsWith("data:")) return svg;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

const createCard = (item) => {
  const div = document.createElement("div");
  div.className = "svg-card";
  div.dataset.id = item.name;
  div.dataset.minted = "false";
  div.onclick = () => openModal(item.name);
  const imageUri = svgToDataUri(item.image);
  div.innerHTML = `
    <div class="svg-preview">
      <img class="lazy" data-src="${imageUri}" alt="${item.name}" src="${placeholder}" loading="lazy" decoding="async" />
    </div>
    <div class="svg-info">
      <div class="svg-id">${colorize(item.name)}</div>
    </div>
  `;
  state.renderedCards.set(item.name, div);
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
  const visibleNames = new Set(items.map((item) => item.name));
  state.renderedCards.forEach((card, name) => {
    if (visibleNames.has(name)) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });

  let emptyState = gallery.querySelector(".empty-state");
  if (items.length === 0) {
    if (!emptyState) {
      emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.innerHTML = "<p>No items match the selected filters.</p>";
      gallery.appendChild(emptyState);
    }
  } else if (emptyState) {
    emptyState.remove();
  }

  const newItems = items.filter((item) => !state.renderedCards.has(item.name));

  if (newItems.length > 0) {
    if (newItems.length <= CONFIG.RENDER_BATCH_SIZE) {
      appendItems(newItems);
    } else {
      renderChunked(newItems);
    }
  } else {
    observeLazyImages();
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

    const chunk = items.slice(index, index + CONFIG.RENDER_BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    chunk.forEach((item) => fragment.appendChild(createCard(item)));
    gallery.appendChild(fragment);

    index += CONFIG.RENDER_BATCH_SIZE;
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

async function openModal(itemName) {
  const item = state.metadata.find((m) => m.name === itemName);
  if (!item) return;

  const modal = document.getElementById("item-modal");
  const imageUri = svgToDataUri(item.image);

  document.getElementById("modal-img").src = imageUri;
  const mobilImg = document.getElementById("modal-img-mobile");
  if (mobilImg) mobilImg.src = imageUri;

  document.getElementById("modal-title").innerHTML = colorize(item.name);
  document.getElementById("modal-traits").innerHTML = item.attributesParsed
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

  const claimBtn = document.getElementById("modal-claim");

  let isMinted = false;
  if (wallet.isConnected() && CONTRACT_CONFIG.ADDRESS) {
    const tokenId = parseTokenId(item.name);
    if (tokenId !== null) {
      try {
        isMinted = await isTokenMinted(tokenId);
      } catch (error) {
        console.error("Error checking mint status:", error);
      }
    }
  }

  if (isMinted) {
    claimBtn.style.display = "none";
  } else {
    claimBtn.style.display = "block";
    claimBtn.textContent = "Claim";
    claimBtn.disabled = false;
    claimBtn.classList.remove("minted");
    claimBtn.onclick = () => {
      claim(itemName);
    };
  }

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
  const svgData = item.image.startsWith("data:")
    ? decodeURIComponent(item.image.replace("data:image/svg+xml;utf8,", ""))
    : item.image;
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

  closeModal();
  await mintToken(item);
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
  CONTRACT_CONFIG,
  toggleFilters,
  addFilter,
  removeFilter,
  openItemModal: openModal,
  closeItemModal: closeModal,
  downloadSVG: download,
  claim,
  mintToken,
  isTokenMinted,
  parseTokenId,
});
