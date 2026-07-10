import {
  approveOrganization,
  approveEvent,
  createEvent,
  createOrder,
  deleteEvent,
  deleteOrganization,
  getEvents,
  getOrders,
  getOrganizations,
  getUserProfile,
  ensureUserProfile,
  loginUser,
  loginWithGoogle,
  logoutUser,
  pauseEvent,
  rejectEvent,
  rejectOrganization,
  registerUser,
  settleOrganization,
  scanTicketService,
  updateEvent,
  updateEventServices,
  updateEventVouchers,
  watchAuthState
} from "./firebase.js";

const SERVICE_CHARGE_PER_1000 = 10;
const FEE_RATE = SERVICE_CHARGE_PER_1000 / 1000;
const SELLER_AGREEMENT_VERSION = "v1";
const defaultServiceModules = [
  { key: "entry", label: "Entry" },
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" }
];

const state = {
  activePanel: "home",
  activeFilter: "All",
  searchQuery: "",
  authRole: "buyer",
  authMode: "login",
  activeSlide: 0,
  editingEventId: "",
  editingImageUrl: "",
  selectedEventId: "",
  pendingBuyerEventId: "",
  scannerService: "entry",
  scannerBusy: false,
  scannerStream: null,
  scannerFrame: 0,
  currentUser: null,
  currentProfile: null,
  lastTicket: null,
  lastVerificationHash: "",
  modalHistoryOpen: false,
  organizations: [],
  events: [],
  orders: []
};

const roleLabels = {
  home: "Events",
  admin: "Admin Panel",
  seller: "Organization Panel",
  buyer: "Buyer Panel"
};

const pageNames = {
  home: "Home",
  admin: "Admin",
  seller: "Seller",
  buyer: "Buyer",
  login: "Login"
};

let pageLoaderTimer = 0;
let suppressModalPop = false;

const accessLabels = {
  admin: "Admin",
  seller: "Sell Ticket",
  buyer: "Buy Ticket"
};

const elements = {
  homeLink: document.querySelector("#homeLink"),
  topbar: document.querySelector(".topbar"),
  pageLoader: document.querySelector("#pageLoader"),
  pageLoaderText: document.querySelector("#pageLoaderText"),
  themeToggle: document.querySelector("#themeToggle"),
  adminAccess: document.querySelector("#adminAccess"),
  openLogin: document.querySelector("#openLogin"),
  currentPanelName: document.querySelector("#currentPanelName"),
  navButtons: document.querySelectorAll(".nav-button"),
  panelViews: document.querySelectorAll("[data-panel-view]"),
  landingEventCount: document.querySelector("#landingEventCount"),
  homeSearch: document.querySelector("#homeSearch"),
  eventSlider: document.querySelector("#eventSlider"),
  landingEventGrid: document.querySelector("#landingEventGrid"),
  metricTickets: document.querySelector("#metricTickets"),
  metricGross: document.querySelector("#metricGross"),
  metricOrgShare: document.querySelector("#metricOrgShare"),
  metricFee: document.querySelector("#metricFee"),
  adminOrgRows: document.querySelector("#adminOrgRows"),
  adminEventRows: document.querySelector("#adminEventRows"),
  eventSalesRows: document.querySelector("#eventSalesRows"),
  eventSalesSummary: document.querySelector("#eventSalesSummary"),
  pendingOrgCount: document.querySelector("#pendingOrgCount"),
  settlementRows: document.querySelector("#settlementRows"),
  sellerAgreement: document.querySelector("#sellerAgreement"),
  agreeSellerTerms: document.querySelector("#agreeSellerTerms"),
  sellerEventList: document.querySelector("#sellerEventList"),
  sellerEventCount: document.querySelector("#sellerEventCount"),
  sellerEventRows: document.querySelector("#sellerEventRows"),
  serviceScanner: document.querySelector("#serviceScanner"),
  scannerEvent: document.querySelector("#scannerEvent"),
  serviceToggleGrid: document.querySelector("#serviceToggleGrid"),
  scannerCode: document.querySelector("#scannerCode"),
  scanManualButton: document.querySelector("#scanManualButton"),
  startScannerButton: document.querySelector("#startScannerButton"),
  stopScannerButton: document.querySelector("#stopScannerButton"),
  scannerVideo: document.querySelector("#scannerVideo"),
  scannerPlaceholder: document.querySelector("#scannerPlaceholder"),
  scannerResult: document.querySelector("#scannerResult"),
  eventForm: document.querySelector("#eventForm"),
  eventFormTitle: document.querySelector("#eventFormTitle"),
  eventFormHint: document.querySelector("#eventFormHint"),
  eventSubmitButton: document.querySelector("#eventSubmitButton"),
  cancelEventEdit: document.querySelector("#cancelEventEdit"),
  filterPills: document.querySelectorAll(".filter-pill"),
  buyerSearch: document.querySelector("#buyerSearch"),
  buyerEventGrid: document.querySelector("#buyerEventGrid"),
  checkoutEvent: document.querySelector("#checkoutEvent"),
  selectedEventStatus: document.querySelector("#selectedEventStatus"),
  buyerName: document.querySelector("#buyerName"),
  buyerEmail: document.querySelector("#buyerEmail"),
  ticketQuantity: document.querySelector("#ticketQuantity"),
  voucherCode: document.querySelector("#voucherCode"),
  voucherMessage: document.querySelector("#voucherMessage"),
  paymentMethods: document.querySelectorAll("input[name='paymentMethod']"),
  checkoutPaymentMethod: document.querySelector("#checkoutPaymentMethod"),
  checkoutGross: document.querySelector("#checkoutGross"),
  checkoutDiscount: document.querySelector("#checkoutDiscount"),
  checkoutForm: document.querySelector("#checkoutForm"),
  checkoutPanel: document.querySelector("#checkoutPanel"),
  checkoutBackdrop: document.querySelector("#checkoutBackdrop"),
  eventPreviewPanel: document.querySelector("#eventPreviewPanel"),
  eventPreviewBody: document.querySelector("#eventPreviewBody"),
  closeEventPreview: document.querySelector("#closeEventPreview"),
  closeCheckout: document.querySelector("#closeCheckout"),
  receiptOutput: document.querySelector("#receiptOutput"),
  eventDetailsModal: document.querySelector("#eventDetailsModal"),
  closeEventDetails: document.querySelector("#closeEventDetails"),
  eventDetailsBody: document.querySelector("#eventDetailsBody"),
  authModal: document.querySelector("#authModal"),
  closeAuth: document.querySelector("#closeAuth"),
  authChoice: document.querySelector("#authChoice"),
  authForm: document.querySelector("#authForm"),
  authRoleLabel: document.querySelector("#authRoleLabel"),
  authFormTitle: document.querySelector("#authFormTitle"),
  authIdentifier: document.querySelector("#authIdentifier"),
  authPassword: document.querySelector("#authPassword"),
  authConfirmWrap: document.querySelector("#authConfirmWrap"),
  authConfirmPassword: document.querySelector("#authConfirmPassword"),
  authMessage: document.querySelector("#authMessage"),
  authSubmit: document.querySelector("#authSubmit"),
  authGoogle: document.querySelector("#authGoogle"),
  authSwitchPrompt: document.querySelector("#authSwitchPrompt"),
  authSwitch: document.querySelector("#authSwitch"),
  passwordToggles: document.querySelectorAll("[data-toggle-password]"),
  toast: document.querySelector("#toast")
};

function money(value) {
  return `Tk ${Math.round(value || 0).toLocaleString("en-US")}`;
}

function userRole() {
  return state.currentProfile?.role || "";
}

function isAdminUser() {
  return userRole() === "admin";
}

function sellerAgreementKey() {
  return `tickolas-seller-agreement-${SELLER_AGREEMENT_VERSION}-${state.currentUser?.uid || "guest"}`;
}

function sellerAgreementAccepted() {
  return localStorage.getItem(sellerAgreementKey()) === "accepted";
}

function acceptSellerAgreement() {
  localStorage.setItem(sellerAgreementKey(), "accepted");
  renderSeller();
  showToast("Seller agreement accepted.");
}

function userLabel() {
  const email = state.currentProfile?.email || state.currentUser?.email || "";
  return email ? email.split("@")[0] : "User";
}

function loggedInEmail() {
  return state.currentUser?.email || state.currentProfile?.email || "";
}

function routeToProfile(profile) {
  const previousPanel = state.activePanel;
  if (profile?.role === "admin") {
    state.activePanel = "admin";
  } else if (profile?.role === "seller") {
    state.activePanel = "seller";
  } else if (profile?.role === "buyer") {
    state.activePanel = "buyer";
  }
  if (state.activePanel !== previousPanel) {
    showPageLoader(state.activePanel);
  }
}

function showPageLoader(panel = state.activePanel, duration = 520) {
  if (!elements.pageLoader || !elements.pageLoaderText) return;
  window.clearTimeout(pageLoaderTimer);
  elements.pageLoaderText.textContent = `${pageNames[panel] || "Tickolas"} Page is loading`;
  elements.pageLoader.hidden = false;
  if (duration > 0) {
    pageLoaderTimer = window.setTimeout(() => {
      elements.pageLoader.hidden = true;
    }, duration);
  }
}

function hidePageLoader() {
  if (!elements.pageLoader) return;
  window.clearTimeout(pageLoaderTimer);
  elements.pageLoader.hidden = true;
}

function isAnyModalOpen() {
  return !elements.authModal.hidden
    || !elements.eventDetailsModal.hidden
    || !elements.eventPreviewPanel.hidden
    || !elements.checkoutPanel.hidden;
}

function syncModalState() {
  const hasModal = isAnyModalOpen();
  document.body.classList.toggle("modal-open", hasModal);
  if (!hasModal && state.modalHistoryOpen && history.state?.tickolasModal) {
    suppressModalPop = true;
    state.modalHistoryOpen = false;
    history.back();
  } else if (!hasModal) {
    state.modalHistoryOpen = false;
  }
}

function pushModalHistory() {
  if (state.modalHistoryOpen || history.state?.tickolasModal) {
    state.modalHistoryOpen = true;
    return;
  }
  history.pushState({ tickolasModal: true }, "", window.location.href);
  state.modalHistoryOpen = true;
}

