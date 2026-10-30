import { createClient } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
let client;
let initializing;
export class StoreError extends Error {
 constructor(message, status) { super(message); this.status = status; }
}
async function database() {
 if (!client) {
  if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) throw new StoreError('Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for persistent hosted storage.', 503);
  if (process.env.TURSO_DATABASE_URL && !/^libsql:\/\//.test(process.env.TURSO_DATABASE_URL)) throw new StoreError('TURSO_DATABASE_URL must use a libsql:// address.', 503);
  if (process.env.TURSO_DATABASE_URL && !process.env.TURSO_AUTH_TOKEN) throw new StoreError('Configure TURSO_AUTH_TOKEN for hosted storage.', 503);
  const data = process.env.DATA_DIR || path.join(root, 'data');
  if (!process.env.TURSO_DATABASE_URL) mkdirSync(data, { recursive: true });
  client = createClient({url: process.env.TURSO_DATABASE_URL || `file:${path.join(data,'mission-control.sqlite')}`, authToken: process.env.TURSO_AUTH_TOKEN});
 }
 if (!initializing) initializing = client.batch([
  'CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS generation_leases (id TEXT PRIMARY KEY, token TEXT NOT NULL, expires INTEGER NOT NULL)',
 ], 'write').catch(error => { initializing = undefined; throw error; });
 await initializing;
 return client;
}
const decode = row => row ? JSON.parse(row.value) : null;
export const store = {
 async settings() { const db=await database();return decode((await db.execute('SELECT value FROM settings WHERE id=1')).rows[0]); },
 async saveSettings(s) { const db=await database();await db.execute({sql:'INSERT OR REPLACE INTO settings VALUES (1, ?)',args:[JSON.stringify(s)]});return s; },
 async all() { const db=await database();return (await db.execute('SELECT value FROM applications')).rows.map(decode).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); },
 async get(id) {const db=await database();return decode((await db.execute({sql:'SELECT value FROM applications WHERE id=?',args:[id]})).rows[0]);},
 async create(a) {const db=await database();await db.execute({sql:'INSERT INTO applications VALUES (?,?)',args:[a.id,JSON.stringify(a)]});return a;},
 async change(id, fn, {remove=false, token}={}) {
  const db=await database();const tx=await db.transaction('write');
  try {
   const a=decode((await tx.execute({sql:'SELECT value FROM applications WHERE id=?',args:[id]})).rows[0]);
   if(!a)throw new StoreError('Application not found.',404);
   const lease=(await tx.execute({sql:'SELECT token, expires FROM generation_leases WHERE id=?',args:[id]})).rows[0];
   if(remove && lease && Number(lease.expires)>Date.now())throw new StoreError('Wait for generation to finish.',409);
   if(token && (!lease || lease.token!==token || Number(lease.expires)<=Date.now()))throw new StoreError('Generation expired. Please retry.',409);
   if(remove) {await tx.execute({sql:'DELETE FROM applications WHERE id=?',args:[id]});await tx.execute({sql:'DELETE FROM generation_leases WHERE id=?',args:[id]});}
   else {fn(a);await tx.execute({sql:'UPDATE applications SET value=? WHERE id=?',args:[JSON.stringify(a),id]});}
   await tx.commit();return a;
  } finally {tx.close();}
 },
 async acquire(id, token) {
  const db=await database();const result=await db.execute({sql:`INSERT INTO generation_leases VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET token=excluded.token, expires=excluded.expires WHERE generation_leases.expires <= ?`,args:[id,token,Date.now()+150000,Date.now()]});
  if(!result.rowsAffected)throw new StoreError('Generation is already running for this application.',409);
 },
 async release(id, token) {const db=await database();await db.execute({sql:'DELETE FROM generation_leases WHERE id=? AND token=?',args:[id,token]});},
};
