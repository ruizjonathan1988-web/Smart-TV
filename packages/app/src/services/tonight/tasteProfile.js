// Les goûts (taste_profile.dart de l'APK) : ce que le questionnaire a appris,
// et le facteur qui en découle pour chaque titre (0 l'écarte, 1 est neutre).
import {getFromStorage, saveToStorage} from '../storage';
import {GENRES} from './tonightModels';

const KEY = 'vjodTaste';
const FEEDBACK_KEY = 'vjodTasteFeedback';

export const MEDIA_PREFS = ['both', 'movies', 'series'];
export const ERAS = ['any', 'recent', 'classic'];
export const MOVIE_LENGTHS = ['short', 'medium', 'long', 'any'];
export const SERIES_FORMATS = ['mini', 'few', 'long', 'any'];
export const VIOLENCE = ['none', 'justified', 'fine'];
export const SUBTITLES = ['never', 'depends', 'gladly'];
export const AXES = ['darkLight', 'realImaginary', 'slowFast', 'recentClassic', 'popularNiche', 'spectacleIntimate'];
export const TASTE_GENRES = Object.keys(GENRES);

export const EMPTY_PROFILE = {
	mediaPref: 'both', era: 'any', liked: [], avoided: [], languages: [], favorites: [], pivots: [],
	meh: [], disliked: [], contexts: [], kidsAge: null, movieLength: 'any', seriesFormat: 'any',
	axes: {}, violence: 'fine', subtitles: 'depends', anime: false, surpriseMe: false, updatedAt: null
};
export const EMPTY_FEEDBACK = {hidden: [], penalties: {}};

const oneOf = (list, v, fallback) => (list.indexOf(v) >= 0 ? v : fallback);
const genreList = (v) => (Array.isArray(v) ? v.filter((g) => TASTE_GENRES.indexOf(g) >= 0) : []);

export const pickOf = (j) => {
	if (!j || typeof j !== 'object' || typeof j.id !== 'number' || (j.type !== 'movie' && j.type !== 'tv')) return null;
	return {id: j.id, type: j.type, title: j.title || '', poster: j.poster || null, genres: genreList(j.genres)};
};
export const pickKey = (p) => `${p.type}:${p.id}`;
const picks = (v) => (Array.isArray(v) ? v.map(pickOf).filter(Boolean) : []);

// Format de stockage de l'APK (même clés JSON).
export const decodeProfile = (json) => {
	if (!json || typeof json !== 'object') return {...EMPTY_PROFILE};
	const axes = {};
	if (json.axes && typeof json.axes === 'object') {
		Object.keys(json.axes).forEach((k) => {
			if (AXES.indexOf(k) >= 0 && typeof json.axes[k] === 'number') axes[k] = json.axes[k];
		});
	}
	return {
		mediaPref: oneOf(MEDIA_PREFS, json.media, 'both'),
		era: oneOf(ERAS, json.era, 'any'),
		liked: genreList(json.liked),
		avoided: genreList(json.avoided),
		languages: Array.isArray(json.languages) ? json.languages.filter((c) => typeof c === 'string' && c) : [],
		favorites: picks(json.favorites),
		pivots: picks(json.pivots),
		meh: picks(json.meh),
		disliked: picks(json.disliked),
		contexts: Array.isArray(json.contexts) ? json.contexts.filter((c) => typeof c === 'string') : [],
		kidsAge: typeof json.kids === 'string' ? json.kids : null,
		movieLength: oneOf(MOVIE_LENGTHS, json.length, 'any'),
		seriesFormat: oneOf(SERIES_FORMATS, json.series, 'any'),
		axes,
		violence: oneOf(VIOLENCE, json.violence, 'fine'),
		subtitles: oneOf(SUBTITLES, json.subtitles, 'depends'),
		anime: json.anime === true,
		surpriseMe: json.surprise === true,
		updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : null
	};
};

