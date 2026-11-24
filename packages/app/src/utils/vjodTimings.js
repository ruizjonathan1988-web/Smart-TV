// VJOD 4.20 (comme lib/util/vjod_timings.dart) : le temps que met chaque service à répondre sur
// cette TV (Jellyfin, Seerr, Ma TV), les 60 dernières réponses de chacun, montré dans « À propos ».
// Toutes les requêtes passent par traceRequest (networkLogSink), qui les chronomètre ici.

const KEEP = 60;
const times = new Map();
const slowest = new Map();
const jellyfinOrigins = new Set();
let changes = 0;

// Un repère pour savoir si quelque chose a été chronométré depuis.
export const timingMark = () => changes;

const originOf = (url) => {
	const match = /^(https?:\/\/[^/?#]+)/i.exec(String(url || ''));
	return match ? match[1].toLowerCase() : '';
};

const pathOf = (url) => {
	const rest = String(url || '').replace(/^https?:\/\/[^/?#]+/i, '');
	return rest.split(/[?#]/)[0] || '/';
};

// L'adresse du serveur Jellyfin en cours, pour reconnaître ses réponses.
export const registerJellyfinServer = (url) => {
	const origin = originOf(url);
	if (origin) jellyfinOrigins.add(origin);
};

// Le service qu'interroge cette adresse, ou null quand elle ne dit rien des listes (images,
// suivi de lecture, flux vidéo).
export const serviceOf = (url) => {
	const path = pathOf(url);
	if (/\/Images\/|\/Sessions\/Playing/i.test(path)) return null;
	if (/\/tv\/(play|shift|replay|xc)\//.test(path)) return null;
	if (path.indexOf('/tv/api/vod/') >= 0) return 'Ma TV (VOD)';
	if (path.indexOf('/tv/api/') >= 0) return 'Ma TV';
	if (path.indexOf('/api/v1/') >= 0) return 'Seerr';
	if (jellyfinOrigins.has(originOf(url))) return 'Jellyfin';
	return null;
};

// Le genre d'appel, sans les identifiants.
export const callKind = (url) => pathOf(url).replace(/[0-9a-fA-F]{16,}|\d+/g, '…');

export const addTiming = (service, ms, what = '') => {
	if (!service || !(ms >= 0)) return;
	const list = times.get(service) || [];
	if (what && (list.length === 0 || ms >= Math.max(...list))) slowest.set(service, what);
	list.push(Math.round(ms));
	changes += 1;
	if (list.length > KEEP) list.shift();
	times.set(service, list);
};

// Chronomètre la réponse d'une adresse, si elle appartient à un service suivi.
export const timeRequest = (url, send) => {
	const service = serviceOf(url);
	if (!service) return send();
	const started = Date.now();
	const done = () => addTiming(service, Date.now() - started, callKind(url));
	return send().then((response) => {
		done();
		return response;
	}, (err) => {
		done();
		throw err;
	});
};

const at = (sorted, q) => sorted[Math.round((sorted.length - 1) * q)];

export const timingSummary = () => {
	const out = {};
	times.forEach((list, service) => {
		if (!list.length) return;
		const sorted = [...list].sort((a, b) => a - b);
		out[service] = {median: at(sorted, 0.5), p90: at(sorted, 0.9), count: sorted.length, slowest: slowest.get(service) || ''};
	});
	return out;
};

export const formatMs = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`);

// « Jellyfin : 240 ms d'habitude, 1,2 s quand c'est lent (60 réponses) », le plus lent d'abord.
export const timingLines = () => Object.entries(timingSummary())
	.sort((a, b) => b[1].p90 - a[1].p90)
	.map(([service, s]) => `${service} : ${formatMs(s.median)} d’habitude, ${formatMs(s.p90)} quand c’est lent (${s.count} réponses)`);

export const resetTimings = () => {
	times.clear();
	slowest.clear();
	jellyfinOrigins.clear();
};
