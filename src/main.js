import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import './css/style.css';

import { loadPartial } from './js/utils.js';

async function loadPartials() {
  await loadPartial('#header', 'partials/header.html');
  await loadPartial('#footer', 'partials/footer.html');
}

import { initQuoteBanner } from "/src/js/components/quoteBanner.js";
import { initChallengeBadge } from "/src/js/components/challengeBadge.js";
import { initStatsRow } from "/src/js/components/statsRow.js";
import { initReadingList } from "/src/js/components/readingList.js";
import { initFindBooks } from "/src/js/components/findBooks.js";
import { initProgressSection } from "/src/js/components/progressSection.js";
import { initCertificateModal } from "/src/js/components/certificateModal.js";

await loadPartials();

initChallengeBadge({
  containerId: "challenge-badge-mount",
  durationDays: 365
});

initQuoteBanner({
  templateId: "quote-banner-template",
  containerId: "quote-banner-mount",
  apiUrl: "https://dummyjson.com/quotes/random"
});

initStatsRow({
    templateId: "stats-row-template",
    containerId: "stats-row-mount",
    bookGoal: 20
});



initReadingList({
  containerId: "reading-list-mount",
  bookGoal: 20
});

initFindBooks({
  containerId: "find-books-mount",
  bookGoal: 20
});



initProgressSection({
  containerId: "progress-mount",
  bookGoal: 20
});



// Inside mountApp():
initCertificateModal({
  containerId: "certificate-modal-mount",
  bookGoal: BOOK_GOAL
});