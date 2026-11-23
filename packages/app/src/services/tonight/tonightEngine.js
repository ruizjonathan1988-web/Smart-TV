// Moteur « Ce soir » (tonight_engine.dart de l'APK) : une suggestion
// principale et cinq autres, d'après les habitudes du créneau et de la
// compagnie, l'envie du soir et le temps qu'il laisse. Que de l'arithmétique
// sur ce que l'app sait déjà.
//
// Sur la TV il n'y a pas encore le questionnaire de goûts (For You) de l'APK :
// le facteur de goût vaut 1 et les « parce que tu as aimé » ne viennent que
// du journal. Le reste est identique.
import {tasteFactorFor, seriesFit, EMPTY_PROFILE} from './tasteProfile';
import {budgetMinutes, kidsMaxAge, slotOf} from './tonightModels';
import {outcomeOf, tmdbKeyOf, entrySlot} from './eveningJournal';
import {habitsFor, confidence, genreFit} from './habitModel';

export const PICK_COUNT = 6;

export const FEATURES = ['taste', 'seed', 'habit', 'format', 'mood', 'duration', 'company', 'quality', 'fresh', 'resume', 'novelty', 'rejected'];

export const DEFAULT_WEIGHTS = {
	taste: 1.0, seed: 0.9, habit: 0.8, format: 0.3, mood: 1.1, duration: 0.6,
	company: 0.6, quality: 0.7, fresh: 0.2, resume: 0.5, novelty: 0.15, rejected: 1.0
};
const FIXED = {rejected: true};
const MIN_W = 0.05;
const MAX_W = 2.5;

export const weightOf = (weights, f) => (weights && typeof weights[f] === 'number' ? weights[f] : DEFAULT_WEIGHTS[f]);

// Rapproche les poids de ce qu'avait `chosen` et, s'il est donné, les éloigne de `over`.
export const learnWeights = (weights, chosen, {over = null, reward, rate = 0.05}) => {
	const next = {};
	FEATURES.forEach((f) => {
		const current = weightOf(weights, f);
		if (FIXED[f]) {
			next[f] = current;
			return;
		}
		const delta = (chosen[f] || 0) - ((over && over[f]) || 0);
		next[f] = Math.max(MIN_W, Math.min(MAX_W, current + rate * reward * delta));
	});
	return next;
};

export const MOOD_GENRES = {
	laugh: {comedy: 1, animation: 0.6, family: 0.5, romance: 0.3},
	chills: {horror: 1, thriller: 1, mystery: 0.7, crime: 0.4},
	escape: {fantasy: 1, scifi: 1, adventure: 0.9, animation: 0.5, action: 0.5},
	think: {documentary: 1, drama: 0.8, history: 0.8, war: 0.5, mystery: 0.4, crime: 0.3},
	comfort: {comedy: 0.7, family: 0.6, romance: 0.6, animation: 0.6, adventure: 0.3, music: 0.3},
	surprise: {}
};
export const MOOD_CLASHES = {
	laugh: ['horror', 'war'],
	chills: ['family', 'kids'],
	escape: ['documentary', 'talk'],
	think: ['kids', 'reality'],
	comfort: ['horror', 'war'],
	surprise: []
};
const STRICT_MOODS = {laugh: true, chills: true, escape: true, think: true};
const FAMILY = ['family', 'animation', 'kids'];
const DARK = ['horror', 'thriller', 'crime', 'war'];
const has = (list, g) => list.indexOf(g) >= 0;
const any = (list, set) => list.some((g) => set.indexOf(g) >= 0);

const familySafe = (c, kids) => {
	if (c.adult) return false;
	if (c.ratingAge !== null && c.ratingAge !== undefined) return c.ratingAge <= kidsMaxAge(kids);
	return any(c.genres, FAMILY) && !any(c.genres, DARK);
};

// À quel point les titres aimés pointent vers chaque candidat (seeds = titres
// aimés avec leurs recommandations), plus fort s'ils ont été vus dans une
// soirée semblable.
const seedSupport = (input, slot) => {
	const contextual = {};
	(input.journal || []).forEach((e) => {
		const key = tmdbKeyOf(e);
		if (!key || outcomeOf(e) <= 0) return;
		let boost = 0;
		const s = entrySlot(e);
		if (s.band === slot.band) boost += 0.25;
		if (s.key === slot.key) boost += 0.25;
		if (e.company && e.company === input.answers.company) boost += 0.5;
		contextual[key] = Math.max(contextual[key] || 0, boost);
	});
	const result = {};
	const best = {};
	(input.seeds || []).forEach((seed) => {
		const recs = (input.recommendations || {})[seed.key];
		if (!recs || !recs.length) return;
		const weight = seed.weight * (1 + (contextual[seed.key] || 0));
		recs.forEach((item, rank) => {
			const key = `${item.mediaType || seed.mediaType}:${item.id}`;
			const push = weight * (1 - rank / (recs.length + 5));
			const cur = result[key];
			const title = cur && (best[key] || 0) >= push ? cur.title : seed.title;
			if ((best[key] || 0) < push) best[key] = push;
			result[key] = {support: (cur ? cur.support : 0) + push, title};
		});
	});
	return result;
};

