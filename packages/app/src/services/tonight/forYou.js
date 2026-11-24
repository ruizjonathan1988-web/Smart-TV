// « Pour toi » (for_you_service.dart, for_you_ranker.dart, abandoned.dart et
// taste_extras.dart de l'APK) : ce qui a été regardé, mis en favori, choisi
// dans le questionnaire, mis dans la liste ou demandé devient une graine ;
// les recommandations Seerr de chaque graine sont fusionnées et classées.
// Les mêmes graines font « Parce que tu as regardé… » et les pépites.
// Les recommandations de TMDB sont affinées par BetaSeries et Trakt
// (seedRecommendations). Le compte Trakt n'existe pas sur la TV : pas de
// graine « Trakt ».
import {tasteFactorFor, loadTaste, pickKey} from './tasteProfile';
import {loadVotes, genreBias, factorFor, sourceWeights, saveSuggested} from '../vjodVotes';
import {fetchRatings} from '../mdblistApi';
import {genresOfIds} from './tonightModels';
import {seedRecommendations} from './seedRecommendations';

const MAX_SEEDS = 12;
const MAX_PER_SEED = 4;
const LEAD_COUNT = 10;
const CACHE_MS = 30 * 60000;
const CONCURRENCY = 4;
const DAY = 86400000;
const ST = {pending: 2, processing: 3, partial: 4, available: 5, blocklisted: 6};

export const forYouKey = (mediaType, id) => `${mediaType}:${id}`;
const mediaTypeOf = (item, fallback) => (item.mediaType === 'movie' || item.mediaType === 'tv' ? item.mediaType : fallback);
const parseDate = (v) => {
	if (!v) return null;
	const t = Date.parse(v);
	return isNaN(t) ? null : t;
};
const statusOf = (item) => item.mediaInfo && item.mediaInfo.status;

// ------------------------------------------------------------------ abandons

export const abandonedMovie = (ud, now) => {
	if (!ud || ud.IsFavorite || ud.Played) return false;
	const percent = ud.PlayedPercentage || 0;
	if (percent <= 0 || percent >= 50) return false;
	const last = parseDate(ud.LastPlayedDate);
	return last !== null && now - last >= 14 * DAY;
};

export const abandonedSeries = (ud, now, lastEpisode) => {
	if (!ud || ud.IsFavorite) return false;
	const percent = ud.PlayedPercentage || 0;
	if (percent <= 0 || percent > 30) return false;
	if ((ud.UnplayedItemCount || 0) < 3) return false;
	const own = parseDate(ud.LastPlayedDate);
	const last = own === null || (lastEpisode && lastEpisode > own) ? lastEpisode : own;
	if (!last) return true;
	return now - last >= 21 * DAY;
};

export const abandonedPenalties = (lists, floor = 0.35) => {
	const factors = {};
	lists.forEach((list) => {
		const seen = new Set();
		list.forEach(([key, position]) => {
			if (seen.has(key)) return;
			seen.add(key);
			const next = (factors[key] === undefined ? 1 : factors[key]) * (1 - 0.4 / Math.sqrt(position + 1));
			factors[key] = Math.max(next, floor);
		});
	});
	return factors;
};

// ------------------------------------------------------------------ historique

const FIELDS = 'ProviderIds,UserData,Genres';

