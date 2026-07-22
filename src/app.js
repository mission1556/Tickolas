import {
  approveOrganization,
  approveEvent,
  createEvent,
  createOrder,
  deleteCurrentAccount,
  deleteEvent,
  deleteOrganization,
  getEvents,
  getOrders,
  getOrganizations,
  getUsers,
  getUserProfile,
  ensureUserProfile,
  loginUser,
  loginWithGoogle,
  logoutUser,
  pauseEvent,
  rejectEvent,
  rejectOrganization,
  registerUser,
  resendCurrentUserVerification,
  saveSellerOrganization,
  settleOrganization,
  scanTicketService,
  updateEvent,
  updateEventServices,
  updateEventVouchers,
  uploadEventThumbnail,
  updateUserProfileInfo,
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
  adminUserQuery: "",
  authRole: "buyer",
  authMode: "login",
  activeSlide: 0,
  editingEventId: "",
  editingImageUrl: "",
  selectedEventId: "",
  pendingBuyerEventId: "",
  sellerInfoEditing: false,
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
  orders: [],
  users: [],
  accountEvents: [],
  accountEventsOwnerId: ""
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
let scannerAudioContext = null;

const accessLabels = {
  admin: "Admin",
  seller: "Sell Ticket",
  buyer: "Buy Ticket"
};

const elements = {
  homeLink: document.querySelector("#homeLink"),
  topbar: document.querySelector(".topbar"),
  pageLoader: document.querySelector("#pageLoader"),
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
  adminUserSearch: document.querySelector("#adminUserSearch"),
  adminUserRows: document.querySelector("#adminUserRows"),
  adminSellerRows: document.querySelector("#adminSellerRows"),
  adminBuyerRows: document.querySelector("#adminBuyerRows"),
  adminUserCount: document.querySelector("#adminUserCount"),
  adminSellerCount: document.querySelector("#adminSellerCount"),
  adminBuyerCount: document.querySelector("#adminBuyerCount"),
  adminEventRows: document.querySelector("#adminEventRows"),
  adminActivityFeed: document.querySelector("#adminActivityFeed"),
  adminActivityCount: document.querySelector("#adminActivityCount"),
  eventSalesRows: document.querySelector("#eventSalesRows"),
  eventSalesSummary: document.querySelector("#eventSalesSummary"),
  pendingOrgCount: document.querySelector("#pendingOrgCount"),
  settlementRows: document.querySelector("#settlementRows"),
  sellerAgreement: document.querySelector("#sellerAgreement"),
  sellerAccountSummary: document.querySelector("#sellerAccountSummary"),
  sellerAccountName: document.querySelector("#sellerAccountName"),
  sellerAccountEmail: document.querySelector("#sellerAccountEmail"),
  sellerAccountRole: document.querySelector("#sellerAccountRole"),
  sellerAccountUserId: document.querySelector("#sellerAccountUserId"),
  sellerAccountDob: document.querySelector("#sellerAccountDob"),
  sellerAccountPhone: document.querySelector("#sellerAccountPhone"),
  sellerAccountEventTotal: document.querySelector("#sellerAccountEventTotal"),
  sellerAccountSave: document.querySelector("#sellerAccountSave"),
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
  purchasedTicketSection: document.querySelector("#purchasedTicketSection"),
  purchasedTicketList: document.querySelector("#purchasedTicketList"),
  purchasedTicketCount: document.querySelector("#purchasedTicketCount"),
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
  authSellerNameWrap: document.querySelector("#authSellerNameWrap"),
  authSellerName: document.querySelector("#authSellerName"),
  authIdentifier: document.querySelector("#authIdentifier"),
  authPassword: document.querySelector("#authPassword"),
  authConfirmWrap: document.querySelector("#authConfirmWrap"),
  authConfirmPassword: document.querySelector("#authConfirmPassword"),
  authMessage: document.querySelector("#authMessage"),
  authSubmit: document.querySelector("#authSubmit"),
  authGoogle: document.querySelector("#authGoogle"),
  authSwitchPrompt: document.querySelector("#authSwitchPrompt"),
  authSwitch: document.querySelector("#authSwitch"),
  sellerProfileModal: document.querySelector("#sellerProfileModal"),
  sellerProfileForm: document.querySelector("#sellerProfileForm"),
  sellerProfileEyebrow: document.querySelector("#sellerProfileEyebrow"),
  sellerProfileTitle: document.querySelector("#sellerProfileTitle"),
  sellerProfileCopy: document.querySelector("#sellerProfileCopy"),
  sellerProfileNameLabel: document.querySelector("#sellerProfileNameLabel"),
  sellerProfileName: document.querySelector("#sellerProfileName"),
  sellerProfileDob: document.querySelector("#sellerProfileDob"),
  sellerProfilePhone: document.querySelector("#sellerProfilePhone"),
  sellerProfileMessage: document.querySelector("#sellerProfileMessage"),
  sellerProfileSubmit: document.querySelector("#sellerProfileSubmit"),
  accountModal: document.querySelector("#accountModal"),
  closeAccountModal: document.querySelector("#closeAccountModal"),
  accountPanelName: document.querySelector("#accountPanelName"),
  accountPanelEmail: document.querySelector("#accountPanelEmail"),
  accountPanelRole: document.querySelector("#accountPanelRole"),
  accountPanelUserId: document.querySelector("#accountPanelUserId"),
  accountPanelDob: document.querySelector("#accountPanelDob"),
  accountPanelPhone: document.querySelector("#accountPanelPhone"),
  accountPanelTicketTotal: document.querySelector("#accountPanelTicketTotal"),
  accountTicketCount: document.querySelector("#accountTicketCount"),
  accountTicketList: document.querySelector("#accountTicketList"),
  deleteAccountButton: document.querySelector("#deleteAccountButton"),
  deleteAccountConfirm: document.querySelector("#deleteAccountConfirm"),
  deleteAccountText: document.querySelector("#deleteAccountText"),
  confirmDeleteAccount: document.querySelector("#confirmDeleteAccount"),
  cancelDeleteAccount: document.querySelector("#cancelDeleteAccount"),
  deleteAccountMessage: document.querySelector("#deleteAccountMessage"),
  scannerModuleManager: document.querySelector("#scannerModuleManager"),
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
  const displayName = String(state.currentProfile?.displayName || state.currentUser?.displayName || "").trim();
  if (displayName) return displayName;

  if (userRole() === "seller") {
    const sellerName = state.events
      .filter((event) => event.createdBy === state.currentUser?.uid)
      .map((event) => String(event.organizerName || "").trim())
      .find(Boolean);
    if (sellerName) return sellerName;
  }
  if (userRole() === "seller") return "Seller";

  const email = state.currentProfile?.email || state.currentUser?.email || "";
  return email ? email.split("@")[0] : "User";
}

function loggedInEmail() {
  return state.currentUser?.email || state.currentProfile?.email || "";
}

function normalizeBangladeshPhone(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (/^01[3-9]\d{8}$/.test(digits)) return `+88${digits}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^1[3-9]\d{8}$/.test(digits)) return `+880${digits}`;
  return raw.startsWith("+") ? raw.replace(/[^\d+]/g, "") : "";
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
    render();
  }
}

function showPageLoader(_panel = state.activePanel, duration = 520) {
  if (!elements.pageLoader) return;
  window.clearTimeout(pageLoaderTimer);
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
    || !elements.sellerProfileModal.hidden
    || !elements.accountModal.hidden
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
  elements.sellerProfileModal.hidden = true;
  elements.accountModal.hidden = true;
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
  loadData();
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
        const maxWidth = 900;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.72;
        canvas.toBlob((initialBlob) => {
          if (!initialBlob) {
            reject(new Error("Could not process this image."));
            return;
          }

          if (initialBlob.size <= 450000 || quality <= 0.42) {
            resolve(initialBlob);
            return;
          }

          const tryCompress = () => {
            quality -= 0.08;
            canvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error("Could not process this image."));
                return;
              }
              if (blob.size <= 450000 || quality <= 0.42) {
                resolve(blob);
                return;
              }
              tryCompress();
            }, "image/jpeg", quality);
          };

          tryCompress();
        }, "image/jpeg", quality);
      };
      image.onerror = () => reject(new Error("Could not read this image."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

async function eventImageFromForm(formData, eventId) {
  const file = formData.get("imageFile");
  if (file && file.size > 0) {
    const resizedImage = await resizeImageFile(file);
    return uploadEventThumbnail(resizedImage, eventId);
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

function formatBangladeshDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

function statusLabel(value) {
  const status = String(value || "").trim();
  const labels = {
    review: "In review",
    live: "Live",
    paused: "Hidden",
    rejected: "Rejected",
    confirmed: "Confirmed"
  };
  return labels[status] || status;
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

function normalizedProfileDate(value) {
  const dateText = formatBangladeshDateInput(value);
  return dateText ? parseBangladeshDate(dateText) : "";
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

function organizerName(event) {
  const eventName = String(event?.organizerName || "").trim();
  if (eventName) return eventName;

  const organizationName = String(getOrg(event?.orgId)?.name || "").trim();
  return organizationName || "Organizer";
}

function preferredOrganizerName() {
  const savedEvent = state.events.find((event) =>
    event.createdBy === state.currentUser?.uid && String(event.organizerName || "").trim()
  );
  return String(
    savedEvent?.organizerName
      || state.currentProfile?.displayName
      || state.currentUser?.displayName
      || ""
  ).trim();
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
  const url = new URL(`${window.location.origin}${window.location.pathname}`);
  url.searchParams.set("verify-ticket", "1");
  params.forEach((value, key) => url.searchParams.set(key, value));
  return url.toString();
}

function orderCreatedMillis(order) {
  const createdAt = order?.createdAt;
  if (createdAt?.toMillis) return createdAt.toMillis();
  if (createdAt?.seconds) return createdAt.seconds * 1000;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ticketFromOrder(order) {
  const event = getEvent(order.eventId) || {
    id: order.eventId || "",
    title: order.eventTitle || "Tickolas event",
    category: order.eventCategory || "Event",
    date: order.eventDate || "",
    venue: order.eventVenue || "Venue to be announced",
    price: Number(order.gross || 0) / Math.max(Number(order.quantity || 1), 1),
    organizerName: order.organizerName || "Organizer",
    imageUrl: order.eventImageUrl || ""
  };
  const org = getOrg(event.orgId) || { name: organizerName(event) };
  return { order, event, org };
}

function buyerPurchasedOrders() {
  if (!state.currentUser) return [];
  return state.orders
    .filter((order) => !order.userId || order.userId === state.currentUser.uid)
    .sort((left, right) => orderCreatedMillis(right) - orderCreatedMillis(left));
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
  const searchParams = new URLSearchParams(window.location.search);
  const hashRoute = window.location.hash.startsWith("#verify-ticket?");
  const queryRoute = searchParams.get("verify-ticket") === "1";
  if (!hashRoute && !queryRoute) return;

  const routeKey = queryRoute ? window.location.search : window.location.hash;
  if (state.lastVerificationHash === routeKey) return;
  state.lastVerificationHash = routeKey;

  const params = queryRoute
    ? searchParams
    : new URLSearchParams(window.location.hash.replace("#verify-ticket?", ""));
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
  const organizer = String(event?.organizerName || org?.name || "").trim() || "Organizer";
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
  return [
    event.title,
    event.category,
    event.venue,
    event.date,
    organizerName(event),
    getOrg(event.orgId)?.type || ""
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
    "auth/app-not-authorized": "This domain is not authorized in Firebase Authentication settings.",
    "auth/captcha-check-failed": "reCAPTCHA check failed. Refresh and try again.",
    "auth/invalid-credential": "No matching account found or password is incorrect. Please sign up first if you are new.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/missing-password": "Please enter a password.",
    "auth/popup-closed-by-user": "Google login was closed before completion.",
    "auth/popup-blocked": "Popup blocked. Please allow popups for this site and try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/weak-password": "Password should be at least 6 characters."
  };
  return messages[code] || error?.message || "Authentication failed.";
}

async function runButtonAction(button, label, action) {
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  if (button.classList.contains("google-auth-button")) {
    button.innerHTML = `
      <img class="google-mark" src="assets/google-g.svg" alt="" aria-hidden="true">
      ${escapeHtml(label)}
    `;
  } else {
    button.textContent = label;
  }

  try {
    await action();
  } finally {
    button.innerHTML = originalHtml;
    button.disabled = false;
    button.classList.remove("is-loading");
  }
}

async function loadData() {
  try {
    const admin = isAdminUser() && state.activePanel === "admin";
    const seller = userRole() === "seller" && state.activePanel === "seller";
    const publicOnly = state.activePanel === "home" || !state.currentUser || userRole() === "buyer";
    const [organizations, events, orders, users] = await Promise.all([
      getOrganizations({ publicOnly, ownerId: seller ? state.currentUser.uid : "" }),
      getEvents({ publicOnly, ownerId: seller ? state.currentUser.uid : "" }),
      getOrders({ userId: state.currentUser?.uid || "", admin }),
      admin ? getUsers().catch(() => []) : Promise.resolve([])
    ]);

    state.organizations = organizations;
    state.events = events;
    state.orders = orders;
    state.users = users;
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
  if (elements.accountModal && !elements.accountModal.hidden) {
    renderAccountPanel();
  }
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
          <span>${escapeHtml(organizerName(event))}</span>
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

function recordTime(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function recordDate(value) {
  const time = recordTime(value);
  return time ? new Date(time).toLocaleDateString("en-GB") : "New";
}

function roleName(role = "") {
  return { admin: "Admin", seller: "Seller", buyer: "Buyer" }[role] || "User";
}

function profileUserCode(profile = {}) {
  if (profile.userCode) return profile.userCode;
  const prefix = profile.role === "admin" ? "ADM" : profile.role === "seller" ? "SEL" : "BUY";
  const shortId = String(profile.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase();
  return `${prefix}-${shortId || "USER"}`;
}

function profileName(profile = {}) {
  return String(profile.displayName || profile.name || (profile.email ? profile.email.split("@")[0] : "Unnamed user")).trim();
}

function eventTitle(eventId) {
  return state.events.find((event) => event.id === eventId)?.title || "Unknown event";
}

function renderAdminUsers() {
  if (!elements.adminSellerRows || !elements.adminBuyerRows) return;

  const queryText = state.adminUserQuery;
  const users = [...state.users]
    .sort((a, b) => recordTime(b.createdAt) - recordTime(a.createdAt))
    .filter((profile) => {
      const haystack = [
        profile.email,
        profile.displayName,
        profile.role,
        profileUserCode(profile),
        profile.id
      ]
        .join(" ")
        .toLowerCase();

      return !queryText || haystack.includes(queryText);
    });

  elements.adminUserCount.textContent = `${users.length} account${users.length === 1 ? "" : "s"}`;
  const sellers = users.filter((profile) => profile.role === "seller");
  const buyers = users.filter((profile) => profile.role === "buyer");
  elements.adminSellerCount.textContent = `${sellers.length} seller${sellers.length === 1 ? "" : "s"}`;
  elements.adminBuyerCount.textContent = `${buyers.length} buyer${buyers.length === 1 ? "" : "s"}`;

  const renderRows = (profiles, emptyLabel) => profiles.length
    ? profiles
        .map((profile) => `
          <tr>
            <td><span class="user-id-pill">${escapeHtml(profileUserCode(profile))}</span></td>
            <td>${escapeHtml(profileName(profile))}</td>
            <td>${escapeHtml(profile.email || "No email")}</td>
            <td>${recordDate(profile.createdAt)}</td>
            <td><button class="table-button secondary" type="button" data-action="admin-user-details" data-user-id="${escapeHtml(profile.id)}">See details</button></td>
          </tr>
        `)
        .join("")
    : `
      <tr>
        <td colspan="5" class="muted-cell">${emptyLabel}</td>
      </tr>
    `;

  elements.adminSellerRows.innerHTML = renderRows(sellers, "No seller account matched.");
  elements.adminBuyerRows.innerHTML = renderRows(buyers, "No buyer account matched.");
}

function openAdminUserDetails(userId) {
  const profile = state.users.find((item) => item.id === userId);
  if (!profile) {
    showToast("Account not found.");
    return;
  }

  const ownedEvents = state.events.filter((event) => event.createdBy === profile.id);
  const userOrders = state.orders.filter((order) => order.userId === profile.id || order.buyerEmail === profile.email);
  const role = String(profile.role || "");
  const activityMetric = role === "seller"
    ? `<div><dt>Created events</dt><dd>${ownedEvents.length}</dd></div>`
    : `<div><dt>Purchased tickets</dt><dd>${userOrders.length}</dd></div>`;
  elements.eventDetailsBody.innerHTML = `
    <div class="event-details-header">
      <div>
        <p class="eyebrow">Account details</p>
        <h2 id="eventDetailsTitle">${escapeHtml(profileName(profile))}</h2>
      </div>
      <span class="role-pill">${escapeHtml(roleName(profile.role))}</span>
    </div>
    <dl class="event-details-grid">
      <div><dt>User ID</dt><dd>${escapeHtml(profileUserCode(profile))}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(profile.email || "No email")}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(profile.phoneNumber || "-")}</dd></div>
      <div><dt>Date of birth</dt><dd>${profile.dateOfBirth ? dateLabel(profile.dateOfBirth) : "-"}</dd></div>
      <div><dt>Joined</dt><dd>${recordDate(profile.createdAt)}</dd></div>
      ${activityMetric}
      <div><dt>Profile document ID</dt><dd>${escapeHtml(profile.id || "-")}</dd></div>
    </dl>
  `;
  elements.eventDetailsModal.hidden = false;
  pushModalHistory();
  syncModalState();
  window.setTimeout(() => elements.closeEventDetails.focus(), 0);
}

function renderAdminActivity() {
  if (!elements.adminActivityFeed) return;

  const activities = [
    ...state.users.map((profile) => ({
      kind: "Account",
      title: `${roleName(profile.role)} account created`,
      detail: `${profileName(profile)} - ${profile.email || profileUserCode(profile)}`,
      time: profile.createdAt
    })),
    ...state.events.map((event) => ({
      kind: "Event",
      title: `${event.title || "Untitled event"} created`,
      detail: `${organizerName(event)} - ${event.category || "Event"} - ${event.status || "review"}`,
      time: event.createdAt || event.updatedAt
    })),
    ...state.orders.map((order) => ({
      kind: "Ticket",
      title: "Ticket purchased",
      detail: `${order.buyerName || order.buyerEmail || "Buyer"} bought ${order.quantity || 1} ticket(s) for ${eventTitle(order.eventId)} - ${money(order.gross || 0)}`,
      time: order.createdAt
    }))
  ]
    .filter((item) => recordTime(item.time))
    .sort((a, b) => recordTime(b.time) - recordTime(a.time));

  elements.adminActivityCount.textContent = `${activities.length} update${activities.length === 1 ? "" : "s"}`;
  elements.adminActivityFeed.innerHTML = activities.length
    ? activities
        .map((item) => `
          <article class="admin-activity-item">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.detail)}</span>
            </div>
            <small><b>${escapeHtml(item.kind)}</b>${recordDate(item.time)}</small>
          </article>
        `)
        .join("")
    : `<p class="muted-cell">No activity yet.</p>`;
}

function renderAdmin() {
  renderAdminUsers();
  renderAdminActivity();

  const actionQueueEvents = state.events.filter((event) => ["review", "paused", "rejected"].includes(event.status || "review"));
  const pending = actionQueueEvents.length;
  elements.pendingOrgCount.textContent = `${pending} pending`;

  elements.adminOrgRows.innerHTML = actionQueueEvents.length
    ? actionQueueEvents
        .map((event) => {
          const action = event.status === "review"
            ? `
              <div class="button-row">
                <button class="table-button" type="button" data-action="approve-event" data-event-id="${escapeHtml(event.id)}">Approve</button>
                <button class="table-button danger" type="button" data-action="reject-event" data-event-id="${escapeHtml(event.id)}">Reject</button>
              </div>
            `
            : `
              <div class="button-row">
                <button class="table-button" type="button" data-action="approve-event" data-event-id="${escapeHtml(event.id)}">Re-approve</button>
                <button class="table-button danger" type="button" data-action="delete-event" data-event-id="${escapeHtml(event.id)}">Delete</button>
              </div>
            `;

          return `
          <tr>
            <td>
              <strong>${escapeHtml(event.title)}</strong>
              <small class="table-subtext">${escapeHtml(event.venue)} | ${dateLabel(event.date)}</small>
            </td>
            <td>${escapeHtml(organizerName(event))}</td>
            <td>${escapeHtml(event.category)}</td>
            <td>${adminEventStatusMarkup(event)}</td>
            <td>${action}</td>
          </tr>
        `;
        })
        .join("")
    : `
      <tr>
        <td colspan="5" class="muted-cell">No events waiting for approval or admin action.</td>
      </tr>
    `;

  const managedEvents = state.events.filter((event) => event.status === "live");
  elements.adminEventRows.innerHTML = managedEvents.length
    ? managedEvents
        .map((event) => {
          const org = { name: organizerName(event) };
          const action = `<button class="table-button secondary" type="button" data-action="pause-event" data-event-id="${escapeHtml(event.id)}">Hide</button>`;
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
        <td colspan="5" class="muted-cell">No live events yet.</td>
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
          const org = { name: organizerName(event) };
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
  const profile = state.currentProfile || {};
  const sellerName = profile.displayName || state.currentUser?.displayName || userLabel();

  if (elements.sellerAccountName && !state.sellerInfoEditing && elements.sellerAccountName.value !== (sellerName || "")) {
    elements.sellerAccountName.value = sellerName || "";
  }
  if (elements.sellerAccountName) elements.sellerAccountName.disabled = !state.sellerInfoEditing;
  if (elements.sellerAccountEmail) elements.sellerAccountEmail.textContent = state.currentUser?.email || profile.email || "-";
  if (elements.sellerAccountRole) elements.sellerAccountRole.textContent = statusLabel(profile.role || "seller");
  if (elements.sellerAccountUserId) elements.sellerAccountUserId.textContent = profile.userCode || state.currentUser?.uid || "-";
  const profileDob = dateLabel(profile.dateOfBirth);
  if (elements.sellerAccountDob && !state.sellerInfoEditing && elements.sellerAccountDob.value !== profileDob) {
    elements.sellerAccountDob.value = profileDob;
  }
  if (elements.sellerAccountDob) elements.sellerAccountDob.disabled = !state.sellerInfoEditing;
  if (elements.sellerAccountPhone && !state.sellerInfoEditing && elements.sellerAccountPhone.value !== String(profile.phoneNumber || "")) {
    elements.sellerAccountPhone.value = String(profile.phoneNumber || "");
  }
  if (elements.sellerAccountPhone) elements.sellerAccountPhone.disabled = !state.sellerInfoEditing;
  if (elements.sellerAccountEventTotal) elements.sellerAccountEventTotal.textContent = String(ownEvents.length);
  if (elements.sellerAccountSave) {
    elements.sellerAccountSave.textContent = state.sellerInfoEditing ? "Save info" : "Update your info";
  }

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
    </article>
  `;
}

