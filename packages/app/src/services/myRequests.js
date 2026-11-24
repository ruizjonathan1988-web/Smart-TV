// Mes demandes (my_requests.dart de l'APK) : où en est chaque titre demandé,
// de la demande au moment où on peut le regarder.
import {getFromStorage, saveToStorage} from './storage';

export const STATE = {ready: 0, downloading: 1, approved: 2, pending: 3, failed: 4, declined: 5};

const REQ = {pending: 1, approved: 2, declined: 3, failed: 4, completed: 5};
const MEDIA = {partial: 4, available: 5};
const DAY = 86400000;
export const READY_WINDOW = 14 * DAY;
export const DECLINED_WINDOW = 7 * DAY;

const parse = (v) => {
	if (!v) return null;
	const t = Date.parse(v);
	return isNaN(t) ? null : t;
};

export const requestKey = (request) => {
	const media = request.media || {};
	return `${request.type}:${media.tmdbId != null ? media.tmdbId : media.id}`;
};

export const requestState = (request) => {
	if (request.status === REQ.declined) return STATE.declined;
	if (request.status === REQ.failed) return STATE.failed;
	const media = request.media || {};
	const status = request.is4k ? media.status4k : media.status;
	const downloads = request.is4k ? media.downloadStatus4k : media.downloadStatus;
	if (Array.isArray(downloads) && downloads.length) return STATE.downloading;
	if (status === MEDIA.available) return STATE.ready;
	if (status === MEDIA.partial && request.status === REQ.completed) return STATE.ready;
	if (request.status === REQ.pending) return STATE.pending;
	return STATE.approved;
};

// Avancement d'un téléchargement : chaque fichier compté une fois.
export const downloadProgress = (items) => {
	if (!Array.isArray(items) || !items.length) return null;
	const seen = new Set();
	let size = 0;
	let left = 0;
	items.forEach((item) => {
		const id = item.downloadId;
		if (id != null) {
			if (seen.has(id)) return;
			seen.add(id);
		}
		const itemSize = item.size || 0;
		if (itemSize <= 0) return;
		size += itemSize;
		left += Math.min(Math.max(item.sizeLeft || 0, 0), itemSize);
	});
	if (size <= 0) return null;
	return Math.min(Math.max((size - left) / size, 0), 1);
};

const lastChange = (request, state) => {
	if (state === STATE.ready) {
		const added = parse(request.media && request.media.mediaAddedAt);
		if (added !== null) return added;
	}
	const updated = parse(request.updatedAt);
	return updated !== null ? updated : parse(request.createdAt);
};

// Une entrée par titre (la plus avancée), prêts gardés 14 jours, refus et
// échecs 7 jours ; triées par état puis du plus récent au plus ancien.
export const myRequestEntries = (requests, now = Date.now(), limit = 20) => {
	const byKey = {};
	(requests || []).forEach((request) => {
		if (!request || !request.media) return;
		const state = requestState(request);
		const changed = lastChange(request, state);
		let keep = null;
		if (state === STATE.ready) keep = READY_WINDOW;
		else if (state === STATE.declined || state === STATE.failed) keep = DECLINED_WINDOW;
		if (keep !== null && (changed === null || now - changed > keep)) return;
		const media = request.media;
		const entry = {
			request,
			state,
			key: requestKey(request),
			progress: state === STATE.downloading ? downloadProgress(request.is4k ? media.downloadStatus4k : media.downloadStatus) : null,
			eta: null,
			stalled: false,
			changed
		};
		const existing = byKey[entry.key];
		if (!existing || state < existing.state) byKey[entry.key] = entry;
	});
	return Object.keys(byKey).map((k) => byKey[k]).sort((a, b) => {
		if (a.state !== b.state) return a.state - b.state;
		if (a.changed === null && b.changed === null) return 0;
		if (a.changed === null || b.changed === null) return a.changed === null ? 1 : -1;
		return b.changed - a.changed;
	}).slice(0, limit);
};

// La clé d'annonce d'une demande prête : une par demande.
export const readyKey = (entry) => `req:${entry.request.id}`;

const ANNOUNCED_KEY = 'vjodAnnouncedReady';
const readyListeners = new Set();

