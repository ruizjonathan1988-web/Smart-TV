// Replay des chaînes (ma_tv_replay.dart de l'APK). Ma TV tient le catalogue
// (Arte, France 2 à 5, enregistrements du fournisseur IPTV) ; la vidéo d'Arte
// et de France TV est demandée par la TV elle-même, depuis la France, au
// moment de la lire. Un épisode chiffré (DRM) ne se lit jamais ici.
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const TIMEOUT = 12000;

const getJson = async (url, timeoutMs = TIMEOUT) => {
	try {
		const res = await platformFetch(url, {method: 'GET'}, timeoutMs);
		if (!res || res.status !== 200) return null;
		return await res.json();
	} catch (e) {
		return null;
	}
};

// POST JSON ; renvoie le code HTTP (0 sans réponse).
const postJson = async (url, body) => {
	try {
		const res = await platformFetch(url, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(body)
		}, TIMEOUT);
		return res ? res.status : 0;
	} catch (e) {
		return 0;
	}
};

// ------------------------------------------------------------------ données

const num = (v) => {
	const n = typeof v === 'number' ? v : parseInt(v, 10);
	return isNaN(n) ? 0 : n;
};
const str = (v) => (v === undefined || v === null ? '' : String(v));

// ReplayItem.fromJson : aired / live_at en secondes, dur en secondes.
export const replayItem = (j) => ({
	id: str(j.id),
	kind: str(j.kind),
	chan: str(j.chan),
	show: str(j.show),
	title: str(j.title),
	aired: num(j.aired) || 0,
	dur: num(j.dur),
	desc: str(j.desc),
	img: str(j.img),
	page: str(j.page),
	season: num(j.season),
	episode: num(j.episode),
	featured: j.featured === true,
	followed: j.followed === true,
	isNew: j.new === true,
	liveAt: j.live_at ? num(j.live_at) : 0,
	genre: str(j.genre),
	badge: str(j.badge),
	poster: str(j.poster),
	kept: j.kept === true
});

const items = (list) => (Array.isArray(list) ? list : [])
	.filter((x) => x && typeof x === 'object')
	.map(replayItem);

const channelsOf = (list) => (Array.isArray(list) ? list : [])
	.filter((c) => c && typeof c === 'object')
	.map((c) => ({chan: str(c.chan), name: str(c.name || c.chan), count: num(c.count), fresh: num(c.new)}));

// ReplayPage.fromJson : la une, les rangées, nos chaînes, notre sélection.
export const replayPage = (j) => {
	if (!j || typeof j !== 'object') return null;
	return {
		hero: items(j.hero),
		selection: items(j.selection),
		categories: (Array.isArray(j.categories) ? j.categories : [])
			.map((c) => (c && c.genre ? str(c.genre) : ''))
			.filter(Boolean),
		rows: (Array.isArray(j.rows) ? j.rows : [])
			.filter((r) => r && typeof r === 'object')
			.map((r) => ({id: str(r.id), title: str(r.title), items: items(r.items), kind: str(r.kind), genre: str(r.genre)})),
		channels: channelsOf(j.chans)
	};
};

// ReplayChannelPage.fromJson : la soirée, une rangée par émission, puis jour par jour.
export const replayChannelPage = (j) => {
	if (!j || typeof j !== 'object') return null;
	return {
		chan: str(j.chan),
		name: str(j.name),
		prime: j.prime && typeof j.prime === 'object' ? replayItem(j.prime) : null,
		shows: (Array.isArray(j.shows) ? j.shows : [])
			.filter((s) => s && typeof s === 'object')
			.map((s) => ({show: str(s.show), followed: s.followed === true, items: items(s.items)})),
		days: (Array.isArray(j.days) ? j.days : [])
			.filter((d) => d && typeof d === 'object' && !isNaN(Date.parse(str(d.day))))
			.map((d) => ({day: str(d.day), items: items(d.items)}))
	};
};

// ------------------------------------------------------------------ libellés

const DAYS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const dateLabel = (d) => `${DAYS[d.getDay()]} ${d.getDate() === 1 ? '1er' : d.getDate()} ${MONTHS[d.getMonth()]}`;

