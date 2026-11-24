// Trakt sans compte (trakt_client.dart de l'APK) : ses classements, faits de ce
// que ses membres regardent vraiment, et les titres qu'ils rapprochent d'un
// autre. Le compte Trakt (ses recommandations) n'existe pas sur la TV.
import {fetchOutsideJson} from './outsideFetch';

// L'identifiant public de l'appli chez Trakt, le même que l'APK.
export const TRAKT_CLIENT_ID = 'TCAqoSzejS8EETqVZUEc3c0RhsSgxYcM-HYt0_vcHpE';
const BASE = 'https://api.trakt.tv';
const HEADERS = {'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': TRAKT_CLIENT_ID};

// Les plus regardés des sept derniers jours, et ce qui se regarde maintenant.
export const TRAKT_CHARTS = ['watched/weekly', 'trending'];

const kind = (mediaType) => (mediaType === 'tv' ? 'shows' : 'movies');

// Les ids TMDB d'une liste Trakt, dans l'ordre. Un classement range chaque
// titre sous `movie` ou `show`, une liste de titres liés non.
export const parseTraktTitles = (json, mediaType) => {
	if (!Array.isArray(json)) return [];
	const key = mediaType === 'tv' ? 'show' : 'movie';
	const ids = [];
	json.forEach((entry) => {
		if (!entry || typeof entry !== 'object') return;
		const title = key in entry ? entry[key] : entry;
		const tmdb = title && title.ids && title.ids.tmdb;
		if (typeof tmdb === 'number' && ids.indexOf(tmdb) < 0) ids.push(tmdb);
	});
	return ids;
};

let fetchJson = fetchOutsideJson;
const get = (path) => fetchJson(`${BASE}${path}`, {headers: HEADERS});

export const traktChart = async (chart, mediaType, limit = 20) =>
	parseTraktTitles(await get(`/${kind(mediaType)}/${chart}?limit=${limit}`), mediaType);

// Ce que les membres rapprochent du titre : on cherche d'abord son id Trakt.
// Gardé pour la session, rien quand Trakt ne connaît pas le titre.
const related = {};
const fetchRelated = async (mediaType, tmdbId, limit) => {
	const type = mediaType === 'tv' ? 'show' : 'movie';
	const hits = await get(`/search/tmdb/${tmdbId}?type=${type}`);
	let traktId = null;
	if (Array.isArray(hits)) {
		for (const hit of hits) {
			const id = hit && hit[type] && hit[type].ids && hit[type].ids.trakt;
			if (typeof id === 'number') {
				traktId = id;
				break;
			}
		}
	}
	if (traktId === null) return [];
	return parseTraktTitles(await get(`/${kind(mediaType)}/${traktId}/related?limit=${limit}`), mediaType);
};

export const traktRelated = (mediaType, tmdbId, limit = 15) => {
	const key = `${mediaType}:${tmdbId}`;
	if (!related[key]) {
		related[key] = fetchRelated(mediaType, tmdbId, limit).catch(() => {
			delete related[key];
			return [];
		});
	}
	return related[key];
};

export const setTraktFetchForTests = (fn) => {
	fetchJson = fn || fetchOutsideJson;
	Object.keys(related).forEach((k) => delete related[k]);
};