function renderScannerModuleManager() {
  const event = getEvent(elements.scannerEvent.value);
  if (!event) {
    return `<p class="empty-state compact">Select an event to manage scan modules.</p>`;
  }

  const services = serviceModules(event);
  const canManage = canEditEvent(event);
  if (!canManage) {
    return "";
  }

  return `
    <div class="scan-module-manager-card">
      <div class="voucher-manager-head">
        <strong>Custom scan modules</strong>
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
  `;
}

function resetEventForm(organizer = "") {
  state.editingEventId = "";
  state.editingImageUrl = "";
  elements.eventForm.reset();
  elements.eventForm.elements.organizerName.value = String(organizer || preferredOrganizerName()).trim();
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

function playScannerTone(tone) {
  if (!["success", "error"].includes(tone)) return;

  if ("vibrate" in navigator) {
    navigator.vibrate(tone === "success" ? [70, 35, 70] : [180, 70, 180]);
  }

  try {
    scannerAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const context = scannerAudioContext;
    const startTime = context.currentTime;
    const sequence = tone === "success"
      ? [{ frequency: 660, offset: 0 }, { frequency: 880, offset: 0.13 }]
      : [{ frequency: 220, offset: 0 }, { frequency: 160, offset: 0.16 }];

    sequence.forEach(({ frequency, offset }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone === "success" ? "sine" : "square";
      oscillator.frequency.setValueAtTime(frequency, startTime + offset);
      gain.gain.setValueAtTime(0.0001, startTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.32, startTime + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + offset + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startTime + offset);
      oscillator.stop(startTime + offset + 0.13);
    });
  } catch {
    // Audio feedback is optional; scanner result text still confirms status.
  }
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

  elements.serviceToggleGrid.innerHTML = services.map((service) => {
    const checked = service.key === state.scannerService ? "checked" : "";
    const optionId = `scanner-service-${escapeHtml(service.key)}`;
    return `
      <input class="cir-tabs__r" id="${optionId}" type="radio" name="scannerService" value="${escapeHtml(service.key)}" ${checked}>
      <label class="cir-tabs__t service-toggle ${checked ? "active" : ""}" for="${optionId}" data-service="${escapeHtml(service.key)}">
        ${escapeHtml(service.label)}
      </label>
    `;
  }).join("");

  elements.scannerModuleManager.innerHTML = renderScannerModuleManager();
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
    playScannerTone("success");
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
    playScannerTone("error");
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
  elements.eventForm.elements.organizerName.value = organizerName(event) === "Organizer" ? "" : organizerName(event);
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
  renderPurchasedTickets();
}

function renderPurchasedTickets() {
  if (!elements.purchasedTicketSection || !elements.purchasedTicketList) return;
  elements.purchasedTicketSection.hidden = true;
  elements.purchasedTicketList.innerHTML = "";
  if (elements.purchasedTicketCount) elements.purchasedTicketCount.textContent = "0 tickets";
}

function renderPurchasedTicketCard(order) {
  const { event } = ticketFromOrder(order);
  const quantity = Number(order.quantity || 1);
  return `
    <article class="purchased-ticket-card">
      <div class="purchased-ticket-info">
        <strong>${escapeHtml(event.title || "Tickolas ticket")}</strong>
        <div class="purchased-ticket-meta">
          <span>${dateLabel(event.date)}</span>
          <span>${quantity} ticket${quantity > 1 ? "s" : ""}</span>
          <span>${money(order.gross || 0)}</span>
          <span>${escapeHtml(statusLabel(order.status || "confirmed"))}</span>
        </div>
        <span class="purchased-ticket-id">Ticket ID: ${escapeHtml(order.id)}</span>
      </div>
      <div class="ticket-actions">
        <button class="table-button" type="button" data-action="download-purchased-ticket" data-order-id="${escapeHtml(order.id)}">Download PDF</button>
      </div>
    </article>
  `;
}

function orderCreatedAtValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return new Date(value).getTime() || 0;
}

