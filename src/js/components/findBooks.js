import {
  createBookEntry,
  getBooks,
  getChallengeStatus,
  isBookInStorage
} from "../services/storage.js";
import {
  fetchOpenLibraryBookDetails,
  searchOpenLibraryBooks
} from "../services/openLibrary.js";

function escapeHtml(value) {
  const quote = String.fromCharCode(34);
  const apostrophe = String.fromCharCode(39);
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML
    .replaceAll(quote, `"`)
    .replaceAll(apostrophe, "'");
}

function buildDefaultChapters(count) {
  const safeCount = Math.max(0, Math.min(200, Number(count) || 0));
  return Array.from({ length: safeCount }, (_, i) => ({
    id: `ch-${Date.now()}-${i + 1}`,
    title: `${i + 1}. Chapter ${i + 1}`,
    completed: false
  }));
}

export class FindBooks {
  constructor({
    containerId,
    bookGoal = 20,
    initialQuery = "",
    debounceMs = 500
  }) {
    this.container = document.getElementById(containerId);
    this.bookGoal = bookGoal;
    this.query = initialQuery;
    this.debounceMs = debounceMs;
    this.results = [];
    this.selectedBook = null;
    this.isSearching = false;
    this.isLoadingDetails = false;
    this.searchTimer = null;
    this.searchVersion = 0;

    if (!this.container) {
      throw new Error(`FindBooks: container #${containerId} not found.`);
    }

    this.renderShell();
    this.bindEvents();
    this.updateDynamicSections();

    if (this.query) {
      this.performSearch(this.query);
    }
  }

  getGoal() {
    return getChallengeStatus()?.bookGoal ?? this.bookGoal;
  }

  isListFull() {
    return getBooks().length >= this.getGoal();
  }

