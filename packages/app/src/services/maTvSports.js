// Sports de Ma TV (ma_tv_sports.dart de l'APK) : les matchs du jour avec le
// score en direct, les cotes et les chaînes qui les diffusent. Ma TV les lit
// pour toute la maison ; la TV ne fait que lui demander. Les choix (sports,
// cotes, équipes, rappels) sont gardés sur cette TV.
import {getFromStorage, saveToStorage} from './storage';

const KEY = 'maTvSportsChoices';
const str = (v) => (v === undefined || v === null ? '' : String(v));
const int = (v) => (typeof v === 'number' ? Math.round(v) : null);

export const parseEvent = (j) => {
	let score = null;
	if (Array.isArray(j.score) && j.score.length === 2) score = j.score.map(str);
	let sets = null;
	if (Array.isArray(j.sets) && j.sets.length === 2) {
		sets = j.sets.map((side) => (Array.isArray(side) ? side.filter((x) => typeof x === 'number').map(Math.round) : []));
	}
	const odds = {};
	if (j.odds && typeof j.odds === 'object') {
		Object.keys(j.odds).forEach((k) => {
			if (typeof j.odds[k] === 'number') odds[k] = j.odds[k];
		});
	}
	let last = null;
	if (j.last && typeof j.last === 'object') {
		last = {text: str(j.last.text), minute: int(j.last.min), at: int(j.last.at) || 0};
	}
	return {
		id: str(j.id),
		sport: str(j.sport),
		sportName: str(j.sportName),
		competition: str(j.comp),
		country: str(j.country),
		home: str(j.home),
		away: str(j.away),
		start: int(j.start) || 0,
		state: str(j.state) || 'pre',
		score,
		sets,
		minute: int(j.minute),
		period: j.period === undefined || j.period === null ? null : str(j.period),
		odds,
		last,
		channels: (Array.isArray(j.chans) ? j.chans : [])
			.filter((c) => c && typeof c === 'object')
			.map((c) => ({id: str(c.id), number: int(c.num) || 0, name: str(c.name)}))
	};
};

export const parseSports = (j) => {
	if (!j || typeof j !== 'object') return null;
	return {
		events: (Array.isArray(j.events) ? j.events : []).filter((e) => e && typeof e === 'object').map(parseEvent),
		kinds: (Array.isArray(j.sports) ? j.sports : [])
			.filter((s) => s && typeof s === 'object')
			.map((s) => ({id: str(s.id), name: str(s.name)})),
		source: j.source === undefined || j.source === null ? null : str(j.source),
		error: j.error === undefined || j.error === null ? null : str(j.error)
	};
};

export const isLive = (e) => e.state === 'live';
export const isFinished = (e) => e.state === 'end';

// « 2 – 1 », les sets au tennis (« 6-4 3-5 »), rien avant le coup d'envoi.
export const scoreText = (e) => {
	const s = e.sets;
	if (s && s[0].length) {
		const out = [];
		for (let i = 0; i < s[0].length && i < s[1].length; i++) out.push(`${s[0][i]}-${s[1][i]}`);
		return out.join(' ');
	}
	return e.score ? `${e.score[0]} – ${e.score[1]}` : '';
};

// Le coin de la carte : la minute, la période, « Terminé » ou l'heure.
export const clockText = (e) => {
	if (isFinished(e)) return 'Terminé';
	if (isLive(e)) {
		if (e.minute !== null && e.minute !== undefined) return `${e.minute}’`;
		return e.period ? e.period : 'En direct';
	}
	const d = new Date(e.start * 1000);
	const two = (n) => (n < 10 ? '0' + n : String(n));
	return `${two(d.getHours())}:${two(d.getMinutes())}`;
};

export const momentLabel = (m) => (m.minute === null || m.minute === undefined ? m.text : `${m.text} (${m.minute}’)`);

// Cote décimale à la française : « 1,85 ».
export const oddText = (v) => v.toFixed(2).replace('.', ',');

const FROM = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ';
const TO = 'aaaaaaceeeeiiiinooooouuuuyyoa';
const norm = (s) => {
	let out = '';
	const low = str(s).toLowerCase();
	for (let i = 0; i < low.length; i++) {
		const k = FROM.indexOf(low[i]);
		out += k < 0 ? low[i] : TO[k];
	}
	return out.replace(/[^a-z0-9]+/g, ' ').trim();
};

// Si `team` (telle que suivie) est l'un des deux camps de `e`.
export const followsTeam = (e, team) => {
	const k = norm(team);
	if (!k) return false;
	return [e.home, e.away].some((side) => {
		const n = norm(side);
		return n === k || n.split(' ').indexOf(k) >= 0 || (n && k.indexOf(n) >= 0);
	});
};
export const followsAny = (e, teams) => (teams || []).some((t) => followsTeam(e, t));

// Ajoute ou retire `item` d'une liste (sans tenir compte de la casse).
export const toggleIn = (list, item) => {
	const at = list.findIndex((x) => x.toLowerCase() === str(item).toLowerCase());
	return at >= 0 ? list.filter((_, i) => i !== at) : list.concat([item]);
};

// Les matchs passés de « pre » à « live » que le profil attendait : annoncés une fois.
export const kickOffs = (before, events, {reminders, teams}) => events.filter((e) =>
	isLive(e) && before[e.id] === 'pre' && (reminders.indexOf(e.id) >= 0 || followsAny(e, teams)));

// ------------------------------------------------------------------ choix

let choices = {odds: true, kinds: [], teams: [], reminders: []};
let loaded = null;

export const loadSportsChoices = () => {
	if (!loaded) {
		loaded = getFromStorage(KEY)
			.then((stored) => {
				if (stored && typeof stored === 'object') {
					choices = {
						odds: stored.odds !== false,
						kinds: Array.isArray(stored.kinds) ? stored.kinds : [],
						teams: Array.isArray(stored.teams) ? stored.teams : [],
						reminders: Array.isArray(stored.reminders) ? stored.reminders : []
					};
				}
				return choices;
			})
			.catch(() => choices);
	}
	return loaded;
};

export const sportsChoices = () => choices;

const update = (patch) => {
	choices = {...choices, ...patch};
	saveToStorage(KEY, choices).catch(() => {});
	return choices;
};

export const setSportsOdds = (on) => update({odds: !!on});
export const toggleSportKind = (id) => update({kinds: toggleIn(choices.kinds, id)});
export const setAllSportKinds = () => update({kinds: []});
export const toggleSportTeam = (team) => update({teams: toggleIn(choices.teams, team)});
// Les vieux rappels ne s'empilent pas : les 40 derniers sont gardés.
export const toggleSportReminder = (id) => {
	const list = toggleIn(choices.reminders, id);
	return update({reminders: list.length > 40 ? list.slice(list.length - 40) : list});
};

export const resetSportsForTests = (c) => {
	choices = {odds: true, kinds: [], teams: [], reminders: [], ...(c || {})};
	loaded = Promise.resolve(choices);
};