export const encodeProfile = (p) => {
	const out = {
		media: p.mediaPref, era: p.era, liked: p.liked, avoided: p.avoided, languages: p.languages,
		favorites: p.favorites, length: p.movieLength, series: p.seriesFormat, violence: p.violence, subtitles: p.subtitles
	};
	if (p.pivots.length) out.pivots = p.pivots;
	if (p.meh.length) out.meh = p.meh;
	if (p.disliked.length) out.disliked = p.disliked;
	if (p.contexts.length) out.contexts = p.contexts;
	if (p.kidsAge) out.kids = p.kidsAge;
	if (Object.keys(p.axes).length) out.axes = p.axes;
	if (p.anime) out.anime = true;
	if (p.surpriseMe) out.surprise = true;
	if (p.updatedAt) out.updatedAt = p.updatedAt;
	return out;
};

// Ce que les titres notés disent de chaque genre, entre -1 et 1.
export const genreAffinity = (p) => {
	const sum = {};
	const count = {};
	const add = (list, value) => list.forEach((pick) => pick.genres.forEach((g) => {
		sum[g] = (sum[g] || 0) + value;
		count[g] = (count[g] || 0) + 1;
	}));
	add(p.pivots, 2);
	add(p.favorites, 1);
	add(p.meh, -0.3);
	add(p.disliked, -1);
	const out = {};
	Object.keys(sum).forEach((g) => {
		out[g] = Math.max(-1, Math.min(1, sum[g] / (count[g] + 3)));
	});
	return out;
};

const DARK = ['horror', 'thriller', 'crime', 'war'];
const LIGHT = ['comedy', 'family', 'animation', 'kids'];
const REAL = ['documentary', 'history', 'drama', 'crime', 'war'];
const IMAGINARY = ['fantasy', 'scifi', 'animation'];
const FAST = ['action', 'thriller', 'horror'];
const SPECTACLE = ['adventure', 'action', 'scifi', 'fantasy'];
const INTIMATE = ['drama', 'romance'];
const anyOf = (genres, set) => genres.some((g) => set.indexOf(g) >= 0);

export const axisPosition = (axis, {genres, year, voteCount, now}) => {
	switch (axis) {
		case 'darkLight': {
			const dark = anyOf(genres, DARK);
			const light = anyOf(genres, LIGHT);
			if (dark === light) return 0;
			return dark ? -1 : 1;
		}
		case 'realImaginary': {
			const real = anyOf(genres, REAL);
			const imaginary = anyOf(genres, IMAGINARY);
			if (real === imaginary) return 0;
			return real ? -1 : 1;
		}
		case 'slowFast':
			if (anyOf(genres, FAST)) return 1;
			if (genres.indexOf('drama') >= 0 || genres.indexOf('documentary') >= 0) return -1;
			return 0;
		case 'recentClassic': {
			if (!year) return 0;
			const age = new Date(now || Date.now()).getFullYear() - year;
			if (age <= 5) return -1;
			if (age >= 25) return 1;
			return 0;
		}
		case 'popularNiche':
			if (voteCount === null || voteCount === undefined) return 0;
			if (voteCount >= 10000) return -1;
			if (voteCount < 1500) return 1;
			return 0;
		case 'spectacleIntimate': {
			const spectacle = anyOf(genres, SPECTACLE);
			const intimate = anyOf(genres, INTIMATE);
			if (spectacle === intimate) return 0;
			return spectacle ? -1 : 1;
		}
		default:
			return 0;
	}
};