// Les demandes prêtes pas encore annoncées. Rien au tout premier passage
// (`announced` vaut null) : ce qui était déjà prêt n'est pas une nouvelle.
export const newlyReady = (entries, announced) => {
	if (!announced) return [];
	const known = new Set(announced);
	return entries.filter((e) => e.state === STATE.ready && !known.has(readyKey(e)));
};

// Prévenu avec les titres qui viennent d'arriver (« Prêt à regarder »).
export const onRequestsReady = (fn) => {
	readyListeners.add(fn);
	return () => readyListeners.delete(fn);
};

// Le bandeau « Prêt à regarder » : un titre, ou combien.
export const readyNotification = (titles, at = Date.now()) => ({
	key: `requests-ready-${at}`,
	title: 'Prêt à regarder',
	body: titles.length === 1 ? `${titles[0]} est dans votre bibliothèque.` : `${titles.length} titres demandés sont dans votre bibliothèque.`
});

// Retient les prêtes comme annoncées (les 300 dernières) et prévient pour
// celles qui ne l'étaient pas encore.
export const takeReadyNews = async (entries, titleOf = () => '') => {
	const announced = await getFromStorage(ANNOUNCED_KEY).catch(() => null);
	const list = Array.isArray(announced) ? announced : null;
	const fresh = newlyReady(entries, list);
	const all = (list || []).concat(entries.filter((e) => e.state === STATE.ready).map(readyKey)
		.filter((k) => !list || list.indexOf(k) < 0));
	await saveToStorage(ANNOUNCED_KEY, all.length > 300 ? all.slice(all.length - 300) : all);
	const titles = fresh.map((e) => titleOf(e) || (e.request.media && (e.request.media.title || e.request.media.name)) || '').filter(Boolean);
	if (titles.length) readyListeners.forEach((fn) => fn(titles));
	return titles;
};

// Ce que la bibliothèque pourrait déjà avoir alors que Seerr dit encore
// « validé » ou « en attente ».
export const libraryCandidates = (entries) => entries.filter((e) => e.state === STATE.approved || e.state === STATE.pending);

// Seerr peut traîner derrière la bibliothèque : un titre qu'elle a déjà est
// prêt. Une vieille demande ainsi passée prête après 14 jours disparaît.
export const promoteInLibrary = (entries, inLibrary, now = Date.now()) => {
	const out = [];
	entries.forEach((e) => {
		const candidate = e.state === STATE.approved || e.state === STATE.pending;
		if (!candidate || !inLibrary.has(e.key)) {
			out.push(e);
			return;
		}
		const changed = parse(e.request.updatedAt) !== null ? parse(e.request.updatedAt) : parse(e.request.createdAt);
		if (changed !== null && now - changed > READY_WINDOW) return;
		out.push({...e, state: STATE.ready, progress: null});
	});
	return out.sort((a, b) => a.state - b.state);
};

// Les clés TMDB (`movie:12`, `tv:34`) que la bibliothèque Jellyfin contient.
export const loadLibraryTmdbKeys = async (api, wanted) => {
	const found = new Set();
	await Promise.all(wanted.map(async ({mediaType, tmdbId}) => {
		const type = mediaType === 'tv' ? 'Series' : 'Movie';
		try {
			const res = await api.getItems({AnyProviderIdEquals: `tmdb.${tmdbId}`, IncludeItemTypes: type, Recursive: true, Limit: 5, Fields: 'ProviderIds', EnableTotalRecordCount: false});
			const hit = ((res && res.Items) || []).some((i) => i.Type === type && String((i.ProviderIds || {}).Tmdb || (i.ProviderIds || {}).tmdb) === String(tmdbId));
			if (hit) found.add(`${mediaType}:${tmdbId}`);
		} catch (e) {
			// Pas de réponse : on s'en tient à ce que dit Seerr.
		}
	}));
	return found;
};

// Avec la bibliothèque : ce qui y est déjà passe prêt.
export const withLibrary = async (api, entries, now = Date.now()) => {
	const candidates = libraryCandidates(entries).filter((e) => e.request.media && e.request.media.tmdbId != null);
	if (!api || !candidates.length) return entries;
	const inLibrary = await loadLibraryTmdbKeys(api, candidates.map((e) => ({mediaType: e.request.type === 'tv' ? 'tv' : 'movie', tmdbId: e.request.media.tmdbId})));
	return inLibrary.size ? promoteInLibrary(entries, inLibrary, now) : entries;
};

