const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;

loadLocalEnv();

const port = process.env.PORT || 3000;
const feeRate = 0.01;

let adminApp = null;
let adminError = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) return;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function safePath(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    decodedPath = "/index.html";
  }
  const requested = decodedPath === "/" ? "/index.html" : decodedPath;
  const resolved = path.normalize(path.join(root, requested));
  return resolved === root || resolved.startsWith(root + path.sep)
    ? resolved
    : path.join(root, "index.html");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function normalizePrivateKey(value) {
  return typeof value === "string" ? value.replace(/\\n/g, "\n") : value;
}

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  }

  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialPath) {
    const file = fs.readFileSync(path.resolve(credentialPath), "utf8");
    const parsed = JSON.parse(file);
    parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  }

  return null;
}

function getAdmin() {
  if (adminApp) return adminApp;
  if (adminError) throw adminError;

  try {
    const { cert, getApps, initializeApp } = require("firebase-admin/app");
    const { getAuth } = require("firebase-admin/auth");
    const { FieldValue, getFirestore } = require("firebase-admin/firestore");
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      throw new Error("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON.");
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID
      });
    }

    const firestore = Object.assign(() => getFirestore(), { FieldValue });
    adminApp = {
      auth: () => getAuth(),
      firestore
    };
    return adminApp;
  } catch (error) {
    adminError = error;
    throw adminError;
  }
}

async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw Object.assign(new Error("Login token missing."), { status: 401 });
  try {
    return await getAdmin().auth().verifyIdToken(token);
  } catch {
    throw Object.assign(new Error("Login session is invalid or expired. Please login again."), { status: 401 });
  }
}

function splitAmount(gross) {
  const fee = Math.round(gross * feeRate);
  return {
    fee,
    orgShare: gross - fee
  };
}

function cleanString(value, fallback = "") {
  return String(value || fallback).trim().slice(0, 120);
}

function paymentMethod(value) {
  const selected = cleanString(value, "bKash");
  return ["bKash", "Nagad", "Rocket"].includes(selected) ? selected : "bKash";
}

function normalizeVoucherCode(value) {
  return String(value || "").trim().toLowerCase();
}

function findVoucher(event, code) {
  const normalized = normalizeVoucherCode(code);
  if (!normalized || !Array.isArray(event.vouchers)) return null;
  return event.vouchers.find((voucher) => normalizeVoucherCode(voucher.code) === normalized) || null;
}

function cleanVouchers(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((voucher) => ({
      code: cleanString(voucher.code, "").slice(0, 40),
      discountPercent: Math.min(Math.max(Number(voucher.discountPercent || 0), 1), 100)
    }))
    .filter((voucher) => {
      const key = normalizeVoucherCode(voucher.code);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

function serviceKeyFromLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function cleanServices(value) {
  const defaults = [
    { key: "entry", label: "Entry" },
    { key: "breakfast", label: "Breakfast" },
    { key: "lunch", label: "Lunch" },
    { key: "dinner", label: "Dinner" }
  ];
  const incoming = Array.isArray(value) ? value : [];
  const source = incoming.length ? [defaults[0], ...incoming] : defaults;
  const seen = new Set();
  return source
    .map((service) => ({
      key: serviceKeyFromLabel(service.key || service.label),
      label: cleanString(service.label || service.key || "", "").slice(0, 32)
    }))
    .filter((service) => {
      if (!service.key || !service.label || seen.has(service.key)) return false;
      seen.add(service.key);
      return true;
    })
    .slice(0, 12);
}

function ticketIdFromScan(value) {
  const raw = cleanString(value, "").slice(0, 800);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const hash = parsed.hash || "";
    if (hash.startsWith("#verify-ticket?")) {
      return cleanString(new URLSearchParams(hash.replace("#verify-ticket?", "")).get("id"));
    }
    return cleanString(parsed.searchParams.get("id"));
  } catch {
    const hashIndex = raw.indexOf("#verify-ticket?");
    if (hashIndex !== -1) {
      return cleanString(new URLSearchParams(raw.slice(hashIndex).replace("#verify-ticket?", "")).get("id"));
    }
    return raw;
  }
}

function fuzzyTicketKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[il1|]/g, "1")
    .replace(/[o0]/g, "0");
}

async function getOrderForScan(transaction, db, eventId, ticketId) {
  const exactRef = db.collection("orders").doc(ticketId);
  const exactSnap = await transaction.get(exactRef);
  if (exactSnap.exists) return { ref: exactRef, snap: exactSnap };

  const fuzzyInput = fuzzyTicketKey(ticketId);
  const eventOrders = await transaction.get(db.collection("orders").where("eventId", "==", eventId));
  const match = eventOrders.docs.find((item) => fuzzyTicketKey(item.id) === fuzzyInput || fuzzyTicketKey(item.data().id) === fuzzyInput);
  return match ? { ref: match.ref, snap: match } : { ref: exactRef, snap: exactSnap };
}

