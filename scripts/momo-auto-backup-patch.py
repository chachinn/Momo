from pathlib import Path
import re

firebase_path = Path('firebase-momo.js')
firebase = firebase_path.read_text(encoding='utf-8')

constants_anchor = 'const NOTIFICATION_AUTH_SEPARATED_KEY = "momo_notification_auth_separated_v1";\n'
assert constants_anchor in firebase
firebase = firebase.replace(constants_anchor, constants_anchor + '''\n// Daily cloud backup uses the device's local time. A PWA cannot reliably wake\n// from a fully closed state on every platform, so a missed 8:00 AM backup is\n// caught up automatically when Momo next opens, resumes, or reconnects.\nconst CLOUD_AUTO_BACKUP_HOUR = 8;\nconst CLOUD_AUTO_BACKUP_MINUTE = 0;\nconst CLOUD_AUTO_BACKUP_KEY_PREFIX = "momo_cloud_auto_backup_v1";\nconst CLOUD_AUTO_BACKUP_RETRY_MS = 5 * 60 * 1000;\n''', 1)

state_anchor = 'let legacyNotificationMigrationRunning = false;\n'
assert state_anchor in firebase
firebase = firebase.replace(state_anchor, state_anchor + 'let cloudAutoBackupTimer = null;\nlet cloudAutoBackupRunning = false;\n', 1)

upload_pattern = re.compile(r'async function uploadCloudBackup\(\) \{.*?\n\}\n\nasync function readCloudStores', re.S)
assert len(upload_pattern.findall(firebase)) == 1
replacement = '''async function writeCurrentDeviceToCloud({ automatic = false } = {}) {
  if (!isRealAccountUser()) return false;

  const snapshot = await snapshotMomoData();
  const uid = currentUser.uid;
  const operations = [];

  for (const storeName of snapshot.storeNames) {
    const recordsRef = collection(cloudDb, "users", uid, "stores", storeName, "records");
    const existing = await getDocs(recordsRef);
    existing.forEach((cloudDoc) => operations.push({ type: "delete", ref: cloudDoc.ref }));

    snapshot.stores[storeName].forEach((record, index) => {
      operations.push({ type: "set", ref: doc(recordsRef, recordKey(record, index)), data: { payload: record } });
    });

    operations.push({
      type: "set",
      ref: doc(cloudDb, "users", uid, "stores", storeName),
      data: { count: snapshot.stores[storeName].length }
    });
  }

  await commitOperations(operations);

  const metadata = {
    email: currentUser.email || "",
    displayName: currentUser.displayName || "",
    updatedAt: serverTimestamp(),
    cloudBackupVersion: 1,
    storeNames: snapshot.storeNames,
    mediaPolicy: "local-only",
    devicePreferencesPolicy: "local-only"
  };

  if (automatic) {
    metadata.lastAutoBackupAt = serverTimestamp();
    metadata.autoBackupSchedule = "08:00-local";
    metadata.autoBackupTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }

  await setDoc(doc(cloudDb, "users", uid), metadata, { merge: true });
  await refreshCloudMetadata();
  return true;
}

async function uploadCloudBackup() {
  if (!isRealAccountUser() || busy || cloudAutoBackupRunning) return;
  const ok = window.confirm(
    "Replace your existing cloud copy with the Momo data currently on this device?\\n\\nThis overwrites the previous cloud backup. Receipt photos and custom wallpaper images stay on this device and are not uploaded."
  );
  if (!ok) return;

  setBusy(true);
  setStatus("Uploading your Momo…");
  try {
    await writeCurrentDeviceToCloud({ automatic: false });
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

async function readCloudStores'''
firebase = upload_pattern.sub(replacement, firebase, count=1)

