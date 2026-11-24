// Service « Ce soir » (tonight_service.dart de l'APK) : garde le journal des
// soirées, rassemble ce qui pourrait être regardé (bibliothèque Jellyfin,
// découvertes Seerr), demande au moteur et retient ce que la personne fait de
// ses suggestions. Tout reste sur cette TV.
import {getFromStorage, saveToStorage} from '../storage';
import {getImageUrl} from '../../utils/helpers';
import {genresFromNames, genresOfIds, ratingAge, slotOf, budgetMinutes, decodeAnswers, encodeAnswers} from './tonightModels';
import {backfillEntries, decodeJournal, recordEntry, watchedTmdbKeys} from './eveningJournal';
import {buildHabits, suggestCompany} from './habitModel';
import {rankTonight, learnWeights, selfCheck} from './tonightEngine';
import {loadTaste, pickKey} from './tasteProfile';
import {loadForYouSnapshot, loadTasteHistory, requestedKeys} from './forYou';

const KEY = 'vjodTonight';
const ANSWERS_LIFETIME_MS = 5 * 3600000;
const LIBRARY_LIFETIME_MS = 15 * 60000;
const DISCOVER_LIFETIME_MS = 30 * 60000;
const REJECTION_MEMORY_MS = 7 * 86400000;
const DEVICE = 'tv';
const FIELDS = 'Overview,Genres,ProviderIds,ChildCount,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,DateCreated,UserData,PrimaryImageAspectRatio,BackdropImageTags';

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
						lastLaunch: s.lastLaunch && typeof s.lastLaunch === 'object' ? s.lastLaunch : null,
						pending: Array.isArray(s.pending) ? s.pending : []
					};
				}
				return state;
			})
			.catch(() => state);
	}
	return loaded;
};

// Le journal des soirées (pour le point du mois).
// (L'état chargé est remplacé à chaque séance : on lit l'actuel, pas celui du chargement.)
export const getJournal = async () => {
	await loadTonight();
	return state.journal;
};

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

// Une séance IPTV (film ou épisode du fournisseur), avec la compagnie du soir
// si les questions ont été répondues (recordIptvSitting de l'APK).
export const recordIptvTonightSitting = (entry) => {
	if (!entry || (entry.watchedMinutes || 0) < 1) return;
	const answers = decodeAnswers(state.answers);
	const recent = answers && entry.at - answers.at < ANSWERS_LIFETIME_MS;
	recordSitting({...entry, company: recent ? answers.company : null});
};

const LAUNCH_WINDOW_MS = 8 * 3600000;
const TICKS_PER_MINUTE = 600000000;

// Vu jusqu'au bout : 85 % d'un épisode ou moins de 3 min restantes, 90 %
// d'un film ou moins de 8 min (le générique).
export const finishedAt = (isEpisode, runtimeTicks, stopTicks) => {
	if (!(runtimeTicks > 0)) return false;
	const ratio = stopTicks / runtimeTicks;
	const leftMinutes = (runtimeTicks - stopTicks) / TICKS_PER_MINUTE;
	return isEpisode ? ratio >= 0.85 || leftMinutes <= 3 : ratio >= 0.9 || leftMinutes <= 8;
};

// La lecture vient-elle du dernier titre lancé depuis « Ce soir » ?
export const fromLaunch = (launch, {startedAt, playItemId, ownerId, tmdbKey}) => {
	if (!launch || startedAt - launch.at >= LAUNCH_WINDOW_MS) return false;
	const libraryItemId = launch.libraryItemId || launch.itemId;
	return (!!launch.playItemId && launch.playItemId === playItemId) || libraryItemId === ownerId || (!!launch.tmdbKey && launch.tmdbKey === tmdbKey);
};

// Ce que la soirée lancée depuis « Ce soir » apprend au moteur : vue jusqu'au
// bout (1), lâchée tôt (−1) ou entre les deux (0.2).
export const outcomeReward = (entry) => {
	if (entry.finished) return 1;
	return (entry.watchedMinutes || 0) < 15 ? -1 : 0.2;
};

const learn = (features, opts) => {
	state = {...state, weights: learnWeights(state.weights, features || {}, opts)};
};