  renderShell() {
    this.container.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2 class="h5 fw-bold text-dark m-0">Find a Book</h2>
      </div>

      <div class="search-box-wrap mb-3">
        <i class="bi bi-search search-box-icon" aria-hidden="true"></i>
        <input
          type="search"
          class="form-control search-box-input"
          placeholder="Title, author or topic"
          value="${escapeHtml(this.query)}"
          data-book-search-input
          aria-label="Search books by title, author or topic"
        />
      </div>

      <div class="d-flex flex-column gap-2 mb-3" data-search-results></div>
      <div data-book-details></div>
    `;

    this.inputEl = this.container.querySelector("[data-book-search-input]");
    this.resultsEl = this.container.querySelector("[data-search-results]");
    this.detailsEl = this.container.querySelector("[data-book-details]");
  }

  updateDynamicSections() {
    const goal = this.getGoal();
    const isFull = this.isListFull();

    if (this.resultsEl) {
      if (this.isSearching) {
        this.resultsEl.innerHTML = `<div class="book-card p-3 text-muted small">Searching Open Library...</div>`;
      } else if (!this.query) {
        this.resultsEl.innerHTML = `<div class="book-card p-3 text-muted small">Type a title, author, or topic to search.</div>`;
      } else if (this.results.length === 0) {
        this.resultsEl.innerHTML = `<div class="book-card p-3 text-muted small">No books found for "${escapeHtml(this.query)}".</div>`;
      } else {
        this.resultsEl.innerHTML = this.results
          .map((book, idx) => this.renderResultCard(book, idx, isFull))
          .join("");
      }
    }

    if (this.detailsEl) {
      this.detailsEl.innerHTML = this.selectedBook
        ? this.renderDetailsCard(this.selectedBook, isFull, goal)
        : "";
    }
  }

  async performSearch(rawQuery) {
    const trimmed = String(rawQuery ?? "").trim();
    const currentVersion = ++this.searchVersion;
    this.query = trimmed;

    if (!trimmed) {
      this.results = [];
      this.selectedBook = null;
      this.isSearching = false;
      this.updateDynamicSections();
      return;
    }

    this.isSearching = true;
    this.updateDynamicSections();

    try {
      const items = await searchOpenLibraryBooks(trimmed, 3);
      if (currentVersion !== this.searchVersion) return;

      this.results = items;
      this.isSearching = false;

      if (items.length > 0) {
        this.selectedBook = { ...items[0] };
        this.updateDynamicSections();
        await this.selectBook(items[0], currentVersion);
      } else {
        this.selectedBook = null;
        this.updateDynamicSections();
      }
    } catch (err) {
      if (currentVersion !== this.searchVersion) return;
      console.warn("Open Library search error:", err);
      this.results = [];
      this.isSearching = false;
      this.updateDynamicSections();
    }
  }

 async selectBook(book, version = this.searchVersion) {
  this.isLoadingDetails = true;
  this.selectedBook = { ...book };
  this.updateDynamicSections();

  try {
    const detailed = await fetchOpenLibraryBookDetails(book);
    if (version !== this.searchVersion) return;

    this.selectedBook = detailed;
    this.results = this.results.map((item) =>
      item.workKey === detailed.workKey || item.editionKey === detailed.editionKey
        ? {
            ...item,
            totalPages: detailed.totalPages,
            chapters: detailed.chapters,
            description: detailed.description
          }
        : item
    );
  } finally {
    if (version === this.searchVersion) {
      this.isLoadingDetails = false;
      this.updateDynamicSections();
    }
  }
}

addBookToStorage(book, overrides = {}) {
  if (this.isListFull() || isBookInStorage(book)) return;

  const rawPages =
    overrides.totalPages !== undefined
      ? Number(overrides.totalPages)
      : Number(book.totalPages);

  const finalPages = Number.isFinite(rawPages) && rawPages > 0 ? Math.floor(rawPages) : 0;

  let finalChapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (overrides.chapterCount !== undefined) {
    const desiredCount = Math.max(0, Math.min(200, Number(overrides.chapterCount) || 0));
    if (desiredCount !== finalChapters.length) {
      finalChapters = buildDefaultChapters(desiredCount);
    }
  }

  createBookEntry({
    title: book.title,
    author: book.author,
    totalPages: finalPages,
    currentPage: 0,
    chapters: finalChapters,
    coverUrl: book.coverUrl || null,
    workKey: book.workKey || null,
    editionKey: book.editionKey || null
  });

  this.updateDynamicSections();
}

  renderResultCard(book, index, isFull) {
    const alreadyAdded = isBookInStorage(book);
    const addDisabled = isFull || alreadyAdded;
    const pagesLabel = book.totalPages > 0 ? `${book.totalPages} pages` : "Pages N/A";

  return `
    <div class="book-card result-card p-3 d-flex align-items-center gap-3" data-result-index="${index}">
      ${
        book.coverUrl
          ? `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}" class="result-cover-img" loading="lazy" />`
          : `<div class="result-cover-placeholder" aria-hidden="true"></div>`
      }

      <div class="flex-grow-1 min-w-0">
        <div class="fw-bold text-dark text-break" style="font-size: 0.92rem;">
          ${escapeHtml(book.title)}
        </div>
        <div
          class="text-muted text-break mb-2"
          style="font-size: 0.78rem; line-height: 1.35;"
          title="${escapeHtml(book.author)} · ${escapeHtml(pagesLabel)}"
        >
          ${escapeHtml(book.author)} · ${escapeHtml(pagesLabel)}
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2">
          <button type="button" class="btn btn-sm btn-view-details" data-view-details>
            View details
          </button>
          <button type="button" class="btn btn-sm btn-dark btn-quick-add" data-quick-add ${addDisabled ? "disabled" : ""}>
            ${alreadyAdded ? "Added" : "+ Add"}
          </button>
        </div>
      </div>
    </div>
  `;
}

  renderDetailsCard(book, isFull, goal) {
    const alreadyAdded = isBookInStorage(book);
    const addDisabled = isFull || alreadyAdded;
    const yearText = book.publishYear ? `${book.publishYear} · ` : "";
    const pagesCount = Number(book.totalPages) || 0;
    const chaptersCount = Array.isArray(book.chapters) ? book.chapters.length : 0;

    return `
      <div class="book-card p-3 p-md-4" data-details-panel>
        <div class="chapters-heading mb-2">BOOK DETAILS</div>

        <div class="d-flex align-items-start gap-3 mb-3">
  <div class="details-cover-box">
    ${
      book.coverUrl
        ? `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}" class="details-cover-img" />`
        : `<span class="details-cover-label">Cover</span>`
    }
        </div>

        <div class="flex-grow-1 min-w-0">
            <h3 class="h6 fw-bold text-dark mb-1 text-break">${escapeHtml(book.title)}</h3>
            <div class="text-muted small text-break">
            ${escapeHtml(book.author)} · ${yearText}${pagesCount} pages · ${chaptersCount} chapters
            </div>
        </div>
        </div>

        ${
          this.isLoadingDetails
            ? `<p class="text-muted small mb-3">Loading details...</p>`
            : book.description
              ? `<p class="text-muted small mb-3 details-description">${escapeHtml(book.description)}</p>`
              : `
                <div class="mb-3">
                  <div class="placeholder-line w-100 mb-1"></div>
                  <div class="placeholder-line w-75"></div>
                </div>
              `
        }

        <div class="row g-2 mb-3">
          <div class="col-6">
            <label class="form-label text-muted mb-1" style="font-size: 0.72rem;">Total pages</label>
            <input
              type="number"
              min="0"
              class="form-control form-control-sm"
              value="${pagesCount}"
              data-detail-pages
            />
          </div>
          <div class="col-6">
            <label class="form-label text-muted mb-1" style="font-size: 0.72rem;">Chapters</label>
            <input
              type="number"
              min="0"
              class="form-control form-control-sm"
              value="${chaptersCount}"
              data-detail-chapters
            />
          </div>
        </div>

        <button type="button" class="btn btn-dark w-100 py-2 fw-medium" style="border-radius: 8px; font-size: 0.875rem;" data-add-from-details ${addDisabled ? "disabled" : ""}>
            ${alreadyAdded ? "Already in reading list" : "Add to reading list"}
        </button>

        <div class="text-center text-muted mt-2" style="font-size: 0.75rem;">
          Blocked when list is full (${goal}/${goal})
        </div>
      </div>
    `;
  }

  bindEvents() {
    window.addEventListener("ptp:books-updated", () => this.updateDynamicSections());
    window.addEventListener("storage", () => this.updateDynamicSections());

    this.container.addEventListener("input", (e) => {
      if (!e.target.matches("[data-book-search-input]")) return;
      const value = e.target.value;

      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.performSearch(value);
      }, this.debounceMs);
    });

    this.container.addEventListener("click", (e) => {
      const resultCard = e.target.closest("[data-result-index]");
      if (resultCard) {
        const idx = Number(resultCard.dataset.resultIndex);
        const book = this.results[idx];
        if (!book) return;

        if (e.target.closest("[data-view-details]")) {
          this.selectBook(book, this.searchVersion);
          return;
        }

        if (e.target.closest("[data-quick-add]")) {
          this.addBookToStorage(book);
          return;
        }
      }

      if (e.target.closest("[data-add-from-details]") && this.selectedBook) {
        const panel = this.container.querySelector("[data-details-panel]");
        const customPages = panel?.querySelector("[data-detail-pages]")?.value;
        const customChapters = panel?.querySelector("[data-detail-chapters]")?.value;

        this.addBookToStorage(this.selectedBook, {
          totalPages: customPages,
          chapterCount: customChapters
        });
      }
    });
  }
}

export function initFindBooks(options) {
  return new FindBooks(options);
}