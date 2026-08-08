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
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
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

function localPreferenceSnapshot() {
  const values = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
      values[key] = localStorage.getItem(key);
    }
  }
  return values;
}

async function snapshotMomoData() {
  const db = await openLocalDatabase();
  try {
    const storeNames = Array.from(db.objectStoreNames);
    const stores = {};
    for (const storeName of storeNames) {
      const records = await readStore(db, storeName);
      stores[storeName] = records.map((record) => sanitizeForCloud(record));
    }
    return {
      stores,
      localPreferences: localPreferenceSnapshot(),
      storeNames,
      omittedMedia: true
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
    "Upload this device's current Momo data to your cloud account?\n\nReceipt photos and custom wallpaper images stay on this device and are not uploaded."
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
      localPreferences: snapshot.localPreferences
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
  if (!cloudMetadata?.exists) {
    toast("There is no cloud backup to restore yet.");
    return;
  }

  const ok = window.confirm(
    "Restore the cloud copy onto this device?\n\nMomo will replace its local database records with the cloud copy. Existing receipt photos on this device are preserved when their expense still exists."
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
        await clearAndWriteStore(db, storeName, records);
      }
    } finally {
      db.close();
    }

    const preferences = cloudMetadata.data?.localPreferences;
    if (preferences && typeof preferences === "object") {
      Object.entries(preferences).forEach(([key, value]) => {
        if (key.startsWith(LOCAL_STORAGE_PREFIX) && typeof value === "string") {
          localStorage.setItem(key, value);
        }
      });
    }

toast("Cloud copy restored. Reloading Momo…");

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
  try {
    const snap = await getDoc(doc(cloudDb, "users", currentUser.uid));
    cloudMetadata = { exists: snap.exists(), data: snap.exists() ? snap.data() : null };
    const last = byId("cloudLastBackup");
    if (last) last.textContent = snap.exists() ? formatCloudDate(snap.data()) : "Not backed up yet";
    const restoreButton = byId("restoreCloudBackup");
    if (restoreButton) restoreButton.disabled = !snap.exists();
  } catch (error) {
    console.error("Could not read cloud metadata:", error);
  }
}

function showSignedOut() {
  byId("cloudSignedOut")?.removeAttribute("hidden");
  byId("cloudSignedIn")?.setAttribute("hidden", "");
  const drawerTitle = byId("drawerAccountTitle");
  const drawerSubtitle = byId("drawerAccountSubtitle");
  if (drawerTitle) drawerTitle.textContent = "Account & Cloud";
  if (drawerSubtitle) drawerSubtitle.textContent = "Sign in to protect your Momo data.";
  setStatus("Not signed in");
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
  setStatus("Signed in", "success");
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

function bindEvents() {
  byId("googleCloudSignIn")?.addEventListener("click", googleSignIn);
  byId("emailCloudSignIn")?.addEventListener("click", () => emailSignIn("signin"));
  byId("emailCloudCreate")?.addEventListener("click", () => emailSignIn("create"));
  byId("cloudForgotPassword")?.addEventListener("click", resetPassword);
  byId("uploadCloudBackup")?.addEventListener("click", uploadCloudBackup);
  byId("restoreCloudBackup")?.addEventListener("click", restoreCloudBackup);
  byId("refreshCloudStatus")?.addEventListener("click", refreshCloudMetadata);
  byId("cloudSignOut")?.addEventListener("click", async () => {
    if (window.confirm("Sign out of your Momo account? Your local Momo data will stay on this device.")) {
      await signOut(auth);
      toast("Signed out. Local Momo data is still here.");
    }
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
      return;
    }
    showSignedIn(user);
    await refreshCloudMetadata();
  });
}

init();
