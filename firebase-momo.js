import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA_ilbegzsUstD2hp-94Ym2Hy82MIpPQ5U",
  authDomain: "momo-153f5.firebaseapp.com",
  projectId: "momo-153f5",
  storageBucket: "momo-153f5.firebasestorage.app",
  messagingSenderId: "203733258491",
  appId: "1:203733258491:web:8b25ca857bc57a4247205e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const cloudDb = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

const DB_NAME = "momo_database";
const MEDIA_KEYS = new Set([
  "photo",
  "photoData",
  "receiptData",
  "imageData",
  "wallpaperData",
  "tripShoppingPhotoData"
]);
const LOCAL_STORAGE_PREFIX = "momo_";

const MOMO_VAPID_PUBLIC_KEY = "BHl9Crz0RRKBkb6h-dNQ9r7mxeyXj_laLEgkO0B72uKdDHtb_uSp4Y8o9Fe_iTCxv8zlRZUqrRaZLdbBTlzg-Ck";
const PUSH_SUBSCRIPTION_COLLECTION = "pushSubscriptions";
const NOTIFICATION_QUEUE_COLLECTION = "notificationQueue";

// Device-specific settings stay on this device even when the user signs in.
const DEVICE_LOCAL_SETTING_KEYS = new Set([
  "appearance_preferences"
]);

let currentUser = null;
let cloudMetadata = null;
let busy = false;

const byId = (id) => document.getElementById(id);

function toast(message) {
  const el = byId("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => el.classList.remove("show"), 2600);
}

function setStatus(message, tone = "neutral") {
  const status = byId("cloudAccountStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function setBusy(nextBusy) {
  busy = nextBusy;
  document.querySelectorAll("[data-cloud-action]").forEach((button) => {
    button.disabled = nextBusy;
  });
}

function isMobileApplePwa() {
  const ua = navigator.userAgent || "";
  const appleMobile = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  return appleMobile || standalone;
}

function openLocalDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function clearAndWriteStore(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Restore transaction was aborted."));
  });
}

function sanitizeForCloud(value, key = "") {
  if (MEDIA_KEYS.has(key)) return "";
  if (Array.isArray(value)) return value.map((item) => sanitizeForCloud(item));
  if (value && typeof value === "object") {
    const output = {};
    Object.entries(value).forEach(([childKey, childValue]) => {
      output[childKey] = sanitizeForCloud(childValue, childKey);
    });
    return output;
  }
  return value;
}

function recordKey(record, index) {
  const raw = record?.id ?? record?.key ?? `record-${index}`;
  return encodeURIComponent(String(raw)).replaceAll(".", "%2E");
}

async function snapshotMomoData() {
  const db = await openLocalDatabase();
  try {
    const storeNames = Array.from(db.objectStoreNames);
    const stores = {};
    for (const storeName of storeNames) {
      const records = await readStore(db, storeName);
      const cloudRecords =
        storeName === "settings"
          ? records.filter((record) => !DEVICE_LOCAL_SETTING_KEYS.has(record?.key))
          : records;

      stores[storeName] = cloudRecords.map((record) => sanitizeForCloud(record));
    }
    return {
      stores,
      storeNames,
      omittedMedia: true,
      devicePreferencesLocalOnly: true
    };
  } finally {
    db.close();
  }
}