// « Lun. 2 nov. », le jour de diffusion.
export const dayLabel = (item) => (item && item.aired ? dateLabel(new Date(item.aired * 1000)) : '');

// Ce que la carte dit sous l'émission : l'épisode, sinon le titre, sinon le jour.
export const subtitleOf = (item) => {
	if (item.season > 0 && item.episode > 0) return `S${item.season} · É${item.episode}${item.title ? ' · ' + item.title : ''}`;
	if (item.title && item.title !== item.show) return item.title;
	return dayLabel(item);
};

export const titleOf = (item) => (!item.title || item.title === item.show ? item.show : `${item.show} · ${item.title}`);

// « Aujourd'hui », « Hier », puis « Lun. 2 nov. » (ReplayDay.label).
export const dayGroupLabel = (isoDay, now = new Date()) => {
	const p = str(isoDay).split('-').map((x) => parseInt(x, 10));
	const d = p.length >= 3 ? new Date(p[0], p[1] - 1, p[2]) : new Date(isoDay);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const ago = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
	if (ago === 0) return 'Aujourd’hui';
	if (ago === 1) return 'Hier';
	return dateLabel(d);
};

// Première phrase d'un résumé (la « une » et Notre sélection).
export const firstSentence = (text) => {
	const s = str(text);
	const m = /^(.*?[.!?])\s/.exec(s);
	return m ? m[1] : s;
};

// Les noms de rangées de l'appli France TV.
export const rowLabel = (g) => ({
	'Séries & fictions': 'Les séries à ne pas rater',
	'Documentaires': 'Le meilleur du documentaire',
	'Cinéma': 'Films et téléfilms',
	'Enfants': 'Pour les enfants',
	'Société': 'Magazines et enquêtes',
	'Arts & spectacles': 'Arts et spectacles'
}[g] || g);

// La couleur de la pastille d'une catégorie, comme l'appli France TV.
export const genreColor = (g) => ({
	'Séries & fictions': '#8A4B57',
	'Documentaires': '#7A8236',
	'Cinéma': '#B03A3A',
	'Société': '#6E5A52',
	'Info': '#6B6B6B',
	'Arts & spectacles': '#C0602A',
	'Sport': '#2B3FD0',
	'Divertissement': '#9E3B7A',
	'Enfants': '#7A3FC0'
}[g] || '#555555');

// Clé de nom de chaîne, pour rapprocher replay et grille Ma TV (replayNameKey).
export const replayNameKey = (s) => {
	let k = str(s).toLowerCase().replace(/^\s*(fr|fra|france)\s*[:|]\s*/, '');
	k = k.replace(/[^a-z0-9]/g, '');
	return k.replace(/(uhd|fhd|hd|sd|4k)$/, '');
};

// L'épisode de la même émission diffusé juste après `e` dans `list`.
export const nextEpisode = (e, list) => {
	if (!e || !e.aired) return null;
	let best = null;
	(list || []).forEach((x) => {
		if (!x || x.id === e.id || x.show !== e.show || !x.aired || x.aired <= e.aired) return;
		if (!best || x.aired < best.aired) best = x;
	});
	return best;
};

// Logos des chaînes du replay, pris dans la grille Ma TV (replayLogos).
export const replayLogos = (channels, liveChannels) => {
	const byName = {};
	(liveChannels || []).forEach((c) => {
		const k = replayNameKey(c.name);
		if (c.logo && !(k in byName)) byName[k] = c.logo;
	});
	const out = {};
	(channels || []).forEach((c) => {
		const logo = byName[replayNameKey(c.name)] || byName[replayNameKey(c.chan)];
		if (logo) out[c.chan] = logo;
	});
	return out;
};

// Les chaînes du replay, en direct dans Ma TV (« En direct »), une par nom.
export const liveForReplay = (channels, liveChannels) => {
	const want = {};
	(channels || []).forEach((c) => {
		want[replayNameKey(c.name)] = true;
	});
	const seen = {};
	return (liveChannels || []).filter((c) => {
		const k = replayNameKey(c.name);
		if (!want[k] || seen[k]) return false;
		seen[k] = true;
		return true;
	});
};