function closeAllModalsFromHistory() {
  elements.authModal.hidden = true;
  elements.eventDetailsModal.hidden = true;
  elements.eventPreviewPanel.hidden = true;
  elements.checkoutPanel.hidden = true;
  elements.checkoutBackdrop.hidden = true;
  state.modalHistoryOpen = false;
  syncModalState();
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

function changePanel(panel) {
  if (!panel || panel === state.activePanel) return;
  if (panel !== "seller") stopQrScanner();
  state.activePanel = panel;
  showPageLoader(panel);
  render();
}

function requireSignedIn(message = "Please login first.") {
  if (state.currentUser) return true;
  showToast(message);
  openAuthChoice();
  return false;
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("tickolas-theme", nextTheme);
  elements.themeToggle.setAttribute("aria-pressed", String(nextTheme === "dark"));
  elements.themeToggle.setAttribute("aria-label", `Switch to ${nextTheme === "dark" ? "light" : "dark"} theme`);
  elements.themeToggle.querySelector(".theme-toggle-text").textContent = nextTheme === "dark" ? "Dark" : "Light";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function usableImageSource(value) {
  const image = String(value || "").trim();
  if (!image) return "";
  if (image.startsWith("data:image/")) return image;
  return cleanImageUrl(image);
}

function eventImageStyle(event) {
  const imageUrl = usableImageSource(event.imageUrl);
  if (!imageUrl) return "";
  const safeUrl = imageUrl.replace(/["\\\n\r]/g, "");
  return ` style="background-image: linear-gradient(135deg, rgba(6, 12, 24, 0.18), rgba(124, 58, 237, 0.22) 58%, rgba(255, 138, 61, 0.12)), url(&quot;${safeUrl}&quot;)"`;
}

function eventImageVariable(event) {
  const imageUrl = usableImageSource(event.imageUrl);
  if (!imageUrl) return "";
  const safeUrl = imageUrl.replace(/["\\\n\r]/g, "");
  return ` style="--event-image: url(&quot;${safeUrl}&quot;)"`;
}

function canEditEvent(event) {
  return isAdminUser() || (state.currentUser && event.createdBy === state.currentUser.uid);
}

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.74);
        if (dataUrl.length > 850000) {
          reject(new Error("Image is too large. Please choose a smaller photo."));
          return;
        }
        resolve(dataUrl);
      };
      image.onerror = () => reject(new Error("Could not read this image."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

async function eventImageFromForm(formData) {
  const file = formData.get("imageFile");
  if (file && file.size > 0) {
    return resizeImageFile(file);
  }

  const url = cleanImageUrl(formData.get("imageUrl"));
  if (url) return url;
  return state.editingImageUrl || "";
}

function dateLabel(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return String(value);
}

function statusLabel(value) {
  const status = String(value || "").trim();
  return status === "review" ? "In review" : status;
}

function adminEventStatusMarkup(event) {
  const status = event.status || "review";
  const label = statusLabel(status);
  if (status !== "review") {
    return `<span class="status ${escapeHtml(status)}">${escapeHtml(label)}</span>`;
  }

  return `
    <button class="status status-button review" type="button" data-action="view-event-details" data-event-id="${escapeHtml(event.id)}">
      ${escapeHtml(label)}
    </button>
  `;
}

function parseBangladeshDate(value) {
  const match = String(value).trim().match(/^([0-2][0-9]|3[01])\/(0[1-9]|1[0-2])\/([0-9]{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  if (date.getFullYear() !== Number(year) || date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function createSlugId(prefix, title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${prefix}-${slug || "item"}-${Date.now().toString(36)}`;
}

function splitAmount(gross) {
  return {
    fee: gross * FEE_RATE,
    orgShare: gross * (1 - FEE_RATE)
  };
}

function normalizeVoucherCode(value) {
  return String(value || "").trim().toLowerCase();
}

function voucherList(event) {
  return Array.isArray(event?.vouchers) ? event.vouchers : [];
}

function serviceKeyFromLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function serviceModules(event) {
  const saved = Array.isArray(event?.serviceModules) ? event.serviceModules : [];
  const combined = saved.length ? [defaultServiceModules[0], ...saved] : defaultServiceModules;
  const seen = new Set();
  return combined
    .map((service) => ({
      key: serviceKeyFromLabel(service.key || service.label),
      label: String(service.label || service.key || "").trim().slice(0, 32)
    }))
    .filter((service) => {
      if (!service.key || !service.label || seen.has(service.key)) return false;
      seen.add(service.key);
      return true;
    })
    .slice(0, 12);
}

function findVoucher(event, code) {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return null;
  return voucherList(event).find((voucher) => normalizeVoucherCode(voucher.code) === normalized) || null;
}

function checkoutPricing(event, quantity, code) {
  const subtotal = Number(event?.price || 0) * Math.max(Number(quantity) || 1, 1);
  const voucher = findVoucher(event, code);
  const discountPercent = voucher ? Math.min(Math.max(Number(voucher.discountPercent || 0), 0), 100) : 0;
  const discount = Math.round(subtotal * (discountPercent / 100));
  return {
    subtotal,
    discount,
    total: Math.max(subtotal - discount, 0),
    voucher,
    discountPercent
  };
}

function getOrg(orgId) {
  return state.organizations.find((org) => org.id === orgId);
}

function getEvent(eventId) {
  return state.events.find((event) => event.id === eventId);
}

function pdfEscape(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function pdfText(value, x, y, size = 12, color = "0 0 0", font = "F1") {
  return `${color} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(value)}) Tj ET`;
}

function pdfTextLines(value, x, y, size = 12, maxChars = 52, lineHeight = 17, color = "0 0 0", font = "F1") {
  const words = String(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = next;
  });
  if (line) lines.push(line);
  return lines.map((text, index) => pdfText(text, x, y - index * lineHeight, size, color, font));
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildPdfBlob(content, images = []) {
  const encoder = new TextEncoder();
  const imageResources = images.map((image, index) => `/I${index + 1} ${index + 5} 0 R`).join(" ");
  const contentObjectId = 5 + images.length;
  const objects = [
    { body: "<< /Type /Catalog /Pages 2 0 R >>" },
    { body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /F3 << /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >> >> /XObject << ${imageResources} >> >> /Contents ${contentObjectId} 0 R >>`
    },
    { body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    ...images.map((image) => ({
      header: `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      bytes: image.bytes,
      footer: "\nendstream"
    })),
    {
      header: `<< /Length ${encoder.encode(content).length} >>\nstream\n`,
      bytes: encoder.encode(content),
      footer: "\nendstream"
    }
  ];
  const parts = [];
  const offsets = [0];
  let byteLength = encoder.encode("%PDF-1.4\n").length;
  parts.push("%PDF-1.4\n");

  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const start = `${index + 1} 0 obj\n`;
    parts.push(start);
    byteLength += encoder.encode(start).length;

    if (object.body) {
      parts.push(object.body);
      byteLength += encoder.encode(object.body).length;
    } else {
      parts.push(object.header, object.bytes, object.footer);
      byteLength += encoder.encode(object.header).length + object.bytes.length + encoder.encode(object.footer).length;
    }

    const end = "\nendobj\n";
    parts.push(end);
    byteLength += encoder.encode(end).length;
  });

  const xrefOffset = byteLength;
  let trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    trailer += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  trailer += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(trailer);

  return new Blob(parts, { type: "application/pdf" });
}

function ticketFileName(order, event) {
  const safeTitle = String(event?.title || "ticket")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42) || "ticket";
  return `tickolas-${safeTitle}-${order.id}.pdf`;
}

function ticketVerifyUrl(order, event) {
  const params = new URLSearchParams({
    id: order.id,
    event: String(event?.title || "Tickolas event").replace(/\s+/g, " ").slice(0, 36),
    date: dateLabel(event?.date),
    qty: String(order.quantity || 1),
    paid: String(Math.round(Number(order.gross || 0)))
  });
  return `${window.location.origin}${window.location.pathname}#verify-ticket?${params.toString()}`;
}

function qrAppendBits(buffer, value, length) {
  for (let i = length - 1; i >= 0; i -= 1) {
    buffer.push((value >>> i) & 1);
  }
}

function qrBytesFromBits(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | (bits[i + j] || 0);
    bytes.push(value);
  }
  return bytes;
}

function qrMakeGaloisTables() {
  const exp = new Array(512).fill(0);
  const log = new Array(256).fill(0);
  let value = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255];
  return { exp, log };
}

function qrMultiply(left, right, tables) {
  if (!left || !right) return 0;
  return tables.exp[tables.log[left] + tables.log[right]];
}

function qrErrorCorrection(data, degree) {
  const tables = qrMakeGaloisTables();
  const generator = new Array(degree).fill(0);
  generator[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      generator[j] = qrMultiply(generator[j], root, tables);
      if (j + 1 < degree) generator[j] ^= generator[j + 1];
    }
    root = qrMultiply(root, 0x02, tables);
  }

  const result = new Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= qrMultiply(coefficient, factor, tables);
    });
  });
  return result;
}

function qrSet(matrix, reserved, x, y, dark, lock = true) {
  if (x < 0 || y < 0 || y >= matrix.length || x >= matrix.length) return;
  matrix[y][x] = Boolean(dark);
  if (lock) reserved[y][x] = true;
}

function qrFinder(matrix, reserved, left, top) {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const absoluteX = left + x;
      const absoluteY = top + y;
      const dark = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
      qrSet(matrix, reserved, absoluteX, absoluteY, dark);
    }
  }
}

function qrAlignment(matrix, reserved, centerX, centerY) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
      qrSet(matrix, reserved, centerX + x, centerY + y, dark);
    }
  }
}

function qrFormatBits(mask) {
  let data = (1 << 3) | mask;
  let value = data << 10;
  for (let i = 14; i >= 10; i -= 1) {
    if ((value >>> i) & 1) value ^= 0x537 << (i - 10);
  }
  return ((data << 10) | value) ^ 0x5412;
}

function qrDrawFormat(matrix, reserved, mask) {
  const size = matrix.length;
  const bits = qrFormatBits(mask);
  for (let i = 0; i <= 5; i += 1) qrSet(matrix, reserved, 8, i, (bits >>> i) & 1);
  qrSet(matrix, reserved, 8, 7, (bits >>> 6) & 1);
  qrSet(matrix, reserved, 8, 8, (bits >>> 7) & 1);
  qrSet(matrix, reserved, 7, 8, (bits >>> 8) & 1);
  for (let i = 9; i < 15; i += 1) qrSet(matrix, reserved, 14 - i, 8, (bits >>> i) & 1);
  for (let i = 0; i < 8; i += 1) qrSet(matrix, reserved, size - 1 - i, 8, (bits >>> i) & 1);
  for (let i = 8; i < 15; i += 1) qrSet(matrix, reserved, 8, size - 15 + i, (bits >>> i) & 1);
}

function qrMatrixFromText(text) {
  if (!window.qrcode) {
    throw new Error("QR generator is not loaded.");
  }

  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();

  return Array.from({ length: qr.getModuleCount() }, (_, row) =>
    Array.from({ length: qr.getModuleCount() }, (_, column) => qr.isDark(row, column))
  );
}

function ticketQrPayload(order, event) {
  return ticketVerifyUrl(order, event);
}

function handleTicketVerificationHash() {
  if (!window.location.hash.startsWith("#verify-ticket?")) return;
  if (state.lastVerificationHash === window.location.hash) return;
  state.lastVerificationHash = window.location.hash;
  const params = new URLSearchParams(window.location.hash.replace("#verify-ticket?", ""));
  const message = [
    "Tickolas ticket verification",
    `Ticket ID: ${params.get("id") || "N/A"}`,
    `Event: ${params.get("event") || "N/A"}`,
    `Date: ${params.get("date") || "N/A"}`,
    `Quantity: ${params.get("qty") || "N/A"}`,
    `Paid: Tk ${params.get("paid") || "0"}`
  ].join("\n");
  window.alert(message);
}