const effectiveWeights = (input, neutralMood) => {
	const w = {};
	FEATURES.forEach((f) => {
		w[f] = weightOf(input.weights, f);
	});
	if (neutralMood) {
		w.mood = 0;
		return w;
	}
	if (input.answers.mood === 'surprise') {
		w.habit *= 0.3;
		w.seed *= 0.6;
		w.quality *= 1.3;
		w.novelty = 0.9;
	} else if (input.answers.mood === 'comfort') {
		w.resume *= 2;
		w.habit *= 1.3;
		w.novelty = 0;
	}
	if (input.answers.company === 'family') w.company *= 1.5;
	if (input.answers.time === 'short') w.duration *= 1.4;
	return w;
};

const standardize = (rows) => {
	FEATURES.forEach((f) => {
		const mean = rows.reduce((s, r) => s + r.raw[f], 0) / rows.length;
		const variance = rows.reduce((s, r) => s + (r.raw[f] - mean) * (r.raw[f] - mean), 0) / rows.length;
		const sd = Math.sqrt(variance);
		rows.forEach((r) => {
			r.z[f] = sd < 1e-6 ? 0 : Math.max(-2.5, Math.min(2.5, (r.raw[f] - mean) / sd));
		});
	});
};

export const scoreCandidates = (input, {strictMood, neutralMood = false}) => {
	const {answers} = input;
	const mood = answers.mood;
	const slot = slotOf(input.now);
	const habit = habitsFor(input.habits, {slot, company: answers.company, device: input.device});
	const conf = confidence(input.habits.global, 10);
	const budget = budgetMinutes(answers.time);
	const profile = input.profile || EMPTY_PROFILE;
	const declared = {short: 95, medium: 120, long: 150}[profile.movieLength] || 110;
	let ideal = Math.max(85, Math.min(150, habit.typicalMovieMinutes || declared));
	if (budget !== null) ideal = Math.min(ideal, budget - 5);
	const support = seedSupport(input, slot);
	const wanted = MOOD_GENRES[mood];
	const clashes = MOOD_CLASHES[mood];
	const exclude = input.exclude || new Set();
	const hidden = new Set((input.feedback && input.feedback.hidden) || []);
	const watched = input.watched || new Set();
	const rejections = input.rejections || {};
	const year = new Date(input.now).getFullYear();
	const rows = [];

	input.candidates.forEach((c) => {
		// Les règles d'abord : ce que la soirée ne peut pas tenir est écarté.
		if (exclude.has(c.key)) return;
		if (hidden.has(c.key) || (c.tmdbId && hidden.has(`${c.mediaType}:${c.tmdbId}`))) return;
		if (input.blockAdult !== false && c.adult) return;
		if (c.rewatch && mood !== 'comfort') return;
		const tk = c.tmdbId ? `${c.mediaType}:${c.tmdbId}` : null;
		if (!c.rewatch && !c.inProgress && tk && watched.has(tk)) return;
		if (!neutralMood && any(c.genres, clashes)) return;
		if (answers.company === 'family' && !familySafe(c, answers.kidsAge)) return;
		const runtime = c.runtimeMinutes;
		if (budget !== null && runtime) {
			if (c.mediaType === 'movie' && runtime > budget + 5) return;
			if (c.mediaType !== 'movie' && runtime > budget) return;
		}
		const taste = tasteFactorFor({genres: c.genres, mediaType: c.mediaType, language: c.language, year: c.year, voteCount: c.voteCount, profile, feedback: input.feedback, now: input.now});
		if (taste <= 0) return;
		let moodScore = 0;
		c.genres.forEach((g) => {
			moodScore += wanted[g] || 0;
		});
		moodScore = Math.min(moodScore, 1.5);
		if (!neutralMood && strictMood && STRICT_MOODS[mood] && moodScore <= 0 && !c.inProgress) return;
		if (mood === 'comfort') {
			if (c.rewatch) moodScore += 0.8;
			if (c.inProgress) moodScore += 0.5;
		}
		const seed = support[c.key] || (tk ? support[tk] : null);
		const fit = genreFit(habit, c.genres);
		let duration;
		if (c.mediaType === 'movie') {
			if (!runtime) duration = -0.4;
			else {
				duration = -Math.abs(runtime - ideal) / 45;
				if (answers.time === 'evening' && runtime >= 100) duration += 0.2;
			}
		} else {
			duration = answers.time === 'short' ? 0.3 : answers.time === 'evening' && c.inProgress ? 0.3 : 0;
		}
		let company = 0;
		if (answers.company === 'family') {
			company = (any(c.genres, FAMILY) ? 1 : 0) + (has(c.genres, 'comedy') || has(c.genres, 'adventure') ? 0.3 : 0);
		} else if (answers.company === 'couple') {
			company = Math.log(1 + (c.voteCount || 300)) / 8 + (has(c.genres, 'romance') ? 0.3 : 0);
		} else if (answers.company === 'friends') {
			company = any(c.genres, ['action', 'comedy', 'horror', 'thriller']) ? 0.6 : 0;
		}
		let quality = 0;
		if (c.rating > 0) {
			if (c.voteCount) quality = (c.voteCount * c.rating + 400 * 6.6) / (c.voteCount + 400) - 6.6;
			else quality = c.rating * 0.7 + 6.6 * 0.3 - 6.6;
		}
		const fresh = (c.freshlyAdded ? 1 : 0) + (c.year && c.year >= year - 1 ? 0.5 : 0);
		const movieShare = habit.movieShare;
		rows.push({
			candidate: c,
			taste,
			seedTitle: seed ? seed.title : null,
			raw: {
				taste: Math.log(taste),
				seed: Math.log(1 + (seed ? seed.support : 0)),
				habit: fit * conf,
				format: ((c.mediaType === 'movie' ? movieShare : 1 - movieShare) - 0.5) * conf + (c.mediaType === 'movie' ? 0 : seriesFit(profile.seriesFormat, c.seasonCount)),
				mood: neutralMood ? 0 : moodScore,
				duration,
				company,
				quality,
				fresh,
				resume: c.inProgress ? 1 : 0,
				novelty: -fit,
				rejected: -(rejections[c.key] || 0)
			},
			z: {},
			score: 0
		});
	});
	if (!rows.length) return rows;
	standardize(rows);
	const w = effectiveWeights(input, neutralMood);
	rows.forEach((r) => {
		r.score = FEATURES.reduce((s, f) => s + (w[f] || 0) * (r.z[f] || 0), 0);
	});
	rows.sort((a, b) => b.score - a.score);
	return rows;
};

