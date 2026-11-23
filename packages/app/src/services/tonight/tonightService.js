// Service « Ce soir » (tonight_service.dart de l'APK) : garde le journal des
// soirées, rassemble ce qui pourrait être regardé (bibliothèque Jellyfin,
// découvertes Seerr), demande au moteur et retient ce que la personne fait de
// ses suggestions. Tout reste sur cette TV.
import {getFromStorage, saveToStorage} from '../storage';
import {getImageUrl} from '../../utils/helpers';
import {genresFromNames, genresOfIds, ratingAge, slotOf, budgetMinutes, decodeAnswers, encodeAnswers} from './tonightModels';
import {backfillEntries, decodeJournal, recordEntry, watchedTmdbKeys} from './eveningJournal';
import {buildHabits, suggestCompany} from './habitModel';
import {rankTonight, learnWeights} from './tonightEngine';
import {loadTaste, pickKey} from './tasteProfile';

const KEY = 'vjodTonight';
const ANSWERS_LIFETIME_MS = 5 * 3600000;
const LIBRARY_LIFETIME_MS = 15 * 60000;
const DISCOVER_LIFETIME_MS = 30 * 60000;
const REJECTION_MEMORY_MS = 7 * 86400000;
const DEVICE = 'tv';
const FIELDS = 'Overview,Genres,ProviderIds,ChildCount,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,DateCreated,UserData,PrimaryImageAspectRatio';

let state = {journal: [], answers: null, backfilled: false, rejections: {}, weights: {}};
let loaded = null;
const caches = {library: {}, discover: {}};
const listeners = new Set();

const save = () => saveToStorage(KEY, state).catch(() => {});

export const loadTonight = () => {
	if (!loaded) {
		loaded = getFromStorage(KEY)
			.then((s) => {
				if (s && typeof s === 'object') {
					state = {
						journal: decodeJournal(s.journal),
						answers: s.answers || null,
						backfilled: s.backfilled === true,
						rejections: s.rejections && typeof s.rejections === 'object' ? s.rejections : {},
						weights: s.weights && typeof s.weights === 'object' ? s.weights : {},
						lastLaunch: s.lastLaunch && typeof s.lastLaunch === 'object' ? s.lastLaunch : null
					};
				}
				return state;
			})
			.catch(() => state);
	}
	return loaded;
};

// Le journal des soirées (pour le point du mois).
export const getJournal = async () => (await loadTonight()).journal;

// Prévenu quand les réponses du soir changent (la bannière se recharge).
export const onTonightChange = (fn) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

// ------------------------------------------------------------------ réponses

// À présélectionner : les réponses de ce soir si données récemment, sinon la
// compagnie habituelle de ce créneau et la dernière envie.
export const suggestAnswers = (now = Date.now()) => {
	const last = decodeAnswers(state.answers);
	if (last && now - last.at < ANSWERS_LIFETIME_MS) return {...last, at: now};
	const slot = slotOf(now);
	const habits = buildHabits(state.journal, now);
	const lateWeekday = slot.day === 'weekday' && slot.band === 'late';
	return {
		company: suggestCompany(habits, slot, DEVICE) || (last && last.company) || 'alone',
		time: lateWeekday ? 'short' : (last && last.time) || 'evening',
		mood: (last && last.mood) || 'surprise',
		kidsAge: (last && last.kidsAge) || 'from7to12',
		at: now
	};
};

export const saveAnswers = (answers) => {
	state = {...state, answers: encodeAnswers(answers)};
	save();
	listeners.forEach((fn) => fn());
};

// ------------------------------------------------------------------ journal

