/* ==========================================================================
   萬寶企業文具行
   全站智慧搜尋 V2.4 (全面支援 Excel 28 欄位與全型號檢索版)
   ========================================================================== */

let fuseEngine = null;

let searchState = {
    activeIndex: -1,
    matches: [],
    query: "",
    isOpen: false
};

// 取得當前可用的搜尋資料庫 (優先使用輕量化 SEARCH_INDEX)
function getSearchDataSource() {
    if (typeof SEARCH_INDEX !== "undefined" && Array.isArray(SEARCH_INDEX) && SEARCH_INDEX.length > 0) {
        return SEARCH_INDEX;
    }
    if (typeof PUBLISHED_PRODUCTS !== "undefined" && Array.isArray(PUBLISHED_PRODUCTS) && PUBLISHED_PRODUCTS.length > 0) {
        return PUBLISHED_PRODUCTS;
    }
    if (typeof ALL_PRODUCTS !== "undefined" && Array.isArray(ALL_PRODUCTS)) {
        return ALL_PRODUCTS;
    }
    return [];
}

function getSearchElements() {
    const searchInput = document.getElementById("site-search");
    const searchBox = searchInput ? searchInput.closest(".search-box") || document.querySelector(".search-box") : document.querySelector(".search-box");
    const searchBtn = searchBox ? searchBox.querySelector("button") : null;
    let dropdown = document.getElementById("search-dropdown");

    if (!dropdown && searchBox) {
        dropdown = document.createElement("div");
        dropdown.id = "search-dropdown";
        dropdown.className = "search-dropdown";
        dropdown.setAttribute("role", "listbox");
        dropdown.setAttribute("aria-label", "搜尋建議清單");
        dropdown.hidden = true;
        searchBox.appendChild(dropdown);
    }

    return { searchInput, searchBox, searchBtn, dropdown };
}

function initFuseSearch() {
    const dataSource = getSearchDataSource();
    if (typeof Fuse === "undefined" || dataSource.length === 0) {
        return;
    }

    // 🌟 全面升級：加入 brand 與 model 欄位權重
    const options = {
        includeScore: true,
        threshold: 0.4,
        distance: 100,
        ignoreLocation: true,
        minMatchCharLength: 1,
        shouldSort: true,
        keys: [
            { name: "title", weight: 0.45 },
            { name: "model", weight: 0.25 },
            { name: "brand", weight: 0.15 },
            { name: "aliases", weight: 0.10 },
            { name: "code", weight: 0.05 }
        ]
    };

    fuseEngine = new Fuse(dataSource, options);
}

