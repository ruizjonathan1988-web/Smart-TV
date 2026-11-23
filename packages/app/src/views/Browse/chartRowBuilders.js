// Les autres rangées VJOD de l'accueil (home_view_model.dart, home_highlights.dart,
// french_box_office.dart, saga_service.dart et upcoming_picks.dart de l'APK) :
// Top 10, cinéma et séries français, sagas en cours, bientôt pour toi,
// surprise et soirée en famille. Sans Trakt, BetaSeries ni palmarès : les
// classements de TMDB et des plateformes, que Seerr relaie.
import seerrApi from '../../services/seerrApi';
import {normalizeMediaItem} from '../../utils/seerrHomeRows';
import {loadTaste, tasteFactorFor} from '../../services/tonight/tasteProfile';
import {genresOfIds} from '../../services/tonight/tonightModels';
import {loadForYouSnapshot, loadTasteHistory, forYouKey} from '../../services/tonight/forYou';

const DAY = 86400000;
const CHART_MS = 3 * 3600000;
const charts = {};

// ------------------------------------------------------------------ outils

export const chartPicks = (chart, limit = 10) => {
	const seen = new Set();
	const out = [];
	for (const item of chart || []) {
		if (!item.posterPath || seen.has(item.id)) continue;
		seen.add(item.id);
		out.push(item);
		if (out.length >= limit) break;
	}
	return out;
};

export const isWellRated = (item) => (item.voteCount || 0) < 100 || (item.voteAverage || 0) >= 5.5;

// Un classement fait de plusieurs : des points par rang, chaque titre une fois.
export const fuseCharts = (lists, depth = 10) => {
	const points = {};
	const count = {};
	const best = {};
	const first = new Map();
	lists.forEach((chart) => {
		const seen = new Set();
		for (const item of chart) {
			if (seen.size >= depth) break;
			if (seen.has(item.id)) continue;
			seen.add(item.id);
			const rank = seen.size - 1;
			points[item.id] = (points[item.id] || 0) + depth - rank;
			count[item.id] = (count[item.id] || 0) + 1;
			if (rank < (best[item.id] === undefined ? depth : best[item.id])) best[item.id] = rank;
			if (!first.has(item.id)) first.set(item.id, item);
		}
	});
	const order = new Map(Array.from(first.keys()).map((id, i) => [id, i]));
	return Array.from(first.keys()).sort((a, b) => (points[b] - points[a]) || (count[b] - count[a]) || (best[a] - best[b]) || (order.get(a) - order.get(b))).map((id) => first.get(id));
};

export const takeTurns = (lists, keyOf = (i) => i.id) => {
	const out = [];
	const seen = new Set();
	const longest = lists.reduce((m, l) => Math.max(m, l.length), 0);
	for (let i = 0; i < longest; i++) {
		lists.forEach((list) => {
			if (i >= list.length) return;
			const k = keyOf(list[i]);
			if (seen.has(k)) return;
			seen.add(k);
			out.push(list[i]);
		});
	}
	return out;
};

const tmdbDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Sorti en vidéo : une sortie numérique/physique/TV, ou le cinéma il y a 120 jours.
export const isOutAtHome = (details, now = Date.now()) => {
	const countries = details && details.releases && details.releases.results;
	if (!Array.isArray(countries) || !countries.length) return true;
	for (const country of countries) {
		for (const r of country.release_dates || []) {
			const at = Date.parse(r.release_date);
			if (isNaN(at) || at > now) continue;
			if (r.type >= 4) return true;
			if ((r.type === 2 || r.type === 3) && now - at >= 120 * DAY) return true;
		}
	}
	return false;
};

const page = (promise) => promise.then((r) => (r && r.results) || []).catch(() => []);

