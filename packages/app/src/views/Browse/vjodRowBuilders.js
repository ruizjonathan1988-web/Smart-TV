// Les rangées VJOD tirées des collections (home_view_model.dart,
// vjod_personalizer.dart et vjod_collections.dart de l'APK) : les deux
// rangées « prêtes ce soir » lisent la bibliothèque, les autres une
// collection VJOD cherchée sur Seerr, terminée par une tuile « Tout voir ».
// Chacune est arrangée pour la personne (envie du soir, ce qu'elle regarde
// en ce moment, ses goûts) en gardant un tiers de découvertes.
import seerrApi from '../../services/seerrApi';
import {normalizeMediaItem} from '../../utils/seerrHomeRows';
import {VJOD_COLLECTIONS, collectionById, inSeason} from '../../services/vjodCollections';
import {fetchPage} from '../../services/vjodCollectionService';
import {getFromStorage} from '../../services/storage';
import {loadTaste, tasteFactorFor, genreAffinity} from '../../services/tonight/tasteProfile';
import {genresOfIds, genresFromNames} from '../../services/tonight/tonightModels';
import {MOOD_GENRES, MOOD_CLASHES} from '../../services/tonight/tonightEngine';
import {getJournal} from '../../services/tonight/tonightService';
import {outcomeOf} from '../../services/tonight/eveningJournal';

const DAY = 86400000;
export const MOOD_KEY = 'vjodHomeMood';
const MOOD_LABELS = {laugh: 'Rire', chills: 'Frissons', escape: 'Évasion', think: 'Réfléchir', comfort: 'Réconfort', surprise: 'Surprends-moi'};
export const moodLabel = (m) => MOOD_LABELS[m] || m;

// L'envie choisie sous la bannière vaut jusqu'au lendemain 5 h (VjodMoodStore).
const moodDay = (at) => {
	const d = new Date(at - 5 * 3600000);
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
export const readMood = (stored, now = Date.now()) => {
	if (typeof stored !== 'string') return null;
	const [m, day] = stored.split('@');
	return day === moodDay(now) && MOOD_LABELS[m] ? m : null;
};
export const writeMood = (mood, now = Date.now()) => `${mood}@${moodDay(now)}`;

const dayIndex = (now) => {
	const d = new Date(now);
	return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(2026, 0, 1)) / DAY);
};

export const themeOfDay = (now = Date.now()) => {
	const date = new Date(now);
	const themes = VJOD_COLLECTIONS.filter((c) => c.family === 'themes' && inSeason(c, date));
	const seasonal = themes.filter((c) => c.months && c.months.length);
	if (seasonal.length && date.getDate() % 2 === 0) return seasonal[0];
	const yearRound = themes.filter((c) => !c.months || !c.months.length);
	return yearRound[Math.abs(dayIndex(now)) % yearRound.length];
};

export const ambianceOfDay = (now = Date.now(), onHome = new Set()) => {
	const moods = VJOD_COLLECTIONS.filter((c) => c.family === 'ambiances' && c.family !== 'ready' && inSeason(c, new Date(now)) && !onHome.has(c.id));
	if (!moods.length) return null;
	return moods[(Math.abs(dayIndex(now)) + 3) % moods.length];
};

// ------------------------------------------------------------------ signaux

export const buildSignals = ({journal, profile, mood, now = Date.now()}) => {
	const recent = {};
	const recentTitles = {};
	const habit = {};
	(journal || []).forEach((e) => {
		const genres = e.genres || [];
		if (!genres.length || outcomeOf(e) < 0) return;
		const age = now - e.at;
		if (age < 0) return;
		const days = age / DAY;
		const strength = Math.max(outcomeOf(e), 0.1);
		genres.forEach((g) => {
			habit[g] = (habit[g] || 0) + strength * Math.pow(0.5, days / 60) / genres.length;
		});
		if (age > 21 * DAY) return;
		genres.forEach((g) => {
			recent[g] = (recent[g] || 0) + strength * Math.pow(0.5, days / 5) / genres.length;
			if (e.title) recentTitles[g] = e.title;
		});
	});
	const total = Object.keys(recent).reduce((s, g) => s + recent[g], 0);
	const shares = {};
	if (total > 0) {
		Object.keys(recent).forEach((g) => {
			shares[g] = recent[g] / total;
		});
	}
	const affinity = genreAffinity(profile);
	const comfort = new Set(Object.keys(habit).sort((a, b) => habit[b] - habit[a]).slice(0, 3)
		.concat(profile.liked, Object.keys(affinity).filter((g) => affinity[g] >= 0.3)));
	const watched = new Set();
	(journal || []).forEach((e) => {
		if (e.tmdbId && (e.finished || e.backfilled)) watched.add(`${e.mediaType}:${e.tmdbId}`);
	});
	return {enabled: true, mood, recent: shares, recentTitles, comfort, watched};
};

