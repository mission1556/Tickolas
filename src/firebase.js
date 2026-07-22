import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyCTbXab5djaHa3fjQaPhJ1TZATZ_5mLcRI",
  authDomain: "tickolas-da77a.firebaseapp.com",
  projectId: "tickolas-da77a",
  storageBucket: "tickolas-da77a.firebasestorage.app",
  messagingSenderId: "537966181058",
  appId: "1:537966181058:web:03e063a4e2b5e15814d95b",
  measurementId: "G-9GYH0DJ9RX"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const auth = getAuth(firebaseApp);

const CLOUDINARY_CLOUD_NAME = "qsbc4vql";
const CLOUDINARY_UPLOAD_PRESET = "tickolas_unsigned_uploads";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

isSupported().then((supported) => {
  if (supported) getAnalytics(firebaseApp);
});

function fromSnap(snapshot) {
  return snapshot.docs.map((item) => ({
    ...item.data(),
    id: item.id
  }));
}

function apiUrl(path) {
  const apiBase = ["5500", "5501"].includes(window.location.port) ? "http://localhost:3000" : "";
  return `${apiBase}${path}`;
}

function timeValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  return new Date(value).getTime() || 0;
}

function byCreatedAtAsc(a, b) {
  return timeValue(a.createdAt) - timeValue(b.createdAt);
}

function byCreatedAtDesc(a, b) {
  return timeValue(b.createdAt) - timeValue(a.createdAt);
}