function qrPdfCommands(text, left, bottom, moduleSize) {
  const matrix = qrMatrixFromText(text);
  const commands = [
    "1 1 1 rg",
    `${left - moduleSize * 2} ${bottom - moduleSize * 2} ${(matrix.length + 4) * moduleSize} ${(matrix.length + 4) * moduleSize} re f`,
    "0 0 0 rg"
  ];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      const pdfX = left + x * moduleSize;
      const pdfY = bottom + (matrix.length - 1 - y) * moduleSize;
      commands.push(`${pdfX} ${pdfY} ${moduleSize} ${moduleSize} re f`);
    });
  });
  return commands;
}

function qrJpegImage(text, moduleSize = 10, margin = 4) {
  const matrix = qrMatrixFromText(text);
  const size = (matrix.length + margin * 2) * moduleSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#000000";

  matrix.forEach((row, rowIndex) => {
    row.forEach((dark, columnIndex) => {
      if (!dark) return;
      context.fillRect((columnIndex + margin) * moduleSize, (rowIndex + margin) * moduleSize, moduleSize, moduleSize);
    });
  });

  const dataUrl = canvas.toDataURL("image/jpeg", 1);
  return {
    dataUrl,
    width: size,
    height: size,
    bytes: base64ToBytes(dataUrl.split(",")[1])
  };
}

function canvasJpegImage(canvas, quality = 0.9) {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    bytes: base64ToBytes(dataUrl.split(",")[1])
  };
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error("Image source missing."));
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load ticket image."));
    if (!String(source).startsWith("data:")) image.crossOrigin = "anonymous";
    image.src = source;
  });
}

function drawCoverImage(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function ticketBackgroundImage(event) {
  const canvas = document.createElement("canvas");
  canvas.width = 1190;
  canvas.height = 1684;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#150b2d");
  gradient.addColorStop(0.45, "#111b2c");
  gradient.addColorStop(1, "#300d3a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const image = await loadImageElement(usableImageSource(event?.imageUrl));
    context.save();
    context.globalAlpha = 0.18;
    drawCoverImage(context, image, 0, 0, canvas.width, canvas.height);
    context.restore();
  } catch {
    context.fillStyle = "rgba(154, 87, 255, 0.12)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const vignette = context.createRadialGradient(360, 260, 80, 595, 842, 1020);
  vignette.addColorStop(0, "rgba(255,255,255,0.10)");
  vignette.addColorStop(0.55, "rgba(9,14,27,0.42)");
  vignette.addColorStop(1, "rgba(7,10,20,0.84)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvasJpegImage(canvas, 0.88);
}

async function ticketLogoImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 220;
  canvas.height = 220;
  const context = canvas.getContext("2d");
  const headerColor = { r: 10, g: 16, b: 32 };
  context.fillStyle = `rgb(${headerColor.r}, ${headerColor.g}, ${headerColor.b})`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const image = await loadImageElement("assets/tickolas-logo-mark.png");
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    const tempContext = temp.getContext("2d");
    drawCoverImage(tempContext, image, 14, 14, 192, 192);
    const pixels = tempContext.getImageData(0, 0, temp.width, temp.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const alpha = pixels.data[index + 3];
      if (alpha < 12 || (red < 26 && green < 26 && blue < 26)) {
        pixels.data[index] = headerColor.r;
        pixels.data[index + 1] = headerColor.g;
        pixels.data[index + 2] = headerColor.b;
        pixels.data[index + 3] = 255;
      }
    }
    tempContext.putImageData(pixels, 0, 0);
    context.drawImage(temp, 0, 0);
  } catch {
    context.fillStyle = "#b56cff";
    context.font = "bold 126px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("T", 110, 116);
  }

  return canvasJpegImage(canvas, 0.9);
}

async function ticketEventHeroImage(event) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 520;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#24104b");
  gradient.addColorStop(1, "#101827");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  try {
    const image = await loadImageElement(usableImageSource(event?.imageUrl));
    drawCoverImage(context, image, 0, 0, canvas.width, canvas.height);
  } catch {
    context.fillStyle = "rgba(213, 100, 255, 0.2)";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const shade = context.createLinearGradient(0, 0, canvas.width, 0);
  shade.addColorStop(0, "rgba(7, 10, 20, 0.84)");
  shade.addColorStop(0.58, "rgba(7, 10, 20, 0.36)");
  shade.addColorStop(1, "rgba(7, 10, 20, 0.08)");
  context.fillStyle = shade;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvasJpegImage(canvas, 0.86);
}

async function buildTicketPdf({ order, event, org }) {
  const gross = Number(order.gross || 0);
  const qrPayload = ticketQrPayload(order, event);
  const qrImage = qrJpegImage(qrPayload, 8, 4);
  const backgroundImage = await ticketBackgroundImage(event);
  const logoImage = await ticketLogoImage();
  const eventHeroImage = await ticketEventHeroImage(event);
  const issueDate = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  const ticketId = String(order.id || "");
  const organizer = org?.name || event?.sellerEmail || "Organization";
  const quantity = Number(order.quantity || 1);
  const ticketLines = [
    pdfText("ickolas", 106, 744, 28, "1 1 1", "F2"),
    pdfText("Official event ticket", 108, 718, 12, "0.86 0.90 0.98"),
    pdfText("VALID ENTRY PASS", 380, 758, 12, "0.98 0.72 1", "F2"),
    pdfText(`Issued ${issueDate}`, 380, 734, 10, "0.78 0.84 0.94"),
    pdfText(event?.category || "Event", 78, 630, 12, "0.98 0.72 1", "F2"),
    ...pdfTextLines(event?.title || "Tickolas event", 78, 591, 23, 25, 27, "1 1 1", "F2"),
    pdfText(`Date: ${dateLabel(event?.date)}`, 78, 520, 13, "1 1 1", "F2"),
    pdfText(`Venue: ${event?.venue || "Venue to be announced"}`, 78, 496, 12, "0.88 0.93 1"),
    pdfText(`Organizer: ${organizer}`, 78, 474, 12, "0.88 0.93 1"),
    pdfText("Scan to verify", 407, 458, 10, "0.84 0.90 1", "F2"),
    pdfText("Buyer details", 76, 397, 12, "0.98 0.72 1", "F2"),
    pdfText(order.buyerName || "Buyer", 76, 368, 18, "1 1 1", "F2"),
    pdfText(order.buyerEmail || "N/A", 76, 344, 11, "0.78 0.86 0.96"),
    pdfText("Quantity", 76, 286, 10, "0.64 0.72 0.84"),
    pdfText(String(quantity), 76, 260, 21, "1 1 1", "F2"),
    pdfText("Payment", 198, 286, 10, "0.64 0.72 0.84"),
    pdfText(order.paymentMethod || "Selected", 198, 263, 15, "1 1 1", "F2"),
    pdfText("Total paid", 308, 286, 10, "0.64 0.72 0.84"),
    pdfText(money(gross), 308, 263, 18, "0.98 0.72 1", "F2"),
    pdfText(`Ticket ID: ${ticketId}`, 76, 214, 10, "0.76 0.84 0.94", "F3"),
    pdfText("Show this ticket at the event entry gate.", 76, 104, 11, "0.84 0.90 1"),
    pdfText("Powered by Tickolas", 380, 104, 11, "0.98 0.72 1", "F2")
  ];
  const content = [
    "q 595 0 0 842 0 0 cm /I1 Do Q",
    "0.04 0.07 0.13 rg",
    "44 76 507 702 re f",
    "0.43 0.22 0.82 RG",
    "1.6 w",
    "44 76 507 702 re S",
    "0.04 0.07 0.14 rg",
    "44 708 507 70 re f",
    "0.85 0.34 0.92 rg",
    "44 700 507 8 re f",
    "q 54 0 0 54 54 714 cm /I2 Do Q",
    "q 306 0 0 184 64 464 cm /I4 Do Q",
    "0.13 0.08 0.24 rg",
    "64 235 340 84 re f",
    "q 118 0 0 118 386 490 cm /I3 Do Q",
    ...ticketLines
  ].join("\n");

  return buildPdfBlob(content, [backgroundImage, logoImage, qrImage, eventHeroImage]);
}

async function downloadTicketPdf(ticket) {
  const blob = await buildTicketPdf(ticket);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = ticketFileName(ticket.order, ticket.event);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Ticket PDF download started.");
}

function eventSearchText(event) {
  const org = getOrg(event.orgId) || { name: event.sellerEmail || "" };
  return [
    event.title,
    event.category,
    event.venue,
    event.date,
    org.name,
    org.type
  ].join(" ").toLowerCase();
}

function searchedEvents(events) {
  const query = state.searchQuery.trim().toLowerCase();
  if (!query) return events;
  const keywords = query.split(/\s+/).filter(Boolean);
  return events.filter((event) => keywords.every((word) => eventSearchText(event).includes(word)));
}

function syncSearchInputs() {
  if (elements.homeSearch && elements.homeSearch.value !== state.searchQuery) {
    elements.homeSearch.value = state.searchQuery;
  }
  if (elements.buyerSearch && elements.buyerSearch.value !== state.searchQuery) {
    elements.buyerSearch.value = state.searchQuery;
  }
}

function soldCount(event) {
  return Number(event.sold || 0);
}

function remainingTickets(event) {
  return Math.max(Number(event.capacity || 0) - soldCount(event), 0);
}

function eventGross(event) {
  if (Number.isFinite(Number(event.revenueGross)) && Number(event.revenueGross) > 0) {
    return Number(event.revenueGross);
  }
  return Number(event.price || 0) * soldCount(event);
}

function orgTotals(orgId) {
  return state.events
    .filter((event) => event.orgId === orgId)
    .reduce(
      (totals, event) => {
        const gross = eventGross(event);
        const split = splitAmount(gross);
        totals.tickets += soldCount(event);
        totals.gross += gross;
        totals.fee += split.fee;
        totals.orgShare += split.orgShare;
        return totals;
      },
      { tickets: 0, gross: 0, fee: 0, orgShare: 0 }
    );
}

function platformTotals() {
  return state.events.reduce(
    (totals, event) => {
      const gross = eventGross(event);
      const split = splitAmount(gross);
      totals.tickets += soldCount(event);
      totals.gross += gross;
      totals.fee += split.fee;
      totals.orgShare += split.orgShare;
      return totals;
    },
    { tickets: 0, gross: 0, fee: 0, orgShare: 0 }
  );
}

function liveEvents() {
  return state.events.filter((event) => event.status === "live");
}

function moveSlide(direction) {
  const available = liveEvents();
  if (!available.length) return;
  state.activeSlide = (state.activeSlide + direction + available.length) % available.length;
  renderHome();
}

function selectedPaymentMethod() {
  return document.querySelector("input[name='paymentMethod']:checked")?.value || "bKash";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function showAuthMessage(message, tone = "error") {
  elements.authMessage.textContent = message;
  elements.authMessage.dataset.tone = tone;
  elements.authMessage.hidden = false;
  showToast(message);
}

function clearAuthMessage() {
  elements.authMessage.textContent = "";
  elements.authMessage.hidden = true;
  elements.authMessage.dataset.tone = "";
}

function authErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/configuration-not-found": "Enable Firebase Authentication Email/Password provider first.",
    "auth/email-already-in-use": "This email already has an account. Please login.",
    "auth/invalid-credential": "No matching account found or password is incorrect. Please sign up first if you are new.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter a password.",
    "auth/popup-closed-by-user": "Google login was closed before completion.",
    "auth/popup-blocked": "Popup blocked. Please allow popups for this site and try again.",
    "auth/weak-password": "Password should be at least 6 characters."
  };
  return messages[code] || error?.message || "Authentication failed.";
}