// ------------------------------------------------------------------ client

export const createReplayClient = (maTvClient) => {
	const server = maTvClient.server;
	const user = maTvClient.user || '';
	const get = (path, query = {}) => getJson(maTvEndpoint(server, path, {...query, u: user}));
	const kidsQ = (kids) => (kids ? {kids: '1'} : {});

	return {
		page: async (kids = false) => replayPage(await get('/tv/api/replay/page', kidsQ(kids))),
		category: async (genre, kids = false) => {
			const j = await get('/tv/api/replay/category', {g: genre, ...kidsQ(kids)});
			return items(j && j.items);
		},
		channel: async (chan) => replayChannelPage(await get('/tv/api/replay/chan', {c: chan})),
		item: async (id) => {
			const j = await get('/tv/api/replay/item', {id});
			return j && typeof j === 'object' ? j : null;
		},
		search: async (text) => {
			const j = await get('/tv/api/replay/search', {q: text});
			return items(j && j.items);
		},
		// Suivre, masquer une émission, marquer vu (setPref de l'APK).
		setPref: async ({show, follow, hide, item, seen = false}) => {
			const body = {user};
			if (show !== undefined) body.show = show;
			if (follow !== undefined) body.follow = follow;
			if (hide !== undefined) body.hide = hide;
			if (item !== undefined) body.item = item;
			if (seen) body.seen = true;
			return (await postJson(maTvEndpoint(server, '/tv/api/replay/pref'), body)) === 200;
		},
		// « Garder les prochains épisodes » : ils iront dans la bibliothèque, sans pub.
		// Renvoie null si c'est fait, sinon le message d'erreur.
		setKeep: async (show, on) => {
			const status = await postJson(maTvEndpoint(server, '/tv/api/replay/keep'), {user, show, keep: on});
			if (status === 200) return null;
			if (status === 404) return 'Il faut Ma TV 3.72 sur la seedbox.';
			return status ? `Ma TV a répondu ${status}.` : 'Ma TV ne répond pas.';
		}
	};
};

// ------------------------------------------------------------------ lecture

// Arte : réglages du lecteur pour le programme ; la VF d'abord, puis la VO
// sous-titrée, puis n'importe quelle version.
export const pickArteStream = (json) => {
	const streams = (((json || {}).data || {}).attributes || {}).streams;
	const list = Array.isArray(streams) ? streams : [];
	const labelOf = (s) => {
		const v = Array.isArray(s.versions) && s.versions.length ? s.versions[0] : {};
		return str(v.shortLabel || v.label).toUpperCase();
	};
	const pick = (ok) => {
		for (let i = 0; i < list.length; i++) {
			const s = list[i];
			if (s && typeof s === 'object' && ok(labelOf(s))) return str(s.url);
		}
		return null;
	};
	return pick((l) => l === 'VF' || l.indexOf('VF ') === 0) ||
		pick((l) => l.indexOf('VOSTF') >= 0 || l.indexOf('STF') >= 0) ||
		pick(() => true);
};

const ENCRYPTED = 'chiffré';

const arteUrl = async (ref) => pickArteStream(await getJson(`https://api.arte.tv/api/player/v2/config/fr/${encodeURIComponent(ref)}`));

const ftvUrl = async (ref) => {
	const q = 'country_code=FR&capabilities=drm&os=androidtv&diffusion_mode=tunnel_first&offline=false';
	const info = await getJson(`https://k7.ftven.fr/videos/${encodeURIComponent(ref)}?${q}`);
	const video = info && info.video;
	if (!video || typeof video !== 'object') return null;
	if (video.drm === true) throw new Error(ENCRYPTED);
	const url = str(video.url);
	if (!url) return null;
	const signed = await getJson(`https://hdfauth.ftven.fr/esi/TA?format=json&url=${encodeURIComponent(url)}`);
	return signed ? str(signed.url) : null;
};

