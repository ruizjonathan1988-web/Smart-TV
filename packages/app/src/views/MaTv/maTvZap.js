// Logique pure du lecteur Ma TV (zapping, saisie de numéro, programme en
// cours), reprise de ma_tv_player_screen.dart / ma_tv_widgets.dart de l'APK.
// Aucune dépendance au DOM ni au lecteur : testable telle quelle.

// Zapping circulaire, comme `_zap` de l'APK : (index + delta) modulo la liste.
export const wrapIndex = (index, delta, length) => {
	if (!length) return 0;
	return (((index + delta) % length) + length) % length;
};

// Saisie au clavier numérique : au-delà de 5 chiffres on repart du dernier.
export const appendDigit = (current, digit) => {
	const next = (current || '') + digit;
	return next.length > 5 ? String(digit) : next;
};

// Position d'une chaîne par son numéro dans la liste courante, -1 sinon.
export const indexOfNumber = (channels, number) => {
	const n = parseInt(number, 10);
	if (!Array.isArray(channels) || isNaN(n)) return -1;
	for (let i = 0; i < channels.length; i++) {
		if (Number(channels[i] && channels[i].num) === n) return i;
	}
	return -1;
};

// Programme en cours et suivant à l'instant `nowSec` (secondes epoch).
// La chaîne embarque now/next ; si « now » est fini et que « next » a commencé,
// on décale (programAt / programAfter de l'APK).
export const programsAt = (channel, nowSec) => {
	const now = channel && channel.now && channel.now.t ? channel.now : null;
	const next = channel && channel.next && channel.next.t ? channel.next : null;
	if (now && now.e && now.e <= nowSec && next && (!next.s || next.s <= nowSec)) {
		return {current: next, next: null};
	}
	return {current: now, next};
};

// Avancement 0..1 d'un programme {s, e} (secondes).
export const progressOf = (prog, nowSec) => {
	if (!prog || !prog.s || !prog.e || prog.e <= prog.s) return 0;
	const v = (nowSec - prog.s) / (prog.e - prog.s);
	if (v < 0) return 0;
	if (v > 1) return 1;
	return v;
};

// Retard affiché, comme fmtDelay de l'APK : « −45 s », « −2 min », « −2 min 05 ».
export const fmtDelay = (seconds) => {
	const s = Math.max(0, Math.round(seconds));
	const m = Math.floor(s / 60);
	const r = s % 60;
	if (m === 0) return `−${r} s`;
	return r === 0 ? `−${m} min` : `−${m} min ${r < 10 ? '0' + r : r}`;
};

// Fenêtre de différé renvoyée par /tv/api/shift (MaTvShift de l'APK) :
// {from: secondes epoch, max_min} ou {off: true}. null si indisponible.
export const shiftFrom = (json) => {
	if (!json || typeof json !== 'object' || json.off === true) return null;
	return typeof json.from === 'number' ? json.from : null;
};

// Retard réellement jouable pour un retard voulu (secondes) : pas plus loin
// que ce que la seedbox garde (moins 3 s de marge), jamais négatif.
export const clampDelay = (from, wanted, nowSec) => {
	if (from === null || from === undefined) return 0;
	const most = nowSec - from - 3;
	if (most <= 0) return 0;
	if (wanted > most) return most;
	return wanted < 0 ? 0 : wanted;
};

// Programme en cours et 3 suivants pour le mini-guide (MaTvMiniGuide).
export const guideAt = (programs, channel, nowSec) => {
	const list = Array.isArray(programs) ? programs : [];
	let current = null;
	for (let i = 0; i < list.length; i++) {
		const p = list[i];
		if (p && p.s <= nowSec && (!p.e || p.e > nowSec)) {
			current = p;
			break;
		}
	}
	if (!current) current = programsAt(channel, nowSec).current;
	const later = list.filter((p) => p && p.s > nowSec).slice(0, 3);
	return {current, later};
};
