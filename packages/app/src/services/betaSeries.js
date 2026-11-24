// BetaSeries (betaseries_client.dart de l'APK) : le côté français des
// classements et des suggestions, ce que ses membres suivent, regardent et
// rapprochent.
import {fetchOutsideJson, mapBounded} from './outsideFetch';

// La clé publique de l'appli chez BetaSeries, la même que l'APK.
export const BETASERIES_KEY = '09fe278bf39e';
const BASE = 'https://api.betaseries.com';
const HEADERS = {'X-BetaSeries-Key': BETASERIES_KEY, 'X-BetaSeries-Version': '3.0'};
// Les pays que BetaSeries classe à part, les autres ont le monde.
const RANKED = ['fr', 'de', 'es'];

let fetchJson = fetchOutsideJson;
const get = (path, params) => {
	const query = Object.keys(params).map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&');
	return fetchJson(`${BASE}${path}?${query}`, {headers: HEADERS});
};

// ------------------------------------------------------------------ lecture

export const parseRanking = (json) => {
	const shows = json && json.shows;
	if (!Array.isArray(shows)) return [];
	return shows.filter((s) => s && typeof s.show_id === 'number').map((s) => s.show_id);
};

export const parseMovies = (json) => {
	const movies = json && json.movies;
	if (!Array.isArray(movies)) return [];
	return movies.filter((m) => m && typeof m.tmdb_id === 'number' && m.tmdb_id > 0).map((m) => m.tmdb_id);
};

export const parseShow = (json) => {
	const show = json && json.show;
	if (!show || typeof show.themoviedb_id !== 'number' || show.themoviedb_id <= 0) return null;
	return {tmdbId: show.themoviedb_id, language: typeof show.language === 'string' ? show.language : null};
};

export const parseMovieId = (json) => {
	const id = json && json.movie && json.movie.id;
	return typeof id === 'number' && id > 0 ? id : null;
};

// Les titres rapprochés, les plus suivis d'abord, chacun une fois.
export const parseSimilars = (json, mediaType) => {
	const similars = json && json.similars;
	if (!Array.isArray(similars)) return [];
	const key = mediaType === 'tv' ? 'show' : 'movie';
	const idField = mediaType === 'tv' ? 'themoviedb_id' : 'tmdb_id';
	const found = [];
	const seen = new Set();
	similars.forEach((s) => {
		const title = s && s[key];
		if (!title || typeof title !== 'object') return;
		const id = title[idField];
		if (typeof id !== 'number' || id <= 0 || seen.has(id)) return;
		seen.add(id);
		found.push({id, followers: typeof title.followers === 'number' ? title.followers : 0, order: found.length});
	});
	found.sort((a, b) => (b.followers - a.followers) || (a.order - b.order));
	return found.map((t) => t.id);
};

// ------------------------------------------------------------------ appels

const knownShows = {};
const knownSimilars = {};

const showOf = async (id) => {
	if (knownShows[id]) return knownShows[id];
	const show = parseShow(await get('/shows/display', {id}));
	if (show) knownShows[id] = show;
	return show;
};

const ranking = async (country, limit) => {
	const code = String(country || '').toLowerCase();
	const ids = parseRanking(await get('/stats/shows_ranking', {country: RANKED.indexOf(code) >= 0 ? code : 'all', genre: 'all', limit}));
	return (await mapBounded(ids, 4, showOf)).filter(Boolean);
};

// Les séries les plus regardées des sept derniers jours dans [country].
export const betaSeriesShowChart = async (country = 'fr', limit = 10) => (await ranking(country, limit)).map((s) => s.tmdbId);

// Les séries en français les plus regardées en France, parmi les [limit] premières.
export const betaSeriesFrenchShowChart = async (limit = 25) => (await ranking('fr', limit)).filter((s) => s.language === 'fr').map((s) => s.tmdbId);

// Les films que les membres suivent le plus.
export const betaSeriesMovieChart = async (limit = 20) => parseMovies(await get('/movies/list', {order: 'popularity', limit}));

export const betaSeriesSimilarMovies = async (tmdbId) => {
	const key = `movie:${tmdbId}`;
	if (knownSimilars[key]) return knownSimilars[key];
	const id = parseMovieId(await get('/movies/movie', {tmdb_id: tmdbId}));
	if (id === null) {
		knownSimilars[key] = [];
		return [];
	}
	knownSimilars[key] = parseSimilars(await get('/movies/similars', {id, details: 'true'}), 'movie');
	return knownSimilars[key];
};

// BetaSeries trouve une série par son id TheTVDB, que [tvdbIdOf] donne.
export const betaSeriesSimilarShows = async (tmdbId, tvdbIdOf) => {
	const key = `tv:${tmdbId}`;
	if (knownSimilars[key]) return knownSimilars[key];
	const tvdbId = await tvdbIdOf();
	if (!tvdbId) {
		knownSimilars[key] = [];
		return [];
	}
	knownSimilars[key] = parseSimilars(await get('/shows/similars', {thetvdb_id: tvdbId, details: 'true'}), 'tv');
	return knownSimilars[key];
};

export const setBetaSeriesFetchForTests = (fn) => {
	fetchJson = fn || fetchOutsideJson;
	[knownShows, knownSimilars].forEach((m) => Object.keys(m).forEach((k) => delete m[k]));
};