// Fin d'une lecture Jellyfin : la séance entre au journal (onPlaybackStopped
// de l'APK), avec la compagnie du soir si les questions ont été répondues.
// Moins d'une minute ne compte pas.
export const recordPlaybackStop = async (api, {itemId, startTicks = 0, startedAt, stopTicks}) => {
	if (!api || !itemId || !startedAt) return;
	try {
		await loadTonight();
		const watchedTicks = (stopTicks || 0) - (startTicks || 0);
		if (watchedTicks < TICKS_PER_MINUTE) return;
		const item = await api.getItem(itemId);
		if (!item || (item.Type !== 'Movie' && item.Type !== 'Episode')) return;
		const isEpisode = item.Type === 'Episode';
		const owner = isEpisode && item.SeriesId ? await api.getItem(item.SeriesId).catch(() => null) : item;
		if (!owner) return;
		const answers = decodeAnswers(state.answers);
		const recent = answers && startedAt - answers.at < ANSWERS_LIFETIME_MS;
		const launch = state.lastLaunch;
		const tmdb = owner.ProviderIds && parseInt(owner.ProviderIds.Tmdb, 10);
		const mediaType = isEpisode ? 'tv' : 'movie';
		const fromTonight = fromLaunch(launch, {startedAt, playItemId: item.Id, ownerId: owner.Id, tmdbKey: tmdb ? `${mediaType}:${tmdb}` : null});
		const entry = {
			at: startedAt,
			itemId: owner.Id,
			mediaType,
			title: owner.Name || '',
			tmdbId: tmdb || null,
			genres: genresFromNames(owner.Genres),
			runtimeMinutes: item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_MINUTE) : null,
			year: owner.ProductionYear || null,
			rating: owner.CommunityRating || null,
			watchedMinutes: Math.floor(watchedTicks / TICKS_PER_MINUTE),
			finished: finishedAt(isEpisode, item.RunTimeTicks, stopTicks || 0),
			company: recent ? answers.company : null,
			fromTonight
		};
		recordSitting(entry);
		if (fromTonight) {
			// Un seul verdict par lancement.
			learn(launch.features, {reward: outcomeReward(entry)});
			state = {...state, lastLaunch: null};
			save();
		}
	} catch (e) {
		// Le journal est un plus : une lecture qui ne s'y inscrit pas ne gêne rien.
	}
};

// « Autre idée » : moins de chances de revoir ce titre cette semaine, et le
// moteur apprend un peu de ce refus.
export const rejected = (pick) => {
	const now = Date.now();
	const list = (state.rejections[pick.candidate.key] || []).filter((t) => now - t < REJECTION_MEMORY_MS);
	const rejections = {...state.rejections, [pick.candidate.key]: list.concat([now])};
	// Ce qui est loin derrière est oublié.
	Object.keys(rejections).forEach((k) => {
		if (rejections[k].every((t) => now - t >= REJECTION_MEMORY_MS)) delete rejections[k];
	});
	state = {...state, rejections};
	learn(pick.features, {reward: -0.3});
	save();
};