const outAtHome = async (chart, depth = 16) => {
	const head = chart.slice(0, depth);
	const keep = [];
	for (let i = 0; i < head.length; i += 4) {
		keep.push(...await Promise.all(head.slice(i, i + 4).map((film) => {
			const s = film.mediaInfo && film.mediaInfo.status;
			if (s === 5 || s === 4) return true;
			return seerrApi.getMovie(film.id).then((d) => isOutAtHome(d), () => true);
		})));
	}
	return head.filter((f, i) => keep[i] !== false);
};

const cards = async (ids, known, mediaType, depth = 10) => {
	const out = [];
	for (const id of ids.slice(0, depth)) {
		if (known[id]) out.push(known[id]);
		else {
			try {
				const d = await (mediaType === 'tv' ? seerrApi.getTv(id) : seerrApi.getMovie(id));
				if (d) out.push({...d, mediaType});
			} catch (e) {
				// Titre introuvable : on passe.
			}
		}
	}
	return out;
};

const cached = async (key, build) => {
	const hit = charts[key];
	if (hit && Date.now() - hit.at < CHART_MS) return hit.chart;
	const chart = await build();
	if (chart.length) charts[key] = {at: Date.now(), chart};
	return chart;
};

const toCards = (list, mediaType, blockAdult, limit, reason) => list
	.filter((i) => !(blockAdult && i.adult) && i.posterPath)
	.slice(0, limit)
	.map((i) => ({...normalizeMediaItem({...i, mediaType}), _vjodReason: reason ? reason(i) : null}));

const row = (id, title, items, extra = {}) => ({id, title, items, type: 'portrait', isSeerrRow: true, ...extra});

// ------------------------------------------------------------------ Top 10

const STREAMING = [8, 119, 337, 350, 381, 1899, 531];

const top10 = (mediaType) => async (ctx) => {
	const chart = await cached(`top10|${mediaType}`, async () => {
		const lists = await Promise.all([
			page(seerrApi.discoverRaw(mediaType, {sortBy: 'popularity.desc'})),
			page(seerrApi.trending(1)).then((l) => l.filter((i) => i.mediaType === mediaType)),
			...STREAMING.map((provider) => page(seerrApi.discoverRaw(mediaType, {watchRegion: 'FR', watchProviders: provider})))
		]);
		let fused = fuseCharts(lists.map((l) => chartPicks(l, 20))).filter(isWellRated);
		if (mediaType === 'movie') fused = await outAtHome(fused);
		return fused;
	});
	const items = toCards(chart, mediaType, ctx.blockAdult, 10);
	if (items.length < 3) return [];
	return [row(mediaType === 'tv' ? 'top10_series' : 'top10_movies', mediaType === 'tv' ? 'Top 10 séries' : 'Top 10 films',
		items.map((it, i) => ({...it, _vjodRank: i + 1})))];
};

// ------------------------------------------------------------------ français

const HITS_2020 = [1152014, 1084736, 1145899, 959604, 643215, 967585, 796185, 1137759, 577242, 714869, 740937, 823951, 637534, 1259983, 1404684];
const HITS_2010 = [77338, 262391, 52077, 304410, 505436, 424619, 456165, 48034, 102207, 248507];
const HITS_ALL = [8265, 77338, 8290, 2899, 11687, 11972, 262391, 25866, 1152014, 2332];
const HITS_BY_DECADE = {2020: HITS_2020, 2010: HITS_2010};

const worthShowing = (list) => chartPicks(list, 20).filter(isWellRated);
const acclaimed = (mediaType, from, minVotes) => page(seerrApi.discoverFiltered(mediaType, {language: 'fr', sortBy: 'vote_average.desc', voteCountGte: minVotes, releaseDateGte: from ? tmdbDay(from) : undefined}));
const byId = (lists) => {
	const out = {};
	lists.forEach((l) => l.forEach((i) => {
		out[i.id] = i;
	}));
	return out;
};