function accountOrders() {
  if (!state.currentUser) return [];
  const email = String(state.currentUser.email || "").toLowerCase();
  return state.orders
    .filter((order) => (
      order.userId === state.currentUser.uid
      || String(order.buyerEmail || "").toLowerCase() === email
    ))
    .sort((a, b) => orderCreatedAtValue(b.createdAt) - orderCreatedAtValue(a.createdAt));
}

function sellerAccountEvents() {
  if (!state.currentUser || userRole() !== "seller") return [];
  const source = state.accountEventsOwnerId === state.currentUser.uid ? state.accountEvents : state.events;
  return source.filter((event) => event.createdBy === state.currentUser.uid);
}

async function refreshSellerAccountEvents() {
  if (!state.currentUser || userRole() !== "seller") return;
  try {
    state.accountEvents = await getEvents({ ownerId: state.currentUser.uid });
    state.accountEventsOwnerId = state.currentUser.uid;
    if (elements.accountModal && !elements.accountModal.hidden) {
      renderAccountPanel();
    }
  } catch (error) {
    showToast(error.message || "Could not load seller events.");
  }
}

function resetDeleteAccountConfirm() {
  if (elements.deleteAccountConfirm) elements.deleteAccountConfirm.hidden = true;
  if (elements.deleteAccountText) elements.deleteAccountText.value = "";
  if (elements.deleteAccountMessage) {
    elements.deleteAccountMessage.hidden = true;
    elements.deleteAccountMessage.textContent = "";
  }
}

