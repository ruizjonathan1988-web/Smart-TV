// Le matériel du questionnaire de goûts (taste_quiz.dart et
// taste_quiz_loader.dart de l'APK) : une réserve d'affiches connues, les pages
// d'affiches à noter qui s'adaptent aux réponses, et les duels d'affiches.
import * as seerrApi from '../seerrApi';
import {genresOfIds} from './tonightModels';

export const quizTitleFromSeerr = (item, type) => {
	const mediaType = item.mediaType || type;
	if (mediaType !== 'movie' && mediaType !== 'tv') return null;
	if (!item.posterPath || item.adult) return null;
	const date = mediaType === 'tv' ? item.firstAirDate : item.releaseDate;
	return {
		id: item.id,
		type: mediaType,
		key: `${mediaType}:${item.id}`,
		title: item.title || item.name || '',
		poster: item.posterPath,
		genres: genresOfIds(item.genreIds, mediaType),
		year: date && date.length >= 4 ? parseInt(date.slice(0, 4), 10) : null,
		rating: item.voteAverage || 0,
		votes: item.voteCount || 0,
		language: item.originalLanguage || null
	};
};

export const toPick = (t) => ({id: t.id, type: t.type, title: t.title, poster: t.poster || null, genres: t.genres});
export const fromPick = (p) => ({id: p.id, type: p.type, key: `${p.type}:${p.id}`, title: p.title, poster: p.poster, genres: p.genres, year: null, rating: 0, votes: 0, language: null});

const isDivisive = (t) => t.votes >= 2000 && t.rating >= 6.0 && t.rating <= 7.4;
const has = (t, set) => t.genres.some((g) => set.indexOf(g) >= 0);

export const loadQuizPool = async (now = new Date()) => {
	const year = now.getFullYear();
	const list = (type, params) => seerrApi.discoverFiltered(type, params)
		.then((r) => ((r && r.results) || []).map((i) => quizTitleFromSeerr(i, type)).filter(Boolean))
		.catch(() => []);
	const lists = await Promise.all([
		list('movie', {page: 1, sortBy: 'vote_count.desc'}),
		list('movie', {page: 2, sortBy: 'vote_count.desc'}),
		list('movie', {page: 3, sortBy: 'vote_count.desc'}),
		list('movie', {page: 1, sortBy: 'popularity.desc', voteCountGte: 1500}),
		list('movie', {page: 2, sortBy: 'popularity.desc', voteCountGte: 1500}),
		list('movie', {sortBy: 'vote_count.desc', releaseDateLte: '1999-12-31'}),
		list('movie', {sortBy: 'vote_count.desc', releaseDateGte: `${year - 6}-01-01`}),
		list('movie', {page: 1, sortBy: 'vote_count.desc', language: 'fr'}),
		list('movie', {page: 2, sortBy: 'vote_count.desc', language: 'fr'}),
		list('movie', {sortBy: 'vote_count.desc', language: 'ko'}),
		list('movie', {sortBy: 'vote_count.desc', language: 'ja', genre: '16'}),
		list('movie', {sortBy: 'vote_average.desc', voteCountGte: 400, voteAverageGte: 7.4}),
		list('tv', {page: 1, sortBy: 'vote_count.desc'}),
		list('tv', {page: 2, sortBy: 'vote_count.desc'}),
		list('tv', {sortBy: 'popularity.desc', voteCountGte: 300}),
		list('tv', {sortBy: 'vote_count.desc', language: 'fr'})
	]);
	const seen = new Set();
	const out = [];
	lists.forEach((l) => l.forEach((t) => {
		if (seen.has(t.key)) return;
		seen.add(t.key);
		out.push(t);
	}));
	return out;
};

export const loadQuizRecommendations = async (title) => {
	try {
		const r = await (title.type === 'movie' ? seerrApi.getMovieRecommendations(title.id) : seerrApi.getTvRecommendations(title.id));
		return ((r && r.results) || []).map((i) => quizTitleFromSeerr(i, title.type)).filter(Boolean);
	} catch (e) {
		return [];
	}
};

export const searchQuizTitles = async (query) => {
	if (!String(query || '').trim()) return [];
	try {
		const r = await seerrApi.search(query.trim());
		return ((r && r.results) || []).map((i) => quizTitleFromSeerr(i)).filter(Boolean);
	} catch (e) {
		return [];
	}
};

// Ce que disent les pages déjà notées.
export const soFarOf = (pages, verdicts) => {
	const shown = [].concat(...pages);
	const by = (v) => shown.filter((t) => verdicts[t.key] === v);
	return {
		liked: by('liked'), meh: by('meh'), disliked: by('disliked'),
		unseen: shown.filter((t) => !verdicts[t.key]).length,
		shown: shown.length
	};
};

const familiarityOf = (s) => {
	if (!s || !s.shown) return 'normal';
	const seenShare = 1 - s.unseen / s.shown;
	if (seenShare < 0.4) return 'famous';
	if (seenShare > 0.8) return 'deeper';
	return 'normal';
};

const exhaustedGenres = (s) => {
	const count = {};
	((s && s.disliked) || []).forEach((t) => t.genres.forEach((g) => {
		count[g] = (count[g] || 0) + 1;
	}));
	return Object.keys(count).filter((g) => count[g] >= 2);
};

const shuffle = (list, random) => {
	for (let i = list.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		const t = list[i];
		list[i] = list[j];
		list[j] = t;
	}
	return list;
};