const seeded = (seed) => {
	let s = seed >>> 0; // eslint-disable-line no-bitwise
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0; // eslint-disable-line no-bitwise
		return s / 4294967296;
	};
};

// VjodPersonalizer.arrange : un tiers de découvertes intercalées.
export const arrange = (candidates, signals, {seed = 0, allDiscovery = false, keepWatched = false} = {}) => {
	const moodGenres = signals.mood ? MOOD_GENRES[signals.mood] || {} : {};
	const clashes = signals.mood ? MOOD_CLASHES[signals.mood] || [] : [];
	const hasMood = Object.keys(moodGenres).length > 0;
	const scored = [];
	const seen = new Set();
	candidates.forEach((c, index) => {
		if (c.taste <= 0 || seen.has(c.key)) return;
		if (!keepWatched && signals.watched.has(c.key)) return;
		seen.add(c.key);
		let recentFit = 0;
		let recentGenre = null;
		let moodFit = 0;
		c.genres.forEach((g) => {
			const share = signals.recent[g] || 0;
			recentFit += share;
			if (share > (signals.recent[recentGenre] || 0)) recentGenre = g;
			moodFit = Math.max(moodFit, moodGenres[g] || 0);
		});
		recentFit = Math.min(1, recentFit);
		const clash = c.genres.some((g) => clashes.indexOf(g) >= 0);
		let score = c.taste * (1 / (1 + 0.04 * index)) * (1 + 0.8 * recentFit);
		if (hasMood) {
			score *= 0.55 + moodFit;
			if (clash) score *= 0.25;
		}
		let why = null;
		let because = null;
		if (moodFit >= 0.6 && !clash) why = 'mood';
		else if (recentFit >= 0.3 && recentGenre && signals.recentTitles[recentGenre]) {
			why = 'recent';
			because = signals.recentTitles[recentGenre];
		} else if (c.taste >= 1.25) why = 'liked';
		scored.push({c, score, why, because});
	});
	const isDiscovery = (c) => c.genres.length > 0 && !c.genres.some((g) => signals.comfort.has(g)) && !c.genres.some((g) => clashes.indexOf(g) >= 0);
	const random = seeded(seed);
	const discoveries = scored.filter((s) => isDiscovery(s.c));
	const head = discoveries.slice(0, 12);
	for (let i = head.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const t = head[i];
		head[i] = head[j];
		head[j] = t;
	}
	const queue = head.concat(discoveries.slice(12));
	if (allDiscovery) return queue.map((s) => ({item: s.c.item, why: 'discovery'}));
	const personal = scored.filter((s) => !isDiscovery(s.c)).sort((a, b) => b.score - a.score);
	const every = Math.max(2, Math.round(1 / (signals.mood === 'surprise' ? 1 / 2 : 1 / 3)));
	const out = [];
	let p = 0;
	let d = 0;
	while (p < personal.length || d < queue.length) {
		const wantsDiscovery = out.length % every === every - 1;
		if ((wantsDiscovery || p >= personal.length) && d < queue.length) out.push({item: queue[d++].c.item, why: 'discovery'});
		else {
			const s = personal[p++];
			out.push({item: s.c.item, why: s.why, because: s.because});
		}
	}
	return out;
};

export const whyText = (placed, mood) => {
	switch (placed.why) {
		case 'mood': return mood ? `Pour ce soir : ${moodLabel(mood)}` : null;
		case 'recent': return placed.because ? `Parce que vous regardez ${placed.because}` : null;
		case 'liked': return 'Dans vos goûts';
		case 'discovery': return 'Pour sortir de vos habitudes';
		default: return null;
	}
};

const signalsNow = async () => {
	const [{profile, feedback}, journal, stored] = await Promise.all([loadTaste(), getJournal(), getFromStorage(MOOD_KEY).catch(() => null)]);
	return {signals: buildSignals({journal, profile, mood: readMood(stored)}), profile, feedback};
};

// ------------------------------------------------------------------ rangées