function setDeleteAccountMessage(message) {
  if (!elements.deleteAccountMessage) return;
  elements.deleteAccountMessage.textContent = message;
  elements.deleteAccountMessage.hidden = !message;
}

function renderAccountPanel() {
  if (!elements.accountModal || !state.currentUser) return;
  const profile = state.currentProfile || {};
  const orders = accountOrders();
  const ticketTotal = orders.reduce((sum, order) => sum + Number(order.quantity || 1), 0);
  const sellerEvents = sellerAccountEvents();
  const total = profile.role === "seller" ? sellerEvents.length : ticketTotal;
  const name = profile.displayName || state.currentUser.displayName || userLabel();
  if (elements.accountPanelName) elements.accountPanelName.textContent = name || "-";
  if (elements.accountPanelEmail) elements.accountPanelEmail.textContent = state.currentUser.email || profile.email || "-";
  if (elements.accountPanelRole) elements.accountPanelRole.textContent = statusLabel(profile.role || "buyer");
  if (elements.accountPanelUserId) elements.accountPanelUserId.textContent = profile.userCode || state.currentUser.uid || "-";
  if (elements.accountPanelDob) elements.accountPanelDob.textContent = profile.dateOfBirth ? dateLabel(profile.dateOfBirth) : "-";
  if (elements.accountPanelPhone) elements.accountPanelPhone.textContent = profile.phoneNumber || "-";
  if (elements.accountPanelTicketTotal) elements.accountPanelTicketTotal.textContent = String(total);
  if (elements.accountTicketCount) {
    elements.accountTicketCount.textContent = profile.role === "seller"
      ? `${sellerEvents.length} event${sellerEvents.length === 1 ? "" : "s"}`
      : `${orders.length} ticket${orders.length === 1 ? "" : "s"}`;
  }
  if (elements.accountTicketList) {
    elements.accountTicketList.innerHTML = orders.length
      ? orders.map(renderPurchasedTicketCard).join("")
      : `<p class="empty-state">No purchased ticket yet.</p>`;
  }
}

