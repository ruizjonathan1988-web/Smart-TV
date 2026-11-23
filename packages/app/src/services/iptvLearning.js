// Ce qu'un film ou un épisode du fournisseur IPTV apprend à VJOD une fois
// arrêté (iptv_learning.dart) : une séance au journal du soir, que l'accueil
// et « Ce soir » lisent comme pour un film de la bibliothèque. Tout échoue
// sans bruit.
import * as seerrApi from './seerrApi';
import {loadTonight, recordSitting} from './tonight/tonightService';
import {genresFromNames} from './tonight/tonightModels';

const facts = {};

const tmdbFacts = (mediaType, tmdbId) => {
	const k = `${mediaType}:${tmdbId}`;
	if (!facts[k]) {
		facts[k] = (mediaType === 'tv' ? seerrApi.getTv(tmdbId) : seerrApi.getMovie(tmdbId))
			.then((d) => ({
				genres: genresFromNames(((d && d.genres) || []).map((g) => g.name)),
				year: parseInt(String((d && (d.firstAirDate || d.releaseDate)) || '').split('-')[0], 10) || null,
				rating: (d && d.voteAverage) || null
			}))
			.catch(() => {
				delete facts[k];
				return {genres: [], year: null, rating: null};
			});
	}
	return facts[k];
};

// Vu jusqu'au générique, comme Ma TV le décide.
export const iptvFinished = (episode, posMs, durMs) => {
	if (!(durMs > 0)) return false;
	const left = durMs - posMs;
	const ratio = posMs / durMs;
	return episode ? ratio >= 0.85 || left <= 3 * 60000 : ratio >= 0.9 || left <= 8 * 60000;
};

// Une lecture de watch commencée à startedAt, arrêtée à posMs sur durMs, dont
// watchedMs ont vraiment été regardées.
export const recordIptvSitting = async ({watch, startedAt, posMs, durMs, watchedMs}) => {
	if (!watch || watchedMs < 60000) return;
	const series = watch.kind === 'series';
	const mediaType = series ? 'tv' : 'movie';
	const tmdb = parseInt(watch.tmdb, 10) || null;
	try {
		const f = tmdb ? await tmdbFacts(mediaType, tmdb) : {genres: [], year: null, rating: null};
		await loadTonight();
		recordSitting({
			at: startedAt,
			// La même clé qu'un titre vienne de la bibliothèque ou du fournisseur.
			itemId: tmdb ? `tmdb:${mediaType}:${tmdb}` : `iptv:${watch.kind}:${watch.id}`,
			mediaType,
			title: watch.name || '',
			tmdbId: tmdb,
			genres: f.genres,
			runtimeMinutes: durMs > 0 ? Math.round(durMs / 60000) : null,
			year: f.year,
			rating: f.rating,
			watchedMinutes: Math.round(watchedMs / 60000),
			finished: iptvFinished(series, posMs, durMs)
		});
	} catch (e) {
		// Le journal est un plus.
	}
};