const frenchMovies = async () => {
	const now = new Date();
	const decade = Math.floor(now.getFullYear() / 10) * 10;
	const [boxOffice, recent, best] = await Promise.all([
		page(seerrApi.discoverFiltered('movie', {language: 'fr', sortBy: 'revenue.desc', releaseDateGte: tmdbDay(new Date(decade, 0, 1)), releaseDateLte: tmdbDay(now)})),
		page(seerrApi.discoverFiltered('movie', {language: 'fr', releaseDateGte: tmdbDay(new Date(now.getFullYear(), now.getMonth() - 18, now.getDate())), releaseDateLte: tmdbDay(now)})),
		acclaimed('movie', new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()), 300)
	]);
	const recorded = await cards(HITS_BY_DECADE[decade] || [], byId([boxOffice, recent, best]), 'movie');
	const hits = takeTurns([recorded, chartPicks(boxOffice, 10)]);
	return outAtHome(takeTurns([takeTurns([hits, worthShowing(recent)]), chartPicks(best, 20)]), 20);
};

const frenchSeries = async () => {
	const now = new Date();
	const [popular, best] = await Promise.all([
		page(seerrApi.discoverFiltered('tv', {language: 'fr', releaseDateGte: tmdbDay(new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()))})),
		acclaimed('tv', new Date(now.getFullYear() - 10, now.getMonth(), now.getDate()), 100)
	]);
	return takeTurns([worthShowing(popular), chartPicks(best, 20)]);
};

const frenchClassics = async () => {
	const decade = Math.floor(new Date().getFullYear() / 10) * 10;
	const past = Object.keys(HITS_BY_DECADE).map(Number).filter((d) => d < decade).sort((a, b) => b - a);
	const best = await acclaimed('movie', null, 1000);
	const hits = await cards(takeTurns([HITS_ALL].concat(past.map((d) => HITS_BY_DECADE[d])), (i) => i), byId([best]), 'movie', 20);
	return takeTurns([hits, chartPicks(best, 20)]);
};

const french = (id) => async (ctx) => {
	const [title, mediaType, build] = {
		french_movies: ['Cinéma français', 'movie', frenchMovies],
		french_series: ['Séries françaises', 'tv', frenchSeries],
		french_classics: ['Classiques du cinéma français', 'movie', frenchClassics]
	}[id];
	const picks = await cached(id, build);
	const items = toCards(picks, mediaType, ctx.blockAdult, 20);
	return items.length >= 5 ? [row(id, title, items)] : [];
};

// ------------------------------------------------------------------ sagas

let sagas = null;

const releaseOf = (i) => {
	const t = Date.parse(i.releaseDate || '');
	return isNaN(t) ? null : t;
};

export const nextInSagas = ({watched, collectionOfFilm, collections, exclude = new Set(), blockAdult = true, now = Date.now(), limit = 15}) => {
	const watchedIds = new Set(watched.map((f) => f.tmdbId));
	const done = new Set();
	const picks = [];
	for (const film of watched) {
		if (picks.length >= limit) break;
		const cid = collectionOfFilm[film.tmdbId];
		if (!cid || done.has(cid)) continue;
		done.add(cid);
		const col = collections[cid];
		if (!col || !col.parts || col.parts.length < 2) continue;
		const parts = col.parts.slice().sort((a, b) => {
			const x = releaseOf(a);
			const y = releaseOf(b);
			if (x === null && y === null) return 0;
			if (x === null) return 1;
			if (y === null) return -1;
			return x - y;
		});
		let last = -1;
		parts.forEach((p, i) => {
			if (watchedIds.has(p.id)) last = i;
		});
		if (last < 0) continue;
		for (let i = last + 1; i < parts.length; i++) {
			const p = parts[i];
			if (watchedIds.has(p.id) || exclude.has(`movie:${p.id}`)) continue;
			if ((blockAdult && p.adult) || !p.posterPath || (p.mediaInfo && p.mediaInfo.status === 6)) continue;
			const r = releaseOf(p);
			if (r === null || r > now) continue;
			picks.push({item: p, afterTitle: parts[last].title || parts[last].name || '', collectionName: col.name || ''});
			break;
		}
	}
	return picks;
};

