// La version « qui passe partout » d'un film IPTV (iptv_cast.dart de l'APK,
// /tv/api/cast, Ma TV 3.53 et plus). Le relais de la seedbox prépare à la
// volée un flux HLS en H.264 et AAC, que tout lecteur sait lire. L'APK s'en
// sert pour la Chromecast et pour Safari ; la TV le demande quand son lecteur
// refuse un fichier du fournisseur (MKV en HEVC, son DTS ou AC3…).
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const extOf = (file) => {
	const dot = file.lastIndexOf('.');
	return dot < 0 ? '' : file.substring(dot + 1).toLowerCase();
};

// IptvCastRequest.fromPlayUrl, plus le serveur Ma TV lu dans l'adresse :
//   …/tv/xc/<movie|series>/<user>/<clé>/<id>.<ext>?q=&src=
//   …/tv/replay/<chaîne>.ts?start=&dur=&k=     …/tv/rec/<id>.ts?k=
export const relayRequestFromUrl = (playUrl) => {
	let u;
	try {
		u = new URL(playUrl);
	} catch (e) {
		return null;
	}
	const at = u.pathname.indexOf('/tv/');
	if (at < 0) return null;
	const base = `${u.origin}${u.pathname.substring(0, at)}`;
	const parts = u.pathname.substring(at + 4).split('/').filter(Boolean);
	const q = u.searchParams;
	if ((parts[0] === 'replay' || parts[0] === 'rec') && parts.length === 2) {
		const rid = parts[1].replace(/\.ts$/, '');
		const key = q.get('k');
		if (!rid || !key) return null;
		if (parts[0] === 'replay' && (!q.get('start') || !q.get('dur'))) return null;
		const rq = {kind: parts[0], id: rid, ext: 'ts'};
		if (parts[0] === 'replay') {
			rq.at = q.get('start');
			rq.dur = q.get('dur');
			if (q.get('caps')) rq.caps = q.get('caps');
		}
		return {server: {url: base, key}, query: rq};
	}
	if (parts[0] !== 'xc' || parts.length < 5) return null;
	const kind = parts[1];
	if (kind !== 'movie' && kind !== 'series') return null;
	const file = parts[parts.length - 1];
	const ext = extOf(file);
	const id = ext ? file.substring(0, file.length - ext.length - 1) : file;
	if (!id) return null;
	const query = {kind, id};
	if (ext) query.ext = ext;
	if (q.get('q')) query.q = q.get('q');
	if (q.get('src')) query.src = q.get('src');
	return {server: {url: base, key: parts[parts.length - 2]}, query};
};

// castSourceFromMaTv : {url, offsetMs} ; {error} quand Ma TV explique ; null
// quand la réponse ne se lit pas.
export const relaySourceFromAnswer = (status, json) => {
	if (!json || typeof json !== 'object') return null;
	const error = json.error ? String(json.error) : '';
	if (status !== 200) return error ? {error: `Ma TV : ${error[0].toUpperCase()}${error.substring(1)}.`} : null;
	const url = json.url ? String(json.url) : '';
	if (!/^https:\/\/[^/]+/.test(url)) return null;
	const offset = typeof json.offset === 'number' ? json.offset : 0;
	return {url, offsetMs: Math.round(offset * 1000)};
};

const FAILED = {error: 'Ma TV n’a pas pu préparer de version lisible. Réessaie dans un moment.'};

// Demande le flux au relais, à partir de `startMs` (5 s avant, passé la
// première minute, comme relayQuery). null : Ma TV trop ancienne (404).
export const askMaTvRelay = async (request, {startMs = 0, title = ''} = {}) => {
	if (!request) return FAILED;
	const query = {...request.query};
	if (startMs > 60000) query.start = String(Math.floor(startMs / 1000) - 5);
	if (title) query.title = title;
	try {
		// Ma TV regarde le fichier : quelques secondes, jusqu'à 45 si la source traîne.
		const res = await platformFetch(maTvEndpoint(request.server, '/tv/api/cast', query), {method: 'GET'}, 60000);
		if (!res) return FAILED;
		if (res.status === 404) return null;
		let json = null;
		try {
			json = await res.json();
		} catch (e) {
			json = null;
		}
		return relaySourceFromAnswer(res.status, json) || FAILED;
	} catch (e) {
		return FAILED;
	}
};

// relayStopUri : …/tv/cast/<jeton>/index.m3u8 → …/tv/cast/<jeton>/stop
export const relayStopUrl = (hlsUrl) => {
	if (!hlsUrl || hlsUrl.indexOf('/tv/cast/') < 0) return null;
	const noQuery = hlsUrl.split('?')[0];
	return noQuery.replace(/\/[^/]*$/, '/stop');
};

// Dit à Ma TV d'arrêter la préparation tout de suite. N'échoue jamais.
export const stopMaTvRelay = (hlsUrl) => {
	const stop = relayStopUrl(hlsUrl);
	if (!stop) return;
	platformFetch(stop, {method: 'GET'}, 5000).catch(() => {});
};
