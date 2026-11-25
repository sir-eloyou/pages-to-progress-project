import { fetchReadingQuote } from "../services/quotesApi.js";

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

export class QuoteBanner {
  constructor({ containerId }) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`QuoteBanner: container #${containerId} not found.`);
    }

    this.quote = {
      text: "Loading a reading quote...",
      author: ""
    };
    this.isLoading = true;
    this.render();
    this.bindEvents();
    this.loadQuote(false);
  }

  async loadQuote(forceRefresh = false) {
    this.isLoading = true;
    this.render();

    try {
      this.quote = await fetchReadingQuote({ forceRefresh });
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  render() {
    const authorHtml = this.quote.author
      ? `<div class="text-muted small">— ${escapeHtml(this.quote.author)}</div>`
      : "";

    this.container.innerHTML = `
      <section class="quote-card p-3 p-md-4 mb-4" aria-label="Reading motivation">
        <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div class="d-flex align-items-start gap-3 min-w-0">
            <span class="quote-icon flex-shrink-0" aria-hidden="true">“</span>
            <div class="min-w-0">
              <p class="quote-text mb-1 fs-6">${escapeHtml(this.quote.text)}</p>
              ${authorHtml}
            </div>
          </div>

          <button
            type="button"
            class="btn btn-quote flex-shrink-0 align-self-start align-self-md-center d-inline-flex align-items-center gap-2"
            data-next-quote
            ${this.isLoading ? "disabled" : ""}
          >
            <i class="bi bi-arrow-clockwise ${this.isLoading ? "quote-spin" : ""}" aria-hidden="true"></i>
            <span>New quote</span>
          </button>
        </div>
      </section>
    `;
  }

  bindEvents() {
    this.container.addEventListener("click", (e) => {
      if (!e.target.closest("[data-next-quote]")) return;
      this.loadQuote(false);
    });
  }
}

export function initQuoteBanner(options) {
  return new QuoteBanner(options);
}