function compactUserCode(role = "buyer", uid = "") {
  const prefix = role === "admin" ? "ADM" : role === "seller" ? "SEL" : "BUY";
  const source = String(uid || Math.random().toString(36).slice(2, 10))
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${source || Date.now().toString(36).toUpperCase()}`;
}

function byDateAsc(a, b) {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }

    callback(user, await getUserProfile(user.uid));
  });
}

export async function getUserProfile(uid) {
  const profile = await getDoc(doc(db, "users", uid));
  return profile.exists() ? { ...profile.data(), id: profile.id } : null;
}

export async function ensureUserProfile(user, role) {
  const existingProfile = await getUserProfile(user.uid);
  if (existingProfile) {
    if (!existingProfile.userCode) {
      const userCode = compactUserCode(existingProfile.role || role, user.uid);
      await updateDoc(doc(db, "users", user.uid), { userCode });
      return { ...existingProfile, userCode };
    }

    return existingProfile;
  }

  const profile = {
    email: user.email || "",
    role,
    displayName: user.displayName || "",
    userCode: compactUserCode(role, user.uid),
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, "users", user.uid), profile);
  return { ...profile, id: user.uid };
}

export async function registerUser({ email, password, role, displayName = "", dateOfBirth = "" }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(credential.user);
  return credential.user;
}

export async function getUsers() {
  const snapshot = await getDocs(query(collection(db, "users")));
  return fromSnap(snapshot).sort(byCreatedAtDesc);
}

export async function updateUserProfileInfo({ displayName = "", dateOfBirth = "" }) {
  if (!auth.currentUser) {
    throw new Error("Please login first.");
  }

  const payload = {
    displayName: String(displayName || "").trim(),
    updatedAt: serverTimestamp()
  };

  if (dateOfBirth !== undefined) {
    payload.dateOfBirth = String(dateOfBirth || "").trim();
  }

  await updateDoc(doc(db, "users", auth.currentUser.uid), payload);
}

export async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function resendCurrentUserVerification() {
  if (!auth.currentUser) {
    throw new Error("Please login first.");
  }
  await sendEmailVerification(auth.currentUser);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  return credential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function deleteCurrentAccount() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/users/delete-account"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Account delete failed.");

  await signOut(auth).catch(() => {});
  return payload;
}

export async function getOrganizations({ publicOnly = false, ownerId = "" } = {}) {
  const baseQuery = ownerId
    ? query(collection(db, "organizations"), where("ownerId", "==", ownerId))
    : publicOnly
    ? query(collection(db, "organizations"), where("approved", "==", true))
    : query(collection(db, "organizations"));
  const snapshot = await getDocs(baseQuery);
  return fromSnap(snapshot).sort(byCreatedAtAsc);
}

export async function saveSellerOrganization({ orgId, ownerId, name, type }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/organizations/save"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ orgId, ownerId, name, type })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Organization update failed.");
  }

  return payload.organization;
}

export async function getEvents({ publicOnly = false, ownerId = "" } = {}) {
  const baseQuery = ownerId
    ? query(collection(db, "events"), where("createdBy", "==", ownerId))
    : publicOnly
    ? query(collection(db, "events"), where("status", "==", "live"))
    : query(collection(db, "events"));
  const snapshot = await getDocs(baseQuery);
  return fromSnap(snapshot).sort(byDateAsc);
}

export async function getOrders({ userId = "", admin = false } = {}) {
  if (!userId && !admin) return [];
  const baseQuery = admin
    ? query(collection(db, "orders"))
    : query(collection(db, "orders"), where("userId", "==", userId));
  const snapshot = await getDocs(baseQuery);
  return fromSnap(snapshot).sort(byCreatedAtDesc);
}

export async function approveOrganization(orgId) {
  await updateDoc(doc(db, "organizations", orgId), { approved: true });

  const reviewEvents = await getDocs(query(collection(db, "events"), where("orgId", "==", orgId)));
  await Promise.all(
    reviewEvents.docs
      .filter((item) => item.data().status === "review")
      .map((item) => updateDoc(item.ref, { status: "live" }))
  );
}

export async function rejectOrganization(orgId) {
  await updateDoc(doc(db, "organizations", orgId), { approved: false, status: "rejected" });

  const orgEvents = await getDocs(query(collection(db, "events"), where("orgId", "==", orgId)));
  await Promise.all(orgEvents.docs.map((item) => updateDoc(item.ref, { status: "rejected" })));
}

export async function deleteOrganization(orgId) {
  const orgEvents = await getDocs(query(collection(db, "events"), where("orgId", "==", orgId)));
  await Promise.all([
    ...orgEvents.docs.map((item) => deleteDoc(item.ref)),
    deleteDoc(doc(db, "organizations", orgId))
  ]);
}

export async function settleOrganization(orgId, paidOut) {
  await updateDoc(doc(db, "organizations", orgId), { paidOut });
}

export async function createEvent(data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/events/save"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventId: data.id, data })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Event publish failed.");
  }

  return payload.event;
}

export async function updateEvent(eventId, data) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/events/save"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventId, data })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Event update failed.");
  }

  return payload.event;
}

export async function updateEventVouchers(eventId, vouchers) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/events/vouchers"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventId, vouchers })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Voucher update failed.");
  }

  return payload.event;
}

export async function updateEventServices(eventId, services) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/events/services"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventId, services })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Service module update failed.");
  }

  return payload.event;
}

export async function uploadEventThumbnail(file, eventId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");
  if (!file) return "";

  const safeEventId = String(eventId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "-");
  const uploadData = new FormData();
  uploadData.append("file", file, `${safeEventId}-${Date.now()}.jpg`);
  uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: uploadData
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || "Image upload failed. Check the Cloudinary upload preset.";
    throw new Error(`Cloudinary: ${message}`);
  }

  return payload.secure_url || payload.url || "";
}

export async function scanTicketService({ eventId, service, ticketCode }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login as seller first.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/tickets/scan-service"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventId, service, ticketCode })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Ticket scan failed.");
    error.details = payload;
    throw error;
  }

  return payload;
}

export async function approveEvent(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "live" });
}

export async function rejectEvent(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "rejected" });
}

export async function pauseEvent(eventId) {
  await updateDoc(doc(db, "events", eventId), { status: "paused" });
}

export async function deleteEvent(eventId) {
  await deleteDoc(doc(db, "events", eventId));
}

export async function createOrder(input) {
  const user = auth.currentUser;
  if (!user) throw new Error("Please login before buying tickets.");

  const token = await user.getIdToken(true);
  const response = await fetch(apiUrl("/api/orders/dev-confirm"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Ticket purchase failed.");
  }

  return payload.order;
}

export async function seedDemoData(seed) {
  const writes = [];
  Object.entries(seed.organizations).forEach(([id, data]) => {
    writes.push(setDoc(doc(db, "organizations", id), data, { merge: true }));
  });
  Object.entries(seed.events).forEach(([id, data]) => {
    writes.push(setDoc(doc(db, "events", id), data, { merge: true }));
  });
  await Promise.all(writes);
}