// Lancé depuis Ce soir : les poids suivent ce qui a été préféré à chacun des
// autres, et le lancement est retenu pour juger la soirée à la fin.
export const launched = (pick, over = []) => {
	if (!over.length) learn(pick.features, {reward: 0.5});
	over.forEach((o) => learn(pick.features, {over: o.features, reward: 0.5}));
	const c = pick.candidate;
	state = {...state, lastLaunch: {at: Date.now(), key: c.key, tmdbKey: c.tmdbId ? `${c.mediaType}:${c.tmdbId}` : null,
		libraryItemId: c.libraryItemId || null, playItemId: c.playItemId || null, features: pick.features || {}}};
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
		backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length ? getImageUrl(serverUrl, item.Id, 'Backdrop', {maxWidth: 1280}) : null,
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

// ------------------------------------------------------------------ demandes

const STALL_AFTER_MS = 45 * 60000;
const PENDING_LIFETIME_MS = 48 * 3600000;

const savePending = (list) => {
	state = {...state, pending: list};
	save();
};

// Demande à Seerr le film, ou la première saison d'une série.
// 'sent', 'alreadyThere' ou 'failed'.
export const requestTonight = async (seerr, c) => {
	if (!c.tmdbId || !seerr) return 'failed';
	const addPending = () => savePending((state.pending || []).filter((p) => p.key !== c.key)
		.concat([{key: c.key, title: c.title, mediaType: c.mediaType, tmdbId: c.tmdbId, at: Date.now()}]));
	try {
		if (c.mediaType === 'movie') await seerr.requestMovie(c.tmdbId);
		else await seerr.requestTv(c.tmdbId, {seasons: [1]});
		addPending();
		return 'sent';
	} catch (e) {
		if (e && (e.status === 409 || /already|exist/i.test(String(e.message || '')))) {
			addPending();
			return 'alreadyThere';
		}
		return 'failed';
	}
};

// La copie du serveur d'un titre demandé, une fois arrivée (vue par Seerr).
export const findInLibraryTonight = async (seerr, c) => {
	if (!c.tmdbId || !seerr) return null;
	try {
		const d = await (c.mediaType === 'movie' ? seerr.getMovie(c.tmdbId) : seerr.getTv(c.tmdbId));
		const info = d && d.mediaInfo;
		if (info && (info.status === 5 || info.status === 4) && info.jellyfinMediaId) return info.jellyfinMediaId;
	} catch (e) {
		// Pas encore.
	}
	return null;
};

// Une demande faite depuis « Ce soir » qui tarde à arriver ; celles arrivées
// ou trop vieilles sont oubliées.
const stalledRequest = async (seerr) => {
	const now = Date.now();
	const list = state.pending || [];
	if (!list.length) return null;
	const keep = [];
	let stalled = null;
	for (const p of list) {
		if (now - p.at > PENDING_LIFETIME_MS) continue;
		if (now - p.at < STALL_AFTER_MS) {
			keep.push(p);
			continue;
		}
		const found = await findInLibraryTonight(seerr, p);
		if (found) continue;
		keep.push(p);
		if (!stalled) stalled = p;
	}
	if (keep.length !== list.length) savePending(keep);
	return stalled;
};

// Les graines de « Pour vous » guident aussi « Ce soir » (loadRaw de l'APK) :
// ce qui a été regardé, mis en favori, choisi dans le questionnaire, mis dans
// la liste ou demandé, avec leurs recommandations (TMDB, BetaSeries, Trakt).
// Ce qui a été demandé pendant la session ou abandonné reste dehors.
const forYouSeeds = async (api, seerr) => {
	if (!seerr) return {seeds: [], recommendations: {}, exclude: []};
	const snap = await loadForYouSnapshot({api, seerr});
	return {seeds: snap.seeds, recommendations: snap.recs, exclude: requestedKeys().concat(Array.from(snap.abandoned))};
};

// La durée des films Seerr ne se lit que sur leur fiche : celle des films en
// lice est demandée, puis le classement refait avec leur vraie durée.
const runtimes = {};
const withKnownRuntime = (c) => {
	if (c.runtimeMinutes || c.mediaType !== 'movie' || !c.tmdbId || !runtimes[c.tmdbId]) return c;
	return {...c, runtimeMinutes: runtimes[c.tmdbId]};
};

// Les films sans durée parmi les propositions, puis ceux d'un classement sans
// la règle du temps (qui pourraient se révéler trop longs), 30 au plus.
export const contenders = (candidates, result, loose) => {
	const seen = new Set();
	const out = [];
	const take = (c) => {
		if (out.length >= 30 || c.mediaType !== 'movie' || c.runtimeMinutes || !c.tmdbId || seen.has(c.key)) return;
		seen.add(c.key);
		out.push(c);
	};
	result.picks.concat(loose.picks).forEach((p) => take(p.candidate));
	candidates.forEach(take);
	return out;
};

const fetchRuntimes = async (seerr, movies) => {
	const todo = movies.filter((c) => !runtimes[c.tmdbId]).map((c) => c.tmdbId);
	for (let i = 0; i < todo.length; i += 6) {
		await Promise.all(todo.slice(i, i + 6).map(async (id) => {
			try {
				const d = await seerr.getMovie(id);
				if (d && d.runtime > 0) runtimes[id] = d.runtime;
			} catch (e) {
				// Pas de fiche : la durée reste inconnue.
			}
		}));
	}
};

// Rassemble ce qui pourrait être regardé et le classe pour `answers`.
// libraryOnly ne garde que ce que le serveur peut lire tout de suite,
// requestableOnly que ce qu'il n'a pas (pour la bannière de l'Accueil).
export const loadTonightPicks = async (answers, {api, serverUrl, seerr = null, libraryOnly = false, requestableOnly = false, blockAdult = true, exclude = null, full = false}) => {
	await loadTonight();
	await ensureBackfilled(api);
	const now = Date.now();
	const taste = await loadTaste();
	const [library, discovered, guided, history] = await Promise.all([
		requestableOnly ? Promise.resolve([]) : libraryCandidates(api, serverUrl).catch(() => []),
		seerr && !libraryOnly ? discoverCandidates(seerr, answers).catch(() => []) : Promise.resolve([]),
		forYouSeeds(api, seerr).catch(() => ({seeds: [], recommendations: {}, exclude: []})),
		loadTasteHistory(api).catch(() => ({recent: []}))
	]);
	const pool = {};
	const add = (c) => {
		pool[c.key] = pool[c.key] ? merge(pool[c.key], c) : c;
	};
	library.forEach(add);
	if (seerr && !libraryOnly) {
		Object.keys(guided.recommendations).forEach((k) => guided.recommendations[k].forEach((item) => {
			const type = item.mediaType || k.split(':')[0];
			if (type === 'movie' || type === 'tv') add(fromSeerr(item, type, seerr.getImageUrl));
		}));
	}
	discovered.forEach(add);
	const watched = watchedTmdbKeys(state.journal);
	[].concat(taste.profile.favorites, taste.profile.pivots, taste.profile.meh, taste.profile.disliked).forEach((p) => watched.add(pickKey(p)));
	// Les derniers vus du serveur aussi : un film, ou une série vue en entier.
	(history.recent || []).forEach((item) => {
		const tmdb = item.ProviderIds && parseInt(item.ProviderIds.Tmdb || item.ProviderIds.tmdb, 10);
		if (!tmdb) return;
		if (item.Type === 'Movie') watched.add(`movie:${tmdb}`);
		else if (item.UserData && item.UserData.Played) watched.add(`tv:${tmdb}`);
	});
	let candidates = Object.keys(pool).map((k) => pool[k]).filter((c) =>
		(!libraryOnly || c.availability === 'inLibrary') && (!requestableOnly || c.availability === 'requestable')).map(withKnownRuntime);
	const excluded = new Set([].concat(exclude ? Array.from(exclude) : [], guided.exclude));
	const inputFor = (list) => ({
		candidates: list,
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
		exclude: excluded,
		blockAdult
	});
	let result = rankTonight(inputFor(candidates));
	if (libraryOnly || requestableOnly) return {result, answers};
	if (seerr && result.picks.length) {
		const loose = rankTonight(inputFor(candidates.filter((c) => c.mediaType === 'movie' && !c.runtimeMinutes)));
		const unknown = contenders(candidates, result, loose);
		if (unknown.length) {
			await fetchRuntimes(seerr, unknown);
			candidates = candidates.map(withKnownRuntime);
			result = rankTonight(inputFor(candidates));
		}
	}
	if (!full) return {result, answers};
	// L'écran « Ce soir » en dit plus : la précision et une demande qui traîne.
	let precision = null;
	try {
		precision = selfCheck({journal: state.journal, pool: candidates, profile: taste.profile, feedback: taste.feedback, weights: state.weights});
	} catch (e) {
		precision = null;
	}
	const stalled = seerr ? await stalledRequest(seerr).catch(() => null) : null;
	return {result, answers, precision, stalled};
};

export const resetTonightForTests = (s) => {
	state = {journal: [], answers: null, backfilled: true, rejections: {}, weights: {}, ...(s || {})};
	loaded = Promise.resolve(state);
	caches.library = {};
	caches.discover = {};
	Object.keys(runtimes).forEach((k) => delete runtimes[k]);
};