async function runButtonAction(button, label, action) {
  const originalText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = label;

  try {
    await action();
  } finally {
    button.textContent = originalText;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

async function loadData() {
  try {
    const admin = isAdminUser();
    const seller = userRole() === "seller";
    const publicOnly = !state.currentUser || userRole() === "buyer";
    const [organizations, events, orders] = await Promise.all([
      getOrganizations({ publicOnly }),
      getEvents({ publicOnly, ownerId: seller ? state.currentUser.uid : "" }),
      getOrders({ userId: state.currentUser?.uid || "", admin })
    ]);

    state.organizations = organizations;
    state.events = events;
    state.orders = orders;
    render();
  } catch (error) {
    showToast(error.message);
  }
}

function render() {
  renderNavigation();
  renderHome();
  renderMetrics();
  renderAdmin();
  renderSeller();
  renderBuyer();
}

function renderNavigation() {
  elements.openLogin.textContent = state.currentUser ? "Logout" : "Sign Up/Login";
  elements.topbar.hidden = state.activePanel !== "home";
  elements.adminAccess.textContent = state.currentUser ? userLabel() : "Admin";
  elements.adminAccess.hidden = !state.currentUser;
  elements.adminAccess.classList.toggle("dark", !state.currentUser);
  elements.adminAccess.classList.toggle("user-badge", Boolean(state.currentUser));
  if (elements.currentPanelName) {
    elements.currentPanelName.textContent = roleLabels[state.activePanel];
  }
  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === state.activePanel);
  });
  elements.panelViews.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panelView === state.activePanel);
  });
}

function renderHome() {
  const available = liveEvents();
  const visibleEvents = searchedEvents(available);
  syncSearchInputs();
  if (state.activeSlide >= visibleEvents.length) {
    state.activeSlide = 0;
  }

  elements.landingEventCount.textContent = `${visibleEvents.length} live`;
  elements.eventSlider.innerHTML = visibleEvents.length
    ? renderEventSlider(visibleEvents)
    : `<p class="empty-state">No event matched your search.</p>`;
  elements.landingEventGrid.innerHTML = visibleEvents.length
    ? visibleEvents.map(renderLandingEventCard).join("")
    : `<p class="empty-state">No live events found. Try another keyword.</p>`;
}

function renderEventSlider(events) {
  const event = events[state.activeSlide] || events[0];
  const org = getOrg(event.orgId) || { name: "Organization" };
  const remaining = remainingTickets(event);
  const dots = events
    .map((item, index) => `
      <button class="slider-dot ${index === state.activeSlide ? "active" : ""}" type="button" data-slide-index="${index}" aria-label="Show ${escapeHtml(item.title)}"></button>
    `)
    .join("");

  return `
    <article class="slider-card"${eventImageVariable(event)}>
      <div class="slider-copy">
        <span class="slider-kicker">${escapeHtml(event.category)}</span>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.venue)} | ${dateLabel(event.date)}</p>
        <div class="slider-meta">
          <strong>${money(event.price)}</strong>
          <span>${escapeHtml(org.name)}</span>
          <span>${remaining} tickets left</span>
        </div>
        <button class="primary-button" type="button" data-action="slider-buy" data-event-id="${escapeHtml(event.id)}">Buy ticket</button>
      </div>
      <div class="slider-visual" aria-hidden="true">
        <span>${escapeHtml(event.category)}</span>
      </div>
      <div class="slider-controls">
        <button class="slider-arrow" type="button" data-slide-action="prev" aria-label="Previous event">&lsaquo;</button>
        <div class="slider-dots">${dots}</div>
        <button class="slider-arrow" type="button" data-slide-action="next" aria-label="Next event">&rsaquo;</button>
      </div>
    </article>
  `;
}

function renderMetrics() {
  const totals = platformTotals();
  elements.metricTickets.textContent = totals.tickets.toLocaleString("en-US");
  elements.metricGross.textContent = money(totals.gross);
  elements.metricOrgShare.textContent = money(totals.orgShare);
  elements.metricFee.textContent = money(totals.fee);
}