async function createVerifiedOrder(req, res) {
  if (process.env.DEV_PAYMENT_MODE !== "true") {
    sendJson(res, 403, {
      error: "Local test purchase is disabled. Set DEV_PAYMENT_MODE=true for local testing, or connect a real payment gateway."
    });
    return;
  }

  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);

  const eventId = cleanString(body.eventId);
  const quantity = Math.max(1, Math.min(Number(body.quantity) || 1, 20));
  if (!eventId) {
    sendJson(res, 400, { error: "Event is required." });
    return;
  }

  const db = admin.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const eventRef = db.collection("events").doc(eventId);
  const orderRef = db.collection("orders").doc();

  const order = await db.runTransaction(async (transaction) => {
    const [profileSnap, eventSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(eventRef)
    ]);

    if (!profileSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
    const profile = profileSnap.data();
    if (!["buyer", "admin"].includes(profile.role)) {
      throw Object.assign(new Error("Only buyer accounts can purchase tickets."), { status: 403 });
    }

    if (!eventSnap.exists) throw Object.assign(new Error("Event not found."), { status: 404 });
    const event = { id: eventSnap.id, ...eventSnap.data() };
    if (event.status !== "live") throw Object.assign(new Error("This event is not live."), { status: 400 });

    const price = Number(event.price || 0);
    const capacity = Number(event.capacity || 0);
    const sold = Number(event.sold || 0);
    const remaining = capacity - sold;

    if (!Number.isFinite(price) || price <= 0) throw Object.assign(new Error("Event price is invalid."), { status: 400 });
    if (quantity > remaining) throw Object.assign(new Error(`Only ${remaining} tickets are available.`), { status: 400 });

    const subtotal = price * quantity;
    const voucher = findVoucher(event, body.voucherCode);
    const discountPercent = voucher ? Math.min(Math.max(Number(voucher.discountPercent || 0), 0), 100) : 0;
    const discount = Math.round(subtotal * (discountPercent / 100));
    const gross = Math.max(subtotal - discount, 0);
    const split = splitAmount(gross);
    const verifiedOrder = {
      id: orderRef.id,
      eventId,
      userId: user.uid,
      buyerName: cleanString(body.buyerName, profile.displayName || user.name || "Buyer"),
      buyerEmail: user.email || cleanString(body.buyerEmail),
      quantity,
      subtotal,
      discount,
      voucherCode: voucher ? voucher.code : "",
      voucherDiscountPercent: discountPercent,
      gross,
      fee: split.fee,
      orgShare: split.orgShare,
      paymentMethod: paymentMethod(body.paymentMethod),
      paymentStatus: "verified_dev",
      paymentReference: `dev-${Date.now()}-${orderRef.id}`,
      serviceStatus: {},
      status: "confirmed",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    transaction.update(eventRef, {
      sold: admin.firestore.FieldValue.increment(quantity),
      revenueGross: admin.firestore.FieldValue.increment(gross),
      revenueFee: admin.firestore.FieldValue.increment(split.fee),
      revenueOrgShare: admin.firestore.FieldValue.increment(split.orgShare)
    });
    transaction.set(orderRef, verifiedOrder);

    return {
      ...verifiedOrder,
      createdAt: new Date().toISOString()
    };
  });

  sendJson(res, 201, { order });
}