const sagaRow = async (ctx) => {
	if (!sagas || Date.now() - sagas.at > 2 * 3600000) {
		const history = await loadTasteHistory(ctx.api);
		const watched = history.recent.filter((i) => i.Type === 'Movie').map((i) => ({tmdbId: parseInt(i.ProviderIds && (i.ProviderIds.Tmdb || i.ProviderIds.tmdb), 10), title: i.Name})).filter((f) => f.tmdbId > 0);
		const collectionOfFilm = {};
		const look = watched.slice(0, 15);
		for (let i = 0; i < look.length; i += 4) {
			await Promise.all(look.slice(i, i + 4).map(async (f) => {
				try {
					const d = await seerrApi.getMovie(f.tmdbId);
					if (d && d.collection && d.collection.id) collectionOfFilm[f.tmdbId] = d.collection.id;
				} catch (e) {
					// Pas de fiche.
				}
			}));
		}
		const collections = {};
		await Promise.all(Array.from(new Set(Object.keys(collectionOfFilm).map((k) => collectionOfFilm[k]))).map(async (id) => {
			try {
				collections[id] = await seerrApi.getCollection(id);
			} catch (e) {
				// Collection introuvable.
			}
		}));
		sagas = {at: Date.now(), watched, collectionOfFilm, collections};
	}
	const {feedback} = await loadTaste();
	const picks = nextInSagas({...sagas, exclude: new Set(feedback.hidden), blockAdult: ctx.blockAdult});
	const items = picks.map((p) => ({...normalizeMediaItem({...p.item, mediaType: 'movie'}), _vjodReason: `Après ${p.afterTitle}`, _vjodPill: 'Suite'}));
	return items.length ? [row('seerr_sagas', 'La suite de vos sagas', items)] : [];
};

// ------------------------------------------------------------------ bientôt pour toi

export const isComing = (item, now = Date.now(), blockAdult = true) => {
	if (blockAdult && item.adult) return false;
	if (!item.posterPath) return false;
	const s = item.mediaInfo && item.mediaInfo.status;
	if (s === 5 || s === 4 || s === 6) return false;
	const d = Date.parse(item.releaseDate || item.firstAirDate || '');
	return !isNaN(d) && d > now && d <= now + 365 * DAY;
};

const upcomingRow = async (ctx) => {
	const [snap, {profile, feedback}, movies, series] = await Promise.all([
		loadForYouSnapshot(ctx),
		loadTaste(),
		Promise.all([1, 2].map((p) => page(seerrApi.upcomingMovies(p)))).then((l) => [].concat(...l).map((i) => [i, 'movie'])),
		Promise.all([1, 2].map((p) => page(seerrApi.upcomingTv(p)))).then((l) => [].concat(...l).map((i) => [i, 'tv']))
	]);
	const now = Date.now();
	const seedKeys = new Set(snap.seeds.map((s) => s.key));
	const exclude = new Set(feedback.hidden.concat(Array.from(snap.abandoned)));
	const cands = {};
	const fits = (item, key) => !seedKeys.has(key) && !exclude.has(key) && isComing(item, now, ctx.blockAdult);
	snap.seeds.forEach((seed) => (snap.recs[seed.key] || []).forEach((item, position) => {
		const mediaType = item.mediaType === 'tv' || item.mediaType === 'movie' ? item.mediaType : seed.mediaType;
		const key = forYouKey(mediaType, item.id);
		if (!fits(item, key)) return;
		const c = cands[key] || (cands[key] = {item, mediaType, bySeed: {}, listed: 0});
		const contribution = seed.weight / Math.sqrt(position + 1);
		if (!c.bySeed[seed.key] || c.bySeed[seed.key][1] < contribution) c.bySeed[seed.key] = [seed, contribution];
	}));
	takeTurns([movies, series], (e) => `${e[1]}:${e[0].id}`).forEach(([item, mediaType]) => {
		const key = forYouKey(mediaType, item.id);
		if (!fits(item, key)) return;
		const c = cands[key] || (cands[key] = {item, mediaType, bySeed: {}, listed: 0});
		c.listed = Math.max(c.listed, 0.2 * (0.25 + 0.75 * Math.min(1, Math.max(0, (item.popularity || 0) / 100))));
	});
	const scored = Object.keys(cands).map((k) => {
		const c = cands[k];
		const vouches = Object.keys(c.bySeed).map((s) => c.bySeed[s]);
		const support = vouches.reduce((s, v) => s + v[1], 0);
		const year = parseInt(String(c.item.releaseDate || c.item.firstAirDate || '').slice(0, 4), 10) || null;
		const taste = tasteFactorFor({genres: genresOfIds(c.item.genreIds, c.mediaType), mediaType: c.mediaType, language: c.item.originalLanguage, year, voteCount: c.item.voteCount, profile, feedback});
		const strongest = vouches.length ? vouches.reduce((a, b) => (b[1] > a[1] ? b : a))[0] : null;
		return {c, taste, strongest, score: (support * (1 + 0.35 * Math.max(0, vouches.length - 1)) + c.listed) * taste};
	}).filter((s) => s.taste > 0).sort((a, b) => b.score - a.score).slice(0, 20);
	const items = scored.map((s) => ({...normalizeMediaItem({...s.c.item, mediaType: s.c.mediaType}), _vjodReason: s.strongest && s.strongest.title ? s.strongest.title : null}));
	return items.length >= 5 ? [row('seerr_upcoming', 'Bientôt pour toi', items)] : [];
};