function openAccountModal() {
  if (!state.currentUser) {
    openAuthChoice();
    return;
  }
  renderAccountPanel();
  resetDeleteAccountConfirm();
  elements.accountModal.hidden = false;
  pushModalHistory();
  syncModalState();
  refreshSellerAccountEvents();
}

function closeAccountModal() {
  if (!elements.accountModal) return;
  elements.accountModal.hidden = true;
  resetDeleteAccountConfirm();
  syncModalState();
}

function renderEventCard(event) {
  const remaining = remainingTickets(event);
  return `
    <article class="event-card">
      <div class="event-art"${eventImageStyle(event)}>
        <span>${escapeHtml(event.category)}</span>
      </div>
      <div class="event-card-body">
        <span class="status live">${escapeHtml(event.category)}</span>
        <h3>${escapeHtml(event.title)}</h3>
        <div class="event-meta">
          <span>${dateLabel(event.date)}</span>
          <span>${escapeHtml(event.venue)}</span>
          <span>${escapeHtml(organizerName(event))}</span>
          <span>${remaining} tickets left</span>
        </div>
        <div class="event-price-row">
          <strong>${money(event.price)}</strong>
          <button class="select-event" type="button" data-action="select-event" data-event-id="${escapeHtml(event.id)}">View details</button>
        </div>
      </div>
    </article>
  `;
}

