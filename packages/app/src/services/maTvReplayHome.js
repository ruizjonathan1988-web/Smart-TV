// « Mes émissions » (MaTvReplayMineScreen de l'APK) et la rangée Replay de l'accueil
// (home_view_model.dart, _loadReplayRowOrFail) : GET /tv/api/replay/home de Ma TV.
import {maTvEndpoint} from './maTvApi';
import {replayItem, replayLogos} from './maTvReplay';
import {platformFetch} from './secureFetch';
import {readSnapshot, writeSnapshot} from './vjodSnapshots';

const num = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : parseInt(v, 10) || 0);
const items = (list) => (Array.isArray(list) ? list : []).filter((x) => x && typeof x === 'object').map(replayItem);

// ReplayHome.fromJson
export const replayHome = (j) => {
	if (!j || typeof j !== 'object') return null;
	return {
		mine: items(j.mine),
		mineNew: num(j.mine_new),
		channels: (Array.isArray(j.chans) ? j.chans : []).filter((c) => c && typeof c === 'object')
			.map((c) => ({chan: String(c.chan || ''), name: String(c.name || c.chan || ''), fresh: num(c.new), count: num(c.count)})),
		featured: items(j.featured),
		suggest: items(j.suggest)
	};
};

const SNAP = (user) => `replay:home:${user || ''}`;

// La réponse de Ma TV (gardée pour s'afficher tout de suite la prochaine fois), ou null.
export const fetchReplayHome = async (maTv) => {
	if (!maTv || !maTv.server) return null;
	try {
		const res = await platformFetch(maTvEndpoint(maTv.server, '/tv/api/replay/home', {u: maTv.user || ''}), {method: 'GET'}, 15000);
		if (!res || res.status !== 200) return null;
		const raw = await res.json();
		if (raw && typeof raw === 'object') writeSnapshot(SNAP(maTv.user), [raw]);
		return replayHome(raw);
	} catch (e) {
		return null;
	}
};

// La dernière réponse gardée (homeSaved).
export const savedReplayHome = async (maTv) => {
	if (!maTv) return null;
	const snap = await readSnapshot(SNAP(maTv.user)).catch(() => null);
	return snap && snap[0] ? replayHome(snap[0]) : null;
};

const fresh = (n) => `${n} nouveau${n > 1 ? 'x' : ''}`;

// Les trois premières émissions suivies, pour la carte « Mes émissions ».
export const mineNames = (home) => [...new Set(home.mine.map((e) => e.show))].slice(0, 3).join(', ');

// Ce que dit la carte « Mes émissions » (_replayTile de l'APK).
export const mineCardText = (home) => {
	const names = mineNames(home);
	if (home.mineNew > 0) return `${home.mineNew} nouveau${home.mineNew > 1 ? 'x' : ''} épisode${home.mineNew > 1 ? 's' : ''}`;
	return names ? 'Rien de nouveau' : 'Suis tes émissions';
};

// Ce que dit la carte d'une chaîne : « 2 nouveaux », sinon « 14 en replay ».
export const channelCardText = (c) => (c.fresh > 0 ? fresh(c.fresh) : `${c.count} en replay`);

// La rangée « Replay » de l'accueil : « Mes émissions » puis chaque chaîne qui a du replay.
export const replayRowCards = (home, logos = {}) => {
	const mineImage = home.mine.length ? home.mine[0].img : (home.featured.length ? home.featured[0].img : '');
	const imageOf = (chan) => {
		const e = home.mine.concat(home.featured).find((x) => x.chan === chan && x.img);
		return e ? e.img : '';
	};
	return [
		{Id: 'replay-mine', Name: `Mes émissions · ${mineCardText(home)}`, Type: 'Folder', _externalTileUrl: mineImage || null, _vjodReplay: {kind: 'mine'}},
		...home.channels.filter((c) => c.count > 0).map((c) => ({
			Id: `replay-${c.chan}`,
			Name: `${c.name} · ${channelCardText(c)}`,
			Type: 'Folder',
			_externalTileUrl: logos[c.chan] || imageOf(c.chan) || null,
			_vjodReplay: {kind: 'chan', chan: c.chan, name: c.name}
		}))
	];
};

export const replayRowLogos = (home, liveChannels) => replayLogos(home.channels, liveChannels);

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// « vu en direct lundi », sinon « à la une · Mar. 3 nov. » (_why de l'APK).
export const whyOf = (item, dayLabel, now = new Date()) => {
	if (!item.liveAt) return `à la une · ${dayLabel}`;
	const at = new Date(item.liveAt * 1000);
	const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const ago = Math.round((day(now) - day(at)) / 86400000);
	return `vu en direct ${ago <= 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : WEEKDAYS[at.getDay()]}`;
};

// Les émissions à proposer quand rien n'est suivi : ce qu'on a regardé en direct, puis la une,
// une par émission, quatorze au plus (_start de l'APK).
export const startShows = (home) => {
	const seen = new Set();
	return home.suggest.concat(home.featured).filter((e) => {
		if (seen.has(e.show)) return false;
		seen.add(e.show);
		return true;
	}).slice(0, 14);
};
