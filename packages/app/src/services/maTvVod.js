// Le catalogue VOD de Ma TV (xtream_catalog.dart de l'APK, côté « Ma TV ») :
// la seedbox fusionne les films et séries des fournisseurs IPTV et répond par
// page, par rangée d'affiches ou par recherche ; rien n'est gardé sur la TV.
//   /tv/api/vod/tmdb?kind=movie&ids=1,2  → {id: [copies]}
//   /tv/api/vod/search?q=                 → {titles: [...]}
//   /tv/api/vod/info?kind=series&id=      → saisons et épisodes (format Xtream)
//   /tv/xc/movie/vjod/<clé>/<id>.<ext>     lecture d'un film
//   /tv/xc/series/vjod/<clé>/<id>.<ext>    lecture d'un épisode
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const TIMEOUT = 15000;
const str = (v) => (v === undefined || v === null ? '' : String(v));
const int = (v, fallback = 0) => {
	const n = parseInt(v, 10);
	return isNaN(n) ? fallback : n;
};

const getJson = async (url) => {
	try {
		const res = await platformFetch(url, {method: 'GET'}, TIMEOUT);
		if (!res || res.status !== 200) return null;
		return await res.json();
	} catch (e) {
		return null;
	}
};

// XtreamTitle.fromMaTv
export const vodTitle = (j) => {
	const kind = j.kind === 'series' ? 'series' : 'movie';
	const year = int(j.year);
	return {
		kind,
		id: str(j.id),
		name: str(j.name),
		tag: str(j.tag),
		poster: str(j.poster),
		extension: kind === 'movie' ? str(j.ext) || 'mp4' : '',
		tmdbId: str(j.tmdb),
		year: year > 0 ? year : null,
		qualities: (Array.isArray(j.qualities) ? j.qualities : []).map(str).filter(Boolean)
	};
};

const titles = (list) => (Array.isArray(list) ? list : []).filter((j) => j && typeof j === 'object').map(vodTitle);

// parseSeriesInfo : épisodes groupés par saison, triés par numéro.
export const parseSeriesInfo = (decoded) => {
	if (!decoded || typeof decoded !== 'object') return {plot: '', cover: '', seasons: {}};
	const info = decoded.info && typeof decoded.info === 'object' ? decoded.info : {};
	const raw = decoded.episodes;
	const groups = [];
	if (Array.isArray(raw)) raw.forEach((v) => groups.push([null, v]));
	else if (raw && typeof raw === 'object') Object.keys(raw).forEach((k) => groups.push([int(k, null), raw[k]]));
	const seasons = {};
	groups.forEach(([key, value]) => {
		(Array.isArray(value) ? value : [value]).forEach((ep) => {
			if (!ep || typeof ep !== 'object') return;
			const id = str(ep.id);
			if (!id) return;
			const epInfo = ep.info && typeof ep.info === 'object' ? ep.info : {};
			const season = int(ep.season, key === null ? 1 : key);
			const number = int(ep.episode_num);
			const title = str(ep.title).replace(/^[A-Z]{2,3}\s*[-|:]\s*/, '').trim();
			(seasons[season] = seasons[season] || []).push({
				id, season, number,
				title: title || `Épisode ${number}`,
				extension: str(ep.container_extension) || 'mkv',
				plot: str(epInfo.plot),
				image: str(epInfo.movie_image)
			});
		});
	});
	Object.keys(seasons).forEach((s) => seasons[s].sort((a, b) => a.number - b.number));
	return {plot: str(info.plot), cover: str(info.cover), seasons};
};

export const createVodClient = (maTvClient) => {
	const server = maTvClient.server;
	const base = `${server.url}/tv/xc`;
	const seg = (v) => encodeURIComponent(v);
	const api = (what, query) => getJson(maTvEndpoint(server, `/tv/api/vod/${what}`, query));
	// Les copies par TMDB, demandées par lots et gardées pour la séance.
	const known = {};

	return {
		copiesByTmdb: async (kind, ids) => {
			const out = {};
			const missing = [];
			ids.forEach((id) => {
				const key = `${kind}:${id}`;
				if (known[key]) out[id] = known[key];
				else missing.push(id);
			});
			for (let i = 0; i < missing.length; i += 150) {
				const part = missing.slice(i, i + 150);
				const answer = await api('tmdb', {kind, ids: part.join(',')});
				if (!answer) continue;
				part.forEach((id) => {
					const copies = titles(answer[id]);
					known[`${kind}:${id}`] = copies;
					out[id] = copies;
				});
			}
			return out;
		},
		search: async (q, limit = 40) => {
			if (str(q).trim().length < 2) return [];
			const answer = await api('search', {q: q.trim(), limit});
			return titles(answer && answer.titles);
		},
		seriesInfo: async (id) => parseSeriesInfo(await api('info', {kind: 'series', id})),
		movieUrl: (movie) => `${base}/movie/vjod/${seg(server.key)}/${movie.id}.${movie.extension || 'mp4'}`,
		episodeUrl: (ep) => `${base}/series/vjod/${seg(server.key)}/${ep.id}.${ep.extension || 'mkv'}`
	};
};

// ------------------------------------------------------------------ catalogue

// Comment regarder un titre (catalogue_availability.dart) : sur le serveur,
// puis chez le fournisseur IPTV, puis déjà demandé, sinon à demander.
export const catalogueAvailability = (seerrStatus, hasIptv) => {
	if (seerrStatus === 5 || seerrStatus === 4) return 'server';
	if (hasIptv) return 'iptv';
	if (seerrStatus === 2 || seerrStatus === 3) return 'requested';
	return 'toRequest';
};

// Le filtre du haut : 0 tout, 1 sur le serveur, 2 IPTV, 3 à demander (demandés compris).
export const catalogueFilterKeeps = (filter, a) => {
	if (filter === 1) return a === 'server';
	if (filter === 2) return a === 'iptv';
	if (filter === 3) return a === 'toRequest' || a === 'requested';
	return true;
};
