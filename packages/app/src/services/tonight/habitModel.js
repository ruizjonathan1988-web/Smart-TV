// Habitudes (habit_model.dart de l'APK) : quels genres ont tenu, films ou
// séries, la longueur habituelle d'un film, qui était là ; par créneau, par
// compagnie et par appareil, chacun s'appuyant sur le plus large quand il en
// sait peu.
import {outcomeOf, entrySlot} from './eveningJournal';

const EMPTY = {weight: 0, genreShare: {}, dropShare: {}, movieShare: 0.5, typicalMovieMinutes: null, companyShare: {}};
export const EMPTY_PROFILE = EMPTY;

export const confidence = (p, prior = 6) => p.weight / (p.weight + prior);

const mixMaps = (a, b, own) => {
	const out = {};
	Object.keys(a).concat(Object.keys(b)).forEach((k) => {
		out[k] = (a[k] || 0) * own + (b[k] || 0) * (1 - own);
	});
	return out;
};

// Ce profil, tiré vers `other` là où il sait peu (`other` vaut `prior` séances).
export const blend = (p, other, prior = 6) => {
	const own = p.weight / (p.weight + prior);
	if (own >= 1) return p;
	let minutes;
	if (p.typicalMovieMinutes === null) minutes = other.typicalMovieMinutes;
	else if (other.typicalMovieMinutes === null) minutes = p.typicalMovieMinutes;
	else minutes = p.typicalMovieMinutes * own + other.typicalMovieMinutes * (1 - own);
	return {
		weight: p.weight,
		genreShare: mixMaps(p.genreShare, other.genreShare, own),
		dropShare: mixMaps(p.dropShare, other.dropShare, own),
		movieShare: p.movieShare * own + other.movieShare * (1 - own),
		typicalMovieMinutes: minutes,
		companyShare: mixMaps(p.companyShare, other.companyShare, own)
	};
};

// À quel point ces genres collent à ce qui a été vu jusqu'au bout, moins une part de ce qui a été lâché.
export const genreFit = (p, genres) => {
	if (!genres.length) return 0;
	let fit = 0;
	let drop = 0;
	genres.forEach((g) => {
		fit += p.genreShare[g] || 0;
		drop += p.dropShare[g] || 0;
	});
	return fit - 0.5 * drop;
};

export const usualCompany = (p) => {
	const keys = Object.keys(p.companyShare);
	if (!keys.length) return null;
	const best = keys.reduce((a, b) => (p.companyShare[a] >= p.companyShare[b] ? a : b));
	return p.companyShare[best] >= 0.5 ? best : null;
};

const normalize = (map) => {
	const sum = Object.keys(map).reduce((s, k) => s + map[k], 0);
	if (sum <= 0) return {};
	const out = {};
	Object.keys(map).forEach((k) => {
		out[k] = map[k] / sum;
	});
	return out;
};

export const profileFrom = (entries, now) => {
	let weight = 0;
	let movies = 0;
	let total = 0;
	let companyTotal = 0;
	const liked = {};
	const dropped = {};
	const companies = {};
	const runtimes = [];
	entries.forEach((e) => {
		const age = (now - e.at) / 86400000;
		// Les goûts évoluent : une séance de trois mois compte moitié.
		const w = Math.pow(0.5, Math.max(0, age) / 90);
		weight += w;
		total += w;
		if (e.mediaType === 'movie') movies += w;
		if (e.company) {
			companies[e.company] = (companies[e.company] || 0) + w;
			companyTotal += w;
		}
		const outcome = outcomeOf(e);
		const genres = e.genres || [];
		if (genres.length) {
			const share = w / genres.length;
			genres.forEach((g) => {
				if (outcome > 0) liked[g] = (liked[g] || 0) + share * outcome;
				else dropped[g] = (dropped[g] || 0) + share * -outcome;
			});
		}
		if (e.mediaType === 'movie' && outcome > 0 && e.runtimeMinutes > 0) runtimes.push({minutes: e.runtimeMinutes, weight: w});
	});
	let median = null;
	if (runtimes.length) {
		runtimes.sort((a, b) => a.minutes - b.minutes);
		const half = runtimes.reduce((s, r) => s + r.weight, 0) / 2;
		let run = 0;
		for (let i = 0; i < runtimes.length; i++) {
			run += runtimes[i].weight;
			if (run >= half) {
				median = runtimes[i].minutes;
				break;
			}
		}
		if (median === null) median = runtimes[runtimes.length - 1].minutes;
	}
	const companyShare = {};
	if (companyTotal > 0) {
		Object.keys(companies).forEach((k) => {
			companyShare[k] = companies[k] / companyTotal;
		});
	}
	return {
		weight,
		genreShare: normalize(liked),
		dropShare: normalize(dropped),
		movieShare: total > 0 ? movies / total : 0.5,
		typicalMovieMinutes: median,
		companyShare
	};
};

export const buildHabits = (entries, now = Date.now()) => {
	const list = entries.filter((e) => e.at <= now);
	const group = (keyOf) => {
		const groups = {};
		list.forEach((e) => {
			const k = keyOf(e);
			if (!k) return;
			(groups[k] = groups[k] || []).push(e);
		});
		const out = {};
		Object.keys(groups).forEach((k) => {
			out[k] = profileFrom(groups[k], now);
		});
		return out;
	};
	return {
		global: profileFrom(list, now),
		bySlot: group((e) => entrySlot(e).key),
		byBand: group((e) => entrySlot(e).band),
		byCompany: group((e) => e.company),
		byDevice: group((e) => e.device)
	};
};

// Les habitudes d'une soirée : celles du créneau, appuyées sur le moment de
// la journée puis sur tout, puis infléchies par qui est là.
export const habitsFor = (model, {slot, company, device}) => {
	const band = blend(model.byBand[slot.band] || EMPTY, model.global);
	let profile = blend(model.bySlot[slot.key] || EMPTY, band);
	if (company) {
		const withCompany = model.byCompany[company];
		if (withCompany && withCompany.weight > 0) profile = blend(withCompany, profile, 4);
	} else if (device) {
		const onDevice = model.byDevice[device];
		if (onDevice && onDevice.weight > 0) profile = blend(profile, onDevice, 12);
	}
	return profile;
};

// Qui est d'habitude là sur ce créneau et cet appareil, pour présélectionner.
export const suggestCompany = (model, slot, device) => {
	const inSlot = model.bySlot[slot.key];
	if (inSlot && inSlot.weight >= 3 && usualCompany(inSlot)) return usualCompany(inSlot);
	const onDevice = device ? model.byDevice[device] : null;
	if (onDevice && onDevice.weight >= 3 && usualCompany(onDevice)) return usualCompany(onDevice);
	return null;
};