// loadTasteHistory : les derniers vus (épisodes remplacés par leur série),
// les favoris, et ce qui a été lâché.
export const loadTasteHistory = async (api) => {
	const now = Date.now();
	const get = (params) => api.getItems({Recursive: true, Fields: FIELDS, ...params}).then((r) => (r && r.Items) || []).catch(() => []);
	const played = await get({IncludeItemTypes: 'Movie,Episode', Filters: 'IsPlayed', SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 60});
	const order = [];
	const movies = {};
	const seriesIds = [];
	const lastEpisode = {};
	played.forEach((item) => {
		if (item.Type === 'Movie') {
			if (movies[item.Id]) return;
			movies[item.Id] = item;
			order.push(item.Id);
		} else if (item.Type === 'Episode' && item.SeriesId) {
			const at = parseDate(item.UserData && item.UserData.LastPlayedDate);
			if (at !== null && (!lastEpisode[item.SeriesId] || lastEpisode[item.SeriesId] < at)) lastEpisode[item.SeriesId] = at;
			if (seriesIds.indexOf(item.SeriesId) >= 0) return;
			seriesIds.push(item.SeriesId);
			order.push(item.SeriesId);
		}
	});
	const series = {};
	if (seriesIds.length) {
		(await get({Ids: seriesIds.join(',')})).forEach((s) => {
			series[s.Id] = s;
		});
	}
	const recent = order.map((id) => movies[id] || series[id]).filter(Boolean);
	const [favorites, startedMovies, startedSeries] = await Promise.all([
		get({IncludeItemTypes: 'Movie,Series', Filters: 'IsFavorite', SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 20}),
		get({IncludeItemTypes: 'Movie', Filters: 'IsResumable', SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 40}),
		get({IncludeItemTypes: 'Series', SortBy: 'DatePlayed', SortOrder: 'Descending', Limit: 40, Fields: `${FIELDS},RecursiveItemCount`})
	]);
	const abandoned = startedMovies.filter((m) => abandonedMovie(m.UserData, now))
		.concat(startedSeries.filter((s) => abandonedSeries(s.UserData, now, lastEpisode[s.Id])));
	const dropped = new Set(abandoned.map((i) => i.Id));
	return {recent: recent.filter((i) => !dropped.has(i.Id)), favorites, abandoned};
};

export const signalsFrom = (items) => items.map((item) => {
	const tmdb = parseInt(item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb), 10);
	const mediaType = item.Type === 'Movie' ? 'movie' : item.Type === 'Series' ? 'tv' : null;
	if (!tmdb || tmdb <= 0 || !mediaType) return null;
	const plays = (item.UserData && item.UserData.PlayCount) || 0;
	return {tmdbId: tmdb, mediaType, title: item.Name || '', strength: plays >= 2 ? 1.35 : 1, key: forYouKey(mediaType, tmdb)};
}).filter(Boolean);

export const requestStrength = (status, availableSince, now) => {
	if (status !== ST.available && status !== ST.partial) return 1;
	const since = parseDate(availableSince);
	if (since === null) return 1;
	const days = Math.floor((now - since) / DAY);
	if (days <= 14) return 1;
	if (days >= 60) return 0.2;
	return 1 - 0.8 * (days - 14) / 46;
};

// loadTasteExtras : les choix du questionnaire, la liste et les demandes.
export const loadTasteExtras = async (seerr, profile) => {
	const picked = profile.pivots.map((p) => ({tmdbId: p.id, mediaType: p.type, title: p.title, strength: 3, key: pickKey(p)}))
		.concat(profile.favorites.map((p) => ({tmdbId: p.id, mediaType: p.type, title: p.title, strength: 1, key: pickKey(p)})));
	const watchlist = async () => {
		try {
			const res = await seerr.getWatchlist(1);
			return ((res && res.results) || []).filter((i) => i.mediaType === 'movie' || i.mediaType === 'tv')
				.map((i) => ({tmdbId: i.tmdbId || i.id, mediaType: i.mediaType, title: i.title || i.name || '', strength: 1, key: forYouKey(i.mediaType, i.tmdbId || i.id)}));
		} catch (e) {
			return [];
		}
	};
	const requested = async () => {
		try {
			const me = await seerr.getUser();
			const res = await seerr.getMyRequests(me.id, 30);
			const now = Date.now();
			return ((res && res.results) || []).filter((q) => q.status !== 3 && q.media && q.media.tmdbId).map((q) => {
				const type = q.type === 'tv' ? 'tv' : 'movie';
				return {tmdbId: q.media.tmdbId, mediaType: type, title: q.media.title || q.media.name || '',
					strength: requestStrength(q.media.status, q.media.mediaAddedAt, now), key: forYouKey(type, q.media.tmdbId)};
			});
		} catch (e) {
			return [];
		}
	};
	const [w, r] = await Promise.all([watchlist(), requested()]);
	return {picked, watchlist: w, requested: r};
};