function renderAdmin() {
  const pendingOrgs = state.organizations.filter((org) => !org.approved && org.status !== "rejected").length;
  const pendingEvents = state.events.filter((event) => event.status === "review").length;
  const pending = pendingOrgs + pendingEvents;
  elements.pendingOrgCount.textContent = `${pending} pending`;

  elements.adminOrgRows.innerHTML = state.organizations.length
    ? state.organizations
        .map((org) => {
          const status = org.approved ? "approved" : org.status === "rejected" ? "rejected" : "pending";
          const action = org.approved
            ? `
              <div class="button-row">
                <button class="table-button danger" type="button" data-action="reject-org" data-org-id="${escapeHtml(org.id)}">Reject</button>
              </div>
            `
            : status === "rejected"
              ? `
                <div class="button-row">
                  <button class="table-button" type="button" data-action="approve-org" data-org-id="${escapeHtml(org.id)}">Approve again</button>
                  <button class="table-button danger" type="button" data-action="delete-org" data-org-id="${escapeHtml(org.id)}">Delete</button>
                </div>
              `
              : `
                <div class="button-row">
                  <button class="table-button" type="button" data-action="approve-org" data-org-id="${escapeHtml(org.id)}">Approve</button>
                  <button class="table-button danger" type="button" data-action="reject-org" data-org-id="${escapeHtml(org.id)}">Reject</button>
                </div>
              `;
          return `
            <tr>
              <td><strong>${escapeHtml(org.name)}</strong></td>
              <td>${escapeHtml(org.type)}</td>
              <td><span class="status ${status}">${status}</span></td>
              <td>${action}</td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="4" class="muted-cell">No seller organization requests yet. New seller signups will appear here for approval.</td>
      </tr>
    `;

  const managedEvents = state.events.filter((event) => ["review", "live", "paused", "rejected"].includes(event.status));
  elements.adminEventRows.innerHTML = managedEvents.length
    ? managedEvents
        .map((event) => {
          const org = getOrg(event.orgId) || { name: event.sellerEmail || "Seller event" };
          const action = event.status === "review"
            ? `
              <div class="button-row">
                <button class="table-button" type="button" data-action="approve-event" data-event-id="${escapeHtml(event.id)}">Approve</button>
                <button class="table-button danger" type="button" data-action="reject-event" data-event-id="${escapeHtml(event.id)}">Reject</button>
              </div>
            `
            : event.status === "live"
              ? `<button class="table-button secondary" type="button" data-action="pause-event" data-event-id="${escapeHtml(event.id)}">Hide</button>`
              : event.status === "paused"
                ? `
                  <div class="button-row">
                    <button class="table-button" type="button" data-action="approve-event" data-event-id="${escapeHtml(event.id)}">Approve again</button>
                    <button class="table-button danger" type="button" data-action="delete-event" data-event-id="${escapeHtml(event.id)}">Delete</button>
                  </div>
                `
                : `
                  <div class="button-row">
                    <button class="table-button" type="button" data-action="approve-event" data-event-id="${escapeHtml(event.id)}">Restore</button>
                    <button class="table-button danger" type="button" data-action="delete-event" data-event-id="${escapeHtml(event.id)}">Delete</button>
                  </div>
                `;
          return `
            <tr>
              <td><strong>${escapeHtml(event.title)}</strong></td>
              <td>${escapeHtml(org.name)}</td>
              <td>${escapeHtml(event.category)}</td>
              <td>${adminEventStatusMarkup(event)}</td>
              <td>${action}</td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="5" class="muted-cell">No events waiting for review.</td>
      </tr>
    `;

  const eventSales = state.events
    .filter((event) => soldCount(event) > 0)
    .sort((a, b) => eventGross(b) - eventGross(a));
  const salesTotal = platformTotals();
  elements.eventSalesSummary.textContent = `${salesTotal.tickets.toLocaleString("en-US")} tickets | ${money(salesTotal.gross)} gross | ${money(salesTotal.fee)} Tickolas fee`;
  elements.eventSalesRows.innerHTML = eventSales.length
    ? eventSales
        .map((event) => {
          const org = getOrg(event.orgId) || { name: event.sellerEmail || "Seller event" };
          const sold = soldCount(event);
          const gross = eventGross(event);
          const split = splitAmount(gross);
          return `
            <tr>
              <td>
                <strong>${escapeHtml(event.title)}</strong>
                <small class="table-subtext">${escapeHtml(statusLabel(event.status || "review"))} | ${dateLabel(event.date)}</small>
              </td>
              <td>${escapeHtml(org.name)}</td>
              <td><strong>${sold.toLocaleString("en-US")}</strong> / ${Number(event.capacity || 0).toLocaleString("en-US")}</td>
              <td>${money(event.price)}</td>
              <td><strong>${money(gross)}</strong></td>
              <td>${money(split.fee)}</td>
              <td>${money(split.orgShare)}</td>
            </tr>
          `;
        })
        .join("")
    : `
      <tr>
        <td colspan="7" class="muted-cell">No ticket sales yet.</td>
      </tr>
    `;

  const settlementOrgs = state.organizations
    .map((org) => {
      const totals = orgTotals(org.id);
      const pendingPayout = Math.max(totals.orgShare - Number(org.paidOut || 0), 0);
      return { org, totals, pendingPayout };
    })
    .filter(({ totals, pendingPayout, org }) => totals.gross > 0 || pendingPayout > 0 || Number(org.paidOut || 0) > 0);
  elements.settlementRows.innerHTML = settlementOrgs.length
    ? settlementOrgs
        .map(({ org, totals, pendingPayout }) => `
          <tr>
            <td><strong>${escapeHtml(org.name)}</strong></td>
            <td>${money(totals.gross)}</td>
            <td>${money(totals.fee)}</td>
            <td><span class="status ${pendingPayout > 0 ? "live" : "settled"}">${money(pendingPayout)}</span></td>
            <td>
              <button class="table-button" type="button" data-action="settle-org" data-org-id="${escapeHtml(org.id)}" ${pendingPayout > 0 ? "" : "disabled"}>
                ${pendingPayout > 0 ? "Settle payout" : "Settled"}
              </button>
            </td>
          </tr>
        `)
        .join("")
    : `
      <tr>
        <td colspan="5" class="muted-cell">No settlement is pending. After buyers purchase tickets, organization payout rows will appear here.</td>
      </tr>
    `;
}

function renderSeller() {
  const ownEvents = state.events.filter((event) => !state.currentUser || event.createdBy === state.currentUser.uid);
  const hasAcceptedAgreement = sellerAgreementAccepted();

  elements.sellerAgreement.hidden = hasAcceptedAgreement;
  elements.eventForm.hidden = !hasAcceptedAgreement;
  elements.sellerEventList.hidden = !hasAcceptedAgreement;
  elements.serviceScanner.hidden = !hasAcceptedAgreement;
  elements.sellerEventCount.textContent = `${ownEvents.length} events`;
  syncScannerEventOptions(ownEvents);

  elements.sellerEventRows.innerHTML = ownEvents.length
    ? ownEvents.map(renderSellerEvent).join("")
    : `<p class="empty-state">No events created yet.</p>`;
}

function renderSellerEvent(event) {
  const sold = soldCount(event);
  const progress = Math.min(Math.round((sold / Number(event.capacity || 1)) * 100), 100);
  const split = splitAmount(eventGross(event));
  const vouchers = voucherList(event);
  const services = serviceModules(event);
  const editButton = canEditEvent(event)
    ? `<button class="table-button secondary" type="button" data-action="edit-seller-event" data-event-id="${escapeHtml(event.id)}">Edit</button>`
    : "";
  const voucherManager = canEditEvent(event)
    ? `
      <div class="voucher-manager">
        <div class="voucher-manager-head">
          <strong>Vouchers</strong>
          <span>${vouchers.length} active</span>
        </div>
        <form class="voucher-form" data-action="add-voucher" data-event-id="${escapeHtml(event.id)}">
          <input name="code" type="text" required placeholder="Voucher name">
          <input name="discountPercent" type="number" min="1" max="100" required placeholder="% off">
          <button class="table-button" type="submit">Add</button>
        </form>
        <div class="voucher-list">
          ${vouchers.length
            ? vouchers.map((voucher) => `
              <span class="voucher-chip">
                ${escapeHtml(voucher.code)} - ${Number(voucher.discountPercent || 0)}%
                <button type="button" data-action="delete-voucher" data-event-id="${escapeHtml(event.id)}" data-voucher-code="${escapeHtml(voucher.code)}" aria-label="Delete ${escapeHtml(voucher.code)}">x</button>
              </span>
            `).join("")
            : `<small>No voucher yet.</small>`}
        </div>
      </div>
    `
    : "";
  const serviceManager = canEditEvent(event)
    ? `
      <div class="voucher-manager service-manager">
        <div class="voucher-manager-head">
          <strong>Scan modules</strong>
          <span>${services.length} active</span>
        </div>
        <form class="voucher-form" data-action="add-service" data-event-id="${escapeHtml(event.id)}">
          <input name="label" type="text" required placeholder="Entry, T-shirt, Cap, Gift...">
          <button class="table-button" type="submit">Add module</button>
        </form>
        <div class="voucher-list">
          ${services.map((service) => `
            <span class="voucher-chip service-chip">
              ${escapeHtml(service.label)}
              ${service.key === "entry" ? "" : `<button type="button" data-action="delete-service" data-event-id="${escapeHtml(event.id)}" data-service-key="${escapeHtml(service.key)}" aria-label="Delete ${escapeHtml(service.label)}">x</button>`}
            </span>
          `).join("")}
        </div>
      </div>
    `
    : "";
  return `
    <article class="seller-event">
      <div class="seller-event-main">
        <div class="seller-event-thumb"${eventImageStyle(event)}>
          <span>${escapeHtml(event.category)}</span>
        </div>
        <div>
          <h4>${escapeHtml(event.title)}</h4>
          <p>${escapeHtml(event.category)} at ${escapeHtml(event.venue)} on ${dateLabel(event.date)}</p>
          <p>${sold}/${event.capacity} sold | ${money(event.price)} per ticket | ${money(split.orgShare)} organization share</p>
        </div>
      </div>
      <div class="seller-event-side">
        <span class="status ${event.status}">${statusLabel(event.status)}</span>
        <div class="progress-bar" aria-label="${progress}% sold">
          <span style="width: ${progress}%"></span>
        </div>
        ${editButton}
      </div>
      ${voucherManager}
      ${serviceManager}
    </article>
  `;
}

function resetEventForm() {
  state.editingEventId = "";
  state.editingImageUrl = "";
  elements.eventForm.reset();
  elements.eventFormTitle.textContent = "Create event";
  elements.eventFormHint.textContent = "New events go to review first";
  elements.eventSubmitButton.textContent = "Publish event";
  elements.cancelEventEdit.hidden = true;
}

function serviceLabel(service) {
  const event = getEvent(elements.scannerEvent.value);
  return serviceModules(event).find((item) => item.key === service)?.label || "Service";
}

function setScannerResult(message, tone = "idle") {
  elements.scannerResult.textContent = message;
  elements.scannerResult.dataset.tone = tone;
}

function syncScannerEventOptions(ownEvents) {
  const current = elements.scannerEvent.value;
  elements.scannerEvent.innerHTML = ownEvents.length
    ? ownEvents.map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.title)} - ${statusLabel(event.status)}</option>`).join("")
    : `<option value="">No seller event available</option>`;

  if (ownEvents.some((event) => event.id === current)) {
    elements.scannerEvent.value = current;
  }

  renderScannerServiceOptions();
}

function renderScannerServiceOptions() {
  const event = getEvent(elements.scannerEvent.value);
  const services = serviceModules(event);
  if (!services.some((service) => service.key === state.scannerService)) {
    state.scannerService = services[0]?.key || "entry";
  }

  elements.serviceToggleGrid.innerHTML = services.map((service) => `
    <button class="service-toggle ${service.key === state.scannerService ? "active" : ""}" type="button" data-service="${escapeHtml(service.key)}">
      ${escapeHtml(service.label)}
    </button>
  `).join("");
}

async function processTicketScan(ticketCode) {
  if (state.scannerBusy) return;
  const eventId = elements.scannerEvent.value;
  const code = String(ticketCode || "").trim();
  if (!eventId) {
    setScannerResult("Select an event first.", "error");
    return;
  }
  if (!code) {
    setScannerResult("Scan or paste a ticket QR first.", "error");
    return;
  }

  state.scannerBusy = true;
  const service = state.scannerService;
  setScannerResult(`Checking ${serviceLabel(service)} ticket...`, "idle");
  try {
    const result = await scanTicketService({ eventId, service, ticketCode: code });
    setScannerResult(
      `${serviceLabel(result.service)} confirmed for ${result.buyerName} (${result.quantity} ticket${Number(result.quantity) > 1 ? "s" : ""}).`,
      "success"
    );
    elements.scannerCode.value = "";
    await loadData();
  } catch (error) {
    const details = error.details || {};
    if (details.alreadyServed) {
      const usedAt = details.usedAt ? new Date(details.usedAt).toLocaleString("en-GB") : "earlier";
      setScannerResult(`${serviceLabel(details.service)} already served for ${details.buyerName} at ${usedAt}.`, "error");
    } else {
      setScannerResult(error.message || "Ticket scan failed.", "error");
    }
  } finally {
    state.scannerBusy = false;
  }
}

function stopQrScanner() {
  window.cancelAnimationFrame(state.scannerFrame);
  state.scannerFrame = 0;
  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach((track) => track.stop());
  }
  state.scannerStream = null;
  elements.scannerVideo.hidden = true;
  elements.stopScannerButton.hidden = true;
  elements.startScannerButton.hidden = false;
  elements.scannerPlaceholder.hidden = false;
}

async function startQrScanner() {
  const hasNativeDetector = "BarcodeDetector" in window;
  const hasJsQr = typeof window.jsQR === "function";
  if (!hasNativeDetector && !hasJsQr) {
    setScannerResult("QR scanner library is not loaded. Paste the QR link manually.", "error");
    return;
  }

  try {
    const detector = hasNativeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    state.scannerStream = stream;
    elements.scannerVideo.srcObject = stream;
    elements.scannerVideo.hidden = false;
    elements.scannerPlaceholder.hidden = true;
    elements.startScannerButton.hidden = true;
    elements.stopScannerButton.hidden = false;
    await elements.scannerVideo.play();
    setScannerResult("Camera ready. Place the ticket QR inside the frame.", "idle");

    const scanFrame = async () => {
      if (!state.scannerStream) return;
      try {
        let value = "";
        if (detector) {
          const codes = await detector.detect(elements.scannerVideo);
          value = codes[0]?.rawValue || "";
        } else if (context && elements.scannerVideo.readyState >= 2) {
          canvas.width = elements.scannerVideo.videoWidth;
          canvas.height = elements.scannerVideo.videoHeight;
          context.drawImage(elements.scannerVideo, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          value = window.jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" })?.data || "";
        }
        if (value && !state.scannerBusy) {
          elements.scannerCode.value = value;
          await processTicketScan(value);
        }
      } catch {
        // Keep scanning; some frames are unreadable while the camera focuses.
      }
      state.scannerFrame = window.requestAnimationFrame(scanFrame);
    };
    state.scannerFrame = window.requestAnimationFrame(scanFrame);
  } catch (error) {
    stopQrScanner();
    setScannerResult(error.message || "Could not open camera.", "error");
  }
}

function startEventEdit(eventId) {
  if (!sellerAgreementAccepted()) {
    showToast("Please accept the seller agreement first.");
    elements.sellerAgreement.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const event = getEvent(eventId);
  if (!event || !canEditEvent(event)) {
    showToast("You can edit only your own events.");
    return;
  }

  state.editingEventId = event.id;
  state.editingImageUrl = event.imageUrl || "";
  elements.eventForm.elements.title.value = event.title || "";
  elements.eventForm.elements.category.value = event.category || "Conference";
  elements.eventForm.elements.venue.value = event.venue || "";
  elements.eventForm.elements.details.value = event.details || "";
  elements.eventForm.elements.imageUrl.value = cleanImageUrl(event.imageUrl) || "";
  elements.eventForm.elements.imageFile.value = "";
  elements.eventForm.elements.date.value = dateLabel(event.date);
  elements.eventForm.elements.price.value = event.price || "";
  elements.eventForm.elements.capacity.value = event.capacity || "";
  elements.eventFormTitle.textContent = "Edit event";
  elements.eventFormHint.textContent = "Edited events go back to admin review before buyers see updates";
  elements.eventSubmitButton.textContent = "Save changes";
  elements.cancelEventEdit.hidden = false;
  elements.eventForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderBuyer() {
  syncSearchInputs();
  elements.filterPills.forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.activeFilter);
  });

  const available = liveEvents();
  const searched = searchedEvents(available);
  const filtered = state.activeFilter === "All"
    ? searched
    : searched.filter((event) => event.category === state.activeFilter);

  if (!filtered.some((event) => event.id === state.selectedEventId)) {
    state.selectedEventId = filtered[0]?.id || "";
  }

  elements.checkoutEvent.innerHTML = filtered
    .map((event) => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.title)} - ${money(event.price)}</option>`)
    .join("");
  elements.checkoutEvent.value = state.selectedEventId;

  elements.buyerEventGrid.innerHTML = filtered.length
    ? filtered.map(renderEventCard).join("")
    : `<p class="empty-state">No live events found.</p>`;

  renderCheckout();
}

function renderEventCard(event) {
  const org = getOrg(event.orgId) || { name: "Organization" };
  const remaining = remainingTickets(event);
  const detailPreview = String(event.details || "").trim();
  return `
    <article class="event-card">
      <div class="event-art"${eventImageStyle(event)}>
        <span>${escapeHtml(event.category)}</span>
      </div>
      <div class="event-card-body">
        <span class="status live">${escapeHtml(event.category)}</span>
        <h3>${escapeHtml(event.title)}</h3>
        ${detailPreview ? `<p class="event-card-details">${escapeHtml(detailPreview.slice(0, 130))}${detailPreview.length > 130 ? "..." : ""}</p>` : ""}
        <div class="event-meta">
          <span>${dateLabel(event.date)}</span>
          <span>${escapeHtml(event.venue)}</span>
          <span>${escapeHtml(org.name)}</span>
          <span>${remaining} tickets left</span>
        </div>
        <div class="event-price-row">
          <strong>${money(event.price)}</strong>
          <button class="select-event" type="button" data-action="select-event" data-event-id="${escapeHtml(event.id)}">Select</button>
        </div>
      </div>
    </article>
  `;
}

function renderLandingEventCard(event) {
  const org = getOrg(event.orgId) || { name: "Organization" };
  const remaining = remainingTickets(event);
  const detailPreview = String(event.details || "").trim();
  return `
    <article class="landing-event-card" data-action="landing-buy" data-event-id="${escapeHtml(event.id)}" tabindex="0" role="button" aria-label="Buy ticket for ${escapeHtml(event.title)}">
      <div class="landing-event-media"${eventImageStyle(event)}>
        <span>${escapeHtml(event.category)}</span>
      </div>
      <div class="landing-event-body">
        <div class="event-card-topline">
          <span>${dateLabel(event.date)}</span>
          <strong>${money(event.price)}</strong>
        </div>
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.venue)}</p>
        ${detailPreview ? `<p>${escapeHtml(detailPreview.slice(0, 120))}${detailPreview.length > 120 ? "..." : ""}</p>` : ""}
        <p>${escapeHtml(org.name)} | ${remaining} tickets left</p>
        <button class="primary-button" type="button" data-action="landing-buy" data-event-id="${escapeHtml(event.id)}">Buy ticket</button>
      </div>
    </article>
  `;
}

function openEventDetailsModal(eventId) {
  const event = state.events.find((item) => item.id === eventId);
  if (!event) {
    showToast("Event not found.");
    return;
  }

  const org = getOrg(event.orgId) || { name: event.sellerEmail || "Organization", type: "Seller event" };
  const sold = soldCount(event);
  const gross = eventGross(event);
  const split = splitAmount(gross);
  const imageStyle = eventImageStyle(event);

  elements.eventDetailsBody.innerHTML = `
    <div class="event-details-header">
      <div>
        <p class="eyebrow">Event details</p>
        <h2 id="eventDetailsTitle">${escapeHtml(event.title)}</h2>
      </div>
      <span class="status ${escapeHtml(event.status || "review")}">${escapeHtml(statusLabel(event.status || "review"))}</span>
    </div>
    <div class="event-details-image"${imageStyle}>
      <span>${escapeHtml(event.category || "Event")}</span>
    </div>
    <dl class="event-details-grid">
      <div><dt>Organization</dt><dd>${escapeHtml(org.name)}</dd></div>
      <div><dt>Seller email</dt><dd>${escapeHtml(event.sellerEmail || org.email || "Not provided")}</dd></div>
      <div><dt>Category</dt><dd>${escapeHtml(event.category)}</dd></div>
      <div><dt>Venue</dt><dd>${escapeHtml(event.venue)}</dd></div>
      <div><dt>Date</dt><dd>${dateLabel(event.date)}</dd></div>
      <div><dt>Ticket price</dt><dd>${money(event.price)}</dd></div>
      <div><dt>Capacity</dt><dd>${Number(event.capacity || 0).toLocaleString("en-US")}</dd></div>
      <div><dt>Sold</dt><dd>${sold.toLocaleString("en-US")}</dd></div>
      <div><dt>Gross sales</dt><dd>${money(gross)}</dd></div>
      <div><dt>Tickolas fee</dt><dd>${money(split.fee)}</dd></div>
      <div><dt>Organization payout</dt><dd>${money(split.orgShare)}</dd></div>
      <div><dt>Event ID</dt><dd>${escapeHtml(event.id)}</dd></div>
      <div class="event-details-full"><dt>Event details</dt><dd>${escapeHtml(event.details || "No extra event details provided.")}</dd></div>
    </dl>
  `;
  elements.eventDetailsModal.hidden = false;
  pushModalHistory();
  syncModalState();
}

function closeEventDetailsModal() {
  elements.eventDetailsModal.hidden = true;
  syncModalState();
}

function openAuthChoice() {
  showPageLoader("login", 560);
  state.pendingBuyerEventId = "";
  state.authRole = "buyer";
  state.authMode = "login";
  clearAuthMessage();
  elements.authChoice.hidden = false;
  elements.authForm.hidden = true;
  elements.authModal.hidden = false;
  pushModalHistory();
  syncModalState();
}

function openAuthForm(role) {
  showPageLoader("login", 560);
  state.authRole = role;
  elements.authModal.hidden = false;
  pushModalHistory();
  syncModalState();
  elements.authChoice.hidden = true;
  elements.authForm.hidden = false;
  elements.authRoleLabel.textContent = role === "admin" ? "Admin access" : role === "buyer" ? "Buyer access" : "Seller access";
  resetAuthInputs();
  setAuthMode(role === "admin" ? "login" : "login");
  elements.authIdentifier.focus();
}

function startBuyerFlow(eventId) {
  state.selectedEventId = eventId;
  state.pendingBuyerEventId = eventId;
  if (!state.currentUser) {
    openAuthForm("buyer");
    return;
  }
  changePanel("buyer");
  openEventPreviewModal(eventId);
}

function closeAuthModal(clearPendingBuyerEvent = true) {
  if (clearPendingBuyerEvent) {
    state.pendingBuyerEventId = "";
  }
  elements.authModal.hidden = true;
  syncModalState();
}

function clearReceiptOutput() {
  state.lastTicket = null;
  elements.receiptOutput.innerHTML = "";
  elements.receiptOutput.classList.remove("show");
}

function openCheckoutModal({ keepReceipt = false } = {}) {
  closeEventPreviewModal(false);
  if (!keepReceipt) {
    clearReceiptOutput();
  }
  elements.buyerEmail.value = loggedInEmail();
  elements.checkoutPanel.hidden = false;
  elements.checkoutBackdrop.hidden = false;
  pushModalHistory();
  syncModalState();
  elements.buyerName.focus();
}

function closeCheckoutModal() {
  elements.checkoutPanel.hidden = true;
  elements.checkoutBackdrop.hidden = true;
  syncModalState();
}

function openEventPreviewModal(eventId = state.selectedEventId) {
  const event = getEvent(eventId);
  if (!event) {
    showToast("Event not found.");
    return;
  }

  clearReceiptOutput();
  state.selectedEventId = event.id;
  const org = getOrg(event.orgId) || { name: event.sellerEmail || "Organization" };
  const remaining = remainingTickets(event);
  elements.eventPreviewBody.innerHTML = `
    <div class="event-preview-hero"${eventImageStyle(event)}>
      <span>${escapeHtml(event.category)}</span>
    </div>
    <div class="event-preview-content">
      <div>
        <p class="eyebrow">${escapeHtml(event.category)}</p>
        <h2>${escapeHtml(event.title)}</h2>
      </div>
      <dl class="event-preview-facts">
        <div><dt>Date</dt><dd>${dateLabel(event.date)}</dd></div>
        <div><dt>Venue</dt><dd>${escapeHtml(event.venue)}</dd></div>
        <div><dt>Organizer</dt><dd>${escapeHtml(org.name)}</dd></div>
        <div><dt>Ticket price</dt><dd>${money(event.price)}</dd></div>
        <div><dt>Available</dt><dd>${remaining} tickets left</dd></div>
      </dl>
      <div class="event-preview-details">
        <strong>Event details</strong>
        <p>${escapeHtml(event.details || "No extra details provided by the seller yet.")}</p>
      </div>
      <button class="primary-button event-preview-confirm" type="button" data-action="confirm-event-checkout">Confirm and continue</button>
    </div>
  `;
  elements.checkoutPanel.hidden = true;
  elements.eventPreviewPanel.hidden = false;
  elements.checkoutBackdrop.hidden = false;
  pushModalHistory();
  syncModalState();
}

function closeEventPreviewModal(hideBackdrop = true) {
  elements.eventPreviewPanel.hidden = true;
  if (hideBackdrop && elements.checkoutPanel.hidden) {
    elements.checkoutBackdrop.hidden = true;
  }
  syncModalState();
}

function continuePendingBuyerEvent() {
  if (state.currentProfile?.role !== "buyer") return;
  const eventId = state.pendingBuyerEventId;
  if (!eventId) return;
  state.pendingBuyerEventId = "";
  state.selectedEventId = eventId;
  changePanel("buyer");
  window.setTimeout(() => openEventPreviewModal(eventId), 80);
}

function resetPasswordVisibility() {
  elements.passwordToggles.forEach((button) => {
    const input = document.querySelector(`#${button.dataset.target}`);
    if (!input) return;
    input.type = "password";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", button.dataset.target === "authConfirmPassword" ? "Show confirm password" : "Show password");
  });
}

function resetAuthInputs() {
  elements.authIdentifier.value = "";
  elements.authPassword.value = "";
  elements.authConfirmPassword.value = "";
  elements.authConfirmPassword.setCustomValidity("");
  resetPasswordVisibility();
  clearAuthMessage();
}

function setAuthMode(mode) {
  state.authMode = mode;
  clearAuthMessage();
  const isSignup = state.authMode === "signup" && state.authRole !== "admin";
  elements.authForm.dataset.mode = state.authMode;
  elements.authFormTitle.textContent = isSignup ? "Sign up" : "Login";
  elements.authSubmit.textContent = isSignup ? "Create account" : "Login";
  elements.authSwitchPrompt.textContent = isSignup ? "Already have an account?" : "New here?";
  elements.authSwitch.textContent = isSignup ? "Login" : "Sign up";
  elements.authSwitch.disabled = state.authRole === "admin";
  elements.authSwitch.parentElement.hidden = state.authRole === "admin";
  elements.authConfirmWrap.hidden = !isSignup;
  elements.authConfirmPassword.required = isSignup;
  elements.authConfirmPassword.disabled = !isSignup;
  elements.authConfirmPassword.value = "";
  elements.authConfirmPassword.setCustomValidity("");
}

function toggleAuthMode() {
  if (state.authRole === "admin") return;
  resetAuthInputs();
  setAuthMode(state.authMode === "login" ? "signup" : "login");
}

async function completeAuthFlow() {
  const isSignup = elements.authForm.dataset.mode === "signup";
  if (isSignup && elements.authPassword.value !== elements.authConfirmPassword.value) {
    elements.authConfirmPassword.setCustomValidity("Password does not match.");
    elements.authConfirmPassword.reportValidity();
    showAuthMessage("Password and confirm password do not match.");
    return;
  }

  elements.authConfirmPassword.setCustomValidity("");
  const email = elements.authIdentifier.value.trim();
  const password = elements.authPassword.value;
  if (!email.includes("@")) {
    showAuthMessage("Please enter a valid email address.");
    return;
  }

  if (isSignup) {
    const user = await registerUser({ email, password, role: state.authRole });
    const profile = await getUserProfile(user.uid);
    state.currentUser = user;
    state.currentProfile = profile;
    routeToProfile(profile);
    showToast("Account created. You are logged in.");
  } else {
    const user = await loginUser({ email, password });
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      await logoutUser();
      showAuthMessage("No Tickolas account found. Please sign up first.");
      return;
    }
    if (profile?.role !== "admin") {
      if (state.authRole === "admin") {
        await logoutUser();
        showAuthMessage("This account is not an admin.");
        return;
      }
      if (profile?.role !== state.authRole) {
        await logoutUser();
        showAuthMessage(`This is a ${accessLabels[profile?.role] || "different"} account. Please login with a ${accessLabels[state.authRole]} account.`);
        return;
      }
    }
    state.currentUser = user;
    state.currentProfile = profile;
    routeToProfile(profile);
    showToast(profile?.role === "admin" ? "Admin login successful." : "Login successful.");
  }

  closeAuthModal(false);
  await loadData();
  continuePendingBuyerEvent();
}