// La pastille d'une carte de « Mes demandes » : où en est la demande.
export const requestPill = (state, progress) => {
	switch (state) {
		case STATE.ready: return {pill: 'Prêt', tone: 'ready'};
		case STATE.downloading: return {pill: progress == null ? 'Téléchargement' : `Téléchargement ${Math.round(progress * 100)} %`, progress};
		case STATE.approved: return {pill: 'Validé', tone: 'muted'};
		case STATE.pending: return {pill: 'En attente', tone: 'muted'};
		case STATE.failed: return {pill: 'Échec', tone: 'failed'};
		case STATE.declined: return {pill: 'Refusé', tone: 'failed'};
		default: return null;
	}
};

// Les téléchargements lus en direct dans Radarr et Sonarr par Ma TV.
export const parseMaTvDownloads = (json) => {
	const items = json && Array.isArray(json.items) ? json.items : [];
	return items.filter((i) => i && (typeof i.tmdb === 'number' || typeof i.tvdb === 'number')).map((i) => {
		const eta = parse(i.eta);
		return {
			isTv: i.type === 'tv',
			tmdbId: typeof i.tmdb === 'number' ? i.tmdb : null,
			tvdbId: typeof i.tvdb === 'number' ? i.tvdb : null,
			season: typeof i.season === 'number' ? i.season : null,
			progress: Math.min(Math.max(typeof i.progress === 'number' ? i.progress : 0, 0), 1),
			eta,
			stalled: i.stalled === true
		};
	});
};

const live = (e, downloads) => {
	const tv = e.request.type === 'tv';
	const media = e.request.media;
	const tmdb = media.tmdbId;
	const tvdb = media.tvdbId;
	const seasons = new Set((e.request.seasons || []).map((s) => s.seasonNumber));
	const mine = downloads.filter((d) => d.isTv === tv &&
		((tmdb != null && d.tmdbId === tmdb) || (tvdb != null && d.tvdbId === tvdb)) &&
		(!tv || !seasons.size || d.season === null || seasons.has(d.season)));
	if (!mine.length) return null;
	let eta = null;
	mine.forEach((d) => {
		if (d.eta !== null && (eta === null || d.eta > eta)) eta = d.eta;
	});
	return {
		...e,
		state: STATE.downloading,
		progress: mine.reduce((sum, d) => sum + d.progress, 0) / mine.length,
		eta,
		stalled: mine.some((d) => d.stalled)
	};
};

export const applyLiveDownloads = (entries, downloads) => {
	if (!downloads || !downloads.length) return entries;
	return entries.map((e) => (e.state === STATE.ready || e.state === STATE.failed || e.state === STATE.declined ? e : live(e, downloads) || e));
};

// « fini dans 12 min », « fin vers 21:40 », « fin le 24/11 vers 08:10 ».
export const etaLabel = (eta, now = Date.now()) => {
	const left = eta - now;
	if (left < 0) return '';
	const minutes = Math.floor(left / 60000);
	if (minutes < 1) return 'fini dans un instant';
	if (minutes < 60) return `fini dans ${minutes} min`;
	const d = new Date(eta);
	const n = new Date(now);
	const pad = (v) => String(v).padStart(2, '0');
	const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	if (d.toDateString() === n.toDateString()) return `fin vers ${hm}`;
	const tomorrow = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
	if (d.toDateString() === tomorrow.toDateString()) return `fin demain vers ${hm}`;
	return `fin le ${pad(d.getDate())}/${pad(d.getMonth() + 1)} vers ${hm}`;
};

// Où en est le parcours entier : demandé, validé, en téléchargement, arrivé.
export const journey = (entry) => {
	switch (entry.state) {
		case STATE.ready: return 1;
		case STATE.downloading: return 0.35 + 0.6 * (entry.progress || 0);
		case STATE.approved: return 0.25;
		case STATE.pending: return 0.1;
		default: return 0;
	}
};

// VJOD 5.9 : le compteur de l'onglet En route, les demandes pas encore arrivées.
export const waitingCount = (entries) => (entries || []).filter((e) =>
	e.state === STATE.downloading || e.state === STATE.approved || e.state === STATE.pending
).length;
