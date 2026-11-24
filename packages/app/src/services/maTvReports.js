// VJOD dit à Ma TV ce qui ne va pas sur chaque télé (ma_tv_reports.dart) :
// les plantages, et les chaînes ou films qui ne se lisent pas. L'admin les voit
// regroupés sur la page Ma TV au lieu de deviner d'après une photo de l'écran.
//
// Les signalements attendent sur l'appareil (30 au plus, une semaine au plus)
// que Ma TV réponde ; la clé IPTV, les comptes et les mots de passe sont
// retirés de chaque texte. Sert aussi « Signaler un problème » par WhatsApp.
import {getFromStorage, saveToStorage, removeFromStorage} from './storage';
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';
import {VJOD_TV_VERSION} from '../utils/vjodTvChanges';
import {timingMark, timingSummary} from '../utils/vjodTimings';

const STORAGE_KEY = 'vjod_matv_reports';
const LAST_KEY = 'vjod_matv_last_report';
const DEVICE_KEY = 'vjod_device_id';
const MAX_STORED = 30;
const MAX_AGE = 7 * 24 * 3600;
const DEBOUNCE = 4000;

// La clé Ma TV voyage en k= (ou key=), le compte du fournisseur en
// username=/password= et dans le chemin de chaque flux.
const IPTV_QUERY = /([?&;](?:k|key|username|user|password|pass|pwd)=)[^&\s"'<>]+/gi;
const IPTV_PATH = /\/(movie|series|live|timeshift)\/[^/\s"'<>]+\/[^/\s"'<>]+\//gi;

export const redactIptvSecrets = (text) => {
	const s = String(text || '');
	if (s.indexOf('=') < 0 && s.indexOf('/') < 0) return s;
	return s.replace(IPTV_QUERY, '$1[REDACTED]').replace(IPTV_PATH, '/$1/[REDACTED]/[REDACTED]/');
};

const cut = (s, n) => (s.length > n ? s.substring(0, n) : s);

export const redacted = (r) => ({
	...r,
	message: cut(redactIptvSecrets(r.message), 500),
	stack: cut(redactIptvSecrets(r.stack || ''), 4000),
	source: cut(redactIptvSecrets(r.source || ''), 120)
});

const compact = (r) => {
	const out = {kind: r.kind, message: r.message, at: r.at};
	for (const k of ['stack', 'where', 'channel', 'title', 'player', 'source']) if (r[k]) out[k] = r[k];
	return out;
};

let server = null;
let allowed = true;
let profile = '';
let timer = null;
let sending = false;
let helloSent = false;
let writes = Promise.resolve();
const seen = new Set();

const sendTimingsRef = {current: () => {}};
let timingsTimer = null;
const startTimings = () => {
	if (timingsTimer || typeof setInterval === 'undefined') return;
	// sendTimings est défini plus bas ; appelé seulement à l'heure.
	timingsTimer = setInterval(() => sendTimingsRef.current(), 5 * 60 * 1000);
};

// L'appli dit où est Ma TV, si les signalements sont permis, et le profil.
export const setReportsServer = (s) => {
	server = s || null;
	if (server) {
		sayHello();
		flushSoon();
		startTimings();
	}
};
export const setReportsAllowed = (on) => {
	allowed = on !== false;
};
export const setReportsProfile = (name) => {
	profile = name || '';
};

const nowSec = () => Math.floor(Date.now() / 1000);

export const pending = async () => {
	try {
		const list = await getFromStorage(STORAGE_KEY);
		if (!Array.isArray(list)) return [];
		const cutoff = nowSec() - MAX_AGE;
		return list.filter((r) => r && r.message && r.at >= cutoff);
	} catch (e) {
		return [];
	}
};

const save = (list) => (list.length ? saveToStorage(STORAGE_KEY, list) : removeFromStorage(STORAGE_KEY));

// Ce numéro est celui que la page Ma TV montre avec ses signalements.
export const deviceId = async () => {
	let id = '';
	try {
		id = (await getFromStorage(DEVICE_KEY)) || '';
	} catch (e) {
		id = '';
	}
	if (!id) {
		for (let i = 0; i < 12; i++) id += Math.floor(Math.random() * 36).toString(36);
		saveToStorage(DEVICE_KEY, id);
	}
	return id;
};

const platformName = () => {
	if (typeof window === 'undefined') return '';
	if (window.PalmSystem || window.webOSSystem) return 'webOS';
	if (window.tizen) return 'Tizen';
	return 'web';
};

const who = async () => {
	const out = {device: await deviceId(), model: platformName() === 'web' ? 'Navigateur' : 'TV', os: platformName(), app: `TV ${VJOD_TV_VERSION}`};
	if (process.env.REACT_APP_VERSION) out.build = process.env.REACT_APP_VERSION;
	if (profile) out.profile = profile;
	return out;
};

const post = async (path, body) => {
	const res = await platformFetch(maTvEndpoint(server, path), {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		body: JSON.stringify(body)
	}, 10000);
	return res ? res.status : 0;
};

// VJOD 4.20 / Ma TV 3.65 (sendTimings de l'APK) : la vitesse de réponse de
// chaque service sur cette télé, pour la page Ma TV. Toutes les 5 minutes, et
// seulement si quelque chose a été chronométré depuis le dernier envoi.
let timingsSent = -1;
export const sendTimings = async () => {
	if (!allowed || !server || timingMark() === timingsSent) return false;
	const mark = timingMark();
	const summary = timingSummary();
	const names = Object.keys(summary);
	if (!names.length) return false;
	const services = {};
	names.forEach((n) => {
		const s = summary[n];
		services[n] = {median: s.median, p90: s.p90, n: s.count, slow: s.slowest};
	});
	try {
		const status = await post('/tv/api/timings', {...(await who()), services});
		// 404 : un Ma TV plus ancien, inutile d'insister.
		if (status === 200 || status === 404) timingsSent = mark;
		return status === 200;
	} catch (e) {
		return false;
	}
};
sendTimingsRef.current = sendTimings;



// Envoie ce qui attend ; l'enlève une fois que Ma TV l'a pris.
export const flush = async () => {
	if (sending || !allowed || !server) return 0;
	sending = true;
	try {
		const list = await pending();
		if (!list.length) return 0;
		const base = await who();
		const batch = list.slice(0, 20);
		const status = await post('/tv/api/report', {reports: batch.map((r) => ({...base, ...compact(r)}))});
		if (status !== 200) return 0;
		// Ma TV peut en refuser (un appareil trop bavard) : pas renvoyés.
		const left = (await pending()).filter((r) => !batch.some((b) => b.at === r.at && b.message === r.message));
		await save(left);
		if (left.length) flushSoon();
		return batch.length;
	} catch (e) {
		return 0;
	} finally {
		sending = false;
	}
};

function flushSoon () {
	if (timer) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		flush();
	}, DEBOUNCE);
}

