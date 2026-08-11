import admin from "firebase-admin";
import webpush from "web-push";

const REQUIRED_SECRETS = [
  "FIREBASE_SERVICE_ACCOUNT",
  "MOMO_VAPID_PRIVATE_KEY",
  "MOMO_VAPID_SUBJECT"
];

for (const name of REQUIRED_SECRETS) {
  if (!process.env[name]) {
    throw new Error(`Missing required GitHub secret: ${name}`);
  }
}

const VAPID_PUBLIC_KEY =
  "BHl9Crz0RRKBkb6h-dNQ9r7mxeyXj_laLEgkO0B72uKdDHtb_uSp4Y8o9Fe_iTCxv8zlRZUqrRaZLdbBTlzg-Ck";

const MAX_QUEUE_ITEMS_PER_RUN = 200;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

webpush.setVapidDetails(
  process.env.MOMO_VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  process.env.MOMO_VAPID_PRIVATE_KEY
);

function formatAmount(item) {
  const amount = Number(item.amount || 0);
  if (!(amount > 0)) return "";

  return `${item.currency || "PHP"} ${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2
  })}`;
}

function buildNotification(item) {
  const amountText = formatAmount(item);
  const dueDate = item.dueDate || "";
  const note = String(item.note || "").trim();

  let body = "You have a Momo reminder.";

  if (item.type === "recurring") {
    body = `${amountText ? `${amountText} · ` : ""}Due ${dueDate}`;
  } else if (item.type === "planned") {
    body = `${amountText ? `${amountText} · ` : ""}Planned for ${dueDate}`;
  } else if (item.type === "custom" || item.type === "gentle") {
    body = note || (dueDate ? `Reminder for ${dueDate}` : "You have a Momo reminder.");
  }

  return {
    title: item.title || "Momo reminder",
    body,
    tag: `momo-${item.type || "reminder"}-${item.localId || "item"}`,
    url: "./index.html"
  };
}

async function removeExpiredSubscription(subDoc) {
  try {
    await subDoc.ref.delete();
  } catch (error) {
    console.warn("Could not remove an expired push subscription:", error?.message || error);
  }
}

async function markQueueItemHandled(queueDoc, fields) {
  await queueDoc.ref.set(
    {
      ...fields,
      updatedBySenderAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

const now = new Date();
const nowIso = now.toISOString();

const dueSnapshot = await db
  .collection("notificationQueue")
  .where("dueAt", "<=", nowIso)
  .limit(MAX_QUEUE_ITEMS_PER_RUN)
  .get();

let deliveredCount = 0;
let staleCount = 0;
let skippedCount = 0;
let failedCount = 0;

for (const queueDoc of dueSnapshot.docs) {
  const item = queueDoc.data();

  if (!item.enabled || !item.uid || !item.dueAt || !item.dueDate) {
    skippedCount += 1;
    continue;
  }

  if (item.sentForDueDate === item.dueDate) {
    skippedCount += 1;
    continue;
  }

  const dueAtMs = Date.parse(item.dueAt);
  if (!Number.isFinite(dueAtMs)) {
    console.warn(`Skipping queue item ${queueDoc.id}: invalid dueAt.`);
    skippedCount += 1;
    continue;
  }

  if (now.getTime() - dueAtMs > STALE_AFTER_MS) {
    await markQueueItemHandled(queueDoc, {
      sentForDueDate: item.dueDate,
      skippedAsStale: true,
      lastSkippedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    staleCount += 1;
    continue;
  }

  const subscriptionsSnapshot = await db
    .collection("users")
    .doc(item.uid)
    .collection("pushSubscriptions")
    .get();

  if (subscriptionsSnapshot.empty) {
    skippedCount += 1;
    continue;
  }

  const payload = JSON.stringify(buildNotification(item));
  let deliveredToAtLeastOnePhone = false;

  for (const subDoc of subscriptionsSnapshot.docs) {
    const subscription = subDoc.data();

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.warn(`Removing malformed push subscription ${subDoc.id}.`);
      await removeExpiredSubscription(subDoc);
      continue;
    }

    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: 24 * 60 * 60,
        urgency: "normal"
      });
      deliveredToAtLeastOnePhone = true;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);

      if (statusCode === 404 || statusCode === 410) {
        await removeExpiredSubscription(subDoc);
      } else {
        failedCount += 1;
        console.error(
          `Push delivery failed for queue item ${queueDoc.id}:`,
          statusCode || "unknown status",
          error?.message || error
        );
      }
    }
  }

  if (deliveredToAtLeastOnePhone) {
    await markQueueItemHandled(queueDoc, {
      sentForDueDate: item.dueDate,
      skippedAsStale: false,
      lastSentAt: admin.firestore.FieldValue.serverTimestamp()
    });
    deliveredCount += 1;
  }
}

console.log(
  `Momo reminders complete. Due: ${dueSnapshot.size}; delivered: ${deliveredCount}; stale: ${staleCount}; skipped: ${skippedCount}; delivery errors: ${failedCount}.`
);