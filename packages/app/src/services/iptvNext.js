// Enchaîner les épisodes d'une série lue chez le fournisseur (iptv_next.dart) :
// l'épisode d'après, et la durée du générique de cette série, apprise des
// corrections du spectateur (un fichier du fournisseur n'a pas de chapitres).
import {getFromStorage, saveToStorage} from './storage';

// L'épisode après season / number (ou celui dont l'id est id), dans l'ordre des
// saisons ; null après le dernier ou quand on ne le trouve pas.
export const episodeAfter = (info, {season, number, id = ''}) => {
	const seasons = (info && info.seasons) || {};
	const all = Object.keys(seasons).map(Number).sort((a, b) => a - b).reduce((acc, s) => acc.concat(seasons[s] || []), []);
	let i = id ? all.findIndex((e) => String(e.id) === String(id)) : -1;
	if (i < 0) i = all.findIndex((e) => e.season === season && e.number === number);
	if (i < 0 || i + 1 >= all.length) return null;
	return all[i + 1];
};

// « Passer le générique » saute 1 min 25 d'abord ; quand le spectateur corrige
// juste après (quelques secondes en arrière ou en avant), la bonne durée est
// gardée pour les épisodes suivants.
export const INTRO_DEFAULT_MS = 85000;
const MIN_MS = 15000;
const MAX_MS = 4 * 60000;
const key = (seriesId) => `vjod_iptv_intro_${seriesId}`;

export const introLengthFor = async (seriesId) => {
	try {
		const s = await getFromStorage(key(seriesId));
		if (typeof s === 'number' && s > 0) return s * 1000;
	} catch (e) {
		// La durée par défaut.
	}
	return INTRO_DEFAULT_MS;
};

// La durée à garder après un saut puis une correction ; null quand elle n'a pas de sens.
export const correctedIntro = (jumpedFromMs, landedAtMs) => {
	const len = landedAtMs - jumpedFromMs;
	return len < MIN_MS || len > MAX_MS ? null : len;
};

export const rememberIntro = (seriesId, lengthMs) => saveToStorage(key(seriesId), Math.round(lengthMs / 1000)).catch(() => {});