async function completeGoogleAuthFlow() {
  const user = await loginWithGoogle();
  let profile = await getUserProfile(user.uid);

  if (!profile) {
    if (state.authRole === "admin") {
      await logoutUser();
      showAuthMessage("This Google account is not an admin.");
      return;
    }
    profile = await ensureUserProfile(user, state.authRole);
  }

  if (profile?.role !== "admin") {
    if (state.authRole === "admin") {
      await logoutUser();
      showAuthMessage("This Google account is not an admin.");
      return;
    }
    if (profile?.role !== state.authRole) {
      await logoutUser();
      showAuthMessage(`This is a ${accessLabels[profile?.role] || "different"} account. Please continue with a ${accessLabels[state.authRole]} account.`);
      return;
    }
  }

  state.currentUser = user;
  state.currentProfile = profile;
  routeToProfile(profile);
  closeAuthModal(false);
  showToast(profile?.role === "admin" ? "Admin login successful." : "Google login successful.");
  await loadData();
  continuePendingBuyerEvent();
}

function validateConfirmPassword() {
  const isSignup = elements.authForm.dataset.mode === "signup";
  if (!isSignup) {
    elements.authConfirmPassword.setCustomValidity("");
    return;
  }

  const mismatch = elements.authPassword.value !== elements.authConfirmPassword.value;
  elements.authConfirmPassword.setCustomValidity(mismatch ? "Password does not match." : "");
}