// Une fois par lancement : quelle version tourne sur cette télé (Ma TV 3.90).
export async function sayHello () {
	if (helloSent || !allowed || !server) return false;
	try {
		const status = await post('/tv/api/hello', await who());
		helloSent = status === 200 || status === 404;
		return status === 200;
	} catch (e) {
		return false;
	}
}

const store = async (r) => {
	await saveToStorage(LAST_KEY, compact(r));
	const list = await pending();
	list.push(compact(r));
	while (list.length > MAX_STORED) list.shift();
	await save(list);
	flushSoon();
};

// Garde r et l'envoie bientôt. Ne lève jamais.
export const report = (r, key) => {
	try {
		if (!allowed) return;
		const k = key || `${r.kind}|${r.where || ''}|${r.message}`;
		if (seen.has(k)) return;
		seen.add(k);
		if (seen.size > 200) seen.clear();
		const clean = redacted({at: nowSec(), ...r});
		writes = writes.then(() => store(clean)).catch(() => {});
	} catch (e) {
		// Un signalement ne doit jamais devenir un deuxième plantage.
	}
};

// Une erreur JavaScript non rattrapée.
export const reportCrash = (error, during = '') => {
	const text = String((error && (error.message || error)) || 'Erreur');
	const first = text.split('\n')[0];
	const frames = String((error && error.stack) || '').split('\n').filter((l) => l.trim()).slice(0, 25).join('\n');
	report({
		kind: 'crash',
		message: during ? `${text}\n${during}` : text,
		stack: during ? `Où : ${during}\n${frames}` : frames,
		where: 'tv'
	}, `crash|${first}`);
};

// Une chaîne, un film ou un épisode qui ne se lit pas.
export const reportPlay = (message, {where = 'tv', channel = '', title = '', player = '', source = ''} = {}) => {
	report({kind: 'play', message: String(message || 'Lecture impossible'), where, channel, title, player, source},
		`play|${where}|${channel}|${title}|${message}`);
};

