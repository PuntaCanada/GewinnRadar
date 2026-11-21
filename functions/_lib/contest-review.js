import { publicContestUrl } from './urls.js';

const clean = (v, limit) => typeof v === 'string' ? v.trim().slice(0, limit + 1) : '';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const EMPTY = Object.freeze({});

export function validateContest(input, clock = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Ungültiger Datensatz' };
  const value = {
    id: clean(input.id, 80),
    organizer: clean(input.organizer, 120),
    title: clean(input.title, 180),
    prize: clean(input.prize, 240),
    url: clean(input.url, 2048),
    terms_url: clean(input.terms_url, 2048),
    privacy_url: clean(input.privacy_url, 2048),
    starts_at: clean(input.starts_at, 30),
    ends_at: clean(input.ends_at, 30),
    daily: input.daily === true ? 1 : 0,
    required_data: clean(input.required_data, 1000),
    solution: clean(input.solution, 500) || null
  };
  if (!/^[a-z0-9][a-z0-9-_]{2,79}$/.test(value.id)) return { error: 'Ungültige ID' };
  if (![value.organizer, value.title, value.prize].every(x => x.length >= 3 && x.length <= 240)) return { error: 'Pflichtangaben fehlen' };
  if (![value.url, value.terms_url, value.privacy_url].every(publicContestUrl)) return { error: 'Nur sichere Original-HTTPS-Adressen' };
  if (![value.starts_at, value.ends_at].every(x => ISO.test(x) && Number.isFinite(Date.parse(x)))) return { error: 'Zeitangaben müssen ISO-UTC sein' };
  if (value.starts_at >= value.ends_at) return { error: 'Ende muss nach Beginn liegen' };
  if (Date.parse(value.ends_at) <= clock.getTime()) return { error: 'Gewinnspiel bereits beendet' };
  if (typeof input.daily !== 'boolean') return { error: 'Täglich oder einmalig ausdrücklich angeben' };
  if (!value.required_data || value.required_data.length > 1000) return { error: 'Erforderliche Daten dokumentieren' };
  return { value };
}
export function validateEvidence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Prüfnachweis fehlt' };
  if (input.action !== 'approve' && input.action !== 'reject' && input.action !== 'review') return { error: 'Ungültige Entscheidung' };
  const id = clean(input.id, 80);
  const note = clean(input.note, 1200);
  if (!/^[a-z0-9][a-z0-9-_]{2,79}$/.test(id) || note.length < 20 || note.length > 1200) return { error: 'ID und konkrete Prüfnotiz erforderlich' };
  if (input.action !== 'approve') return { value: { id, action: input.action, note } };
  const originalChecked = input.original_checked === true;
  const termsChecked = input.terms_checked === true;
  const privacyChecked = input.privacy_checked === true;
  const deutschland = input.germany_eligible === true;
  const noMarketing = input.no_mandatory_marketing === true;
  const noPayment = input.no_payment_required === true;
  const humanVerified = input.human_verified === true;
  if (![originalChecked,termsChecked,privacyChecked,deutschland,noMarketing,noPayment,humanVerified].every(Boolean)) return { error: 'Alle sieben Prüfungen müssen nachgewiesen sein' };
  const checkedAt = clean(input.checked_at, 30);
  if (!ISO.test(checkedAt) || !Number.isFinite(Date.parse(checkedAt))) return { error: 'Prüfzeitpunkt fehlt' };
  const stamp = Date.parse(checkedAt);
  if (Math.abs(Date.now() - stamp) > 48*60*60*1000) return { error: 'Prüfung ist zu alt' };
  return { value: { id, action: input.action, note, checked_at: checkedAt, original_checked: 1, terms_checked: 1, privacy_checked: 1, germany_eligible: 1, no_mandatory_marketing: 1, no_payment_required: 1, human_verified: 1 } };
}
export function safeAdmin(user) { return !!user && user.role === 'admin' && user.email_verified === 1; }