async function scanTicketService(req, res) {
  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);
  const eventId = cleanString(body.eventId);
  const service = serviceKeyFromLabel(body.service);
  const ticketId = ticketIdFromScan(body.ticketCode || body.ticketId || body.orderId);

  if (!eventId) throw Object.assign(new Error("Select an event first."), { status: 400 });
  if (!service) throw Object.assign(new Error("Select a scan module first."), { status: 400 });
  if (!ticketId) throw Object.assign(new Error("Ticket QR or ticket ID is required."), { status: 400 });

  const db = admin.firestore();
  const userRef = db.collection("users").doc(user.uid);
  const eventRef = db.collection("events").doc(eventId);

  const result = await db.runTransaction(async (transaction) => {
    const [profileSnap, eventSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(eventRef)
    ]);

    if (!profileSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
    const profile = profileSnap.data();
    if (!["seller", "admin"].includes(profile.role)) {
      throw Object.assign(new Error("Only seller accounts can scan tickets."), { status: 403 });
    }

    if (!eventSnap.exists) throw Object.assign(new Error("Event not found."), { status: 404 });
    const eventData = eventSnap.data();
    if (profile.role !== "admin" && eventData.createdBy !== user.uid) {
      throw Object.assign(new Error("You can scan only your own event tickets."), { status: 403 });
    }
    const allowedServices = cleanServices(eventData.serviceModules);
    if (!allowedServices.some((item) => item.key === service)) {
      throw Object.assign(new Error("This scan module is not enabled for this event."), { status: 400 });
    }

    const { ref: orderRef, snap: orderSnap } = await getOrderForScan(transaction, db, eventId, ticketId);
    if (!orderSnap.exists) throw Object.assign(new Error("Ticket not found."), { status: 404 });
    const order = orderSnap.data();
    if (order.eventId !== eventId) {
      throw Object.assign(new Error("This ticket belongs to a different event."), { status: 403 });
    }
    if (order.status !== "confirmed") {
      throw Object.assign(new Error("This ticket is not confirmed."), { status: 400 });
    }

    const serviceStatus = order.serviceStatus || {};
    const previous = serviceStatus[service];
    if (previous?.used) {
      const usedAt = typeof previous.usedAt?.toDate === "function" ? previous.usedAt.toDate().toISOString() : previous.usedAt || "";
      throw Object.assign(new Error(`${service} already served.`), {
        status: 409,
        payload: {
          alreadyServed: true,
          service,
          usedAt,
          ticketId,
          buyerName: order.buyerName || "Buyer",
          buyerEmail: order.buyerEmail || ""
        }
      });
    }

    const scanRecord = {
      used: true,
      service,
      eventId,
      scannedBy: user.uid,
      scannerEmail: user.email || profile.email || "",
      usedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    transaction.update(orderRef, {
      [`serviceStatus.${service}`]: scanRecord,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      ok: true,
      service,
      ticketId,
      buyerName: order.buyerName || "Buyer",
      buyerEmail: order.buyerEmail || "",
      quantity: order.quantity || 1,
      eventTitle: eventData.title || "Event",
      scannedAt: new Date().toISOString()
    };
  });

  sendJson(res, 200, result);
}

async function createSslcommerzSession(req, res) {
  await requireUser(req);
  sendJson(res, 501, {
    error: "SSLCOMMERZ backend route is reserved. Add sandbox/live credentials before enabling real payment sessions."
  });
}

async function updateEventVouchers(req, res) {
  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);
  const eventId = cleanString(body.eventId);
  if (!eventId) {
    sendJson(res, 400, { error: "Event is required." });
    return;
  }

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(user.uid).get();
  if (!userSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
  const profile = userSnap.data();
  if (!["seller", "admin"].includes(profile.role)) {
    throw Object.assign(new Error("Only seller accounts can manage vouchers."), { status: 403 });
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw Object.assign(new Error("Event not found."), { status: 404 });
  const eventData = eventSnap.data();
  if (profile.role !== "admin" && eventData.createdBy !== user.uid) {
    throw Object.assign(new Error("You can manage only your own event vouchers."), { status: 403 });
  }

  const vouchers = cleanVouchers(body.vouchers);
  await eventRef.update({
    vouchers,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  sendJson(res, 200, { event: { id: eventId, vouchers } });
}

async function updateEventServices(req, res) {
  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);
  const eventId = cleanString(body.eventId);
  if (!eventId) {
    sendJson(res, 400, { error: "Event is required." });
    return;
  }

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(user.uid).get();
  if (!userSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
  const profile = userSnap.data();
  if (!["seller", "admin"].includes(profile.role)) {
    throw Object.assign(new Error("Only seller accounts can manage scan modules."), { status: 403 });
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw Object.assign(new Error("Event not found."), { status: 404 });
  const eventData = eventSnap.data();
  if (profile.role !== "admin" && eventData.createdBy !== user.uid) {
    throw Object.assign(new Error("You can manage only your own scan modules."), { status: 403 });
  }

  const serviceModules = cleanServices(body.services);
  await eventRef.update({
    serviceModules,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  sendJson(res, 200, { event: { id: eventId, serviceModules } });
}

async function saveSellerOrganizationApi(req, res) {
  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);
  const orgId = cleanString(body.orgId);
  const ownerId = cleanString(body.ownerId);

  if (!orgId) throw Object.assign(new Error("Organization is required."), { status: 400 });
  if (ownerId !== user.uid) throw Object.assign(new Error("You can update only your own organization."), { status: 403 });

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(user.uid).get();
  if (!userSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
  const profile = userSnap.data();
  if (!["seller", "admin"].includes(profile.role)) {
    throw Object.assign(new Error("Only seller accounts can publish events."), { status: 403 });
  }

  const orgRef = db.collection("organizations").doc(orgId);
  const orgSnap = await orgRef.get();
  const payload = {
    name: cleanString(body.name, profile.displayName || "Organizer"),
    type: cleanString(body.type, "Event organizer"),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (orgSnap.exists) {
    const org = orgSnap.data();
    if (profile.role !== "admin" && org.ownerId !== user.uid) {
      throw Object.assign(new Error("You can update only your own organization."), { status: 403 });
    }
    await orgRef.update(payload);
  } else {
    await orgRef.set({
      ...payload,
      ownerId: user.uid,
      approved: false,
      status: "review",
      paidOut: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  sendJson(res, 200, {
    organization: {
      id: orgId,
      name: payload.name,
      type: payload.type,
      ownerId: user.uid
    }
  });
}

function cleanEventPayload(data, user, existing = null) {
  const capacity = Math.max(1, Number(data.capacity) || 0);
  const price = Math.max(1, Number(data.price) || 0);
  return {
    orgId: cleanString(data.orgId, `seller-${user.uid}`),
    sellerEmail: cleanString(data.sellerEmail, user.email || ""),
    organizerName: cleanString(data.organizerName, "Organizer"),
    title: cleanString(data.title, "Untitled event"),
    category: cleanString(data.category, "Conference"),
    venue: cleanString(data.venue, "Venue"),
    details: String(data.details || "").trim().slice(0, 900),
    imageUrl: String(data.imageUrl || "").trim(),
    date: cleanString(data.date),
    price,
    capacity,
    serviceModules: cleanServices(data.serviceModules || existing?.serviceModules),
    createdBy: existing?.createdBy || user.uid,
    status: "review"
  };
}

async function saveEventApi(req, res) {
  const admin = getAdmin();
  const user = await requireUser(req);
  const body = await readBody(req);
  const eventId = cleanString(body.eventId || body.id);
  const input = body.data || body;

  if (!eventId) throw Object.assign(new Error("Event ID is required."), { status: 400 });

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(user.uid).get();
  if (!userSnap.exists) throw Object.assign(new Error("User profile missing."), { status: 403 });
  const profile = userSnap.data();
  if (!["seller", "admin"].includes(profile.role)) {
    throw Object.assign(new Error("Only seller accounts can publish events."), { status: 403 });
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  const existing = eventSnap.exists ? eventSnap.data() : null;

  if (existing && profile.role !== "admin" && existing.createdBy !== user.uid) {
    throw Object.assign(new Error("You can edit only your own events."), { status: 403 });
  }

  const payload = cleanEventPayload(input, user, existing);
  if (payload.createdBy !== user.uid && profile.role !== "admin") {
    throw Object.assign(new Error("You can publish only your own events."), { status: 403 });
  }

  if (eventSnap.exists) {
    await eventRef.update({
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    await eventRef.set({
      ...payload,
      id: eventId,
      sold: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  sendJson(res, 200, { event: { id: eventId, ...payload } });
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        firebaseAdminConfigured: Boolean(
          process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
            process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS
        ),
        devPaymentMode: process.env.DEV_PAYMENT_MODE === "true"
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/orders/dev-confirm") {
      await createVerifiedOrder(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/events/vouchers") {
      await updateEventVouchers(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/events/services") {
      await updateEventServices(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/organizations/save") {
      await saveSellerOrganizationApi(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/events/save") {
      await saveEventApi(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/tickets/scan-service") {
      await scanTicketService(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/payments/sslcommerz/initiate") {
      await createSslcommerzSession(req, res);
      return;
    }

    sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Backend request failed.",
      ...(error.payload || {})
    });
  }
}

function serveStatic(req, res, url) {
  const filePath = safePath(url.pathname);
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  });
}

function requestHandler(req, res) {
  try {
    const host = req.headers.host || `localhost:${port}`;
    const url = new URL(req.url || "/", `http://${host}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    console.error(`[request-error] ${error.stack || error.message}`);
    if (!res.headersSent) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end("Bad request");
  }
}

if (require.main === module) {
  const server = http.createServer(requestHandler);

  server.on("clientError", (error, socket) => {
    console.error(`[client-error] ${error.message}`);
    if (socket.writable) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    }
  });

  server.on("error", (error) => {
    console.error(`[server-error] ${error.stack || error.message}`);
  });

  process.on("unhandledRejection", (error) => {
    console.error(`[unhandled-rejection] ${error?.stack || error}`);
  });

  process.on("uncaughtException", (error) => {
    console.error(`[uncaught-exception] ${error.stack || error.message}`);
  });

  server.listen(port, () => {
    console.log(`Tickolas local server running at http://localhost:${port}`);
    console.log("Trusted backend API enabled at /api.");
  });
}

module.exports = {
  requestHandler
};