// Une page d'affiches : variée au départ (classique, français, étranger,
// animation, séries, récents), puis guidée par ce qui a été aimé.
export const pickGridPage = ({pool, count = 8, exclude = new Set(), mediaPref = 'both', avoided = [], soFar = null, recommendationsOfLiked = {}, now = new Date(), random = null}) => {
	const thisYear = now.getFullYear();
	const blocked = avoided.concat(exhaustedGenres(soFar));
	const familiarity = familiarityOf(soFar);
	const usable = (t) => {
		if (exclude.has(t.key)) return false;
		if (has(t, blocked)) return false;
		if (mediaPref === 'movies' && t.type !== 'movie') return false;
		if (mediaPref === 'series' && t.type === 'movie') return false;
		if (familiarity === 'famous') return t.votes >= 5000 || (t.type !== 'movie' && t.votes >= 1500);
		return true;
	};
	const deeper = (t) => t.rating * Math.log(1 + t.votes) / (t.votes > 20000 ? 2 : 1);
	const candidates = pool.filter(usable).sort((a, b) => (familiarity === 'deeper' ? deeper(b) - deeper(a) : b.votes - a.votes));
	const page = [];
	const covered = new Set();
	const taken = (t) => page.some((p) => p.key === t.key);
	const take = (t) => {
		page.push(t);
		t.genres.forEach((g) => covered.add(g));
	};
	const satisfy = (rule) => {
		if (page.length >= count) return;
		let fallback = null;
		for (const t of candidates) {
			if (taken(t) || !rule(t)) continue;
			if (!t.genres.every((g) => covered.has(g))) {
				take(t);
				return;
			}
			if (!fallback) fallback = t;
		}
		if (fallback) take(fallback);
	};
	((soFar && soFar.liked) || []).some((liked) => {
		const recs = recommendationsOfLiked[liked.key];
		if (!recs) return false;
		if (page.length >= Math.floor(count / 2)) return true;
		recs.some((rec) => {
			if (!usable(rec) || taken(rec)) return false;
			const otherGenre = rec.genres.length && !rec.genres.every((g) => liked.genres.indexOf(g) >= 0);
			const otherDecade = rec.year && liked.year && Math.floor(rec.year / 10) !== Math.floor(liked.year / 10);
			if (otherGenre || otherDecade) {
				take(rec);
				return true;
			}
			return false;
		});
		return false;
	});
	if (!soFar || !soFar.shown) {
		satisfy((t) => t.year && t.year < 2000);
		satisfy((t) => t.language === 'fr');
		satisfy((t) => t.language && t.language !== 'en' && t.language !== 'fr');
		satisfy((t) => t.genres.indexOf('animation') >= 0);
		if (mediaPref !== 'movies') {
			satisfy((t) => t.type !== 'movie');
			satisfy((t) => t.type !== 'movie');
		}
		satisfy((t) => t.year && t.year >= 2000 && t.year < 2015);
		satisfy((t) => t.year && t.year >= thisYear - 6);
	}
	const target = Math.floor(count / 3);
	let divisive = page.filter(isDivisive).length;
	while (divisive < target && page.length < count) {
		const before = page.length;
		satisfy(isDivisive);
		if (page.length === before) break;
		divisive++;
	}
	while (page.length < count) {
		const before = page.length;
		satisfy(() => true);
		if (page.length === before) break;
	}
	return random ? shuffle(page, random) : page;
};

const D = {
	dark: ['horror', 'thriller', 'crime', 'war'],
	light: ['comedy', 'family', 'animation'],
	real: ['documentary', 'history', 'drama', 'crime'],
	imaginary: ['fantasy', 'scifi'],
	fast: ['action', 'thriller'],
	spectacle: ['adventure', 'action', 'scifi'],
	intimate: ['drama', 'romance']
};

// Un duel pour un axe : deux films que tout oppose sur cet axe mais qui se
// ressemblent sinon (un genre en commun ou des années proches).
export const buildDuel = (axis, {pool, used = new Set(), avoided = [], now = new Date()}) => {
	const thisYear = now.getFullYear();
	const rules = {
		darkLight: [(t) => has(t, D.dark) && t.genres.indexOf('comedy') < 0, (t) => has(t, D.light) && !has(t, D.dark)],
		realImaginary: [(t) => has(t, D.real) && !has(t, D.imaginary.concat(['animation'])), (t) => has(t, D.imaginary)],
		slowFast: [(t) => t.genres.indexOf('drama') >= 0 && !has(t, D.fast.concat(['adventure'])) && t.rating >= 7.2, (t) => has(t, D.fast)],
		recentClassic: [(t) => t.year && t.year >= thisYear - 5, (t) => t.year && t.year <= thisYear - 30],
		popularNiche: [(t) => t.votes >= 15000, (t) => t.votes >= 300 && t.votes <= 2500 && t.rating >= 7.2],
		spectacleIntimate: [(t) => has(t, D.spectacle) && t.votes >= 5000, (t) => has(t, D.intimate) && !has(t, D.spectacle)]
	}[axis];
	if (!rules) return null;
	const [first, second] = rules;
	const candidates = pool.filter((t) => t.type === 'movie' && !used.has(t.key) && !has(t, avoided)).sort((a, b) => b.votes - a.votes);
	const left = candidates.find((t) => first(t) && !second(t));
	if (!left) return null;
	const alike = (t) => t.genres.some((g) => left.genres.indexOf(g) >= 0) ||
		axis === 'recentClassic' || (t.year && left.year && Math.abs(t.year - left.year) <= 15);
	let right = null;
	let fallback = null;
	for (const t of candidates) {
		if (t.key === left.key || !second(t) || first(t)) continue;
		if (alike(t)) {
			right = t;
			break;
		}
		if (!fallback) fallback = t;
	}
	right = right || fallback;
	return right ? {axis, left, right} : null;
};