export const ROW_COLLECTION = {
	vjod_unwatched_gems: 'gems', vjod_short_gems: 'short_gems', vjod_mind_benders: 'mind_benders', vjod_miniseries: 'miniseries',
	vjod_feel_good: 'feel_good', vjod_epic: 'epic', vjod_binge: 'binge'
};

const seeAll = (collection, cover) => ({
	Id: `vjodcol-${collection.id}`,
	Name: 'Tout voir',
	Type: 'Folder',
	Overview: collection.title,
	_vjodCollection: collection.id,
	_externalBackdropUrl: cover && cover.backdropPath ? seerrApi.getImageUrl(cover.backdropPath, 'w780') : null,
	_externalPosterUrl: cover && cover.posterPath ? seerrApi.getImageUrl(cover.posterPath, 'w342') : null
});

let readyDraw = null;
const loadReady = async (api, short) => {
	if (!readyDraw || Date.now() - readyDraw.at > 5 * 60000) {
		readyDraw = {at: Date.now(), items: api.getItems({IncludeItemTypes: 'Movie', Filters: 'IsUnplayed', SortBy: 'CommunityRating,SortName', SortOrder: 'Descending', Recursive: true, Limit: 200, Fields: 'ProviderIds,Genres,Overview'}).then((r) => (r && r.Items) || []).catch(() => [])};
	}
	const draw = await readyDraw.items;
	const minutes = (i) => Math.floor((i.RunTimeTicks || 0) / 600000000);
	const picked = draw.filter((i) => (i.CommunityRating || 0) >= (short ? 7.0 : 7.3) && (!short || (minutes(i) >= 60 && minutes(i) <= 100)))
		.sort((a, b) => (b.CommunityRating || 0) - (a.CommunityRating || 0));
	const tail = picked.slice(6, 36);
	for (let i = tail.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const t = tail[i];
		tail[i] = tail[j];
		tail[j] = t;
	}
	return picked.slice(0, 6).concat(tail);
};