function renderLandingEventCard(event) {
  const remaining = remainingTickets(event);
  return `
    <article class="landing-event-card" data-action="landing-buy" data-event-id="${escapeHtml(event.id)}" tabindex="0" role="button" aria-label="View details for ${escapeHtml(event.title)}">
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
        <p>${escapeHtml(organizerName(event))} | ${remaining} tickets left</p>
        <button class="primary-button" type="button" data-action="landing-buy" data-event-id="${escapeHtml(event.id)}">View details</button>
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
      <div><dt>Organizer</dt><dd>${escapeHtml(organizerName(event))}</dd></div>
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
  window.setTimeout(() => elements.closeEventDetails.focus(), 0);
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
  setAuthMode("login");
  elements.authIdentifier.focus();
}

function startBuyerFlow(eventId) {
  state.selectedEventId = eventId;
  openEventPreviewModal(eventId);
}

function closeAuthModal(clearPendingBuyerEvent = true) {
  if (clearPendingBuyerEvent) {
    state.pendingBuyerEventId = "";
  }
  elements.authModal.hidden = true;
  syncModalState();
}

function profileNeedsInfo(profile = state.currentProfile) {
  if (!["buyer", "seller"].includes(profile?.role)) return false;
  return !String(profile.displayName || "").trim()
    || !String(profile.dateOfBirth || "").trim()
    || !String(profile.phoneNumber || "").trim();
}

function showSellerProfileMessage(message) {
  elements.sellerProfileMessage.textContent = message;
  elements.sellerProfileMessage.hidden = !message;
}

function openSellerProfileModal() {
  const isSeller = state.currentProfile?.role === "seller";
  elements.sellerProfileEyebrow.textContent = isSeller ? "Seller info" : "Buyer info";
  elements.sellerProfileTitle.textContent = "Update your info";
  elements.sellerProfileCopy.textContent = isSeller
    ? "Add your seller name, date of birth, and phone number so buyers and the navbar show a professional organizer identity."
    : "Add your name, date of birth, and phone number so your ticket profile stays complete.";
  elements.sellerProfileNameLabel.textContent = isSeller ? "Seller name" : "Name";
  elements.sellerProfileName.placeholder = isSeller ? "Your seller or organization name" : "Your full name";
  elements.sellerProfileSubmit.textContent = isSeller ? "Save seller info" : "Save buyer info";
  elements.sellerProfileName.value = String(state.currentProfile?.displayName || state.currentUser?.displayName || "").trim();
  elements.sellerProfileDob.value = dateLabel(state.currentProfile?.dateOfBirth);
  elements.sellerProfilePhone.value = String(state.currentProfile?.phoneNumber || "").trim();
  showSellerProfileMessage("");
  elements.sellerProfileModal.hidden = false;
  pushModalHistory();
  syncModalState();
  window.setTimeout(() => elements.sellerProfileName.focus(), 0);
}

function closeSellerProfileModal() {
  elements.sellerProfileModal.hidden = true;
  syncModalState();
}

function promptSellerProfileIfNeeded() {
  if (!profileNeedsInfo()) return;
  if (!elements.sellerProfileModal.hidden) return;
  showToast("Update your info.");
  openSellerProfileModal();
}

function clearReceiptOutput() {
  state.lastTicket = null;
  elements.receiptOutput.innerHTML = "";
  elements.receiptOutput.classList.remove("show");
}

function openCheckoutModal({ keepReceipt = false } = {}) {
  closeEventPreviewModal(false, false);
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
        <div><dt>Organizer</dt><dd>${escapeHtml(organizerName(event))}</dd></div>
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
  window.setTimeout(() => elements.closeEventPreview.focus(), 0);
}

function closeEventPreviewModal(hideBackdrop = true, syncHistory = true) {
  elements.eventPreviewPanel.hidden = true;
  if (hideBackdrop && elements.checkoutPanel.hidden) {
    elements.checkoutBackdrop.hidden = true;
  }
  if (syncHistory) {
    syncModalState();
  }
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
  elements.authSellerName.value = "";
  elements.authIdentifier.value = "";
  elements.authPassword.value = "";
  elements.authConfirmPassword.value = "";
  elements.authConfirmPassword.setCustomValidity("");
  resetPasswordVisibility();
  clearAuthMessage();
}

function setAuthMode(mode) {
  state.authMode = mode === "signup" ? "signup" : "login";
  clearAuthMessage();
  const identifierWrap = elements.authIdentifier.closest("label");
  const passwordWrap = elements.authPassword.closest("label");
  const isSignup = state.authMode === "signup" && state.authRole !== "admin";

  elements.authForm.dataset.mode = state.authMode;
  elements.authFormTitle.textContent = isSignup ? "Sign up" : "Login";
  elements.authSubmit.hidden = false;
  elements.authSubmit.disabled = false;
  elements.authSubmit.textContent = isSignup ? "Create account" : "Login";
  elements.authSwitchPrompt.textContent = isSignup ? "Already have an account?" : "New here?";
  elements.authSwitch.textContent = isSignup ? "Login" : "Sign up";
  elements.authSwitch.disabled = state.authRole === "admin";
  elements.authSwitch.parentElement.hidden = state.authRole === "admin";
  elements.authSellerNameWrap.hidden = !(isSignup && state.authRole === "seller");
  elements.authSellerName.required = isSignup && state.authRole === "seller";
  elements.authSellerName.disabled = !(isSignup && state.authRole === "seller");
  if (identifierWrap) identifierWrap.hidden = false;
  elements.authIdentifier.required = true;
  elements.authIdentifier.disabled = false;
  if (passwordWrap) passwordWrap.hidden = false;
  elements.authPassword.required = true;
  elements.authPassword.disabled = false;
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
    const user = await registerUser({
      email,
      password,
      role: state.authRole,
      displayName: state.authRole === "seller" ? elements.authSellerName.value.trim() : ""
    });
    await logoutUser();
    showAuthMessage("Verification email sent. Verify your inbox first, then login to activate your Tickolas account.", "success");
    setAuthMode("login");
    elements.authIdentifier.value = email;
    return;
  } else {
    const user = await loginUser({ email, password });
    if (!user.emailVerified) {
      await resendCurrentUserVerification().catch(() => {});
      await logoutUser();
      showAuthMessage("Please verify your email inbox first. We sent the verification email again.");
      return;
    }
    let profile = await getUserProfile(user.uid);
    if (!profile) {
      if (state.authRole === "admin") {
        await logoutUser();
        showAuthMessage("This account is not an admin.");
        return;
      }
      profile = await ensureUserProfile(user, state.authRole);
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
  promptSellerProfileIfNeeded();
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
  promptSellerProfileIfNeeded();
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
    if (userRole() === "seller") {
      closeAllModalsFromHistory();
      changePanel("seller");
      window.setTimeout(() => {
        elements.sellerAccountName?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return;
    }
    openAccountModal();
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

document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-date-format]");
  if (!input) return;
  const formatted = formatBangladeshDateInput(input.value);
  if (input.value !== formatted) input.value = formatted;
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

elements.sellerProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.sellerProfileForm.checkValidity()) {
    elements.sellerProfileForm.reportValidity();
    return;
  }

  const displayName = elements.sellerProfileName.value.trim();
  const rawDateOfBirth = elements.sellerProfileDob.value.trim();
  const dateOfBirth = normalizedProfileDate(rawDateOfBirth);
  const phoneNumber = normalizeBangladeshPhone(elements.sellerProfilePhone.value);
  if (rawDateOfBirth && !dateOfBirth) {
    showSellerProfileMessage("Use date format dd/mm/yyyy.");
    return;
  }
  if (!/^\+8801[3-9]\d{8}$/.test(phoneNumber)) {
    showSellerProfileMessage("Please enter a valid Bangladesh phone number.");
    return;
  }
  try {
    await runButtonAction(elements.sellerProfileSubmit, "Saving...", async () => {
      await updateUserProfileInfo({ displayName, dateOfBirth, phoneNumber });
      state.currentProfile = await getUserProfile(state.currentUser.uid);
      closeSellerProfileModal();
      showToast("Profile info updated.");
      render();
    });
  } catch (error) {
    showSellerProfileMessage(error.message || "Could not update profile info.");
  }
});

elements.cancelEventEdit.addEventListener("click", resetEventForm);

elements.agreeSellerTerms.addEventListener("click", acceptSellerAgreement);

elements.sellerAccountSummary?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.currentUser || userRole() !== "seller") {
    showToast("Please login as seller first.");
    return;
  }
  if (!state.sellerInfoEditing) {
    state.sellerInfoEditing = true;
    renderSeller();
    window.setTimeout(() => elements.sellerAccountName?.focus(), 0);
    return;
  }
  if (!elements.sellerAccountSummary.checkValidity()) {
    elements.sellerAccountSummary.reportValidity();
    return;
  }

  const displayName = elements.sellerAccountName.value.trim();
  const rawDateOfBirth = elements.sellerAccountDob.value.trim();
  const dateOfBirth = normalizedProfileDate(rawDateOfBirth);
  const phoneNumber = normalizeBangladeshPhone(elements.sellerAccountPhone.value);
  if (rawDateOfBirth && !dateOfBirth) {
    showToast("Use date format dd/mm/yyyy.");
    return;
  }
  if (!/^\+8801[3-9]\d{8}$/.test(phoneNumber)) {
    showToast("Please enter a valid Bangladesh phone number.");
    return;
  }
  try {
    await runButtonAction(elements.sellerAccountSave, "Saving...", async () => {
      await updateUserProfileInfo({ displayName, dateOfBirth, phoneNumber });
      state.currentProfile = await getUserProfile(state.currentUser.uid);
      state.sellerInfoEditing = false;
      showToast("Seller info updated.");
      render();
    });
  } catch (error) {
    showToast(error.message || "Could not update seller info.");
  }
});

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

elements.scannerModuleManager.addEventListener("click", async (event) => {
  const deleteServiceButton = event.target.closest("[data-action='delete-service']");
  if (!deleteServiceButton) return;

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
});

elements.scannerModuleManager.addEventListener("submit", async (event) => {
  const serviceForm = event.target.closest("[data-action='add-service']");
  if (!serviceForm) return;
  event.preventDefault();

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
});

elements.serviceToggleGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-service]");
  if (!button) return;
  state.scannerService = button.dataset.service;
  const input = button.previousElementSibling;
  if (input?.matches(".cir-tabs__r")) input.checked = true;
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

    const eventId = state.editingEventId || createSlugId("evt", title);
    const eventData = {
      orgId: `seller-${state.currentUser.uid}`,
      sellerEmail: state.currentUser.email || state.currentProfile?.email || "",
      organizerName: String(formData.get("organizerName") || "").trim().slice(0, 80),
      title,
      category: String(formData.get("category")),
      venue: String(formData.get("venue")).trim(),
      details: String(formData.get("details") || "").trim().slice(0, 900),
      imageUrl: await eventImageFromForm(formData, eventId),
      date,
      price: Number(formData.get("price")),
      capacity: Number(formData.get("capacity")),
      serviceModules: state.editingEventId ? serviceModules(getEvent(state.editingEventId)) : defaultServiceModules,
      createdBy: state.currentUser.uid
    };

    await saveSellerOrganization({
      orgId: eventData.orgId,
      ownerId: state.currentUser.uid,
      name: eventData.organizerName,
      type: eventData.category
    });

    if (state.editingEventId) {
      await updateEvent(state.editingEventId, eventData);
      showToast("Event updated and sent for admin review.");
    } else {
      await createEvent({
        id: eventId,
        ...eventData
      });
      showToast("Event submitted for admin review.");
    }

    resetEventForm(eventData.organizerName);
    await loadData();
  } catch (error) {
    showToast(error.message);
  }
});

elements.adminOrgRows.addEventListener("click", async (event) => {
  const detailButton = event.target.closest("[data-action='view-event-details']");
  if (detailButton) {
    openEventDetailsModal(detailButton.dataset.eventId);
    return;
  }

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

    if (button.dataset.action === "approve-event") {
      await approveEvent(button.dataset.eventId);
      showToast("Event approved and visible to buyers.");
    }

    if (button.dataset.action === "reject-event") {
      await rejectEvent(button.dataset.eventId);
      showToast("Event rejected and hidden from buyers.");
    }

    if (button.dataset.action === "delete-event") {
      await deleteEvent(button.dataset.eventId);
      showToast("Event deleted permanently.");
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

[elements.adminSellerRows, elements.adminBuyerRows].forEach((tableBody) => {
  tableBody?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='admin-user-details']");
    if (!button) return;
    openAdminUserDetails(button.dataset.userId);
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
elements.adminUserSearch?.addEventListener("input", (event) => {
  state.adminUserQuery = event.target.value.trim().toLowerCase();
  renderAdminUsers();
});

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
  if (event.target.closest("button")) return;
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

  if (!state.currentUser) {
    state.pendingBuyerEventId = state.selectedEventId;
    closeEventPreviewModal(false, false);
    openAuthForm("buyer");
    return;
  }

  if (state.currentProfile?.role !== "buyer") {
    showToast("Please use a buyer account to purchase tickets.");
    return;
  }

  changePanel("buyer");
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
      const ticketOrg = getOrg(ticketEvent?.orgId) || { name: organizerName(ticketEvent) };
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
      showToast("Ticket purchased successfully.");
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

async function handlePurchasedTicketDownload(event) {
  const button = event.target.closest("[data-action='download-purchased-ticket']");
  if (!button) return;
  const order = state.orders.find((item) => item.id === button.dataset.orderId);
  if (!order) {
    showToast("Ticket not found.");
    return;
  }

  try {
    await runButtonAction(button, "Preparing PDF...", () => downloadTicketPdf(ticketFromOrder(order)));
  } catch (error) {
    showToast(error.message || "Could not prepare ticket PDF.");
  }
}

elements.purchasedTicketList?.addEventListener("click", handlePurchasedTicketDownload);
elements.accountTicketList?.addEventListener("click", handlePurchasedTicketDownload);

elements.closeAccountModal?.addEventListener("click", closeAccountModal);
elements.accountModal?.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-account]")) closeAccountModal();
});

elements.deleteAccountButton?.addEventListener("click", () => {
  resetDeleteAccountConfirm();
  elements.deleteAccountConfirm.hidden = false;
  elements.deleteAccountText.focus();
});

elements.cancelDeleteAccount?.addEventListener("click", resetDeleteAccountConfirm);

elements.confirmDeleteAccount?.addEventListener("click", async () => {
  if (String(elements.deleteAccountText.value || "").trim() !== "DELETE") {
    setDeleteAccountMessage("Type DELETE to confirm account delete.");
    return;
  }

  try {
    await runButtonAction(elements.confirmDeleteAccount, "Deleting...", async () => {
      await deleteCurrentAccount();
    });
    closeAccountModal();
    state.currentUser = null;
    state.currentProfile = null;
    state.orders = [];
    changePanel("home");
    showToast("Account deleted.");
  } catch (error) {
    setDeleteAccountMessage(error.message || "Could not delete account.");
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
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !isAnyModalOpen()) return;
  if (!elements.checkoutPanel.hidden) {
    closeCheckoutModal();
  } else if (!elements.eventPreviewPanel.hidden) {
    closeEventPreviewModal();
  } else if (!elements.accountModal.hidden) {
    closeAccountModal();
  } else if (!elements.authModal.hidden) {
    closeAuthModal();
  } else if (!elements.eventDetailsModal.hidden) {
    closeEventDetailsModal();
  }
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
  promptSellerProfileIfNeeded();
});

// TICKOLAS_SELLER_ACCOUNT_PATCH_20260715
(() => {
  if (window.__tickolasSellerAccountPatch20260715) return;
  window.__tickolasSellerAccountPatch20260715 = true;

  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const nodes = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function isSellerContext() {
    const pageText = normalize(document.body?.innerText);
    if (pageText.includes('organization panel') || pageText.includes('seller workspace')) return true;

    const activeName = normalize(
      nodes('button, a')
        .map((node) => node.textContent)
        .find((label) => label && !/logout|dark|light|admin|sign up|login/i.test(label))
    );

    try {
      for (const key of Object.keys(localStorage)) {
        const raw = localStorage.getItem(key) || '';
        const lower = raw.toLowerCase();
        if (!lower.includes('seller')) continue;
        if (!activeName || lower.includes(activeName) || lower.includes('"role":"seller"') || lower.includes('role:seller')) {
          return true;
        }
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  function removeAccountDeletionPanels() {
    const candidates = nodes('section, article, div')
      .filter((node) => {
        const text = normalize(node.innerText);
        return text.includes('delete account') && (text.includes('permanently delete') || text.includes('type delete') || text.includes('removes your tickolas login'));
      })
      .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);

    if (candidates[0]) candidates[0].remove();
  }

  function removePurchasedTicketsFromSellerProfile(accountRoot) {
    const headings = nodes('h1, h2, h3, h4, strong, b', accountRoot).filter((node) => normalize(node.textContent) === 'purchased tickets');
    headings.forEach((heading) => {
      let block = heading.closest('section, article, .card, .panel-card, div');
      while (block && block !== accountRoot) {
        const text = normalize(block.innerText);
        if (text.includes('purchased tickets') && (text.includes('ticket history') || text.includes('no purchased ticket') || text.includes('tickets'))) {
          block.remove();
          return;
        }
        block = block.parentElement;
      }
    });
  }

  function polishSellerAccountProfile() {
    const accountRoot = nodes('section, article, div')
      .filter((node) => {
        const text = normalize(node.innerText);
        return text.includes('your tickolas account') && text.includes('role') && text.includes('seller');
      })
      .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];

    if (!accountRoot) return;
    accountRoot.classList.add('seller-account-profile');

    nodes('h1, h2, h3', accountRoot).forEach((heading) => {
      if (normalize(heading.textContent) === 'your tickolas account') heading.textContent = 'Seller account';
    });

    nodes('p', accountRoot).forEach((paragraph) => {
      if (normalize(paragraph.textContent).includes('manage your profile and purchased tickets')) {
        paragraph.textContent = 'Manage your seller profile and ticket selling workspace from one place.';
      }
    });

    nodes('*', accountRoot).forEach((node) => {
      if (normalize(node.textContent) === 'tickets bought') node.textContent = 'Events created';
    });

    removePurchasedTicketsFromSellerProfile(accountRoot);

    if (!accountRoot.querySelector('[data-seller-workspace-action]')) {
      const closeButton = nodes('button, a', accountRoot).find((button) => normalize(button.textContent) === 'x');
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'seller-workspace-action premium-btn';
      action.dataset.sellerWorkspaceAction = 'true';
      action.textContent = 'Open ticket selling form';
      action.addEventListener('click', openSellerWorkspace);
      (closeButton?.parentElement || accountRoot).appendChild(action);
    }
  }

  function openSellerWorkspace() {
    if (!state.currentUser) {
      openAuthForm('seller');
      return;
    }

    if (userRole() !== 'seller') {
      showToast('Please login as seller first.');
      return;
    }

    closeAccountModal();
    changePanel('seller');
    setTimeout(() => {
      const form = elements.eventForm || nodes('form, section, article, div').find((node) => normalize(node.innerText).includes('create event'));
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 160);
  }

  function addSellerDashboardShortcut() {
    if (!isSellerContext()) return;
    if (document.querySelector('[data-seller-shortcut="true"]')) return;

    const logoutButton = nodes('button, a').find((node) => normalize(node.textContent) === 'logout');
    if (!logoutButton?.parentElement) return;

    const shortcut = document.createElement('button');
    shortcut.type = 'button';
    shortcut.dataset.sellerShortcut = 'true';
    shortcut.className = 'seller-dashboard-shortcut premium-btn';
    shortcut.textContent = 'Sell tickets';
    shortcut.addEventListener('click', openSellerWorkspace);
    logoutButton.parentElement.insertBefore(shortcut, logoutButton);
  }

  function applySellerAccountPatch() {
    removeAccountDeletionPanels();
    polishSellerAccountProfile();
  }

  document.addEventListener('DOMContentLoaded', applySellerAccountPatch);
  document.addEventListener('click', () => setTimeout(applySellerAccountPatch, 50), true);
  new MutationObserver(applySellerAccountPatch).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(applySellerAccountPatch, 1500);
})();
