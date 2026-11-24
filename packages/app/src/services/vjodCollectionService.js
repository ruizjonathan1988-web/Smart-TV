// Les pages d'une collection VJOD (vjod_collection_service.dart) : d'abord ses
// titres connus, puis, au-delà, la même recherche sans seuil de votes.
import * as seerrApi from './seerrApi';
import {relaxed} from './vjodCollections';

const keywordIds = {};
const LIFETIME = 30 * 60000;
const cache = {};

// L'id TMDB d'un mot-clé, par son nom ; le nom exact d'abord, sinon le premier.
export const keywordId = async (name) => {
	const key = name.toLowerCase();
	if (key in keywordIds) return keywordIds[key];
	const res = await seerrApi.searchKeyword(name);
	let id = null;
	((res && res.results) || []).some((r) => {
		if (typeof r.id !== 'number') return false;
		if (String(r.name || '').toLowerCase() === key) {
			id = r.id;
			return true;
		}
		if (id === null) id = r.id;
		return false;
	});
	keywordIds[key] = id;
	return id;
};

const fetchRaw = async (c, page) => {
	const q = c.query;
	let keywords;
	if (q.keyword) {
		keywords = await keywordId(q.keyword);
		if (keywords === null) return null;
	}
	return seerrApi.discoverFiltered(q.mediaType || 'movie', {
		page,
		sortBy: q.sortBy || 'popularity.desc',
		genre: q.genre,
		studio: q.studio,
		network: q.network,
		keywords,
		language: q.language,
		status: q.status,
		voteAverageGte: q.voteAverageGte,
		voteCountGte: q.voteCountGte,
		withRuntimeGte: q.runtimeGte,
		withRuntimeLte: q.runtimeLte,
		releaseDateGte: q.dateGte,
		releaseDateLte: q.dateLte
	});
};

// Une page, gardée une demi-heure.
export const fetchPage = (c, page = 1) => {
	const key = `${c.id}:${page}`;
	const hit = cache[key];
	if (hit && Date.now() - hit.at < LIFETIME) return hit.page;
	const promise = fetchRaw(c, page).catch(() => null);
	cache[key] = {at: Date.now(), page: promise};
	promise.then((p) => {
		if (!p && cache[key] && cache[key].page === promise) delete cache[key];
	});
	return promise;
};

export const fetchBrowsePage = async (c, page = 1) => {
	const rest = relaxed(c);
	if (!rest) return fetchPage(c, page);
	const first = await fetchPage(c, 1);
	const strictPages = first && first.results && first.results.length ? first.totalPages || 1 : 0;
	if (page <= strictPages) {
		const strict = page === 1 ? first : await fetchPage(c, page);
		if (!strict) return null;
		const restFirst = await fetchPage(rest, 1);
		return {...strict, page, totalPages: strictPages + ((restFirst && restFirst.totalPages) || 0)};
	}
	const more = await fetchPage(rest, page - strictPages);
	if (!more) return null;
	return {...more, page, totalPages: strictPages + (more.totalPages || 0)};
};

export const clearCollectionCache = () => {
	Object.keys(cache).forEach((k) => delete cache[k]);
};