function renderCheckout() {
  const event = getEvent(state.selectedEventId);
  const quantity = Math.max(Number(elements.ticketQuantity.value) || 1, 1);
  const paymentMethod = selectedPaymentMethod();
  const voucherCode = elements.voucherCode.value;
  elements.buyerEmail.value = loggedInEmail();

  if (!event) {
    elements.selectedEventStatus.textContent = "No event";
    elements.checkoutGross.textContent = money(0);
    elements.checkoutDiscount.textContent = money(0);
    elements.voucherMessage.textContent = "";
    elements.checkoutPaymentMethod.textContent = paymentMethod;
    return;
  }

  const remaining = remainingTickets(event);
  const pricing = checkoutPricing(event, quantity, voucherCode);
  elements.selectedEventStatus.textContent = `${remaining} left`;
  elements.checkoutGross.textContent = money(pricing.total);
  elements.checkoutDiscount.textContent = pricing.discount > 0 ? `- ${money(pricing.discount)}` : money(0);
  elements.voucherMessage.textContent = voucherCode.trim()
    ? pricing.voucher
      ? `${pricing.discountPercent}% discount applied.`
      : "No matching voucher for this event."
    : "";
  elements.voucherMessage.dataset.tone = pricing.voucher ? "success" : "error";
  elements.checkoutPaymentMethod.textContent = paymentMethod;
}

elements.navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    changePanel(button.dataset.panel);
  });
});

elements.homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  changePanel("home");
});

elements.themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

elements.adminAccess.addEventListener("click", () => {
  if (state.currentUser) {
    if (state.currentProfile?.role) {
      routeToProfile(state.currentProfile);
      render();
      return;
    }
    showToast("User profile is missing. Please login again.");
    return;
  }
  openAuthForm("admin");
});

elements.openLogin.addEventListener("click", async () => {
  if (state.currentUser) {
    stopQrScanner();
    state.pendingBuyerEventId = "";
    state.selectedEventId = "";
    closeEventPreviewModal();
    closeCheckoutModal();
    await logoutUser();
    showToast("Logged out.");
    return;
  }
  openAuthChoice();
});

elements.closeAuth.addEventListener("click", closeAuthModal);
elements.closeEventDetails.addEventListener("click", closeEventDetailsModal);

elements.eventDetailsModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-event-details]")) {
    closeEventDetailsModal();
  }
});

elements.authModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-auth]")) {
    closeAuthModal();
  }
});

elements.authChoice.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-role]");
  if (!button) return;
  openAuthForm(button.dataset.authRole);
});

