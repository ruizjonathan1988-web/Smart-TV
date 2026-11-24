// « Autres sources » d'un épisode du replay (ReplaySources de l'APK, ma_tv_replay.dart) : les
// façons de le regarder, la meilleure étant déjà choisie par « Regarder ». Et la VOD du
// fournisseur, qui prend le relais d'un épisode IPTV dont l'enregistrement n'est plus gardé.
import {findInLibrary, findIptvRecording} from './maTvReplay';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// La série du fournisseur qui porte exactement le nom de l'émission (ReplaySources.vod).
export const findProviderSeries = async (item, vod) => {
	if (!vod || !item || !item.show) return null;
	try {
		const want = fold(item.show);
		const found = await vod.search(item.show, 8);
		return (found || []).find((t) => t.kind === 'series' && fold(t.name) === want) || null;
	} catch (e) {
		return null;
	}
};

// L'adresse de l'enregistrement de la diffusion par le fournisseur IPTV, ou null.
export const recordingUrl = async (item, maTv) => {
	if (!maTv || !item || item.kind !== 'iptv') return null;
	try {
		const all = await maTv.allChannels();
		const ch = findIptvRecording(item, all && all.chans);
		if (!ch) return null;
		const len = item.dur > 0 ? item.dur : 3600;
		return maTv.replayUrl(ch, item.aired * 1000, (item.aired + len) * 1000);
	} catch (e) {
		return null;
	}
};

// La liste, dans l'ordre de l'APK. L'appli de la chaîne n'y est pas : la TV ne sait pas
// l'ouvrir. La voie Seerr a son propre bouton sur la fiche.
export const replaySourceList = (item, {chanName = '', lib = null, vodSeries = null, recording = null} = {}) => {
	const name = chanName || item.chan;
	const iptv = item.kind === 'iptv';
	return [
		...(lib ? [{
			kind: 'library',
			name: lib.episode ? 'Dans ta bibliothèque' : 'La série est dans ta bibliothèque',
			detail: lib.episode ? 'Sans pub · gardé · reprise sur tous tes appareils' : 'Cet épisode n’y est peut-être pas',
			target: lib.item
		}] : []),
		...(vodSeries ? [{kind: 'vod', name: 'VOD de ton fournisseur', detail: 'Sans pub · la série, épisode à choisir', target: vodSeries}] : []),
		...(!iptv ? [{kind: 'vjod', name: `Replay ${name} dans VJOD`, detail: 'Sans pub · lecteur VJOD'}] : []),
		...(recording ? [{kind: 'iptv', name: `Replay IPTV de ${name}`, tag: 'avec pub', detail: 'Diffusion d’origine · « Passer la pub » saute 3 min', target: recording}] : []),
		{kind: 'tracker', name: 'Chercher sur mes trackers', tag: 'à garder', detail: 'Prowlarr · tu choisis la version, rien ne part sans ton appui'}
	];
};

// Les sources d'un épisode, cherchées en même temps.
export const loadReplaySources = async (item, {chanName, jellyfin, vod, maTv}) => {
	const [lib, vodSeries, recording] = await Promise.all([
		jellyfin ? findInLibrary(item, jellyfin).catch(() => null) : null,
		findProviderSeries(item, vod),
		recordingUrl(item, maTv)
	]);
	return replaySourceList(item, {chanName, lib, vodSeries, recording});
};