// ------------------------------------------------------------------ classement

const SOURCES = ['watched', 'favorite', 'picked', 'watchlist', 'requested'];

export const buildSeeds = ({recent = [], favorites = [], picked = [], watchlist = [], requested = []}, limit = MAX_SEEDS) => {
	const seeds = {};
	const add = (signal, weight, source) => {
		if (!signal.tmdbId || signal.tmdbId <= 0) return;
		const scaled = weight * signal.strength;
		const cur = seeds[signal.key];
		if (!cur) {
			seeds[signal.key] = {key: signal.key, tmdbId: signal.tmdbId, mediaType: signal.mediaType, title: signal.title, weight: scaled, source};
			return;
		}
		seeds[signal.key] = {
			...cur,
			weight: cur.weight + scaled,
			source: SOURCES.indexOf(source) < SOURCES.indexOf(cur.source) ? source : cur.source,
			title: !cur.title && signal.title ? signal.title : cur.title
		};
	};
	const seen = new Set();
	let position = 0;
	recent.forEach((s) => {
		if (seen.has(s.key)) return;
		seen.add(s.key);
		add(s, Math.pow(0.88, position), 'watched');
		position++;
	});
	favorites.forEach((s) => add(s, 1.4, 'favorite'));
	picked.forEach((s) => add(s, 1.6, 'picked'));
	watchlist.forEach((s) => add(s, 1.1, 'watchlist'));
	requested.forEach((s) => add(s, 0.9, 'requested'));
	return Object.keys(seeds).map((k) => seeds[k]).sort((a, b) => b.weight - a.weight).slice(0, limit);
};

export const qualityFactor = (item) => {
	const votes = item.voteCount || 0;
	const average = item.voteAverage || 0;
	const shrunk = (average * votes + 6.4 * 150) / (votes + 150);
	let factor = 0.55 + 0.45 * Math.max(0, Math.min(1, (shrunk - 5) / 3));
	if (votes < 30) factor *= 0.8;
	return factor;
};

const released = (item, now) => {
	const r = parseDate(item.releaseDate || item.firstAirDate);
	return r !== null && r <= now;
};

export const isRequestable = (item, blockAdult = true, now = Date.now()) => {
	if (blockAdult && item.adult) return false;
	if (!item.posterPath) return false;
	const s = statusOf(item);
	if (s === ST.pending || s === ST.processing || s === ST.partial || s === ST.available || s === ST.blocklisted) return false;
	return released(item, now);
};

const isShowable = (item, blockAdult, now) => {
	if (blockAdult && item.adult) return false;
	if (!item.posterPath) return false;
	if (statusOf(item) === ST.blocklisted) return false;
	return released(item, now);
};

const candidatePool = (seeds, recs, exclude, accept) => {
	const seedKeys = new Set(seeds.map((s) => s.key));
	const pool = {};
	seeds.forEach((seed) => {
		(recs[seed.key] || []).forEach((item, position) => {
			const mediaType = mediaTypeOf(item, seed.mediaType);
			const key = forYouKey(mediaType, item.id);
			if (seedKeys.has(key) || exclude.has(key) || !accept(item)) return;
			const c = pool[key] || (pool[key] = {item, mediaType, key, support: 0, bySeed: {}});
			const contribution = seed.weight / Math.sqrt(position + 1);
			const prev = c.bySeed[seed.key];
			if (prev && prev[1] >= contribution) return;
			c.support += contribution - (prev ? prev[1] : 0);
			c.bySeed[seed.key] = [seed, contribution];
		});
	});
	return Object.keys(pool).map((k) => {
		const c = pool[k];
		const entries = Object.keys(c.bySeed).map((s) => c.bySeed[s]);
		c.seedCount = entries.length;
		c.because = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
		return c;
	});
};