// Rattrapage unique depuis l'historique de lecture du serveur.
const ensureBackfilled = async (api) => {
	if (state.backfilled) return;
	try {
		const res = await api.getItems({
			IncludeItemTypes: 'Movie,Episode', Filters: 'IsPlayed', SortBy: 'DatePlayed', SortOrder: 'Descending',
			Recursive: true, Limit: 60, Fields: FIELDS + ',SeriesId'
		});
		const items = (res && res.Items) || [];
		const seriesIds = [];
		items.forEach((i) => {
			if (i.Type === 'Episode' && i.SeriesId && seriesIds.indexOf(i.SeriesId) < 0) seriesIds.push(i.SeriesId);
		});
		const series = {};
		if (seriesIds.length) {
			const s = await api.getItems({Ids: seriesIds.join(','), Fields: FIELDS});
			((s && s.Items) || []).forEach((x) => {
				series[x.Id] = x;
			});
		}
		const past = [];
		items.forEach((i) => {
			const played = i.UserData && i.UserData.LastPlayedDate ? Date.parse(i.UserData.LastPlayedDate) : NaN;
			if (isNaN(played)) return;
			const item = i.Type === 'Episode' ? series[i.SeriesId] : i;
			if (!item) return;
			const tmdb = item.ProviderIds && parseInt(item.ProviderIds.Tmdb, 10);
			past.push({
				at: played, itemId: item.Id, mediaType: item.Type === 'Series' ? 'tv' : 'movie', title: item.Name || '',
				tmdbId: tmdb || null, genres: genresFromNames(item.Genres), runtimeMinutes: i.RunTimeTicks ? Math.round(i.RunTimeTicks / 600000000) : null,
				year: item.ProductionYear || null, rating: item.CommunityRating || null, finished: true, backfilled: true
			});
		});
		state = {...state, journal: backfillEntries(state.journal, past), backfilled: true};
		save();
	} catch (e) {
		// On réessaiera à la prochaine ouverture.
	}
};

// Une séance regardée (appelée par le lecteur en fin de lecture).
export const recordSitting = (entry) => {
	state = {...state, journal: recordEntry(state.journal, {device: DEVICE, ...entry})};
	save();
};

const LAUNCH_WINDOW_MS = 8 * 3600000;

// Fin d'une lecture Jellyfin : la séance entre au journal (onPlaybackStopped
// de l'APK), avec la compagnie du soir si les questions ont été répondues.
export const recordPlaybackStop = async (api, {itemId, startTicks = 0, startedAt, stopTicks}) => {
	if (!api || !itemId || !startedAt) return;
	try {
		await loadTonight();
		const item = await api.getItem(itemId);
		if (!item || (item.Type !== 'Movie' && item.Type !== 'Episode')) return;
		const isEpisode = item.Type === 'Episode';
		const owner = isEpisode && item.SeriesId ? await api.getItem(item.SeriesId).catch(() => null) : item;
		if (!owner) return;
		const watchedMinutes = Math.max(0, Math.round(((stopTicks || 0) - (startTicks || 0)) / 600000000));
		const finished = (item.UserData && item.UserData.Played) || (item.RunTimeTicks > 0 && stopTicks >= item.RunTimeTicks * 0.9);
		const answers = decodeAnswers(state.answers);
		const recent = answers && startedAt - answers.at < ANSWERS_LIFETIME_MS;
		const launch = state.lastLaunch;
		const tmdb = owner.ProviderIds && parseInt(owner.ProviderIds.Tmdb, 10);
		recordSitting({
			at: startedAt,
			itemId: owner.Id,
			mediaType: isEpisode ? 'tv' : 'movie',
			title: owner.Name || '',
			tmdbId: tmdb || null,
			genres: genresFromNames(owner.Genres),
			runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : null,
			year: owner.ProductionYear || null,
			rating: owner.CommunityRating || null,
			watchedMinutes,
			finished: !!finished,
			company: recent ? answers.company : null,
			fromTonight: !!(launch && launch.itemId === owner.Id && startedAt - launch.at < LAUNCH_WINDOW_MS)
		});
	} catch (e) {
		// Le journal est un plus : une lecture qui ne s'y inscrit pas ne gêne rien.
	}
};

// « Autre idée » : moins de chances de revoir ce titre cette semaine.
export const rejected = (pick) => {
	const now = Date.now();
	const list = (state.rejections[pick.candidate.key] || []).filter((t) => now - t < REJECTION_MEMORY_MS);
	state = {...state, rejections: {...state.rejections, [pick.candidate.key]: list.concat([now])}};
	save();
};

// Lancé depuis Ce soir : les poids suivent ce qui a été préféré aux autres.
export const launched = (pick, over = []) => {
	state = {...state, lastLaunch: {itemId: pick.candidate.libraryItemId, at: Date.now()}};
	let weights = learnWeights(state.weights, pick.features, {reward: 1});
	over.slice(0, 2).forEach((o) => {
		weights = learnWeights(weights, pick.features, {over: o.features, reward: 0.5});
	});
	state = {...state, weights};
	save();
};

