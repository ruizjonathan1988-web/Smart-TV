// Les sources d'une chaîne Ma TV (tv_sources.dart de l'APK). Chaque chaîne de
// la grille repose sur plusieurs flux de fournisseurs ; le relais de la
// seedbox passe de l'un à l'autre sous l'image, sans rien rouvrir.
//   GET  /tv/api/channel?num=1&u=&caps=   → {id, num, name, sources: [...]}
//   POST /tv/api/prefer {id, src, sticky, user, caps}  → même réponse
// Tout échoue en silence (null) : le lecteur continue sans la seedbox.
import {maTvEndpoint} from './maTvApi';
import {platformFetch} from './secureFetch';

const TIMEOUT = 6000;

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v) => (v === undefined || v === null ? '' : String(v));

// TvSource.fromJson
export const parseSource = (j) => ({
	key: str(j.k),
	rank: num(j.n) || 0,
	provider: str(j.provider),
	streamName: str(j.name),
	quality: str(j.quality),
	height: num(j.h),
	fps: num(j.fps),
	kbps: num(j.kbps),
	openMs: num(j.ms),
	codec: j.codec ? str(j.codec) : null,
	ok: typeof j.ok === 'boolean' ? j.ok : null,
	chosen: j.pref === true,
	sticky: j.sticky === true,
	playing: j.playing === true,
	fluidity: num(j.flu),
	liveMinutes: num(j.live_min),
	liveCuts: num(j.live_cuts),
	keyMs: num(j.key_ms),
	server: str(j.server),
	duplicate: j.dup === true,
	takenElsewhere: j.taken === true
});

// TvChannelSources.fromJson
export const parseChannelSources = (j) => {
	if (!j || typeof j !== 'object') return null;
	return {
		id: str(j.id),
		number: num(j.num) || 0,
		name: str(j.name),
		sources: (Array.isArray(j.sources) ? j.sources : []).filter((s) => s && typeof s === 'object').map(parseSource)
	};
};

// La source qui alimente le flux, sinon celle qu'ouvrirait un réglage.
export const currentSource = (data) => {
	if (!data || !data.sources.length) return null;
	return data.sources.find((s) => s.playing) || data.sources[0];
};

export const hasChoice = (data) => Boolean(data && data.sources.some((s) => s.chosen));

// « 1080p », ou la qualité annoncée par le fournisseur quand rien n'est mesuré.
export const resolutionLabel = (s) => {
	if (s.height && s.height > 0) return s.height >= 2000 ? '4K' : `${s.height}p`;
	return s.quality === 'ND' ? '' : s.quality;
};

const decimal = (v) => v.toFixed(1).replace('.', ',');

// « 1080p · 50 i/s · 6,2 Mb/s · 0,8 s », les mesures qui font le rang.
export const sourceDetails = (s) => {
	const parts = [];
	const res = resolutionLabel(s);
	if (res) parts.push(res);
	if (s.fps > 0) parts.push(`${Math.round(s.fps)} i/s`);
	if (s.kbps > 0) parts.push(`${decimal(s.kbps / 1000)} Mb/s`);
	if (s.openMs > 0) parts.push(`${decimal(s.openMs / 1000)} s`);
	if (s.keyMs > 0) parts.push(`image nette ${decimal(s.keyMs / 1000)} s`);
	if (s.fluidity !== null && s.fluidity !== undefined) parts.push(`fluidité ${s.fluidity}`);
	if (s.liveMinutes >= 2) {
		const cuts = s.liveCuts || 0;
		parts.push(cuts === 0 ? 'sans coupure en vrai' : `${cuts} coupure${cuts > 1 ? 's' : ''} en ${Math.round(s.liveMinutes)} min`);
	}
	return parts.join(' · ');
};

// Les pastilles d'une ligne du panneau (null = « Automatique »).
export const sourceBadges = (s, data) => {
	if (!s) return hasChoice(data) ? [] : [{label: 'actif', tone: 'good'}];
	const out = [];
	if (s.playing) out.push({label: 'en lecture', tone: 'good'});
	if (s.sticky) out.push({label: 'toujours', tone: 'accent'});
	else if (s.chosen) out.push({label: 'choisie', tone: 'accent'});
	if (s.ok === false) out.push({label: 'en panne', tone: 'bad'});
	if (s.takenElsewhere) out.push({label: 'occupée ailleurs', tone: 'mute'});
	if (s.ok === null) out.push({label: 'pas testée', tone: 'mute'});
	return out;
};

// Une source par vrai serveur d'abord ; les autres tomberaient avec elle.
export const visibleSources = (data, showAll) => {
	const all = (data && data.sources) || [];
	return showAll ? all : all.filter((s) => !s.duplicate);
};

// Après des saccades : la prochaine source à essayer, même image ou plus légère
// d'abord (c'est peut-être la connexion qui manque), dans l'ordre du relais.
// `stalled` : les clés déjà essayées sans succès sur cette chaîne.
export const pickAfterStalls = (data, stalled = []) => {
	const cur = currentSource(data);
	const weight = (x) => (x.kbps > 0 ? x.kbps : (x.height > 0 ? x.height * 6 : 4000));
	const curWeight = cur ? weight(cur) : Infinity;
	const rest = data.sources.filter((x) => (!cur || x.key !== cur.key) && x.ok !== false && !x.duplicate && !x.takenElsewhere && !stalled.includes(x.key));
	if (!rest.length) return null;
	const lighter = rest.filter((x) => weight(x) <= curWeight);
	return lighter.length ? lighter[0] : rest[0];
};

const who = (client) => {
	const q = {};
	if (client.user) q.u = client.user;
	if (client.caps) q.caps = client.caps;
	return q;
};

export const fetchChannelSources = async (client, number) => {
	if (!client || !client.server || !number) return null;
	try {
		const res = await platformFetch(maTvEndpoint(client.server, '/tv/api/channel', {num: String(number), ...who(client)}), {method: 'GET'}, TIMEOUT);
		if (!res || res.status !== 200) return null;
		return parseChannelSources(await res.json());
	} catch (e) {
		return null;
	}
};

// `sourceKey` null : retour à l'automatique. `sticky` : gardée jusqu'à nouvel
// ordre, sinon pour quelques heures.
export const preferSource = async (client, channelId, sourceKey, sticky = false) => {
	if (!client || !client.server || !channelId) return null;
	const body = {id: channelId, src: sourceKey || '', sticky: Boolean(sticky)};
	if (client.user) body.user = client.user;
	if (client.caps) body.caps = client.caps;
	try {
		const res = await platformFetch(maTvEndpoint(client.server, '/tv/api/prefer'), {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(body)
		}, TIMEOUT);
		if (!res || res.status !== 200) return null;
		return parseChannelSources(await res.json());
	} catch (e) {
		return null;
	}
};