elements.authSwitch.addEventListener("click", toggleAuthMode);
elements.authPassword.addEventListener("input", validateConfirmPassword);
elements.authConfirmPassword.addEventListener("input", validateConfirmPassword);
elements.authSubmit.addEventListener("pointerdown", () => {
  validateConfirmPassword();
  if (!elements.authForm.checkValidity()) return;
  showPageLoader("login", 0);
});
elements.authGoogle.addEventListener("click", async () => {
  clearAuthMessage();
  showPageLoader("login", 0);
  try {
    await runButtonAction(elements.authGoogle, "Opening Google...", completeGoogleAuthFlow);
  } catch (error) {
    showAuthMessage(authErrorMessage(error));
  } finally {
    hidePageLoader();
  }
});
elements.passwordToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.target}`);
    if (!input) return;
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    button.setAttribute("aria-pressed", String(willShow));
    button.setAttribute("aria-label", `${willShow ? "Hide" : "Show"} ${button.dataset.target === "authConfirmPassword" ? "confirm password" : "password"}`);
    input.focus();
  });
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  validateConfirmPassword();
  if (!elements.authForm.checkValidity()) {
    hidePageLoader();
    elements.authForm.reportValidity();
    return;
  }
  showPageLoader("login", 0);
  await waitForNextPaint();
  try {
    await completeAuthFlow();
  } catch (error) {
    showAuthMessage(authErrorMessage(error));
  } finally {
    hidePageLoader();
  }
});

elements.cancelEventEdit.addEventListener("click", resetEventForm);

elements.agreeSellerTerms.addEventListener("click", acceptSellerAgreement);

elements.sellerEventRows.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-action='edit-seller-event']");
  if (editButton) {
    startEventEdit(editButton.dataset.eventId);
    return;
  }

  const deleteServiceButton = event.target.closest("[data-action='delete-service']");
  if (deleteServiceButton) {
    const serviceEvent = getEvent(deleteServiceButton.dataset.eventId);
    if (!serviceEvent || !canEditEvent(serviceEvent)) {
      showToast("You can manage only your own scan modules.");
      return;
    }

    const nextServices = serviceModules(serviceEvent).filter((service) => service.key !== deleteServiceButton.dataset.serviceKey);
    try {
      await runButtonAction(deleteServiceButton, "...", async () => {
        await updateEventServices(serviceEvent.id, nextServices);
        showToast("Scan module deleted.");
        await loadData();
      });
    } catch (error) {
      showToast(error.message || "Scan module delete failed.");
    }
    return;
  }

  const deleteButton = event.target.closest("[data-action='delete-voucher']");
  if (!deleteButton) return;
  const voucherEvent = getEvent(deleteButton.dataset.eventId);
  if (!voucherEvent || !canEditEvent(voucherEvent)) {
    showToast("You can manage only your own vouchers.");
    return;
  }

  const nextVouchers = voucherList(voucherEvent).filter((voucher) => normalizeVoucherCode(voucher.code) !== normalizeVoucherCode(deleteButton.dataset.voucherCode));
  try {
    await runButtonAction(deleteButton, "...", async () => {
      await updateEventVouchers(voucherEvent.id, nextVouchers);
      showToast("Voucher deleted.");
      await loadData();
    });
  } catch (error) {
    showToast(error.message || "Voucher delete failed.");
  }
});

elements.sellerEventRows.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-action='add-voucher']");
  const serviceForm = event.target.closest("[data-action='add-service']");
  if (!form && !serviceForm) return;
  event.preventDefault();

  if (serviceForm) {
    const serviceEvent = getEvent(serviceForm.dataset.eventId);
    if (!serviceEvent || !canEditEvent(serviceEvent)) {
      showToast("You can manage only your own scan modules.");
      return;
    }

    const label = String(new FormData(serviceForm).get("label") || "").trim().slice(0, 32);
    const key = serviceKeyFromLabel(label);
    if (!key || !label) {
      showToast("Module name is required.");
      return;
    }

    const existing = serviceModules(serviceEvent).filter((service) => service.key !== key);
    const nextServices = [...existing, { key, label }].sort((a, b) => a.label.localeCompare(b.label));
    const submitButton = serviceForm.querySelector("button[type='submit']");
    try {
      await runButtonAction(submitButton, "Adding...", async () => {
        await updateEventServices(serviceEvent.id, nextServices);
        serviceForm.reset();
        showToast("Scan module saved.");
        await loadData();
      });
    } catch (error) {
      showToast(error.message || "Scan module save failed.");
    }
    return;
  }

  const voucherEvent = getEvent(form.dataset.eventId);
  if (!voucherEvent || !canEditEvent(voucherEvent)) {
    showToast("You can manage only your own vouchers.");
    return;
  }

  const code = form.elements.code.value.trim();
  const discountPercent = Math.min(Math.max(Number(form.elements.discountPercent.value) || 0, 1), 100);
  if (!code) {
    showToast("Voucher name is required.");
    return;
  }

  const existing = voucherList(voucherEvent).filter((voucher) => normalizeVoucherCode(voucher.code) !== normalizeVoucherCode(code));
  const nextVouchers = [...existing, { code, discountPercent }].sort((a, b) => a.code.localeCompare(b.code));
  const submitButton = form.querySelector("button[type='submit']");
  try {
    await runButtonAction(submitButton, "Adding...", async () => {
      await updateEventVouchers(voucherEvent.id, nextVouchers);
      form.reset();
      showToast("Voucher saved.");
      await loadData();
    });
  } catch (error) {
    showToast(error.message || "Voucher save failed.");
  }
});

elements.serviceToggleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-service]");
  if (!button) return;
  state.scannerService = button.dataset.service;
  elements.serviceToggleGrid.querySelectorAll("[data-service]").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  setScannerResult(`${serviceLabel(state.scannerService)} module selected.`, "idle");
});

elements.scannerEvent.addEventListener("change", () => {
  renderScannerServiceOptions();
  setScannerResult(`${serviceLabel(state.scannerService)} module selected.`, "idle");
});

elements.scanManualButton.addEventListener("click", async () => {
  await runButtonAction(elements.scanManualButton, "Checking...", async () => {
    await processTicketScan(elements.scannerCode.value);
  });
});

elements.scannerCode.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  await processTicketScan(elements.scannerCode.value);
});

elements.startScannerButton.addEventListener("click", startQrScanner);
elements.stopScannerButton.addEventListener("click", stopQrScanner);

elements.eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireSignedIn("Please login as seller first.")) return;
  if (userRole() !== "seller") {
    showToast("Seller account required.");
    return;
  }
  if (!sellerAgreementAccepted()) {
    showToast("Please accept the seller agreement first.");
    elements.sellerAgreement.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const form = event.currentTarget;
  try {
    const formData = new FormData(form);
    const title = String(formData.get("title")).trim();
    const date = parseBangladeshDate(formData.get("date"));

    if (!date) {
      showToast("Use date format dd/mm/yyyy.");
      return;
    }

    const eventData = {
      orgId: `seller-${state.currentUser.uid}`,
      sellerEmail: state.currentUser.email || state.currentProfile?.email || "",
      title,
      category: String(formData.get("category")),
      venue: String(formData.get("venue")).trim(),
      details: String(formData.get("details") || "").trim().slice(0, 900),
      imageUrl: await eventImageFromForm(formData),
      date,
      price: Number(formData.get("price")),
      capacity: Number(formData.get("capacity")),
      serviceModules: state.editingEventId ? serviceModules(getEvent(state.editingEventId)) : defaultServiceModules,
      createdBy: state.currentUser.uid
    };

    if (state.editingEventId) {
      await updateEvent(state.editingEventId, eventData);
      showToast("Event updated and sent for admin review.");
    } else {
      await createEvent({
        id: createSlugId("evt", title),
        ...eventData
      });
      showToast("Event submitted for admin review.");
    }

    resetEventForm();
    await loadData();
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminOrgRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  await runButtonAction(button, "Working...", async () => {
    if (button.dataset.action === "approve-org") {
      await approveOrganization(button.dataset.orgId);
      showToast("Organization approved.");
    }

    if (button.dataset.action === "reject-org") {
      await rejectOrganization(button.dataset.orgId);
      showToast("Organization rejected. Its events are hidden from buyers.");
    }

    if (button.dataset.action === "delete-org") {
      await deleteOrganization(button.dataset.orgId);
      showToast("Rejected organization and its events deleted permanently.");
    }

    await loadData();
  });
});

elements.adminEventRows.addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-action='view-event-details']");
  if (detailButton) {
    openEventDetailsModal(detailButton.dataset.eventId);
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;

  await runButtonAction(button, "Working...", async () => {
    if (button.dataset.action === "approve-event") {
      await approveEvent(button.dataset.eventId);
      showToast("Event approved and visible to buyers.");
    }

    if (button.dataset.action === "reject-event") {
      await rejectEvent(button.dataset.eventId);
      showToast("Event rejected and hidden from buyers.");
    }

    if (button.dataset.action === "pause-event") {
      await pauseEvent(button.dataset.eventId);
      showToast("Event hidden from buyers.");
    }

    if (button.dataset.action === "delete-event") {
      await deleteEvent(button.dataset.eventId);
      showToast("Rejected event deleted permanently.");
    }

    await loadData();
  });
});

elements.settlementRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='settle-org']");
  if (!button) return;
  await runButtonAction(button, "Working...", async () => {
    const orgId = button.dataset.orgId;
    const org = getOrg(orgId);
    const totals = orgTotals(orgId);
    await settleOrganization(orgId, Number(org.paidOut || 0) + Math.max(totals.orgShare - Number(org.paidOut || 0), 0));
    showToast("Payout marked as settled.");
    await loadData();
  });
});

elements.filterPills.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeFilter = button.dataset.filter;
    renderBuyer();
  });
});

function updateSearchQuery(value) {
  state.searchQuery = value.trimStart();
  state.activeSlide = 0;
  renderHome();
  renderBuyer();
}

elements.homeSearch.addEventListener("input", (event) => updateSearchQuery(event.target.value));
elements.buyerSearch.addEventListener("input", (event) => updateSearchQuery(event.target.value));

elements.buyerEventGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='select-event']");
  if (!button) return;
  startBuyerFlow(button.dataset.eventId);
});

elements.landingEventGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='landing-buy']");
  if (!button) return;
  startBuyerFlow(button.dataset.eventId);
});

elements.landingEventGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest("[data-action='landing-buy']");
  if (!card) return;
  event.preventDefault();
  startBuyerFlow(card.dataset.eventId);
});

elements.eventSlider.addEventListener("click", (event) => {
  const arrow = event.target.closest("[data-slide-action]");
  if (arrow) {
    moveSlide(arrow.dataset.slideAction === "next" ? 1 : -1);
    return;
  }

  const dot = event.target.closest("[data-slide-index]");
  if (dot) {
    state.activeSlide = Number(dot.dataset.slideIndex);
    renderHome();
    return;
  }

  const buyButton = event.target.closest("[data-action='slider-buy']");
  if (!buyButton) return;
  startBuyerFlow(buyButton.dataset.eventId);
});

elements.checkoutEvent.addEventListener("change", (event) => {
  state.selectedEventId = event.target.value;
  clearReceiptOutput();
  renderBuyer();
});

elements.closeCheckout.addEventListener("click", closeCheckoutModal);
elements.closeEventPreview.addEventListener("click", () => closeEventPreviewModal());
elements.eventPreviewPanel.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='confirm-event-checkout']");
  if (!button) return;
  openCheckoutModal();
});
elements.checkoutBackdrop.addEventListener("click", () => {
  closeEventPreviewModal(false);
  closeCheckoutModal();
});
elements.ticketQuantity.addEventListener("input", renderCheckout);
elements.voucherCode.addEventListener("input", renderCheckout);
elements.paymentMethods.forEach((input) => input.addEventListener("change", renderCheckout));

elements.checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireSignedIn("Please login before buying tickets.")) return;
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  try {
    await runButtonAction(submitButton, "Buying...", async () => {
      const ticketEvent = getEvent(state.selectedEventId);
      const ticketOrg = getOrg(ticketEvent?.orgId) || { name: ticketEvent?.sellerEmail || "Organization" };
      const order = await createOrder(
        {
          eventId: state.selectedEventId,
          userId: state.currentUser.uid,
          buyerName: elements.buyerName.value.trim(),
          buyerEmail: loggedInEmail(),
          quantity: Number(elements.ticketQuantity.value),
          voucherCode: elements.voucherCode.value.trim(),
          paymentMethod: selectedPaymentMethod()
        },
        splitAmount
      );

      state.lastTicket = {
        order,
        event: ticketEvent,
        org: ticketOrg
      };
      const qrPreview = qrJpegImage(ticketQrPayload(order, ticketEvent), 6, 4);
      const verifyUrl = ticketVerifyUrl(order, ticketEvent);
      elements.receiptOutput.innerHTML = `
        <strong>Ticket confirmed: ${escapeHtml(order.id)}</strong>
        <p>${order.quantity} ticket${order.quantity > 1 ? "s" : ""} purchased by ${escapeHtml(order.buyerName)}.</p>
        ${order.voucherCode ? `<p>Voucher ${escapeHtml(order.voucherCode)} saved ${money(order.discount || 0)}.</p>` : ""}
        <p>Total paid ${money(order.gross)} by ${escapeHtml(order.paymentMethod)}.</p>
        <img class="receipt-qr" src="${qrPreview.dataUrl}" alt="Ticket verification QR code">
        <a class="receipt-link" href="${escapeHtml(verifyUrl)}" target="_blank" rel="noreferrer">Open ticket verification link</a>
        <button class="primary-button receipt-download" type="button" data-action="download-ticket-pdf">Download ticket PDF</button>
      `;
      elements.receiptOutput.classList.add("show");
      showToast("Ticket purchased and saved to Firebase.");
      await loadData();
      openCheckoutModal({ keepReceipt: true });
    });
  } catch (error) {
    showToast(error.message || "Ticket purchase failed.");
  }
});

elements.receiptOutput.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='download-ticket-pdf']");
  if (!button || !state.lastTicket) return;
  try {
    await runButtonAction(button, "Preparing PDF...", () => downloadTicketPdf(state.lastTicket));
  } catch (error) {
    showToast(error.message || "Could not prepare ticket PDF.");
  }
});

window.addEventListener("popstate", () => {
  if (suppressModalPop) {
    suppressModalPop = false;
    return;
  }
  if (state.modalHistoryOpen || isAnyModalOpen()) {
    closeAllModalsFromHistory();
    return;
  }
  handleTicketVerificationHash();
});
window.addEventListener("hashchange", handleTicketVerificationHash);
window.setTimeout(handleTicketVerificationHash, 300);

applyTheme(localStorage.getItem("tickolas-theme") || "light");
showPageLoader("home", 700);

window.setInterval(() => {
  if (state.activePanel === "home" && liveEvents().length > 1 && elements.authModal.hidden) {
    moveSlide(1);
  }
}, 5000);

watchAuthState(async (user, profile) => {
  state.currentUser = user;
  state.currentProfile = profile;

  if (!user) {
    state.orders = [];
    if (state.activePanel === "admin" || state.activePanel === "seller" || state.activePanel === "buyer") {
      state.activePanel = "home";
      showPageLoader("home");
    }
    await loadData();
    return;
  }

  if (state.authRole === "admin" && profile?.role !== "admin") {
    showToast("This account is not an admin.");
    await logoutUser();
    return;
  }

  if (!profile) {
    showToast("User profile is missing. Please login again.");
  } else {
    routeToProfile(profile);
  }

  await loadData();
});