// Le dernier souci noté sur cette télé (envoyé ou non).
export const lastReport = async () => {
	try {
		const r = await getFromStorage(LAST_KEY);
		return r && r.message ? r : null;
	} catch (e) {
		return null;
	}
};

let installed = false;

// Les plantages de la page entière.
export const installCrashReporting = () => {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	window.addEventListener('error', (e) => {
		if (e && (e.error || e.message)) reportCrash(e.error || e.message);
	});
	window.addEventListener('unhandledrejection', (e) => {
		const reason = e && e.reason;
		// Une requête abandonnée n'est pas un plantage.
		if (reason && (reason.name === 'AbortError' || reason.name === 'TimeoutError')) return;
		if (reason) reportCrash(reason, 'promesse non tenue');
	});
};

// ---------------------------------------------------------------- Signaler un problème

let supportNumber = null;
let askedAt = 0;

// Le numéro WhatsApp de l'admin, réglé sur Ma TV (jamais écrit dans l'appli).
export const loadSupportNumber = async (fetchJson = null) => {
	if (supportNumber) return supportNumber;
	if (!server || Date.now() - askedAt < 10 * 60 * 1000) return null;
	askedAt = Date.now();
	try {
		let json;
		if (fetchJson) json = await fetchJson(maTvEndpoint(server, '/tv/api/support'));
		else {
			const res = await platformFetch(maTvEndpoint(server, '/tv/api/support'), {method: 'GET'}, 6000);
			json = res && res.status === 200 ? await res.json() : null;
		}
		const n = json && json.whatsapp ? String(json.whatsapp).trim() : '';
		if (n) supportNumber = n;
		return n || null;
	} catch (e) {
		return null;
	}
};

export const knownSupportNumber = () => supportNumber;

// Le message prérempli : ce qui était à l'écran, le dernier souci s'il est
// récent, la version, l'appareil et son numéro sur la page Ma TV.
export const reportProblemText = ({what = '', last = null, version, device, deviceNumber = '', now = Date.now()}) => {
	const lines = ['Problème sur VJOD :', '', ''];
	if (what) lines.push(`— ${what}`);
	if (last && last.at && now - last.at * 1000 < 24 * 3600 * 1000) {
		const mins = Math.floor((now - last.at * 1000) / 60000);
		const ago = mins < 1 ? 'à l’instant' : (mins < 60 ? `il y a ${mins} min` : `il y a ${Math.floor(mins / 60)} h`);
		const kind = last.kind === 'crash' ? 'plantage' : last.kind === 'play' ? 'lecture ratée' : 'erreur';
		let msg = String(last.message || '').split('\n')[0].trim();
		if (msg.length > 120) msg = `${msg.substring(0, 117)}…`;
		const where = [last.channel, last.title].filter(Boolean).join(' · ');
		lines.push(`— Dernier souci noté : ${kind}${where ? ` (${where})` : ''}, ${ago} : ${msg}`);
	}
	lines.push(`— VJOD ${version} · ${device}`);
	if (deviceNumber) lines.push(`— Appareil ${deviceNumber} (page Ma TV)`);
	return lines.join('\n');
};

// L'adresse WhatsApp à montrer en QR code, ou null sans numéro réglé sur Ma TV.
export const reportProblemUrl = async (what = '') => {
	const number = supportNumber || await loadSupportNumber();
	if (!number) return null;
	const text = reportProblemText({
		what,
		last: await lastReport(),
		version: `TV ${VJOD_TV_VERSION}`,
		device: ['TV', platformName()].filter(Boolean).join(' · '),
		deviceNumber: await deviceId()
	});
	return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

// « Signaler un problème » : l'appli montre le QR code WhatsApp (App.js).
export const openReportProblem = (what = '') => {
	if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vjod:reportProblem', {detail: {what}}));
};

export const resetReportsForTests = () => {
	server = null;
	allowed = true;
	profile = '';
	sending = false;
	helloSent = false;
	supportNumber = null;
	askedAt = 0;
	timingsSent = -1;
	if (timingsTimer) clearInterval(timingsTimer);
	timingsTimer = null;
	seen.clear();
	writes = Promise.resolve();
	if (timer) clearTimeout(timer);
	timer = null;
};
