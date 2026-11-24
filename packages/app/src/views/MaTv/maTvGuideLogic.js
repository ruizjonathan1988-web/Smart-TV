// Logique pure de la grille des programmes (ma_tv_guide.dart de l'APK).
// Tout est en secondes epoch.

export const SPAN = 150 * 60; // deux heures et demie à l'écran
const HALF = 30 * 60;

// L'heure ou la demi-heure pile d'avant (maTvHalfHour).
export const halfHour = (sec) => {
	const d = new Date(sec * 1000);
	d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
	return Math.floor(d.getTime() / 1000);
};

// Programmes d'une ligne : la grille chargée, sinon now/next de la chaîne.
export const rowPrograms = (channel, loaded) => {
	if (loaded && loaded.length) return loaded;
	const out = [];
	if (channel && channel.now && channel.now.s) out.push(channel.now);
	if (channel && channel.next && channel.next.s) out.push(channel.next);
	return out;
};

export const programAt = (progs, cursor) => {
	for (let i = 0; i < progs.length; i++) {
		const p = progs[i];
		if (cursor >= p.s && cursor < p.e) return p;
	}
	return null;
};

// Jusqu'où l'on remonte : le replay de la chaîne (7 jours au plus), sinon une heure.
export const earliestFor = (channel, nowSec) => {
	const days = channel && channel.arc > 0 ? Math.min(7, Math.max(1, channel.arc)) : 0;
	return halfHour(nowSec - (days ? days * 86400 : 3600));
};

// La fenêtre suit le curseur, par demi-heures.
export const follow = (win, cursor, earliest) => {
	let w = win;
	while (cursor < w) w -= HALF;
	while (cursor >= w + SPAN - 20 * 60) w += HALF;
	return w < earliest ? earliest : w;
};

// ◀ / ▶ : de programme en programme (une demi-heure s'il n'y en a pas).
export const moveTime = ({progs, cursor, win, delta, earliest, nowSec}) => {
	const sel = programAt(progs, cursor);
	let next;
	if (delta > 0) {
		const limit = sel ? sel.e : cursor + 60;
		const after = progs.filter((p) => p.s >= limit);
		next = after.length ? after[0].s : cursor + HALF;
	} else {
		const limit = sel ? sel.s : cursor;
		const before = progs.filter((p) => p.e <= limit);
		next = before.length ? before[before.length - 1].s : cursor - HALF;
	}
	if (next < earliest) next = earliest;
	if (next > nowSec + 3 * 86400) return null;
	const c = next < win && delta > 0 ? win : next;
	return {cursor: c, win: follow(win, c, earliest)};
};

// Ce que fait OK sur un programme : regarder le direct, le replay, ou enregistrer.
export const guideAction = (prog, channel, nowSec) => {
	if (!prog || (prog.s <= nowSec && nowSec < prog.e)) return 'live';
	if (prog.e <= nowSec) return channel && channel.arc > 0 ? 'replay' : 'noreplay';
	return 'record';
};

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

// « aujourd'hui », « hier », « demain », sinon « lundi 3 » (maTvDay).
export const dayName = (sec, nowSec) => {
	const t = new Date(sec * 1000);
	const n = new Date(nowSec * 1000);
	const a = new Date(t.getFullYear(), t.getMonth(), t.getDate());
	const b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
	const diff = Math.round((b - a) / 86400000);
	if (diff === 0) return 'aujourd’hui';
	if (diff === 1) return 'hier';
	if (diff === -1) return 'demain';
	return `${DAYS[t.getDay()]} ${t.getDate()}`;
};

// Place d'un programme dans la fenêtre, en pourcentage de la largeur.
export const cellBox = (prog, win) => {
	const from = Math.max(prog.s, win);
	const to = Math.min(prog.e, win + SPAN);
	if (to <= from) return null;
	return {left: ((from - win) / SPAN) * 100, width: ((to - from) / SPAN) * 100};
};