document.addEventListener("DOMContentLoaded", function () {
    initFuseSearch();

    if (typeof initThemeState === "function") {
        initThemeState();
    }

    const { searchInput, searchBox, searchBtn, dropdown } = getSearchElements();
    if (!searchInput || !searchBox || !dropdown) return;

    searchInput.setAttribute("role", "combobox");
    searchInput.setAttribute("aria-autocomplete", "list");
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.setAttribute("aria-controls", "search-dropdown");
    searchInput.removeAttribute("aria-activedescendant");

    let isComposing = false;

    searchInput.addEventListener("compositionstart", function () { isComposing = true; });
    searchInput.addEventListener("compositionend", function () {
        isComposing = false;
        triggerSearch(this.value);
    });

    searchInput.addEventListener("focus", function () {
        const value = this.value.trim();
        if (!value) {
            showHotKeywords();
        } else {
            triggerSearch(value);
        }
    });

    searchInput.addEventListener("input", function () {
        if (isComposing) return;
        triggerSearch(this.value);
    });

    searchInput.addEventListener("keydown", function (e) {
        if (e.key === "ArrowUp") {
            if (!searchState.isOpen) return;
            e.preventDefault();
            moveActiveOption(-1);
            return;
        }

        if (e.key === "ArrowDown") {
            if (!searchState.isOpen) return;
            e.preventDefault();
            moveActiveOption(1);
            return;
        }

        if (e.key === "Home" && searchState.isOpen && searchState.matches.length > 0) {
            e.preventDefault();
            setActiveOption(0);
            return;
        }

        if (e.key === "End" && searchState.isOpen && searchState.matches.length > 0) {
            e.preventDefault();
            setActiveOption(Math.min(searchState.matches.length, 6) - 1);
            return;
        }

        if (e.key === "Enter") {
            e.preventDefault();
            if (searchState.activeIndex >= 0 && searchState.matches[searchState.activeIndex]) {
                const product = searchState.matches[searchState.activeIndex];
                clickDropdownItem(product.id, product.title);
            } else {
                executeFullSearch(this.value);
            }
            return;
        }

        if (e.key === "Escape") {
            if (searchState.isOpen) {
                e.preventDefault();
                closeDropdown();
            }
            return;
        }
    });

    if (searchBtn) {
        searchBtn.addEventListener("click", function () {
            executeFullSearch(searchInput.value);
        });
    }

    dropdown.addEventListener("click", function (e) {
        const option = e.target.closest("[data-product-id]");
        if (!option) return;
        const productId = option.dataset.productId;
        const title = option.dataset.productTitle || "";
        clickDropdownItem(productId, title);
    });

    dropdown.addEventListener("mousemove", function (e) {
        const option = e.target.closest("[role='option']");
        if (!option) return;
        const index = Number(option.dataset.index);
        if (Number.isInteger(index) && index >= 0) {
            setActiveOption(index, false);
        }
    });

    document.addEventListener("click", function (e) {
        if (!searchBox.contains(e.target)) {
            closeDropdown();
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("search")) {
        const query = urlParams.get("search") || "";
        searchInput.value = query;
        setTimeout(function () { executeFullSearch(query); }, 50);
    }
});

let searchDebounceTimer = null;
function triggerSearch(value) {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(function () {
        renderSearchResults(value);
    }, 180);
}

function closeDropdown() {
    const { searchInput, dropdown } = getSearchElements();
    if (!dropdown) return;
    dropdown.hidden = true;
    dropdown.style.display = "none";
    searchState.isOpen = false;
    searchState.activeIndex = -1;
    searchState.matches = [];
    searchState.query = "";

    if (searchInput) {
        searchInput.setAttribute("aria-expanded", "false");
        searchInput.removeAttribute("aria-activedescendant");
    }
}

function openDropdown() {
    const { searchInput, dropdown } = getSearchElements();
    if (!dropdown) return;
    dropdown.hidden = false;
    dropdown.style.display = "block";
    searchState.isOpen = true;

    if (searchInput) {
        searchInput.setAttribute("aria-expanded", "true");
    }
}

function showHotKeywords() {
    const { searchInput, dropdown } = getSearchElements();
    if (!dropdown || typeof HOT_KEYWORDS === "undefined" || !Array.isArray(HOT_KEYWORDS)) return;

    searchState.activeIndex = -1;
    searchState.matches = [];
    searchState.query = "";

    let html = `<div class="dropdown-header" role="presentation">🔥 熱門搜尋推薦</div>`;

    HOT_KEYWORDS.slice(0, 10).forEach(function (keyword, index) {
        const safeKeyword = escapeHtml(keyword);
        html += `
            <div class="dropdown-item hot-keyword-item" role="option" id="search-hot-${index}" data-hot-keyword="${safeKeyword}" tabindex="-1">
                <span class="item-title">🔎 ${safeKeyword}</span>
            </div>
        `;
    });

    dropdown.innerHTML = html;
    openDropdown();

    dropdown.querySelectorAll("[data-hot-keyword]").forEach(function (item) {
        item.addEventListener("click", function () {
            selectHotKeyword(this.dataset.hotKeyword);
        });
    });

    if (searchInput) {
        searchInput.removeAttribute("aria-activedescendant");
    }
}

function selectHotKeyword(keyword) {
    const { searchInput } = getSearchElements();
    if (searchInput) { searchInput.value = keyword; }
    executeFullSearch(keyword);
}

function getMatchedProducts(query) {
    const input = String(query || "").trim();
    const dataSource = getSearchDataSource();
    if (!input || dataSource.length === 0) return [];

    if (fuseEngine) {
        try {
            const results = fuseEngine.search(input);
            return results.map(result => result.item);
        } catch (error) {
            console.warn("Fuse.js 搜尋失敗，改用備援搜尋。", error);
        }
    }

    const lowerInput = input.toLowerCase();
    const keywords = lowerInput.split(/\s+/).filter(Boolean);

    return dataSource.filter(function (product) {
        const aliasText = Array.isArray(product.aliases) ? product.aliases.join(" ") : "";
        const targetText = [
            product.title, product.model, product.brand, product.code,
            product.spec, product.categoryCode, aliasText
        ].filter(Boolean).join(" ").toLowerCase();

        return keywords.every(keyword => targetText.includes(keyword));
    });
}

function renderSearchResults(query) {
    const { searchInput, dropdown } = getSearchElements();
    if (!dropdown) return;

    const input = String(query || "").trim();
    if (!input) {
        showHotKeywords();
        return;
    }

    const matches = getMatchedProducts(input);
    searchState.matches = matches;
    searchState.query = input;
    searchState.activeIndex = -1;

    const keywords = input.toLowerCase().split(/\s+/).filter(Boolean);

    if (matches.length === 0) {
        dropdown.innerHTML = `
            <div class="no-match" role="status" aria-live="polite">
                🔍 查無與「${escapeHtml(input)}」相關的商品
            </div>
        `;
        openDropdown();
        if (searchInput) searchInput.removeAttribute("aria-activedescendant");
        return;
    }

    let html = `
        <div class="dropdown-header" role="presentation">
            找到 ${matches.length} 項智慧匹配商品
            <span class="search-keyboard-hint">↑ ↓ 選擇・Enter 開啟・Esc 關閉</span>
        </div>
    `;

    matches.slice(0, 6).forEach(function (item, index) {
        const safeId = escapeHtml(String(item.id || ""));
        const safeTitle = escapeHtml(String(item.title || ""));
        const safePrice = escapeHtml(String(item.price || ""));
        const highlightedTitle = highlightKeyword(item.title || "", keywords);

        html += `
            <div class="dropdown-item" id="search-option-${index}" role="option" aria-selected="false" tabindex="-1" data-index="${index}" data-product-id="${safeId}" data-product-title="${safeTitle}">
                <span class="item-title">${highlightedTitle}</span>
                ${safePrice ? `<span class="item-price" aria-label="價格 ${safePrice}">價錢：${safePrice === '洽詢' ? '洽詢' : safePrice + '元'}</span>` : ""}
            </div>
        `;
    });

    dropdown.innerHTML = html;
    openDropdown();

    if (searchInput) searchInput.removeAttribute("aria-activedescendant");
}

function moveActiveOption(direction) {
    const visibleCount = Math.min(searchState.matches.length, 6);
    if (visibleCount <= 0) return;

    let nextIndex = searchState.activeIndex;
    if (nextIndex < 0) {
        nextIndex = direction > 0 ? 0 : visibleCount - 1;
    } else {
        nextIndex += direction;
        if (nextIndex >= visibleCount) nextIndex = 0;
        if (nextIndex < 0) nextIndex = visibleCount - 1;
    }

    setActiveOption(nextIndex);
}

function setActiveOption(index, scrollIntoView = true) {
    const { searchInput, dropdown } = getSearchElements();
    if (!dropdown) return;

    const options = dropdown.querySelectorAll("[role='option'][data-index]");
    if (!options.length) return;

    index = Math.max(0, Math.min(index, options.length - 1));

    options.forEach(option => {
        option.setAttribute("aria-selected", "false");
        option.classList.remove("is-active");
    });

    const activeOption = options[index];
    if (!activeOption) return;

    activeOption.setAttribute("aria-selected", "true");
    activeOption.classList.add("is-active");
    searchState.activeIndex = index;

    if (searchInput) {
        searchInput.setAttribute("aria-activedescendant", activeOption.id);
    }

    const product = searchState.matches[index];
    if (product) {
        announceToSR(`目前選擇：${product.title || "商品"}`);
    }

    if (scrollIntoView) {
        activeOption.scrollIntoView({ block: "nearest" });
    }
}

function clickDropdownItem(productId, title) {
    const { searchInput } = getSearchElements();
    if (searchInput) searchInput.value = String(title || "");
    closeDropdown();

    const modal = document.getElementById("product-detail-modal");
    if (typeof openModal === "function" && modal) {
        openModal(productId);
        return;
    }

    window.location.href = `category.html?search=${encodeURIComponent(title || "")}`;
}

function highlightKeyword(text, keywords) {
    let result = escapeHtml(String(text || ""));
    keywords.forEach(function (keyword) {
        if (!keyword) return;
        const escapedKeyword = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!escapedKeyword) return;
        const regex = new RegExp(`(${escapedKeyword})`, "gi");
        result = result.replace(regex, `<mark>$1</mark>`);
    });
    return result;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function executeFullSearch(query) {
    const input = String(query || "").trim();
    if (!input) {
        announceToSR("請輸入搜尋關鍵字。");
        const { searchInput } = getSearchElements();
        if (searchInput) searchInput.focus();
        return;
    }

    closeDropdown();
    const matches = getMatchedProducts(input);
    announceToSR(`已搜尋「${input}」，找到 ${matches.length} 項商品。`);

    if (typeof currentCategoryItems !== "undefined") {
        currentCategoryItems = matches;
        if (typeof currentPage !== "undefined") currentPage = 1;

        const toolbarTitle = document.getElementById("cate-title-display") || document.querySelector(".page-toolbar h2") || document.querySelector(".page-toolbar h1");
        if (toolbarTitle) {
            toolbarTitle.innerHTML = `🔍 「${escapeHtml(input)}」的搜尋結果 <span style="font-size:0.95rem; color:#666; font-weight:normal; margin-left:10px;">（共 ${matches.length} 項商品）</span>`;
        }

        document.querySelectorAll(".sidebar-nav a").forEach(link => link.classList.remove("active"));

        if (typeof renderPage === "function") {
            renderPage();
            window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
            });
        }
        return;
    }

    window.location.href = `category.html?search=${encodeURIComponent(input)}`;
}