async function commitOperations(operations) {
  const CHUNK = 450;
  for (let start = 0; start < operations.length; start += CHUNK) {
    const batch = writeBatch(cloudDb);
    operations.slice(start, start + CHUNK).forEach((op) => {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
}

async function uploadCloudBackup() {
  if (!currentUser || busy) return;
  const ok = window.confirm(
    "Replace your existing cloud copy with the Momo data currently on this device?\n\nThis overwrites the previous cloud backup. Receipt photos and custom wallpaper images stay on this device and are not uploaded."
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Uploading your Momo…");
  try {
    const snapshot = await snapshotMomoData();
    const uid = currentUser.uid;
    const operations = [];

    for (const storeName of snapshot.storeNames) {
      const recordsRef = collection(cloudDb, "users", uid, "stores", storeName, "records");
      const existing = await getDocs(recordsRef);
      existing.forEach((cloudDoc) => operations.push({ type: "delete", ref: cloudDoc.ref }));

      snapshot.stores[storeName].forEach((record, index) => {
        operations.push({
          type: "set",
          ref: doc(recordsRef, recordKey(record, index)),
          data: { payload: record }
        });
      });

      operations.push({
        type: "set",
        ref: doc(cloudDb, "users", uid, "stores", storeName),
        data: { count: snapshot.stores[storeName].length }
      });
    }

    await commitOperations(operations);

    await setDoc(doc(cloudDb, "users", uid), {
      email: currentUser.email || "",
      displayName: currentUser.displayName || "",
      updatedAt: serverTimestamp(),
      cloudBackupVersion: 1,
      storeNames: snapshot.storeNames,
      mediaPolicy: "local-only",
      devicePreferencesPolicy: "local-only"
    }, { merge: true });

    await refreshCloudMetadata();
    setStatus("Cloud backup updated", "success");
    toast("Momo cloud backup updated ☁️");
  } catch (error) {
    console.error("Momo cloud upload failed:", error);
    setStatus("Cloud backup failed", "error");
    toast("Could not upload Momo to cloud.");
  } finally {
    setBusy(false);
  }
}

async function readCloudStores(uid, storeNames) {
  const output = {};
  for (const storeName of storeNames) {
    const snapshot = await getDocs(collection(cloudDb, "users", uid, "stores", storeName, "records"));
    output[storeName] = snapshot.docs.map((item) => item.data()?.payload).filter(Boolean);
  }
  return output;
}

async function existingLocalPhotos(db) {
  if (!db.objectStoreNames.contains("expenses")) return new Map();
  const expenses = await readStore(db, "expenses");
  return new Map(expenses.filter((item) => item?.photo).map((item) => [String(item.id), item.photo]));
}

async function restoreCloudBackup() {
  if (!currentUser || busy) return;

  // Login and restore are deliberately separate actions. Nothing is restored automatically.
  if (!cloudMetadata?.exists) {
    toast("There is no cloud backup to restore yet.");
    return;
  }

  const ok = window.confirm(
    "Replace this device's current Momo records with your cloud copy?\n\nThis overwrites the local database records on this device. Existing receipt photos are preserved when their expense still exists. If this device has newer changes, upload them first before restoring."
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Restoring cloud backup…");
  try {
    const uid = currentUser.uid;
    const storeNames = Array.isArray(cloudMetadata.data?.storeNames) ? cloudMetadata.data.storeNames : [];
    const cloudStores = await readCloudStores(uid, storeNames);
    const db = await openLocalDatabase();

    try {
      const photoMap = await existingLocalPhotos(db);
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) continue;
        let records = cloudStores[storeName] || [];
        if (storeName === "expenses") {
          records = records.map((record) => ({
            ...record,
            photo: photoMap.get(String(record.id)) || record.photo || ""
          }));
        }

        if (storeName === "settings") {
          const currentSettings = await readStore(db, "settings");
          const localOnly = currentSettings.filter((record) => DEVICE_LOCAL_SETTING_KEYS.has(record?.key));
          const cloudSafe = records.filter((record) => !DEVICE_LOCAL_SETTING_KEYS.has(record?.key));
          records = [...cloudSafe, ...localOnly];
        }

        await clearAndWriteStore(db, storeName, records);
      }
    } finally {
      db.close();
    }

    toast("Cloud copy restored. Device appearance and preferences were kept local. Reloading Momo…");

// Give Safari/iOS enough time to fully release IndexedDB
// after the restore transactions and database connection have closed.
window.setTimeout(() => {
  window.location.reload();
}, 2500);

  } catch (error) {
    console.error("Momo cloud restore failed:", error);
    setStatus("Restore failed", "error");
    toast("Could not restore the cloud backup.");
    setBusy(false);
  }
}

function formatCloudDate(data) {
  const timestamp = data?.updatedAt;
  if (!timestamp?.toDate) return "Not backed up yet";
  return timestamp.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function refreshCloudMetadata() {
  if (!currentUser) return;

  const copyStatus = byId("cloudCopyStatus");
  const last = byId("cloudLastBackup");
  const owner = byId("cloudBackupOwner");
  const restoreButton = byId("restoreCloudBackup");

  if (copyStatus) copyStatus.textContent = "Checking…";
  if (last) last.textContent = "Checking…";
  if (owner) owner.textContent = currentUser.email || currentUser.displayName || "This account";

  try {
    const snap = await getDoc(doc(cloudDb, "users", currentUser.uid));
    cloudMetadata = { exists: snap.exists(), data: snap.exists() ? snap.data() : null };

    if (copyStatus) copyStatus.textContent = snap.exists() ? "Cloud copy available ✓" : "No cloud copy yet";
    if (last) last.textContent = snap.exists() ? formatCloudDate(snap.data()) : "Not backed up yet";

    if (owner) {
      const data = snap.exists() ? snap.data() : null;
      owner.textContent = data?.email || data?.displayName || currentUser.email || currentUser.displayName || "This account";
    }

    if (restoreButton) restoreButton.disabled = !snap.exists();
  } catch (error) {
    console.error("Could not read cloud metadata:", error);
    if (copyStatus) copyStatus.textContent = "Could not check cloud copy";
    if (last) last.textContent = "Status unavailable";
  }
}

function updateEmailVerificationUI(user) {
  const row = byId("cloudEmailVerificationRow");
  const status = byId("cloudEmailVerificationStatus");
  const resend = byId("cloudResendVerification");

  if (!row || !status || !resend) return;

  const hasPasswordProvider = user.providerData?.some((provider) => provider.providerId === "password");

  if (!hasPasswordProvider || !user.email) {
    row.hidden = true;
    resend.hidden = true;
    return;
  }

  row.hidden = false;

  if (user.emailVerified) {
    status.textContent = "✓ Email verified";
    status.dataset.tone = "success";
    resend.hidden = true;
  } else {
    status.textContent = "⚠ Email not verified";
    status.dataset.tone = "warning";
    resend.hidden = false;
  }
}

async function resendVerificationEmail() {
  if (!currentUser || busy) return;

  if (currentUser.emailVerified) {
    toast("Your email is already verified.");
    updateEmailVerificationUI(currentUser);
    return;
  }

  setBusy(true);

  try {
    await sendEmailVerification(currentUser);
    toast("Verification email sent. Check your inbox or spam folder.");
  } catch (error) {
    console.error("Verification email could not be sent:", error);
    toast("Could not send the verification email yet.");
  } finally {
    setBusy(false);
  }
}

function showSignedOut() {
  byId("cloudSignedOut")?.removeAttribute("hidden");
  byId("cloudSignedIn")?.setAttribute("hidden", "");
  const drawerTitle = byId("drawerAccountTitle");
  const drawerSubtitle = byId("drawerAccountSubtitle");
  if (drawerTitle) drawerTitle.textContent = "Account & Cloud";
  if (drawerSubtitle) drawerSubtitle.textContent = "Using Momo on this device.";
  const verificationRow = byId("cloudEmailVerificationRow");
  if (verificationRow) verificationRow.hidden = true;
  setStatus("Local mode", "success");
}

function showSignedIn(user) {
  byId("cloudSignedOut")?.setAttribute("hidden", "");
  byId("cloudSignedIn")?.removeAttribute("hidden");

  const name = user.displayName || user.email || "Momo account";
  const email = user.email || "Google account";
  const avatar = byId("cloudAccountAvatar");
  if (avatar) avatar.textContent = name.trim().charAt(0).toUpperCase() || "🍑";
  if (byId("cloudAccountName")) byId("cloudAccountName").textContent = name;
  if (byId("cloudAccountEmail")) byId("cloudAccountEmail").textContent = email;
  if (byId("drawerAccountTitle")) byId("drawerAccountTitle").textContent = name;
  if (byId("drawerAccountSubtitle")) byId("drawerAccountSubtitle").textContent = "Cloud backup available";
  updateEmailVerificationUI(user);
  setStatus("Signed in · local data active", "success");

  const copyStatus = byId("cloudCopyStatus");
  const last = byId("cloudLastBackup");
  const owner = byId("cloudBackupOwner");
  const restoreButton = byId("restoreCloudBackup");
  if (copyStatus) copyStatus.textContent = "Tap ↻ to check";
  if (last) last.textContent = "Not checked yet";
  if (owner) owner.textContent = user.email || user.displayName || "This account";
  if (restoreButton) restoreButton.disabled = true;
}

async function googleSignIn() {
  if (busy) return;

  setBusy(true);

  try {
    await signInWithPopup(auth, googleProvider);
    toast("Welcome to Momo 🍑");
  } catch (error) {
    console.error("Google sign-in failed:", error);

    if (error.code === "auth/popup-closed-by-user") {
      toast("Google sign-in was cancelled.");
    } else if (error.code === "auth/popup-blocked") {
      toast("Your browser blocked the Google sign-in window. Please allow pop-ups and try again.");
    } else {
      toast("Google sign-in did not complete.");
    }
  } finally {
    setBusy(false);
  }
}

async function emailSignIn(mode) {
  if (busy) return;
  const email = byId("cloudEmail")?.value.trim() || "";
  const password = byId("cloudPassword")?.value || "";
  if (!email || !password) {
    toast("Enter your email and password first.");
    return;
  }

  setBusy(true);
  try {
    if (mode === "create") {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try { await sendEmailVerification(credential.user); } catch (error) { console.warn("Verification email could not be sent:", error); }
      toast("Account created. Check your email for verification.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Welcome back to Momo 🍑");
    }
    if (byId("cloudPassword")) byId("cloudPassword").value = "";
  } catch (error) {
    console.error("Email authentication failed:", error);
    const friendly = {
      "auth/email-already-in-use": "That email already has a Momo account.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/weak-password": "Please use a stronger password.",
      "auth/invalid-email": "That email address does not look valid."
    }[error.code] || "Could not complete email sign-in.";
    toast(friendly);
  } finally {
    setBusy(false);
  }
}

async function resetPassword() {
  const email = byId("cloudEmail")?.value.trim() || window.prompt("Email address for your Momo account:")?.trim();
  if (!email) return;
  try {
    await sendPasswordResetEmail(auth, email);
    toast("Password reset email sent.");
  } catch (error) {
    console.error("Password reset failed:", error);
    toast("Could not send the reset email.");
  }
}

function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function sha256Text(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isIosLike() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
}

async function getPushRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("This browser does not support Momo phone notifications.");
  return navigator.serviceWorker.ready;
}

async function currentPushSubscription() {
  try {
    const registration = await getPushRegistration();
    return registration.pushManager?.getSubscription?.() || null;
  } catch {
    return null;
  }
}

async function savePushSubscription(subscription) {
  if (!currentUser) throw new Error("Sign in under Account & Cloud first to use phone notifications.");
  const json = subscription.toJSON();
  const id = await sha256Text(json.endpoint || subscription.endpoint);
  await setDoc(doc(cloudDb, "users", currentUser.uid, PUSH_SUBSCRIPTION_COLLECTION, id), {
    endpoint: json.endpoint || subscription.endpoint,
    keys: json.keys || {},
    userAgent: navigator.userAgent || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

async function enablePush() {
  if (!currentUser) throw new Error("Sign in under Account & Cloud first, then come back here.");
  if (!("Notification" in window) || !("PushManager" in window)) {
    if (isIosLike() && !isStandalonePwa()) {
      throw new Error("On iPhone, install Momo to your Home Screen first, then enable notifications inside the installed app.");
    }
    throw new Error("Phone notifications are not supported by this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed. You can change this in your phone settings.");

  const registration = await getPushRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(MOMO_VAPID_PUBLIC_KEY)
    });
  }
  await savePushSubscription(subscription);
  return subscription;
}

async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  const json = subscription.toJSON();
  const id = await sha256Text(json.endpoint || subscription.endpoint);
  if (currentUser) {
    try { await deleteDoc(doc(cloudDb, "users", currentUser.uid, PUSH_SUBSCRIPTION_COLLECTION, id)); } catch (error) { console.warn("Could not remove cloud push subscription:", error); }
  }
  await subscription.unsubscribe();
}

function reminderDueAt(item, type) {
  const dateString = type === "recurring" ? item.nextDueDate : (type === "custom" || type === "gentle") ? item.date : item.targetDate;
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = String(item.remindTime || "09:00").split(":").map(Number);
  const due = new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0);
  due.setDate(due.getDate() - Number(item.remindDaysBefore || 0));
  return due.toISOString();
}

async function syncReminder(type, item) {
  if (!currentUser || !item?.id) return false;
  if (!item.phoneReminder) {
    await deleteReminder(type, item.id);
    return false;
  }

  const subscription = await currentPushSubscription();
  if (!subscription || Notification.permission !== "granted") return false;
  await savePushSubscription(subscription);

  const dateString = type === "recurring" ? item.nextDueDate : (type === "custom" || type === "gentle") ? item.date : item.targetDate;
  if (!dateString) return false;
  const queueId = `${currentUser.uid}__${type}__${item.id}`;
  const title = type === "recurring" ? (item.name || "Recurring expense") : (type === "custom" || type === "gentle") ? (item.title || "Reminder") : (item.title || "Planned expense");
  const amount = Number(item.amount || 0);
  const currency = item.currency || "PHP";

  await setDoc(doc(cloudDb, NOTIFICATION_QUEUE_COLLECTION, queueId), {
    uid: currentUser.uid,
    localId: item.id,
    type,
    title,
    amount,
    currency,
    note: (type === "custom" || type === "gentle") ? (item.note || "") : "",
    repeat: type === "custom" ? (item.repeat || "none") : "none",
    dueDate: dateString,
    remindDaysBefore: Number(item.remindDaysBefore || 0),
    remindTime: item.remindTime || "09:00",
    dueAt: reminderDueAt(item, type),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    enabled: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return true;
}

async function deleteReminder(type, id) {
  if (!currentUser || !id) return false;
  const queueId = `${currentUser.uid}__${type}__${id}`;
  await deleteDoc(doc(cloudDb, NOTIFICATION_QUEUE_COLLECTION, queueId));
  return true;
}

async function getPushStatus() {
  if (!currentUser) return { enabled: false, message: "Sign in under Account & Cloud to enable phone notifications." };
  if (isIosLike() && !isStandalonePwa()) return { enabled: false, message: "On iPhone, open the installed Home Screen version of Momo to enable notifications." };
  if (!("Notification" in window) || !("PushManager" in window)) return { enabled: false, message: "This browser does not support phone notifications." };
  if (Notification.permission === "denied") return { enabled: false, message: "Notifications are blocked in your phone settings." };
  const subscription = await currentPushSubscription();
  return subscription
    ? { enabled: true, message: "Notifications are enabled on this phone. Only reminders you switch on will alert your phone." }
    : { enabled: false, message: "Optional. Enable phone alerts, then choose which Gentle Reminders may notify you." };
}

window.MomoPush = {
  enable: enablePush,
  disable: disablePush,
  getStatus: getPushStatus,
  syncReminder,
  deleteReminder
};
window.dispatchEvent(new Event("momo-push-ready"));

function bindEvents() {
  byId("googleCloudSignIn")?.addEventListener("click", googleSignIn);
  byId("emailCloudSignIn")?.addEventListener("click", () => emailSignIn("signin"));
  byId("emailCloudCreate")?.addEventListener("click", () => emailSignIn("create"));
  byId("cloudForgotPassword")?.addEventListener("click", resetPassword);
  byId("cloudResendVerification")?.addEventListener("click", resendVerificationEmail);
  byId("uploadCloudBackup")?.addEventListener("click", uploadCloudBackup);
  byId("restoreCloudBackup")?.addEventListener("click", restoreCloudBackup);
  byId("refreshCloudStatus")?.addEventListener("click", async () => {
    if (currentUser) {
      try {
        await reload(currentUser);
        currentUser = auth.currentUser;
        if (currentUser) {
          showSignedIn(currentUser);
        }
      } catch (error) {
        console.warn("Could not refresh account verification state:", error);
      }
    }
    await refreshCloudMetadata();
  });
  byId("cloudSignOut")?.addEventListener("click", async () => {
    if (!window.confirm("Sign out of your Momo account? Your local Momo data will stay on this device.")) {
      return;
    }

    // Remove this browser's push subscription from the account before
    // Firebase clears currentUser. This prevents a later account on the
    // same phone/browser from inheriting the previous user's endpoint.
    try {
      await disablePush();
    } catch (error) {
      console.warn(
        "Could not fully disable phone notifications before sign-out:",
        error
      );
    }

    await signOut(auth);
    toast("Signed out. Local Momo data is still here, and phone alerts are off on this device.");
  });
}

async function init() {
  bindEvents();
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Could not set Firebase auth persistence:", error);
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    cloudMetadata = null;
    if (!user) {
      showSignedOut();
      window.dispatchEvent(new Event("momo-push-ready"));
      return;
    }
    showSignedIn(user);
    window.dispatchEvent(new Event("momo-push-ready"));
    // Authentication is optional. Do not read Firestore on routine app startup.
    // Cloud metadata is fetched only when the user explicitly asks for it.
  });
}

init();