const recentRejections = (now) => {
	const out = {};
	Object.keys(state.rejections).forEach((k) => {
		const n = state.rejections[k].filter((t) => now - t < REJECTION_MEMORY_MS).length;
		if (n) out[k] = n;
	});
	return out;
};

// ------------------------------------------------------------------ candidats

const fromLibrary = (item, serverUrl, {episode = null, rewatch = false} = {}) => {
	const type = item.Type === 'Series' ? 'tv' : 'movie';
	const tmdb = item.ProviderIds && parseInt(item.ProviderIds.Tmdb, 10);
	const created = item.DateCreated ? Date.parse(item.DateCreated) : NaN;
	const ticks = (episode && episode.RunTimeTicks) || item.RunTimeTicks;
	return {
		key: tmdb ? `${type}:${tmdb}` : `lib:${item.Id}`,
		mediaType: type,
		tmdbId: tmdb || null,
		title: item.Name || '',
		genres: genresFromNames(item.Genres),
		runtimeMinutes: ticks ? Math.round(ticks / 600000000) : null,
		year: item.ProductionYear || null,
		rating: item.CommunityRating || null,
		voteCount: null,
		ratingAge: ratingAge(item.OfficialRating),
		availability: 'inLibrary',
		inProgress: !!episode,
		rewatch,
		freshlyAdded: !isNaN(created) && Date.now() - created < 14 * 86400000,
		libraryItemId: item.Id,
		playItemId: episode ? episode.Id : item.Id,
		posterUrl: getImageUrl(serverUrl, item.Id, 'Primary', {maxHeight: 600}),
		overview: item.Overview || '',
		nextEpisodeLabel: episode ? [episode.ParentIndexNumber ? `S${episode.ParentIndexNumber}` : '', episode.IndexNumber ? `E${episode.IndexNumber}` : ''].filter(Boolean).join(' · ') : null,
		seasonCount: type === 'tv' ? item.ChildCount || null : null
	};
};

const libraryCandidates = async (api, serverUrl) => {
	const cached = caches.library[serverUrl];
	if (cached && Date.now() - cached.at < LIBRARY_LIFETIME_MS) return cached.items;
	const draw = (params) => api.getItems({Recursive: true, Fields: FIELDS, ...params}).then((r) => (r && r.Items) || []).catch(() => []);
	const nextUp = async () => {
		try {
			const r = await api.getNextUp(25);
			const eps = ((r && r.Items) || []).filter((e) => e.Type === 'Episode' && e.SeriesId);
			if (!eps.length) return [];
			const ids = eps.map((e) => e.SeriesId).filter((id, i, a) => a.indexOf(id) === i);
			const s = await api.getItems({Ids: ids.join(','), Fields: FIELDS});
			const byId = {};
			((s && s.Items) || []).forEach((x) => {
				byId[x.Id] = x;
			});
			return eps.filter((e) => byId[e.SeriesId]).map((e) => ({episode: e, series: byId[e.SeriesId]}));
		} catch (e) {
			return [];
		}
	};
	const [random, best, series, next, favorites] = await Promise.all([
		draw({IncludeItemTypes: 'Movie', SortBy: 'Random', Filters: 'IsUnplayed', Limit: 150}),
		draw({IncludeItemTypes: 'Movie', SortBy: 'CommunityRating', SortOrder: 'Descending', Filters: 'IsUnplayed', Limit: 60}),
		draw({IncludeItemTypes: 'Series', SortBy: 'Random', Filters: 'IsUnplayed', Limit: 80}),
		nextUp(),
		draw({IncludeItemTypes: 'Movie,Series', SortBy: 'DatePlayed', SortOrder: 'Descending', Filters: 'IsFavorite', Limit: 40})
	]);
	const movies = {};
	random.concat(best).forEach((m) => {
		if (!movies[m.Id]) movies[m.Id] = m;
	});
	const items = []
		.concat(next.map((n) => fromLibrary(n.series, serverUrl, {episode: n.episode})))
		.concat(Object.keys(movies).map((id) => fromLibrary(movies[id], serverUrl)))
		.concat(series.map((s) => fromLibrary(s, serverUrl)))
		.concat(favorites.filter((f) => f.UserData && f.UserData.Played).map((f) => fromLibrary(f, serverUrl, {rewatch: true})));
	caches.library[serverUrl] = {at: Date.now(), items};
	return items;
};

