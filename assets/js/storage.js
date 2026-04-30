/**
 * STORAGE LAYER — localStorage (v1)
 * ─────────────────────────────────
 * This module abstracts all data access so that swapping to Supabase
 * only requires replacing the functions below — no changes elsewhere.
 *
 * SUPABASE MIGRATION: Replace each function body with a Supabase call.
 * Example: getStaff() → supabase.from('staff').select('*')
 */

// ─── KEYS ────────────────────────────────────────────────────────────────────
const KEYS = {
  STAFF: 'vwm_staffList',
  SESSIONS: 'vwm_activeSessions',
  HISTORY: 'vwm_shiftHistory',
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? [];
  } catch {
    return [];
  }
}
function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── STAFF ────────────────────────────────────────────────────────────────────
// [SUPABASE] Replace with: supabase.from('staff').select('*')
export function getAllStaff() {
  return read(KEYS.STAFF);
}

// [SUPABASE] Replace with: supabase.from('staff').insert([staff])
export function saveStaff(staff) {
  const list = getAllStaff();
  list.push(staff);
  write(KEYS.STAFF, list);
}

// [SUPABASE] Replace with: supabase.from('staff').update(updates).eq('id', id)
export function updateStaff(id, updates) {
  const list = getAllStaff().map(s => s.id === id ? { ...s, ...updates } : s);
  write(KEYS.STAFF, list);
}

// [SUPABASE] Replace with: supabase.from('staff').delete().eq('id', id)
export function deleteStaff(id) {
  const list = getAllStaff().filter(s => s.id !== id);
  write(KEYS.STAFF, list);
}

// [SUPABASE] Replace with: supabase.from('staff').select('*').eq('pinIn', pin).single()
export function getStaffByPinIn(pin) {
  return getAllStaff().find(s => s.pinIn === pin) ?? null;
}

// [SUPABASE] Replace with: supabase.from('staff').select('*').eq('pinOut', pin).single()
export function getStaffByPinOut(pin) {
  return getAllStaff().find(s => s.pinOut === pin) ?? null;
}

// ─── ACTIVE SESSIONS ─────────────────────────────────────────────────────────
// [SUPABASE] Replace with: supabase.from('active_sessions').select('*')
export function getActiveSessions() {
  return read(KEYS.SESSIONS);
}

// [SUPABASE] Replace with: supabase.from('active_sessions').select('*').eq('staffId', id).single()
export function getActiveSessionByStaff(staffId) {
  return getActiveSessions().find(s => s.staffId === staffId) ?? null;
}

// [SUPABASE] Replace with: supabase.from('active_sessions').insert([session])
export function createSession(session) {
  const sessions = getActiveSessions();
  sessions.push(session);
  write(KEYS.SESSIONS, sessions);
}

// [SUPABASE] Replace with: supabase.from('active_sessions').delete().eq('staffId', staffId)
export function removeSession(staffId) {
  const sessions = getActiveSessions().filter(s => s.staffId !== staffId);
  write(KEYS.SESSIONS, sessions);
}

// ─── SHIFT HISTORY ───────────────────────────────────────────────────────────
// [SUPABASE] Replace with: supabase.from('shift_history').select('*')
export function getShiftHistory() {
  return read(KEYS.HISTORY);
}

// [SUPABASE] Replace with: supabase.from('shift_history').insert([record])
export function saveShiftRecord(record) {
  const history = getShiftHistory();
  history.push(record);
  write(KEYS.HISTORY, history);
}

// [SUPABASE] Replace with: supabase.from('shift_history').select('*').eq('staffId', id)
export function getShiftsByStaff(staffId) {
  return getShiftHistory().filter(r => r.staffId === staffId);
}

// ─── ANALYTICS HELPERS ───────────────────────────────────────────────────────
export function getTotalHoursByStaff(staffId) {
  return getShiftsByStaff(staffId).reduce((sum, r) => sum + (r.totalHours || 0), 0);
}

// [SUPABASE] Placeholder — implement server-side weekly reset or cron job
export function weeklyReset() {
  // TODO: Implement weekly reset logic
  // localStorage version: clear shift history older than 7 days
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const fresh = getShiftHistory().filter(r => new Date(r.clockOutTime).getTime() > oneWeekAgo);
  write(KEYS.HISTORY, fresh);
}

// ─── SEED / CLEAR ────────────────────────────────────────────────────────────
export function clearAll() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
