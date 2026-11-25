import {
  getChallengeStatus,
  getCompletedBooks,
  removeBookEntry,
  updateBookEntry
} from "../services/storage.js";
import { openCertificateReward } from "./certificateModal.js";

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

export class ProgressSection {
  constructor({ containerId, bookGoal = 20 }) {
    this.container = document.getElementById(containerId);
    this.bookGoal = bookGoal;

    if (!this.container) {
      throw new Error(`ProgressSection: container #${containerId} not found.`);
    }

    this.render();
    this.bindEvents();
  }

  getGoal() {
    return getChallengeStatus()?.bookGoal ?? this.bookGoal;
  }

  render() {
    const completedBooks = getCompletedBooks();
    const goal = Math.max(1, Number(this.getGoal()) || this.bookGoal);
    const completedCount = completedBooks.length;
    const percent = Math.min(100, Math.round((completedCount / goal) * 100));

    this.container.innerHTML = `
      <section class="progress-section mt-4" aria-label="Reading progress">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h2 class="h5 fw-bold text-dark m-0">Progress</h2>
          ${
            completedCount >= goal
              ? `
                <button
                  type="button"
                  class="btn btn-sm ptp-cert-rainbow-btn d-inline-flex align-items-center gap-1"
                  data-open-certificate
                >
                  <i class="bi bi-award"></i>
                  <span>Certificate</span>
                </button>
              `
              : ""
          }
        </div>

        <div class="ptp-card p-3 p-md-4">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <span class="fw-medium text-dark small">Annual goal</span>
            <span class="text-muted small fw-medium tabular-nums">
              ${completedCount} of ${goal} books · ${percent}%
            </span>
          </div>

          <div
            class="progress annual-goal-progress mb-4"
            role="progressbar"
            aria-label="Annual reading goal progress"
            aria-valuenow="${percent}"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div class="progress-bar" style="width: ${percent}%"></div>
          </div>

          ${
            completedBooks.length > 0
              ? `
                <div class="finished-shelf d-flex gap-3 pb-1">
                  ${completedBooks
                    .map((book, idx) => this.renderFinishedTile(book, idx))
                    .join("")}
                </div>
              `
              : `
                <div class="text-muted small py-2">
                  No finished books yet. Checking all chapters or reaching the last page moves a book here automatically.
                </div>
              `
          }
        </div>
      </section>
    `;
  }

  renderFinishedTile(book, index) {
    const label = `Finished ${index + 1}`;

    return `
      <article class="finished-tile flex-shrink-0" data-finished-id="${escapeHtml(book.id)}">
        <div class="finished-box" title="${escapeHtml(book.title)} — ${escapeHtml(book.author || "Unknown Author")}">
          ${
            book.coverUrl
              ? `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}" class="finished-cover-img" loading="lazy" />`
              : `<span class="finished-label">${escapeHtml(label)}</span>`
          }
        </div>

        <div class="finished-title text-truncate mt-2" title="${escapeHtml(book.title)}">
          ${escapeHtml(book.title)}
        </div>
        <div class="finished-author text-truncate" title="${escapeHtml(book.author || "Unknown Author")}">
          ${escapeHtml(book.author || "Unknown Author")}
        </div>

        <div class="finished-actions d-flex align-items-center justify-content-between mt-1 pt-1">
          <button
            type="button"
            class="btn btn-link p-0 text-decoration-none finished-action-btn"
            data-reopen-book
          >
            Re-read
          </button>
          <button
            type="button"
            class="btn btn-link p-0 text-decoration-none finished-action-btn"
            data-remove-finished
          >
            Remove
          </button>
        </div>
      </article>
    `;
  }

  bindEvents() {
    window.addEventListener("ptp:books-updated", () => this.render());
    window.addEventListener("storage", () => this.render());

    this.container.addEventListener("click", (e) => {
      if (e.target.closest("[data-open-certificate]")) {
        const completedBooks = getCompletedBooks();
        const goal = Math.max(1, Number(this.getGoal()) || this.bookGoal);
        const totalPagesRead = completedBooks.reduce(
          (sum, b) => sum + Math.max(0, Number(b.currentPage) || 0),
          0
        );

        openCertificateReward({
          completedCount: completedBooks.length,
          goal,
          totalPagesRead
        });
        return;
      }

      const tile = e.target.closest("[data-finished-id]");
      if (!tile) return;
      const bookId = tile.dataset.finishedId;

      if (e.target.closest("[data-remove-finished]")) {
        removeBookEntry(bookId);
        return;
      }

      if (e.target.closest("[data-reopen-book]")) {
        updateBookEntry(bookId, (book) => ({
          ...book,
          currentPage: 0,
          completed: false,
          completedAt: null,
          chapters: (book.chapters || []).map((ch) => ({
            ...ch,
            completed: false
          }))
        }));
      }
    });
  }
}

export function initProgressSection(options) {
  return new ProgressSection(options);
}