// Statuts Seerr : 5 disponible, 4 en partie, 2 en attente, 3 en cours.
const fromSeerr = (item, type, tmdbImage) => {
	const genres = genresOfIds(item.genreIds, type);
	const status = item.mediaInfo && item.mediaInfo.status;
	const availability = status === 5 || status === 4 ? 'inLibrary' : status === 2 || status === 3 ? 'requested' : 'requestable';
	const date = type === 'tv' ? item.firstAirDate : item.releaseDate;
	return {
		key: `${type}:${item.id}`,
		mediaType: type,
		tmdbId: item.id,
		title: item.title || item.name || '',
		genres,
		// Les listes Seerr ne donnent pas la durée : un épisode est estimé d'après le genre.
		runtimeMinutes: type === 'tv' ? (genres.indexOf('comedy') >= 0 || genres.indexOf('animation') >= 0 ? 25 : 45) : null,
		year: date && date.length >= 4 ? parseInt(date.slice(0, 4), 10) : null,
		rating: item.voteAverage || null,
		voteCount: item.voteCount || null,
		language: item.originalLanguage || null,
		adult: item.adult === true,
		availability,
		libraryItemId: (item.mediaInfo && item.mediaInfo.jellyfinMediaId) || null,
		posterUrl: item.posterPath ? tmdbImage(item.posterPath, 'w500') : null,
		backdropUrl: item.backdropPath ? tmdbImage(item.backdropPath, 'w1280') : null,
		overview: item.overview || '',
		seerr: {...item, mediaType: type}
	};
};

// Les genres TMDB que chaque envie demande à Seerr (films, séries).
const MOOD_QUERIES = {
	laugh: ['35|16|10751', '35|16|10751'],
	chills: ['27|53|9648', '9648|80'],
	escape: ['14|878|12', '10765|10759'],
	think: ['99|18|36', '99|18'],
	comfort: ['35|10751|10749|16', '35|10751'],
	surprise: [null, null]
};

const discoverCandidates = async (seerr, answers) => {
	const family = answers.company === 'family';
	const budget = budgetMinutes(answers.time);
	const cacheKey = `${answers.mood}|${budget}|${family}`;
	const cached = caches.discover[cacheKey];
	if (cached && Date.now() - cached.at < DISCOVER_LIFETIME_MS) return cached.items;
	let [movieGenres, tvGenres] = MOOD_QUERIES[answers.mood];
	if (family) {
		movieGenres = '10751|16';
		tvGenres = '10751|16|10762';
	}
	const surprise = answers.mood === 'surprise';
	const page = surprise ? 1 + Math.floor(Math.random() * 5) : 1;
	const ask = (type, params) => seerr.discoverFiltered(type, params)
		.then((r) => ((r && r.results) || []).map((i) => fromSeerr(i, type, seerr.getImageUrl)))
		.catch(() => []);
	const lists = await Promise.all([
		ask('movie', {page, sortBy: surprise ? 'vote_average.desc' : 'popularity.desc', genre: movieGenres, voteCountGte: surprise ? 1500 : 300, voteAverageGte: 6.3, withRuntimeLte: budget}),
		ask('movie', {page: surprise ? page + 1 : 2, sortBy: 'vote_average.desc', genre: movieGenres, voteCountGte: 1000, voteAverageGte: 7, withRuntimeLte: budget}),
		ask('tv', {page, sortBy: surprise ? 'vote_average.desc' : 'popularity.desc', genre: tvGenres, voteCountGte: surprise ? 500 : 150, voteAverageGte: 6.5})
	]);
	const items = [].concat(...lists);
	caches.discover[cacheKey] = {at: Date.now(), items};
	return items;
};

const merge = (a, b) => ({
	...b,
	...a,
	tmdbId: a.tmdbId || b.tmdbId,
	genres: a.genres.length ? a.genres : b.genres,
	runtimeMinutes: a.runtimeMinutes || b.runtimeMinutes,
	rating: b.voteCount ? b.rating : a.rating || b.rating,
	voteCount: a.voteCount || b.voteCount,
	language: a.language || b.language,
	availability: ['inLibrary', 'requested', 'requestable'].indexOf(a.availability) <= ['inLibrary', 'requested', 'requestable'].indexOf(b.availability) ? a.availability : b.availability,
	backdropUrl: a.backdropUrl || b.backdropUrl,
	overview: a.overview || b.overview,
	seerr: a.seerr || b.seerr
});

