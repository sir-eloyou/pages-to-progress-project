import {
  getActiveReadingBooks,
  getBooks,
  getChallengeStatus,
  logBookPage,
  removeBookEntry,
  updateBookEntry
} from "../services/storage.js";

function escapeHtml(value) {
  const amp = String.fromCharCode(38);
  const quote = String.fromCharCode(34);
  const apostrophe = String.fromCharCode(39);
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML
    .replaceAll(quote, `${amp}#34;`)
    .replaceAll(apostrophe, `${amp}#39;`);
}

function chaptersToTextarea(chapters = []) {
  return chapters.map((ch) => ch.title).join("\n");
}

function textareaToChapters(text, existingChapters = []) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, idx) => {
    const existing = existingChapters[idx];
    const numbered = /^\d+[\.\):-]/.test(line) ? line : `${idx + 1}. ${line}`;
    return {
      id: existing?.id || `ch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title: numbered,
      completed: existing ? Boolean(existing.completed) : false
    };
  });
}

export class ReadingList {
  constructor({ containerId, bookGoal = 20 }) {
    this.container = document.getElementById(containerId);
    this.bookGoal = bookGoal;
    this.editingBookId = null;

    if (!this.container) {
      throw new Error(`ReadingList: container #${containerId} not found.`);
    }

    this.render();
    this.bindEvents();
  }

  getGoal() {
    return getChallengeStatus()?.bookGoal ?? this.bookGoal;
  }

  render() {
    const allBooks = getBooks();
    const activeBooks = getActiveReadingBooks();
    const goal = this.getGoal();

    this.container.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 class="h5 fw-bold text-dark m-0">Reading List</h2>
        <span class="slots-pill">${allBooks.length} of ${goal} slots used</span>
      </div>

      <div class="reading-list-box p-3">
        <div class="d-flex flex-column gap-3">
          ${
            activeBooks.length > 0
              ? activeBooks.map((book) => this.renderBookCard(book)).join("")
              : `
                <div class="p-4 text-center text-muted">
                  <p class="mb-1 fw-medium text-dark">Your reading list is empty</p>
                  <p class="small mb-0">Search in <strong>Find a Book</strong> to add books to your list.</p>
                </div>
              `
          }
        </div>
      </div>

      <p class="mt-3 mb-0 text-muted small d-flex align-items-center gap-1">
        <i class="bi bi-info-circle"></i>
        <span>Finished books (all chapters checked or last page reached) move to Progress automatically.</span>
      </p>
    `;
  }

  renderBookCard(book) {
    const totalPages = Math.max(0, Number(book.totalPages) || 0);
    const currentPage = Math.max(0, Number(book.currentPage) || 0);
    const percent = totalPages > 0
      ? Math.min(100, Math.round((currentPage / totalPages) * 100))
      : 0;

    const chapters = Array.isArray(book.chapters) ? book.chapters : [];
    const checkedCount = chapters.filter((c) => Boolean(c.completed)).length;
    const isEditing = this.editingBookId === book.id;

    return `
      <article class="book-card p-3 p-md-4" data-book-id="${escapeHtml(book.id)}">
        <div class="row g-4 align-items-start">
          <!-- Left: Cover + Progress + Page Logger -->
          <div class="col-12 col-md-7">
            <div class="d-flex gap-3 align-items-start">
              ${
                book.coverUrl
                  ? `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)} cover" class="book-cover-img flex-shrink-0" />`
                  : `<div class="book-cover-placeholder flex-shrink-0">Book cover</div>`
              }

              <div class="flex-grow-1 min-w-0">
                <h3 class="h6 fw-bold text-dark mb-0">${escapeHtml(book.title)}</h3>
                <div class="text-muted small mb-3">${escapeHtml(book.author || "Unknown Author")}</div>

                <div class="d-flex justify-content-between align-items-center small mb-1">
                  <span class="text-secondary fw-medium">
                    Page ${currentPage}${totalPages > 0 ? ` / ${totalPages}` : ""}
                  </span>
                  <span class="text-muted">${percent}%</span>
                </div>

                <div class="progress book-progress mb-3" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar bg-dark" style="width: ${percent}%"></div>
                </div>

                <form class="d-flex align-items-center gap-2 mb-2" data-log-page-form>
                  <input
                    type="number"
                    class="form-control page-input"
                    name="pageInput"
                    min="0"
                    ${totalPages > 0 ? `max="${totalPages}"` : ""}
                    value="${currentPage}"
                    aria-label="Current page for ${escapeHtml(book.title)}"
                  />
                  <button type="submit" class="btn btn-dark btn-log-page flex-shrink-0">
                    Log page
                  </button>
                </form>

                <div class="d-flex flex-wrap align-items-center gap-3 small">
                  <button type="button" class="btn btn-link p-0 text-muted text-decoration-none" data-remove-book>
                    <i class="bi bi-trash me-1"></i>Remove
                  </button>
                  <button type="button" class="btn btn-link p-0 text-muted text-decoration-none" data-edit-book>
                    <i class="bi bi-pencil me-1"></i>${isEditing ? "Cancel edit" : "Edit pages/chapters"}
                  </button>
                </div>
              </div>
            </div>

            ${isEditing ? this.renderEditDrawer(book) : ""}
          </div>

          <!-- Right: Chapters Checklist -->
          <div class="col-12 col-md-5">
            <div class="chapters-heading mb-2">
              CHAPTERS (${checkedCount} / ${chapters.length})
            </div>

            ${
              chapters.length > 0
                ? `
                  <div class="chapters-scroll d-flex flex-column gap-2">
                    ${chapters
                      .map(
                        (ch) => `
                          <label class="form-check chapter-item m-0 d-flex align-items-center gap-2">
                            <input
                              type="checkbox"
                              class="form-check-input mt-0"
                              data-chapter-id="${escapeHtml(ch.id)}"
                              ${ch.completed ? "checked" : ""}
                            />
                            <span class="${ch.completed ? "fw-medium text-dark" : "text-secondary"}">
                              ${escapeHtml(ch.title)}
                            </span>
                          </label>
                        `
                      )
                      .join("")}
                  </div>
                `
                : `
                  <p class="text-muted small mb-0">
                    No chapters set. Click <strong>Edit pages/chapters</strong> to add them.
                  </p>
                `
            }
          </div>
        </div>
      </article>
    `;
  }

  renderEditDrawer(book) {
    return `
      <form class="mt-3 pt-3 border-top" data-edit-book-form>
        <div class="row g-2 mb-2">
          <div class="col-6">
            <label class="form-label small mb-1">Total Pages</label>
            <input type="number" min="0" class="form-control form-control-sm" name="totalPages" value="${Number(book.totalPages) || 0}" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1">Current Page</label>
            <input type="number" min="0" class="form-control form-control-sm" name="currentPage" value="${Number(book.currentPage) || 0}" />
          </div>
        </div>
        <div class="mb-2">
          <label class="form-label small mb-1">Chapters (one per line)</label>
          <textarea class="form-control form-control-sm" name="chaptersText" rows="4">${escapeHtml(chaptersToTextarea(book.chapters))}</textarea>
        </div>
        <div class="d-flex justify-content-end">
          <button type="submit" class="btn btn-sm btn-dark">Save changes</button>
        </div>
      </form>
    `;
  }

  bindEvents() {
    window.addEventListener("ptp:books-updated", () => this.render());
    window.addEventListener("storage", () => this.render());

    this.container.addEventListener("click", (e) => {
      const card = e.target.closest("[data-book-id]");
      if (!card) return;
      const bookId = card.dataset.bookId;

      if (e.target.closest("[data-remove-book]")) {
        removeBookEntry(bookId);
        return;
      }

      if (e.target.closest("[data-edit-book]")) {
        this.editingBookId = this.editingBookId === bookId ? null : bookId;
        this.render();
      }
    });

    this.container.addEventListener("change", (e) => {
      const checkbox = e.target.closest("[data-chapter-id]");
      if (!checkbox) return;

      const card = checkbox.closest("[data-book-id]");
      if (!card) return;

      const bookId = card.dataset.bookId;
      const chapterId = checkbox.dataset.chapterId;
      const isChecked = checkbox.checked;

      updateBookEntry(bookId, (book) => ({
        ...book,
        chapters: (book.chapters || []).map((ch) =>
          ch.id === chapterId ? { ...ch, completed: isChecked } : ch
        )
      }));
    });

    this.container.addEventListener("submit", (e) => {
      if (e.target.matches("[data-log-page-form]")) {
        e.preventDefault();
        const card = e.target.closest("[data-book-id]");
        if (!card) return;

        const bookId = card.dataset.bookId;
        const nextPage = Math.max(0, Number(e.target.elements.pageInput.value) || 0);
        logBookPage(bookId, nextPage);
        return;
      }

      if (e.target.matches("[data-edit-book-form]")) {
        e.preventDefault();
        const card = e.target.closest("[data-book-id]");
        if (!card) return;

        const bookId = card.dataset.bookId;
        const f = e.target.elements;

        updateBookEntry(bookId, (book) => ({
          ...book,
          totalPages: Number(f.totalPages.value) || 0,
          currentPage: Number(f.currentPage.value) || 0,
          chapters: textareaToChapters(f.chaptersText.value, book.chapters || [])
        }));

        this.editingBookId = null;
        this.render();
      }
    });
  }
}

export function initReadingList(options) {
  return new ReadingList(options);
}