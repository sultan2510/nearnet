import { openDB } from "idb";

const DB_NAME = "nearnet";
const DB_VERSION = 1;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("identity")) {
          db.createObjectStore("identity");
        }
        if (!db.objectStoreNames.contains("contacts")) {
          db.createObjectStore("contacts", { keyPath: "peerId" });
        }
        if (!db.objectStoreNames.contains("messages")) {
          const store = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
          store.createIndex("byPeer", "peerId");
        }
      }
    });
  }
  return dbPromise;
}

// --- Identity (single record under key "me") ---
export async function saveIdentity(identity) {
  const db = await getDb();
  await db.put("identity", identity, "me");
}

export async function loadIdentity() {
  const db = await getDb();
  return db.get("identity", "me");
}

// --- Contacts (peers whose public key we have exchanged via QR) ---
export async function upsertContact(contact) {
  const db = await getDb();
  await db.put("contacts", contact);
}

export async function getContact(peerId) {
  const db = await getDb();
  return db.get("contacts", peerId);
}

export async function getAllContacts() {
  const db = await getDb();
  return db.getAll("contacts");
}

// --- Messages ---
export async function addMessage(message) {
  const db = await getDb();
  return db.add("messages", message);
}

export async function getMessagesForPeer(peerId) {
  const db = await getDb();
  return db.getAllFromIndex("messages", "byPeer", peerId);
}

export async function clearAllData() {
  const db = await getDb();
  await db.clear("identity");
  await db.clear("contacts");
  await db.clear("messages");
}