const byScore = (a, b) => (b.score - a.score) || ((b.item.popularity || 0) - (a.item.popularity || 0));

export const rankForYou = ({seeds, recs, exclude = new Set(), blockAdult = true, limit = 30, now = Date.now(), weigh = null}) => {
	const scored = [];
	candidatePool(seeds, recs, exclude, (i) => isRequestable(i, blockAdult, now)).forEach((c) => {
		const taste = weigh ? weigh(c.item, c.mediaType) : 1;
		if (taste <= 0) return;
		scored.push({item: c.item, mediaType: c.mediaType, key: c.key, because: c.because, seedCount: c.seedCount,
			score: c.support * (1 + 0.35 * (c.seedCount - 1)) * qualityFactor(c.item) * taste});
	});
	scored.sort(byScore);
	const picks = [];
	const overflow = [];
	const perSeed = {};
	scored.forEach((p) => {
		if (picks.length >= limit) return;
		const n = perSeed[p.because.key] || 0;
		if (n >= MAX_PER_SEED) {
			overflow.push(p);
			return;
		}
		perSeed[p.because.key] = n + 1;
		picks.push(p);
	});
	overflow.forEach((p) => {
		if (picks.length < limit) picks.push(p);
	});
	return picks;
};

export const becauseRows = ({seeds, recs, exclude = new Set(), blockAdult = true, rows = 2, minItems = 5, perRow = 15, now = Date.now(), weigh = null}) => {
	const seedKeys = new Set(seeds.map((s) => s.key));
	const used = new Set();
	const out = [];
	for (const seed of seeds) {
		if (out.length >= rows) break;
		if (!String(seed.title || '').trim()) continue;
		const list = recs[seed.key];
		if (!list) continue;
		const playable = [];
		const others = [];
		const keys = new Set();
		list.forEach((item) => {
			const mediaType = mediaTypeOf(item, seed.mediaType);
			const key = forYouKey(mediaType, item.id);
			if (seedKeys.has(key) || exclude.has(key) || used.has(key) || keys.has(key)) return;
			keys.add(key);
			if (!isShowable(item, blockAdult, now)) return;
			const taste = weigh ? weigh(item, mediaType) : 1;
			if (taste <= 0) return;
			const s = statusOf(item);
			(s === ST.available || s === ST.partial ? playable : others).push({item, mediaType, key, taste});
		});
		const sort = (l) => l.map((e, i) => [e, i]).sort((a, b) => (b[0].taste - a[0].taste) || (a[1] - b[1])).map((e) => e[0]);
		const items = sort(playable).concat(sort(others)).slice(0, perRow);
		if (items.length < minItems) continue;
		items.forEach((i) => used.add(i.key));
		out.push({seed, items});
	}
	return out;
};

export const gems = ({seeds, recs, exclude = new Set(), blockAdult = true, weigh = null, now = Date.now(), minRating = 7.2, minVotes = 60, maxVotes = 2500, minItems = 5, limit = 15}) => {
	const scored = [];
	candidatePool(seeds, recs, exclude, (item) => {
		if (!isShowable(item, blockAdult, now)) return false;
		const votes = item.voteCount || 0;
		return (item.voteAverage || 0) >= minRating && votes >= minVotes && votes <= maxVotes;
	}).forEach((c) => {
		const taste = weigh ? weigh(c.item, c.mediaType) : 1;
		if (taste <= 0) return;
		scored.push({item: c.item, mediaType: c.mediaType, key: c.key, because: c.because, seedCount: c.seedCount,
			score: c.support * (c.item.voteAverage || 0) * taste});
	});
	scored.sort(byScore);
	return scored.length < minItems ? [] : scored.slice(0, limit);
};