export const tasteFactorFor = ({genres, mediaType, language, year, voteCount, profile, feedback, now}) => {
	const p = profile || EMPTY_PROFILE;
	const fb = feedback || EMPTY_FEEDBACK;
	if (anyOf(genres, p.avoided)) return 0;
	if (p.violence === 'none' && genres.indexOf('horror') >= 0) return 0;
	const foreign = !!language && language !== 'fr' && language !== 'en';
	if (p.subtitles === 'never' && foreign) return 0;
	let factor = 1;
	if ((p.mediaPref === 'movies' && mediaType === 'tv') || (p.mediaPref === 'series' && mediaType === 'movie')) factor *= 0.45;
	if (p.liked.length) {
		const matches = genres.filter((g) => p.liked.indexOf(g) >= 0).length;
		factor *= matches === 0 ? 0.8 : 1 + 0.3 * Math.min(matches, 2);
	}
	const affinity = genreAffinity(p);
	if (Object.keys(affinity).length && genres.length) {
		let total = 0;
		let known = 0;
		genres.forEach((g) => {
			if (affinity[g] === undefined) return;
			total += affinity[g];
			known++;
		});
		if (known) factor *= Math.max(0.6, Math.min(1.5, Math.exp(0.4 * total / known)));
	}
	if (p.languages.length && language) {
		if (p.languages.indexOf(language) >= 0) factor *= 1.15;
		else if (!p.surpriseMe) factor *= 0.7;
	}
	if (p.subtitles === 'gladly' && foreign) factor *= 1.08;
	if (p.anime && language === 'ja' && genres.indexOf('animation') >= 0) factor *= 1.25;
	if (p.violence === 'none' && anyOf(genres, ['war', 'crime', 'thriller'])) factor *= 0.75;
	if (p.violence === 'justified' && genres.indexOf('horror') >= 0) factor *= 0.75;
	if (p.era !== 'any' && year) {
		const thisYear = new Date(now || Date.now()).getFullYear();
		const recent = year >= thisYear - 8;
		const old = year <= thisYear - 20;
		if (p.era === 'recent') {
			if (recent) factor *= 1.12;
			if (old) factor *= 0.8;
		} else {
			if (old) factor *= 1.25;
			if (recent) factor *= 0.85;
		}
	}
	Object.keys(p.axes).forEach((axis) => {
		const v = p.axes[axis];
		if (!v) return;
		const position = axisPosition(axis, {genres, year, voteCount, now});
		if (!position) return;
		factor *= 1 + 0.08 * Math.max(-2, Math.min(2, v)) * position;
	});
	let penalty = 1;
	genres.forEach((g) => {
		const n = fb.penalties[g] || 0;
		if (n > 0) penalty *= Math.pow(0.82, n);
	});
	return factor * Math.max(penalty, 0.3);
};

// Les saisons qui conviennent au format de séries préféré.
export const seriesFit = (format, seasons) => {
	if (!seasons) return 0;
	switch (format) {
		case 'mini': return seasons === 1 ? 0.5 : (seasons >= 4 ? -0.5 : 0);
		case 'few': return seasons >= 2 && seasons <= 3 ? 0.5 : (seasons >= 6 ? -0.4 : 0);
		case 'long': return seasons >= 4 ? 0.5 : (seasons === 1 ? -0.3 : 0);
		default: return 0;
	}
};

// ------------------------------------------------------------------ stockage

let cached = null;
const listeners = new Set();

export const loadTaste = async () => {
	if (cached) return cached;
	try {
		const [p, f] = await Promise.all([getFromStorage(KEY), getFromStorage(FEEDBACK_KEY)]);
		cached = {
			profile: decodeProfile(p),
			feedback: f && typeof f === 'object' ? {hidden: Array.isArray(f.hidden) ? f.hidden : [], penalties: f.penalties || {}} : {...EMPTY_FEEDBACK}
		};
	} catch (e) {
		cached = {profile: {...EMPTY_PROFILE}, feedback: {...EMPTY_FEEDBACK}};
	}
	return cached;
};

export const saveTasteProfile = async (profile) => {
	const taste = await loadTaste();
	cached = {...taste, profile: {...profile, updatedAt: new Date().toISOString()}};
	await saveToStorage(KEY, encodeProfile(cached.profile)).catch(() => {});
	listeners.forEach((l) => l(cached));
	return cached;
};

// « Pas pour moi » : le titre disparaît, ses genres pèsent un peu moins.
export const notInterested = async (key, genres) => {
	const taste = await loadTaste();
	const hidden = taste.feedback.hidden.filter((k) => k !== key).concat([key]).slice(-500);
	const penalties = {...taste.feedback.penalties};
	(genres || []).forEach((g) => {
		penalties[g] = (penalties[g] || 0) + 1;
	});
	cached = {...taste, feedback: {hidden, penalties}};
	await saveToStorage(FEEDBACK_KEY, cached.feedback).catch(() => {});
	listeners.forEach((l) => l(cached));
};

export const onTasteChange = (fn) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

export const resetTasteForTests = (t) => {
	cached = t || null;
};
