const CERTIFICATE_SEEN_KEY = "ptp_certificate_seen_goal";
const SEAL_IMAGE_PATH = "/assets/certified-reader-seal.png";

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

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawSparkle(ctx, x, y, size, alpha = 0.95) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 1.45);
  glow.addColorStop(0, "rgba(255, 250, 235, 0.95)");
  glow.addColorStop(0.5, "rgba(255, 215, 150, 0.35)");
  glow.addColorStop(1, "rgba(255, 215, 150, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#FFFDF7";
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.quadraticCurveTo(0, 0, size, 0);
  ctx.quadraticCurveTo(0, 0, 0, size);
  ctx.quadraticCurveTo(0, 0, -size, 0);
  ctx.quadraticCurveTo(0, 0, 0, -size);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export class CertificateModal {
  constructor({ containerId = "certificate-modal-mount" } = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }

    this.isOpen = false;
    this.readerName = "Reader";
    this.completedCount = 20;
    this.goal = 20;
    this.totalPagesRead = 0;
    this.sealImage = null;

    this.render();
    this.bindEvents();
  }

  async loadSealImage() {
    if (this.sealImage && this.sealImage.complete && this.sealImage.naturalWidth > 0) {
      return this.sealImage;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.sealImage = img;
        resolve(img);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = SEAL_IMAGE_PATH;
    });
  }

  async open({ completedCount = 20, goal = 20, totalPagesRead = 0, readerName } = {}) {
    this.completedCount = completedCount;
    this.goal = goal;
    this.totalPagesRead = totalPagesRead;
    if (typeof readerName === "string" && readerName.trim()) {
      this.readerName = readerName.trim();
    }
    this.isOpen = true;
    this.render();
    await this.drawCanvasCertificate();
  }

  close() {
    this.isOpen = false;
    this.render();
  }

  getFormattedDate() {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  drawSealImageWithShine(ctx, img, cx, cy, size = 185) {
    const half = size / 2;
    const radius = half * 0.94;

    ctx.save();

    // Soft warm glow behind the seal
    const aura = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.35);
    aura.addColorStop(0, "rgba(217, 119, 54, 0.25)");
    aura.addColorStop(0.65, "rgba(247, 197, 136, 0.1)");
    aura.addColorStop(1, "rgba(217, 119, 54, 0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Clip to a circle so rectangular image backgrounds blend cleanly
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, cx - half, cy - half, size, size);

    // Diagonal shine sweep across the stamp
    const sheenGrad = ctx.createLinearGradient(
      cx - radius,
      cy - radius,
      cx + radius,
      cy + radius * 0.45
    );
    sheenGrad.addColorStop(0.15, "rgba(255, 255, 255, 0)");
    sheenGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.34)");
    sheenGrad.addColorStop(0.56, "rgba(255, 255, 255, 0.08)");
    sheenGrad.addColorStop(0.72, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = sheenGrad;
    ctx.fillRect(cx - half, cy - half, size, size);

    ctx.restore();

    // Subtle rim and sparkle accents
    ctx.save();
    ctx.strokeStyle = "rgba(255, 244, 228, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    drawSparkle(ctx, cx + radius * 0.74, cy - radius * 0.72, 13, 0.95);
    drawSparkle(ctx, cx - radius * 0.82, cy - radius * 0.3, 8, 0.8);
    ctx.restore();
  }

  async drawCanvasCertificate() {
    const canvas = this.container.querySelector("#ptpCertificateCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sealImg = await this.loadSealImage();

    const w = canvas.width;
    const h = canvas.height;
    const dateStr = this.getFormattedDate();
    const displayName = this.readerName.trim() || "Dedicated Reader";

    // Warm cream background (#FAF8F5)
    ctx.fillStyle = "#FAF8F5";
    ctx.fillRect(0, 0, w, h);

    // Outer forest frame (#2C4A3E)
    ctx.strokeStyle = "#2C4A3E";
    ctx.lineWidth = 10;
    drawRoundedRect(ctx, 36, 36, w - 72, h - 72, 24);
    ctx.stroke();

    // Inner terracotta accent border (#D97736)
    ctx.strokeStyle = "#D97736";
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 58, 58, w - 116, h - 116, 18);
    ctx.stroke();

    // Header label
    ctx.fillStyle = "#D97736";
    ctx.font = "700 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PAGES TO PROGRESS · READING MILESTONE", w / 2, 165);

    // Main title
    ctx.fillStyle = "#1F2924";
    ctx.font = "700 64px Lora, Georgia, serif";
    ctx.fillText("Certificate of Completion", w / 2, 255);

    // Divider rule
    ctx.strokeStyle = "#D97736";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 140, 295);
    ctx.lineTo(w / 2 + 140, 295);
    ctx.stroke();

    // Subtitle
    ctx.fillStyle = "#5A655F";
    ctx.font = "400 28px Inter, system-ui, sans-serif";
    ctx.fillText("Awarded with pride to", w / 2, 365);

    // Recipient name
    ctx.fillStyle = "#2C4A3E";
    ctx.font = "700 54px Lora, Georgia, serif";
    ctx.fillText(displayName, w / 2, 445);

    // Underline under name
    ctx.strokeStyle = "#CBD5D0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 280, 472);
    ctx.lineTo(w / 2 + 280, 472);
    ctx.stroke();

    // Achievement statement (independent of day count)
    ctx.fillStyle = "#2D3732";
    ctx.font = "400 28px Inter, system-ui, sans-serif";
    ctx.fillText(
      `For completing ${this.completedCount} of ${this.goal} books in the Pages to Progress Reading Challenge`,
      w / 2,
      545
    );

    if (this.totalPagesRead > 0) {
      ctx.fillStyle = "#5A655F";
      ctx.font = "500 24px Inter, system-ui, sans-serif";
      ctx.fillText(
        `Total pages logged: ${this.totalPagesRead.toLocaleString()} pages`,
        w / 2,
        595
      );
    }

    // Big shining stamp image on the bottom-right
    if (sealImg) {
      this.drawSealImageWithShine(ctx, sealImg, w - 275, 745, 300);
    }

    // Footer metadata: Date & Brand
    ctx.fillStyle = "#5A655F";
    ctx.font = "500 22px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Awarded on ${dateStr}`, 130, 775);

    ctx.fillStyle = "#2C4A3E";
    ctx.font = "700 24px Lora, Georgia, serif";
    ctx.fillText("Pages to Progress", 130, 812);
  }

  createPdfBlobFromCanvas(canvas) {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    exportCtx.fillStyle = "#FAF8F5";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    const jpgDataUrl = exportCanvas.toDataURL("image/jpeg", 0.95);
    const jpgBase64 = jpgDataUrl.split(",")[1];
    const jpgBin = atob(jpgBase64);
    const imgBytes = new Uint8Array(jpgBin.length);
    for (let i = 0; i < jpgBin.length; i++) {
      imgBytes[i] = jpgBin.charCodeAt(i);
    }

    const w = exportCanvas.width;
    const h = exportCanvas.height;
    const encoder = new TextEncoder();

    const header = encoder.encode("%PDF-1.4\n");
    const obj1 = encoder.encode("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    const obj2 = encoder.encode("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    const obj3 = encoder.encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    );
    const obj4Prefix = encoder.encode(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
    );
    const obj4Suffix = encoder.encode("\nendstream\nendobj\n");

    const contentStreamStr = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
    const obj5 = encoder.encode(
      `5 0 obj\n<< /Length ${contentStreamStr.length} >>\nstream\n${contentStreamStr}endstream\nendobj\n`
    );

    const chunks = [header];
    const offsets = [0];
    let currentOffset = header.length;

    const pushObject = (parts) => {
      offsets.push(currentOffset);
      for (const part of parts) {
        chunks.push(part);
        currentOffset += part.length;
      }
    };

    pushObject([obj1]);
    pushObject([obj2]);
    pushObject([obj3]);
    pushObject([obj4Prefix, imgBytes, obj4Suffix]);
    pushObject([obj5]);

    const xrefOffset = currentOffset;
    let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    chunks.push(encoder.encode(xref + trailer));

    return new Blob(chunks, { type: "application/pdf" });
  }

  async downloadCertificate() {
    await this.drawCanvasCertificate();
    const canvas = this.container.querySelector("#ptpCertificateCanvas");
    if (!canvas) return;

    const pdfBlob = this.createPdfBlobFromCanvas(canvas);
    const url = URL.createObjectURL(pdfBlob);

    const link = document.createElement("a");
    const safeSlug = (this.readerName || "reader")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.download = `pages-to-progress-certificate-${safeSlug || "reader"}.pdf`;
    link.href = url;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  render() {
    if (!this.isOpen) {
      this.container.innerHTML = "";
      return;
    }

    this.container.innerHTML = `
      <div class="ptp-cert-backdrop" role="dialog" aria-modal="true" aria-labelledby="ptpCertTitle">
        <div class="ptp-cert-dialog p-4 p-md-5">
          <div class="d-flex align-items-start justify-content-between gap-3 mb-3">
            <div>
              <span class="badge rounded-pill px-3 py-2 mb-2" style="background-color: var(--ptp-accent-soft); color: var(--ptp-accent);">
                Milestone Reward Unlocked
              </span>
              <h2 id="ptpCertTitle" class="h4 fw-bold text-dark m-0">
                You Finished ${this.goal} Books!
              </h2>
              <p class="text-muted small mb-0 mt-1">
                Every page added up—enjoy your completion certificate regardless of the challenge clock.
              </p>
            </div>
            <button
              type="button"
              class="btn-close"
              aria-label="Close certificate modal"
              data-close-cert
            ></button>
          </div>

          <div class="mb-3">
            <label for="ptpCertNameInput" class="form-label small fw-medium text-dark mb-1">
              Name on certificate
            </label>
            <input
              id="ptpCertNameInput"
              type="text"
              class="form-control"
              placeholder="Enter your name"
              value="${escapeHtml(this.readerName)}"
              data-cert-name-input
            />
          </div>

          <div class="ptp-cert-preview-wrap mb-4">
            <canvas
              id="ptpCertificateCanvas"
              width="1400"
              height="990"
              class="w-100 h-auto d-block"
            ></canvas>
            <div class="ptp-canvas-seal-shine" aria-hidden="true"></div>
          </div>

          <div class="d-flex flex-wrap align-items-center justify-content-end gap-2">
            <button type="button" class="btn btn-outline-secondary" data-close-cert>
              Close
            </button>
            <button type="button" class="btn btn-dark d-inline-flex align-items-center gap-2" data-download-cert>
              <i class="bi bi-file-earmark-pdf"></i>
              <span>Download Certificate (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this.container.addEventListener("click", (e) => {
      if (e.target.matches(".ptp-cert-backdrop") || e.target.closest("[data-close-cert]")) {
        this.close();
        return;
      }

      if (e.target.closest("[data-download-cert]")) {
        this.downloadCertificate();
      }
    });

    this.container.addEventListener("input", (e) => {
      const input = e.target.closest("[data-cert-name-input]");
      if (!input) return;
      this.readerName = input.value;
      this.drawCanvasCertificate();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) {
        this.close();
      }
    });
  }
}

let sharedCertModal = null;

export function initCertificateModal(options = {}) {
  sharedCertModal = new CertificateModal(options);

  const checkAndTriggerMilestone = () => {
    const rawBooks = JSON.parse(localStorage.getItem("ptp_books") || "[]");
    const completedCount = Array.isArray(rawBooks)
      ? rawBooks.filter((b) => Boolean(b.completed)).length
      : 0;

    const rawChallenge = JSON.parse(localStorage.getItem("ptp_reading_challenge") || "null");
    const goal = Number(rawChallenge?.bookGoal) || options.bookGoal || 20;

    const totalPagesRead = Array.isArray(rawBooks)
      ? rawBooks.reduce((sum, b) => sum + Math.max(0, Number(b.currentPage) || 0), 0)
      : 0;

    const milestoneKey = `${goal}`;
    const alreadyShown = localStorage.getItem(CERTIFICATE_SEEN_KEY) === milestoneKey;

    if (completedCount >= goal && !alreadyShown) {
      localStorage.setItem(CERTIFICATE_SEEN_KEY, milestoneKey);
      sharedCertModal.open({
        completedCount,
        goal,
        totalPagesRead
      });
    } else if (completedCount < goal && alreadyShown) {
      localStorage.removeItem(CERTIFICATE_SEEN_KEY);
    }
  };

  window.addEventListener("ptp:books-updated", checkAndTriggerMilestone);
  window.addEventListener("storage", checkAndTriggerMilestone);
  checkAndTriggerMilestone();

  return sharedCertModal;
}

export function openCertificateReward(data = {}) {
  if (!sharedCertModal) {
    sharedCertModal = initCertificateModal();
  }
  sharedCertModal.open(data);
}