// ------------------------------------------------------------------ service

let snapshot = null;
let inflight = null;
const requestedNow = new Set();

export const markRequested = (mediaType, id) => requestedNow.add(forYouKey(mediaType, id));
// Les titres demandés pendant la session, à garder hors des suggestions.
export const requestedKeys = () => Array.from(requestedNow);
export const clearForYouCache = () => {
	snapshot = null;
};

let recommend = seedRecommendations;
const recommendationsOf = (seerr, seed) => recommend(seerr, seed);

const gather = async (api, seerr, profile) => {
	const [history, extras] = await Promise.all([
		loadTasteHistory(api),
		loadTasteExtras(seerr, profile).catch(() => ({picked: [], watchlist: [], requested: []}))
	]);
	const abandoned = signalsFrom(history.abandoned);
	const dropped = new Set(abandoned.map((s) => s.key));
	const kept = (items) => signalsFrom(items).filter((s) => !dropped.has(s.key));
	const seeds = buildSeeds({recent: kept(history.recent), favorites: kept(history.favorites), ...extras});
	const recs = {};
	for (let i = 0; i < seeds.length; i += CONCURRENCY) {
		await Promise.all(seeds.slice(i, i + CONCURRENCY).map(async (seed) => {
			try {
				recs[seed.key] = await recommendationsOf(seerr, seed);
			} catch (e) {
				// Pas de recommandations pour cette graine.
			}
		}));
	}
	const lists = await Promise.all(abandoned.slice(0, 4).map(async (s) => {
		try {
			const list = await recommendationsOf(seerr, s);
			return list.map((item, position) => [forYouKey(item.mediaType || s.mediaType, item.id), position]);
		} catch (e) {
			return [];
		}
	}));
	return {at: Date.now(), seeds, recs, abandoned: dropped, penalties: abandonedPenalties(lists)};
};

// Les graines et recommandations, gardées une demi-heure.
export const loadForYouSnapshot = async ({api, seerr, forceRefresh = false}) => {
	if (!forceRefresh && snapshot && Date.now() - snapshot.at < CACHE_MS) return snapshot;
	if (inflight) return inflight;
	const {profile} = await loadTaste();
	inflight = gather(api, seerr, profile).then((s) => {
		snapshot = s;
		inflight = null;
		return s;
	}, (e) => {
		inflight = null;
		throw e;
	});
	return inflight;
};

// Le goût et les abandons pèsent sur chaque titre ; ce qui est caché ou
// déjà noté est écarté.
const context = async (snap) => {
	const {profile, feedback} = await loadTaste();
	// Les « J'ai aimé » et « Bof » du générique pèsent un peu sur les genres.
	const exclude = new Set([].concat(Array.from(requestedNow), feedback.hidden, Array.from(snap.abandoned),
		[].concat(profile.favorites, profile.pivots, profile.meh, profile.disliked).map(pickKey)));
	const weigh = (item, mediaType) => tasteFactorFor({
		genres: genresOfIds(item.genreIds, mediaType), mediaType, language: item.originalLanguage,
		year: parseInt(String(item.releaseDate || item.firstAirDate || '').slice(0, 4), 10) || null,
		voteCount: item.voteCount, profile, feedback
	}) * (snap.penalties[forYouKey(mediaType, item.id)] || 1);
	return {exclude, weigh};
};

// Ce que les critiques et le public réunis par MDBList disent d'accord, en
// facteur de 0.8 à 1.2. Une seule source en dit trop peu : 1.
export const ratingsFactor = (ratings) => {
	if (!ratings || !ratings.length) return 1;
	const scales = {letterboxd: 5, rogerebert: 4, imdb: 10, metacriticuser: 10, myanimelist: 10};
	const scores = [];
	ratings.forEach((r) => {
		const source = String(r.source || '').toLowerCase();
		const value = Number(r.value);
		if (!isFinite(value)) return;
		const score = value / (scales[source] || 100);
		if (score > 0 && score <= 1) scores.push(score);
	});
	if (scores.length < 2) return 1;
	const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
	return Math.max(0.8, Math.min(1.2, 0.8 + (mean - 0.6) * 1.6));
};