// Ce que [row] répète de ce que [picks] proposent déjà.
const redundancy = (row, picks) => picks.reduce((penalty, pick) => {
	let p = penalty;
	const a = row.candidate.genres;
	const b = pick.candidate.genres;
	if (a.length && b.length) {
		const shared = a.filter((g) => b.indexOf(g) >= 0).length;
		const union = a.concat(b.filter((g) => a.indexOf(g) < 0)).length;
		p += 0.6 * shared / union;
	}
	if (row.seedTitle && row.seedTitle === pick.seedTitle) p += 0.6;
	if (row.candidate.inProgress && pick.candidate.inProgress) p += 0.4;
	return p;
}, 0);

const reasonFor = (row, w, slot) => {
	if (row.candidate.inProgress) return {kind: 'resume'};
	const part = (f) => (w[f] || 0) * (row.z[f] || 0);
	const options = [
		row.seedTitle ? ['because', part('seed') + 0.15] : null,
		['habit', part('habit')],
		['mood', part('mood')],
		['company', part('company')],
		['quality', part('quality')],
		['fresh', part('fresh')]
	].filter(Boolean).sort((a, b) => b[1] - a[1]);
	const kind = options[0][1] > 0 ? options[0][0] : 'mood';
	return {kind, seedTitle: row.seedTitle, slot};
};

const select = (ranked, input) => {
	const picks = [ranked[0]];
	const top = ranked.slice(0, 60);
	while (picks.length < PICK_COUNT - 1) {
		let best = null;
		let bestValue = -Infinity;
		top.forEach((row) => {
			if (picks.indexOf(row) >= 0) return;
			const value = row.score - redundancy(row, picks);
			if (value > bestValue) {
				bestValue = value;
				best = row;
			}
		});
		if (!best) break;
		picks.push(best);
	}
	// Le dernier : un titre bien noté hors des sentiers habituels.
	let joker = null;
	let jokerValue = -Infinity;
	ranked.forEach((row) => {
		if (picks.indexOf(row) >= 0 || row.taste < 0.85 || row.raw.quality < 0.3) return;
		const value = row.z.quality + 1.2 * row.z.novelty + 0.4 * row.z.mood + 0.3 * row.z.taste - Math.abs(row.z.rejected);
		if (value > jokerValue) {
			jokerValue = value;
			joker = row;
		}
	});
	if (joker) {
		picks.push(joker);
	} else {
		top.forEach((row) => {
			if (picks.length < PICK_COUNT && picks.indexOf(row) < 0) picks.push(row);
		});
	}
	const w = effectiveWeights(input, false);
	const slot = slotOf(input.now);
	return picks.map((row) => ({
		candidate: row.candidate,
		score: row.score,
		features: {...row.z},
		reason: row === joker ? {kind: 'joker'} : reasonFor(row, w, slot),
		isJoker: row === joker
	}));
};

export const rankTonight = (input) => {
	let scored = scoreCandidates(input, {strictMood: true});
	let relaxed = false;
	if (STRICT_MOODS[input.answers.mood] && scored.length < PICK_COUNT * 2) {
		const loose = scoreCandidates(input, {strictMood: false});
		if (loose.length > scored.length) {
			scored = loose;
			relaxed = true;
		}
	}
	if (!scored.length) return {picks: [], poolSize: 0, relaxedMood: false};
	return {picks: select(scored, input), poolSize: scored.length, relaxedMood: relaxed};
};
