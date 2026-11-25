import { getChallengeStatus, startReadingChallenge } from "../services/storage.js";

export class ChallengeBadge {

  constructor({ containerId, durationDays = 365 }) {
    this.container = document.getElementById(containerId);
    this.durationDays = durationDays;

    if (!this.container) {
      throw new Error(`ChallengeBadge: container #${containerId} not found.`);
    }

    this.render();
  }

  render() {
    const status = getChallengeStatus();

    if (!status) {
      // State 1: Not started yet
      this.container.innerHTML = `
        <button type="button" class="btn days-badge d-inline-flex align-items-center gap-2" data-start-challenge>
          <i class="bi bi-clock text-secondary"></i>
          <span>Start challenge</span>
        </button>
      `;

      this.container
        .querySelector("[data-start-challenge]")
        ?.addEventListener("click", () => {
          startReadingChallenge(this.durationDays);
          this.render();
        });
      return;
    }

    // State 2: Active countdown
    const label = status.isCompleted
      ? "Challenge complete!"
      : `${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left`;

    this.container.innerHTML = `
      <div class="days-badge d-inline-flex align-items-center gap-2" title="Reading challenge active">
        <i class="bi bi-clock text-secondary"></i>
        <span>${label}</span>
      </div>
    `;
  }
}

export function initChallengeBadge(options) {
  return new ChallengeBadge(options);
}