const sourceOf = (pick) => (pick.because && pick.because.source === 'trakt' ? 'trakt' : 'tmdb');

// « Pour toi » repesé par VJOD (_vjodRerankForYou de l'APK) : la confiance
// gagnée par la source qui l'a amené, ce que les votes disent de ses genres et
// l'accord des notes de MDBList. Les sources montrées sont retenues, pour
// qu'un vote remonte à celle qui l'a proposé.
export const rerankForYou = (picks, {votes, ratings = {}}) => {
	const bias = genreBias(votes);
	const weights = sourceWeights(votes);
	return picks.map((pick, index) => ({pick, index, score: pick.score * (weights[sourceOf(pick)] || 1) *
		factorFor(genresOfIds(pick.item.genreIds, pick.mediaType), bias) * ratingsFactor(ratings[pick.key])}))
		.sort((a, b) => (b.score - a.score) || (a.index - b.index))
		.map((s) => s.pick);
};

const RATINGS_WAIT_MS = 2000;
const mdbRatings = async (picks, serverUrl) => {
	const ratings = {};
	const asks = picks.slice(0, 10).map((p) => fetchRatings(serverUrl, {Type: p.mediaType === 'tv' ? 'Series' : 'Movie', ProviderIds: {Tmdb: String(p.item.id)}})
		.then((r) => {
			ratings[p.key] = r;
		}, () => null));
	// MDBList est un plus : ce qui est arrivé à temps compte, le reste vaut 1.
	await Promise.race([Promise.all(asks), new Promise((resolve) => setTimeout(resolve, RATINGS_WAIT_MS))]);
	return ratings;
};

export const loadForYou = async ({api, seerr, serverUrl, blockAdult = true, forceRefresh = false}) => {
	const snap = await loadForYouSnapshot({api, seerr, forceRefresh});
	if (!snap.seeds.length) return [];
	const {exclude, weigh} = await context(snap);
	const picks = rankForYou({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh});
	if (!picks.length) return picks;
	const [votes, ratings] = await Promise.all([
		loadVotes().catch(() => ({votes: [], suggested: {}})),
		serverUrl ? mdbRatings(picks, serverUrl).catch(() => ({})) : {}
	]);
	const ranked = rerankForYou(picks, {votes, ratings});
	const shown = {};
	picks.forEach((p) => {
		shown[p.key] = sourceOf(p);
	});
	saveSuggested(shown).catch(() => {});
	return ranked;
};

export const loadBecause = async ({api, seerr, blockAdult = true}) => {
	const snap = await loadForYouSnapshot({api, seerr});
	if (!snap.seeds.length) return [];
	const {exclude, weigh} = await context(snap);
	const lead = rankForYou({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh, limit: LEAD_COUNT});
	lead.forEach((p) => exclude.add(p.key));
	return becauseRows({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh});
};

export const loadGems = async ({api, seerr, blockAdult = true}) => {
	const snap = await loadForYouSnapshot({api, seerr});
	if (!snap.seeds.length) return [];
	const {exclude, weigh} = await context(snap);
	rankForYou({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh, limit: LEAD_COUNT}).forEach((p) => exclude.add(p.key));
	becauseRows({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh}).forEach((r) => r.items.forEach((i) => exclude.add(i.key)));
	return gems({seeds: snap.seeds, recs: snap.recs, exclude, blockAdult, weigh});
};

export const resetForYouForTests = ({recommendations = seedRecommendations} = {}) => {
	recommend = recommendations;
	snapshot = null;
	inflight = null;
	requestedNow.clear();
};
