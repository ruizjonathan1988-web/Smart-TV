// VJOD 4.25 (replay_keep.dart de l'APK) : garder une émission du replay, seconde voie. Les
// trackers sont cherchés par Prowlarr via Ma TV 3.67 (/tv/api/fetch/search) et la version choisie
// part au téléchargement (/tv/api/fetch/grab). Rien ne part sans un appui.
import {maTvEndpoint} from './maTvApi';
import {postMaTv} from './maTvPost';
import {platformFetch} from './secureFetch';

const two = (n) => String(n).padStart(2, '0');
const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : 0);

// Ce qu'on cherche pour un épisode : l'émission, et son épisode quand on le connaît
// (« Koh-Lanta S25E10 »).
export const queryFor = (item) => (item.season > 0 && item.episode > 0
	? `${item.show} S${two(item.season)}E${two(item.episode)}`
	: item.show);

export const parseRelease = (j) => ({
	id: String(j.id ?? ''),
	title: String(j.title ?? ''),
	size: num(j.size),
	seeders: num(j.seeders),
	indexer: String(j.indexer ?? ''),
	ageDays: typeof j.age === 'number' ? Math.round(j.age) : null
});

// « 2,4 Go · 40 sources · Tracker A · il y a 2 j »
export const releaseDetail = (r) => {
	let size = '';
	if (r.size > 0) {
		const go = r.size / (1 << 30);
		size = go >= 1 ? `${go.toFixed(1).replace('.', ',')} Go` : `${Math.round(r.size / (1 << 20))} Mo`;
	}
	const age = r.ageDays === null || r.ageDays === undefined ? '' : (r.ageDays === 0 ? 'aujourd’hui' : `il y a ${r.ageDays} j`);
	return [size, `${r.seeders} source${r.seeders > 1 ? 's' : ''}`, r.indexer, age].filter(Boolean).join(' · ');
};

// La réponse de /tv/api/fetch/search : {results, mayGrab, error}.
export const parseTrackerSearch = (status, json) => {
	if (status === 404) return {results: [], mayGrab: false, error: 'Il faut Ma TV 3.67 sur la seedbox.'};
	if (status !== 200 || !json || typeof json !== 'object') {
		const why = json && typeof json === 'object' && json.error != null ? String(json.error) : `Ma TV a répondu ${status}.`;
		return {results: [], mayGrab: false, error: why};
	}
	return {
		results: (Array.isArray(json.results) ? json.results : []).filter((x) => x && typeof x === 'object').map(parseRelease),
		mayGrab: json.may_grab === true,
		error: ''
	};
};

export const searchTrackers = async (server, query) => {
	if (!server) return {results: [], mayGrab: false, error: 'Ma TV n’est pas réglée sur ce serveur.'};
	try {
		const res = await platformFetch(maTvEndpoint(server, '/tv/api/fetch/search', {q: query}), {method: 'GET'}, 70000);
		if (!res) return {results: [], mayGrab: false, error: 'Les trackers n’ont pas répondu à temps.'};
		let json = null;
		try {
			json = await res.json();
		} catch (err) {
			json = null;
		}
		return parseTrackerSearch(res.status, json);
	} catch (err) {
		const timedOut = err && /timeout|abort/i.test(String(err.name || err.message || err));
		return {results: [], mayGrab: false, error: timedOut ? 'Les trackers n’ont pas répondu à temps.' : `Recherche impossible : ${err && err.message ? err.message : err}`};
	}
};

// La phrase à montrer après l'envoi.
export const grabAnswer = (status, json, show) => {
	if (status === 200 && json && json.ok === true) {
		if (json.via === 'library') return `Téléchargement lancé : il arrivera dans ta bibliothèque Séries, dans « ${show || 'son dossier'} ».`;
		if (json.via === 'qbittorrent') return 'Envoyé à qBittorrent (catégorie « vjod »).';
		return 'Envoyé au téléchargement par Prowlarr.';
	}
	if (status === 0) return 'Envoi impossible : Ma TV ne répond pas.';
	return json && typeof json === 'object' && json.error != null ? String(json.error) : `Ma TV a répondu ${status}.`;
};

export const grabRelease = async (server, release, show = '', post = postMaTv) => {
	if (!server) return 'Ma TV n’est pas réglée sur ce serveur.';
	const body = show ? {id: release.id, show} : {id: release.id};
	const {status, json} = await post(server, '/tv/api/fetch/grab', body, 40000);
	return grabAnswer(status, json, show);
};