scheduler_anchor = '\nfunction updateEmailVerificationUI(user) {'
assert scheduler_anchor in firebase
scheduler = '''
function localCloudBackupDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cloudAutoBackupStorageKey(user = currentUser) {
  return user?.uid ? `${CLOUD_AUTO_BACKUP_KEY_PREFIX}:${user.uid}` : "";
}

function cloudAutoBackupCompletedToday(user = currentUser, now = new Date()) {
  const key = cloudAutoBackupStorageKey(user);
  return Boolean(key && localStorage.getItem(key) === localCloudBackupDayKey(now));
}

function cloudAutoBackupDueTime(now = new Date()) {
  const due = new Date(now);
  due.setHours(CLOUD_AUTO_BACKUP_HOUR, CLOUD_AUTO_BACKUP_MINUTE, 0, 0);
  return due;
}

function clearCloudAutoBackupTimer() {
  if (cloudAutoBackupTimer) {
    window.clearTimeout(cloudAutoBackupTimer);
    cloudAutoBackupTimer = null;
  }
}

function scheduleCloudAutoBackupCheck(delayMs) {
  clearCloudAutoBackupTimer();
  cloudAutoBackupTimer = window.setTimeout(() => {
    cloudAutoBackupTimer = null;
    runCloudAutoBackupIfDue("timer").catch((error) => {
      console.warn("Momo daily cloud backup check failed:", error);
    });
  }, Math.max(1000, delayMs));
}

function scheduleDailyCloudBackup() {
  clearCloudAutoBackupTimer();
  if (!isRealAccountUser()) return;

  const now = new Date();
  const dueToday = cloudAutoBackupDueTime(now);
  const completedToday = cloudAutoBackupCompletedToday(currentUser, now);

  if (!completedToday && now >= dueToday) {
    scheduleCloudAutoBackupCheck(1200);
    return;
  }

  const next = new Date(dueToday);
  if (completedToday || now >= dueToday) next.setDate(next.getDate() + 1);
  scheduleCloudAutoBackupCheck(next.getTime() - now.getTime());
}

async function runCloudAutoBackupIfDue(trigger = "scheduled") {
  if (!isRealAccountUser()) {
    clearCloudAutoBackupTimer();
    return false;
  }

  const now = new Date();
  const dueToday = cloudAutoBackupDueTime(now);

  if (now < dueToday || cloudAutoBackupCompletedToday(currentUser, now)) {
    scheduleDailyCloudBackup();
    return false;
  }

  if (!navigator.onLine || busy || cloudAutoBackupRunning) {
    scheduleCloudAutoBackupCheck(60 * 1000);
    return false;
  }

  cloudAutoBackupRunning = true;
  setBusy(true);
  setStatus("Saving daily cloud backup…");
  let completed = false;

  try {
    await writeCurrentDeviceToCloud({ automatic: true });
    const key = cloudAutoBackupStorageKey(currentUser);
    if (key) localStorage.setItem(key, localCloudBackupDayKey(now));
    completed = true;
    setStatus("Daily cloud backup saved", "success");
    console.info(`Momo daily cloud backup completed (${trigger}).`);
    return true;
  } catch (error) {
    console.error("Momo daily cloud backup failed:", error);
    setStatus("Daily backup will retry", "error");
    scheduleCloudAutoBackupCheck(CLOUD_AUTO_BACKUP_RETRY_MS);
    return false;
  } finally {
    cloudAutoBackupRunning = false;
    setBusy(false);
    if (completed) scheduleDailyCloudBackup();
  }
}
'''
firebase = firebase.replace(scheduler_anchor, '\n' + scheduler + scheduler_anchor, 1)

old_subtitle = 'if (byId("drawerAccountSubtitle")) byId("drawerAccountSubtitle").textContent = "Cloud backup available";'
assert old_subtitle in firebase
firebase = firebase.replace(old_subtitle, 'if (byId("drawerAccountSubtitle")) byId("drawerAccountSubtitle").textContent = "Auto backup daily · 8:00 AM";', 1)
old_status = 'setStatus("Signed in · local data active", "success");'
assert old_status in firebase
firebase = firebase.replace(old_status, 'setStatus("Signed in · auto backup at 8:00 AM", "success");', 1)

auth_tail = '''    if (!user) {
      showSignedOut();
    } else if (!user.isAnonymous) {
      showSignedIn(user);
    }

    setBusy(false);
  });'''
assert auth_tail in firebase
firebase = firebase.replace(auth_tail, '''    if (!user) {
      clearCloudAutoBackupTimer();
      showSignedOut();
    } else if (!user.isAnonymous) {
      showSignedIn(user);
    }

    setBusy(false);

    if (isRealAccountUser(user)) {
      refreshCloudMetadata().catch((error) => {
        console.warn("Could not refresh cloud status after sign-in:", error);
      });
      scheduleDailyCloudBackup();
    }
  });''', 1)

online_anchor = '''  flushPendingPushDeletions().catch((error) => {
    console.warn("Could not flush Momo reminder deletions after reconnecting:", error);
  });
});

init();'''
assert online_anchor in firebase
firebase = firebase.replace(online_anchor, '''  flushPendingPushDeletions().catch((error) => {
    console.warn("Could not flush Momo reminder deletions after reconnecting:", error);
  });

  if (isRealAccountUser()) {
    runCloudAutoBackupIfDue("online").catch((error) => {
      console.warn("Could not run Momo daily backup after reconnecting:", error);
    });
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isRealAccountUser()) {
    runCloudAutoBackupIfDue("resume").catch((error) => {
      console.warn("Could not run Momo daily backup after resume:", error);
    });
  }
});

init();''', 1)

firebase_path.write_text(firebase, encoding='utf-8')

app_path = Path('app.js')
app = app_path.read_text(encoding='utf-8')
assert '// Momo 1.10.2 — Activity Fix + Smart Money Suite + Stability Polish' in app
app = app.replace('// Momo 1.10.2 — Activity Fix + Smart Money Suite + Stability Polish', '// Momo 1.10.3 — Daily Cloud Auto Backup + Stability Polish', 1)
app_path.write_text(app, encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
assert '<meta name="momo-app-version" content="1.10.2">' in html
html = html.replace('<meta name="momo-app-version" content="1.10.2">', '<meta name="momo-app-version" content="1.10.3">', 1)
index_path.write_text(html, encoding='utf-8')

sw_path = Path('service-worker.js')
sw = sw_path.read_text(encoding='utf-8')
assert '  "1.10.2";' in sw
sw = sw.replace('  "1.10.2";', '  "1.10.3";', 1)
sw = sw.replace('// Momo 1.10.2 — Activity stability fix + clean navigation + stable PWA updates', '// Momo 1.10.3 — daily cloud auto backup + stable PWA updates', 1)
sw_path.write_text(sw, encoding='utf-8')