function announceToSR(message) {
    let announcer = document.getElementById("sr-announcer");
    if (!announcer) {
        announcer = document.createElement("div");
        announcer.id = "sr-announcer";
        announcer.className = "sr-only";
        announcer.setAttribute("role", "status");
        announcer.setAttribute("aria-live", "polite");
        announcer.setAttribute("aria-atomic", "true");
        document.body.appendChild(announcer);
    }
    announcer.textContent = "";
    window.setTimeout(function () {
        announcer.textContent = String(message || "");
    }, 20);
}

function toggleTheme() {
    const root = document.documentElement;
    const body = document.body;
    const isDark = !root.classList.contains("dark-mode");

    root.classList.toggle("dark-mode", isDark);
    body.classList.toggle("dark-mode", isDark);

    try {
        localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch (error) {
        console.warn("無法儲存主題設定。", error);
    }
    updateThemeButtonText(isDark);
}

function initThemeState() {
    const root = document.documentElement;
    const body = document.body;
    let storedTheme = null;

    try { storedTheme = localStorage.getItem("theme"); } catch (error) { storedTheme = null; }

    let isDark;
    if (storedTheme === "dark") isDark = true;
    else if (storedTheme === "light") isDark = false;
    else isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

    root.classList.toggle("dark-mode", isDark);
    body.classList.toggle("dark-mode", isDark);
    updateThemeButtonText(isDark);
}

function updateThemeButtonText(isDark) {
    const toggleBtns = document.querySelectorAll(".theme-toggle-btn");
    toggleBtns.forEach(btn => {
        btn.textContent = isDark ? "☀️ 淺色" : "🌙 模式";
        btn.setAttribute("aria-pressed", isDark ? "true" : "false");
        btn.setAttribute("aria-label", isDark ? "切換為淺色模式" : "切換為深色模式");
    });
}

document.addEventListener("keydown", function (e) {
    if (!e.altKey && !e.metaKey) return;
    const key = String(e.key || "").toLowerCase();
    let targetId = null;

    if (key === "u") targetId = "accesskey-U";
    if (key === "l") targetId = "accesskey-L";
    if (key === "c") targetId = "accesskey-C";
    if (key === "z") targetId = "accesskey-Z";

    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;

    e.preventDefault();
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
});

document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    const { searchInput } = getSearchElements();
    if (searchInput && document.activeElement === searchInput && searchState.isOpen) {
        closeDropdown();
    }
});