// Les titres préférés du questionnaire guident (loadTasteExtras de l'APK) :
// un coup de cœur de tous les temps pèse trois fois un titre aimé ; leurs
// recommandations Seerr rejoignent les candidats.
const SEED_LIFETIME_MS = 6 * 60 * 60 * 1000;
const tasteSeeds = async (seerr, profile) => {
	const seeds = profile.pivots.map((p) => ({key: pickKey(p), mediaType: p.type, id: p.id, title: p.title, weight: 3}))
		.concat(profile.favorites.slice(-12).map((p) => ({key: pickKey(p), mediaType: p.type, id: p.id, title: p.title, weight: 1})));
	const recommendations = {};
	if (!seerr) return {seeds: [], recommendations};
	caches.recs = caches.recs || {};
	await Promise.all(seeds.map(async (seed) => {
		const hit = caches.recs[seed.key];
		if (hit && Date.now() - hit.at < SEED_LIFETIME_MS) {
			recommendations[seed.key] = hit.items;
			return;
		}
		try {
			const r = await (seed.mediaType === 'movie' ? seerr.getMovieRecommendations(seed.id) : seerr.getTvRecommendations(seed.id));
			const items = ((r && r.results) || []).filter((i) => !i.adult).slice(0, 20).map((i) => ({...i, mediaType: i.mediaType || seed.mediaType}));
			caches.recs[seed.key] = {at: Date.now(), items};
			recommendations[seed.key] = items;
		} catch (e) {
			recommendations[seed.key] = [];
		}
	}));
	return {seeds, recommendations};
};

// Rassemble ce qui pourrait être regardé et le classe pour `answers`.
// libraryOnly ne garde que ce que le serveur peut lire tout de suite,
// requestableOnly que ce qu'il n'a pas (pour la bannière de l'Accueil).
export const loadTonightPicks = async (answers, {api, serverUrl, seerr = null, libraryOnly = false, requestableOnly = false, blockAdult = true}) => {
	await loadTonight();
	await ensureBackfilled(api);
	const now = Date.now();
	const taste = await loadTaste();
	const [library, discovered, guided] = await Promise.all([
		requestableOnly ? Promise.resolve([]) : libraryCandidates(api, serverUrl).catch(() => []),
		seerr && !libraryOnly ? discoverCandidates(seerr, answers).catch(() => []) : Promise.resolve([]),
		tasteSeeds(seerr, taste.profile).catch(() => ({seeds: [], recommendations: {}}))
	]);
	const pool = {};
	const add = (c) => {
		pool[c.key] = pool[c.key] ? merge(pool[c.key], c) : c;
	};
	library.forEach(add);
	if (seerr && !libraryOnly) {
		Object.keys(guided.recommendations).forEach((k) => guided.recommendations[k].forEach((item) => {
			if (item.mediaType === 'movie' || item.mediaType === 'tv') add(fromSeerr(item, item.mediaType, seerr.getImageUrl));
		}));
	}
	discovered.forEach(add);
	const watched = watchedTmdbKeys(state.journal);
	[].concat(taste.profile.favorites, taste.profile.pivots, taste.profile.meh, taste.profile.disliked).forEach((p) => watched.add(pickKey(p)));
	const candidates = Object.keys(pool).map((k) => pool[k]).filter((c) =>
		(!libraryOnly || c.availability === 'inLibrary') && (!requestableOnly || c.availability === 'requestable'));
	const result = rankTonight({
		candidates,
		answers,
		now,
		device: DEVICE,
		habits: buildHabits(state.journal, now),
		journal: state.journal,
		rejections: recentRejections(now),
		watched,
		profile: taste.profile,
		feedback: taste.feedback,
		seeds: guided.seeds,
		recommendations: guided.recommendations,
		weights: state.weights,
		blockAdult
	});
	return {result, answers};
};

export const resetTonightForTests = (s) => {
	state = {journal: [], answers: null, backfilled: true, rejections: {}, weights: {}, ...(s || {})};
	loaded = Promise.resolve(state);
	caches.library = {};
	caches.discover = {};
};