const collectionItems = async (collection, hidden) => {
	const pages = await Promise.all([1, 2].map((p) => fetchPage(collection, p).catch(() => null)));
	const seen = new Set();
	const items = [];
	pages.forEach((page) => ((page && page.results) || []).forEach((item) => {
		if (seen.has(item.id) || (item.mediaInfo && item.mediaInfo.status === 6)) return;
		if (hidden.has(`${collection.query.mediaType || 'movie'}:${item.id}`)) return;
		seen.add(item.id);
		items.push(item);
	}));
	const rank = (i) => {
		const s = i.mediaInfo && i.mediaInfo.status;
		return s === 5 || s === 4 ? 0 : s === 2 || s === 3 ? 1 : 2;
	};
	return items.map((it, i) => [it, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map((e) => e[0]);
};

const seerrRow = (id, title, collection, found, ctx, seed, allDiscovery = false) => {
	const {signals, profile, feedback} = ctx;
	const mediaType = collection.query.mediaType || 'movie';
	const placed = arrange(found.map((item) => ({
		item,
		key: `${mediaType}:${item.id}`,
		genres: genresOfIds(item.genreIds, mediaType),
		taste: tasteFactorFor({genres: genresOfIds(item.genreIds, mediaType), mediaType, language: item.originalLanguage,
			year: parseInt(String(item.releaseDate || item.firstAirDate || '').slice(0, 4), 10) || null, voteCount: item.voteCount, profile, feedback})
	})), signals, {seed, allDiscovery});
	const items = placed.filter((p) => !(ctx.blockAdult && p.item.adult) && p.item.posterPath)
		.map((p) => ({...normalizeMediaItem({...p.item, mediaType}), _vjodReason: whyText(p, signals.mood)}));
	if (items.length < 5) return [];
	const cover = placed.map((p) => p.item).find((i) => i.backdropPath) || placed[0].item;
	return [{id, title, items: items.concat([seeAll(collection, cover)]), type: 'portrait', isSeerrRow: true}];
};

const collectionRow = (rowId) => {
	const build = async (ctx) => {
		const now = Date.now();
		const base = await signalsNow();
		const full = {...ctx, ...base};
		const seed = dayIndex(now) * 31 + rowId.length;
		const onHome = new Set(Object.keys(ROW_COLLECTION).filter((r) => ctx.enabledIds.has(r)).map((r) => ROW_COLLECTION[r]));
		let collection;
		let title;
		if (rowId === 'vjod_theme_of_day') {
			collection = themeOfDay(now);
			title = `${collection.months && collection.months.length ? 'De saison' : 'Thème du jour'} · ${collection.title}`;
		} else if (rowId === 'vjod_ambiance_of_day') {
			collection = ambianceOfDay(now, onHome);
			if (!collection) return [];
			title = `Ambiance du jour · ${collection.title}`;
		} else {
			collection = collectionById(ROW_COLLECTION[rowId]);
			if (!collection) return [];
			title = collection.title;
		}
		const hidden = new Set(base.feedback.hidden);
		if (collection.family === 'ready') {
			if (!ctx.api) return [];
			const items = await loadReady(ctx.api, rowId === 'vjod_short_gems');
			const placed = arrange(items.map((item) => {
				const tmdb = item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb);
				return {item, key: tmdb ? `movie:${tmdb}` : `jellyfin:${item.Id}`, genres: genresFromNames(item.Genres || []), taste: 1};
			}), {...base.signals, watched: new Set()}, {seed});
			if (placed.length < 4) return [];
			return [{id: rowId, title, type: 'portrait', items: placed.map((p) => ({...p.item, _vjodReason: whyText(p, base.signals.mood)}))}];
		}
		if (!ctx.seerr) return [];
		return seerrRow(rowId, title, collection, await collectionItems(collection, hidden), full, seed);
	};
	build.library = rowId === 'vjod_unwatched_gems' || rowId === 'vjod_short_gems';
	return build;
};

// « Hors de vos habitudes » : une collection par jour, loin des genres habituels.
const outsideHabits = async (ctx) => {
	if (!ctx.seerr) return [];
	const now = Date.now();
	const base = await signalsNow();
	const onHome = new Set([themeOfDay(now).id].concat(Object.keys(ROW_COLLECTION).map((r) => ROW_COLLECTION[r])));
	const ambiance = ambianceOfDay(now, onHome);
	if (ambiance) onHome.add(ambiance.id);
	const inComfort = (c) => {
		if (!c.query.genre || !base.signals.comfort.size) return false;
		const ids = String(c.query.genre).split(/[,|]/).map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));
		return genresOfIds(ids, c.query.mediaType || 'movie').some((g) => base.signals.comfort.has(g));
	};
	const pool = VJOD_COLLECTIONS.filter((c) => c.family !== 'ready' && inSeason(c, new Date(now)) && !onHome.has(c.id) && !inComfort(c));
	if (!pool.length) return [];
	const start = Math.abs(dayIndex(now)) % pool.length;
	for (let i = 0; i < Math.min(3, pool.length); i++) {
		const collection = pool[(start + i) % pool.length];
		const found = await collectionItems(collection, new Set(base.feedback.hidden));
		const rows = seerrRow('vjod_outside_habits', `Hors de vos habitudes · ${collection.title}`, collection, found, {...ctx, ...base}, dayIndex(now) * 31 + 7, true);
		if (rows.length) return rows;
	}
	return [];
};

// « Ce soir, plutôt… » : six envies sous la bannière, celle du jour cochée.
const moodRow = async () => {
	const stored = await getFromStorage(MOOD_KEY).catch(() => null);
	const current = readMood(stored);
	return [{
		id: 'vjod_mood',
		title: current ? `Ce soir, plutôt… ${moodLabel(current)}` : 'Ce soir, plutôt…',
		type: 'landscape',
		isTileRow: true,
		items: Object.keys(MOOD_LABELS).map((m) => ({Id: `vjod_mood_${m}`, Name: m === current ? `✓ ${moodLabel(m)}` : moodLabel(m), Type: 'Folder', _vjodMood: m}))
	}];
};
moodRow.library = true;

export const VJOD_ROW_BUILDERS = {
	vjod_mood: moodRow,
	vjod_unwatched_gems: collectionRow('vjod_unwatched_gems'),
	vjod_short_gems: collectionRow('vjod_short_gems'),
	vjod_mind_benders: collectionRow('vjod_mind_benders'),
	vjod_miniseries: collectionRow('vjod_miniseries'),
	vjod_feel_good: collectionRow('vjod_feel_good'),
	vjod_epic: collectionRow('vjod_epic'),
	vjod_binge: collectionRow('vjod_binge'),
	vjod_theme_of_day: collectionRow('vjod_theme_of_day'),
	vjod_ambiance_of_day: collectionRow('vjod_ambiance_of_day'),
	vjod_outside_habits: outsideHabits
};

