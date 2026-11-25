import { getReadingStats } from "../services/storage.js";

export class StatsRow {

  constructor({ templateId, containerId, bookGoal = 20 }) {
    this.template = document.getElementById(templateId);
    this.container = document.getElementById(containerId);
    this.bookGoal = bookGoal;

    if (!this.template || !this.container) {
      throw new Error("StatsRow: template or container element not found.");
    }

    this.renderTemplate();
    this.update();
    this.bindEvents();
  }

  renderTemplate() {
    this.container.replaceChildren();
    const clone = this.template.content.cloneNode(true);
    this.container.appendChild(clone);

    this.finishedEl = this.container.querySelector('[data-stat="books-finished"]');
    this.pagesEl = this.container.querySelector('[data-stat="pages-read"]');
    this.slotsEl = this.container.querySelector('[data-stat="remaining-slots"]');
    this.daysEl = this.container.querySelector('[data-stat="days-left"]');
  }

  update() {
    const stats = getReadingStats(this.bookGoal);

    if (this.finishedEl) {
      this.finishedEl.textContent = `${stats.finishedCount} / ${stats.bookGoal}`;
    }
    if (this.pagesEl) {
      this.pagesEl.textContent = stats.totalPagesRead.toLocaleString();
    }
    if (this.slotsEl) {
      this.slotsEl.textContent = String(stats.remainingSlots);
    }
    if (this.daysEl) {
      this.daysEl.textContent = String(stats.daysLeft);
    }
  }

  bindEvents() {
    window.addEventListener("ptp:books-updated", () => this.update());
    window.addEventListener("storage", () => this.update());
  }
}

export function initStatsRow(options) {
  return new StatsRow(options);
}