// ------------------------------------------------------------------ bibliothèque

const draw = (api, params) => api.getItems({Recursive: true, Filters: 'IsUnplayed', SortBy: 'Random', Fields: 'ProviderIds,Genres', ...params})
	.then((r) => (r && r.Items) || []).catch(() => []);

// Surprise : un film et une série tirés au sort, bien notés si possible.
const surprise = async (ctx) => {
	const pick = (list) => list.find((i) => (i.CommunityRating || 0) >= 6.5) || list[0] || null;
	const [movie, series] = await Promise.all([draw(ctx.api, {IncludeItemTypes: 'Movie', Limit: 25}), draw(ctx.api, {IncludeItemTypes: 'Series', Limit: 25})]);
	// Une carte Surprise se lance tout de suite, sans passer par la fiche.
	const items = [pick(movie), pick(series)].filter(Boolean).map((i) => ({...i, _vjodPill: 'Lecture', _vjodAutoPlay: true}));
	return items.length ? [{id: 'surprise', title: 'Surprise', type: 'portrait', items}] : [];
};
surprise.library = true;

// Soirée en famille : des films familiaux jamais vus, les mieux notés d'abord.
const familyNight = async (ctx) => {
	const list = await draw(ctx.api, {IncludeItemTypes: 'Movie', Genres: 'Family|Familial|Famille|Animation|Kids|Children|Jeunesse', Limit: 40});
	const seen = new Set();
	const rated = [];
	const rest = [];
	list.forEach((i) => {
		if (seen.has(i.Id) || !(i.ImageTags && i.ImageTags.Primary)) return;
		seen.add(i.Id);
		((i.CommunityRating || 0) >= 6 ? rated : rest).push(i);
	});
	rated.sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0));
	const items = rated.concat(rest).slice(0, 15);
	return items.length >= 4 ? [{id: 'family_night', title: 'Soirée en famille', type: 'portrait', items}] : [];
};
familyNight.library = true;

export const CHART_ROW_BUILDERS = {
	top10_movies: top10('movie'),
	top10_series: top10('tv'),
	french_movies: french('french_movies'),
	french_series: french('french_series'),
	french_classics: french('french_classics'),
	seerr_sagas: sagaRow,
	seerr_upcoming: upcomingRow,
	surprise,
	family_night: familyNight
};