// L'enregistrement de la diffusion par le fournisseur IPTV, si son rattrapage
// de la chaîne remonte assez loin (ReplaySources.iptv).
export const findIptvRecording = (item, allChannels, nowSec = Math.floor(Date.now() / 1000)) => {
	if (!item || item.kind !== 'iptv' || !item.aired) return null;
	const key = replayNameKey(item.chan);
	const days = (nowSec - item.aired) / 86400;
	const list = allChannels || [];
	for (let i = 0; i < list.length; i++) {
		const c = list[i];
		const same = c.id === item.chan || replayNameKey(c.name) === key;
		const arc = num(c.arc);
		if (same && arc > 0 && days <= arc) return c;
	}
	return null;
};

// Épisode de la bibliothèque Jellyfin (par numéros, sinon par jour de
// diffusion), ou la série quand l'épisode n'y est pas (ReplaySources.library).
export const findInLibrary = async (item, jellyfin) => {
	if (!jellyfin || !item.show) return null;
	const fold = (s) => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
	try {
		const found = await jellyfin.getItems({SearchTerm: item.show, IncludeItemTypes: 'Series', Recursive: true, Limit: 6});
		const want = fold(item.show);
		const series = ((found && found.Items) || []).filter((x) => fold(x.Name) === want);
		if (!series.length) return null;
		const eps = await jellyfin.getItems({
			ParentId: series[0].Id, IncludeItemTypes: 'Episode', Recursive: true,
			Fields: 'PremiereDate', SortBy: 'PremiereDate', SortOrder: 'Descending', Limit: 300
		});
		const aired = item.aired ? new Date(item.aired * 1000) : null;
		const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
		const list = (eps && eps.Items) || [];
		for (let i = 0; i < list.length; i++) {
			const x = list[i];
			const byNumber = item.season > 0 && item.episode > 0 && x.ParentIndexNumber === item.season && x.IndexNumber === item.episode;
			const premiere = x.PremiereDate ? new Date(x.PremiereDate) : null;
			const byDay = aired && premiere && !isNaN(premiere) && sameDay(premiere, aired);
			if (byNumber || byDay) return {item: x, episode: true};
		}
		return {item: series[0], episode: false};
	} catch (e) {
		return null;
	}
};

// Comment lire un épisode (playReplay de l'APK) :
//   {type: 'library', item}  l'épisode est dans Jellyfin (sans pub, gardé) ;
//   {type: 'stream', url, adSkip}  un flux que le lecteur de la TV lit ;
//   {type: 'none', message}  rien de lisible ici.
export const resolveReplay = async (item, {replay, maTv, jellyfin}) => {
	const lib = jellyfin ? await Promise.race([
		findInLibrary(item, jellyfin),
		new Promise((resolve) => setTimeout(() => resolve(null), 3000))
	]) : null;
	if (lib && lib.episode) return {type: 'library', item: lib.item};

	const recording = async () => {
		const all = await maTv.allChannels();
		const ch = findIptvRecording(item, all && all.chans);
		if (!ch) return null;
		const len = item.dur > 0 ? item.dur : 3600;
		return maTv.replayUrl(ch, item.aired * 1000, (item.aired + len) * 1000);
	};

	if (item.kind === 'iptv') {
		const url = await recording();
		if (url) return {type: 'stream', url, adSkip: true};
		return {type: 'none', message: 'Ton fournisseur ne garde plus cette émission.'};
	}

	let reason = 'illisible ici';
	try {
		const meta = await replay.item(item.id);
		const ref = meta ? str(meta.ref) : '';
		let url = null;
		if (ref && item.kind === 'arte') url = await arteUrl(ref);
		else if (ref && item.kind === 'ftv') url = await ftvUrl(ref);
		if (url) return {type: 'stream', url};
	} catch (e) {
		if (e && e.message === ENCRYPTED) reason = ENCRYPTED;
	}
	const recorded = await recording();
	if (recorded) {
		return {
			type: 'stream', url: recorded, adSkip: true,
			notice: 'Le replay de la chaîne ne se lit pas ici : la diffusion enregistrée par ton fournisseur prend le relais.'
		};
	}
	return {
		type: 'none',
		message: reason === ENCRYPTED
			? 'Cet épisode est protégé : regarde-le dans l’appli de la chaîne.'
			: 'Lecture impossible ici : regarde-le dans l’appli de la chaîne.'
	};
};
