// « Ce soir » (tonight_models.dart et taste_profile.dart de l'APK) : qui
// regarde, combien de temps, quelle envie ; les créneaux de la semaine ; les
// genres du questionnaire et l'âge que permet une classification.

// Les genres du questionnaire, avec leurs identifiants TMDB (films, séries).
export const GENRES = {
	action: [[28], [10759]],
	adventure: [[12], [10759]],
	animation: [[16], [16]],
	comedy: [[35], [35]],
	crime: [[80], [80]],
	documentary: [[99], [99]],
	drama: [[18], [18]],
	family: [[10751], [10751]],
	fantasy: [[14], [10765]],
	history: [[36], []],
	horror: [[27], []],
	kids: [[], [10762]],
	music: [[10402], []],
	mystery: [[9648], [9648]],
	reality: [[], [10764]],
	romance: [[10749], []],
	scifi: [[878], [10765]],
	talk: [[], [10767, 10763, 10766]],
	thriller: [[53], []],
	war: [[10752], [10768]],
	western: [[37], [37]]
};

// Les genres d'un titre TMDB.
export const genresOfIds = (ids, mediaType) => {
	const set = new Set(ids || []);
	return Object.keys(GENRES).filter((g) => GENRES[g][mediaType === 'tv' ? 1 : 0].some((id) => set.has(id)));
};

const LABELS = {
	action: 'action', adventure: 'adventure', aventure: 'adventure', animation: 'animation', anime: 'animation',
	comedy: 'comedy', comedie: 'comedy', crime: 'crime', policier: 'crime', documentary: 'documentary',
	documentaire: 'documentary', drama: 'drama', drame: 'drama', family: 'family', familial: 'family',
	famille: 'family', fantasy: 'fantasy', fantastique: 'fantasy', history: 'history', histoire: 'history',
	horror: 'horror', horreur: 'horror', kids: 'kids', enfants: 'kids', children: 'kids', music: 'music',
	musique: 'music', musical: 'music', mystery: 'mystery', mystere: 'mystery', reality: 'reality',
	realite: 'reality', 'reality tv': 'reality', 'tele realite': 'reality', romance: 'romance',
	'science fiction': 'scifi', 'sci fi': 'scifi', talk: 'talk', 'talk show': 'talk', soap: 'talk',
	feuilleton: 'talk', news: 'talk', actualites: 'talk', thriller: 'thriller', suspense: 'thriller',
	war: 'war', guerre: 'war', 'war politics': 'war', western: 'western'
};

const fold = (text) => {
	const from = 'àâäéèêëîïôöùûüç';
	const to = 'aaaeeeeiioouuuc';
	let out = '';
	const low = String(text || '').trim().toLowerCase();
	for (let i = 0; i < low.length; i++) {
		const k = from.indexOf(low[i]);
		out += k >= 0 ? to[k] : low[i];
	}
	return out.replace(/[^a-z0-9]+/g, ' ').trim();
};

// Les genres que désignent les noms de genres d'un élément Jellyfin (en
// anglais ou en français, « Action & Adventure » découpé en deux).
export const genresFromNames = (names) => {
	const found = new Set();
	(names || []).forEach((name) => {
		String(name).split(/\s*(?:&|\/|,| et | and )\s*/).forEach((part) => {
			const g = LABELS[fold(part)];
			if (g) found.add(g);
		});
		const whole = LABELS[fold(name)];
		if (whole) found.add(whole);
	});
	return Array.from(found);
};

export const COMPANIES = ['alone', 'couple', 'family', 'friends'];
export const TIMES = ['short', 'evening', 'any'];
export const MOODS = ['laugh', 'chills', 'escape', 'think', 'comfort', 'surprise'];
export const KIDS = ['under7', 'from7to12', 'teen'];

// Minutes disponibles, null sans limite.
export const budgetMinutes = (time) => ({short: 95, evening: 210}[time] || null);
// L'âge de classification le plus élevé permis par le plus jeune.
export const kidsMaxAge = (kids) => ({under7: 6, from7to12: 10, teen: 13}[kids] || 10);

// Le créneau d'un instant : le type de jour et le moment. Après minuit, on
// est encore dans la soirée de la veille.
export const slotOf = (date) => {
	const d = new Date(date);
	const h = d.getHours();
	const effective = h < 5 ? new Date(d.getTime() - 5 * 3600000) : d;
	const band = h < 5 || h >= 22 ? 'late' : h >= 17 ? 'evening' : 'daytime';
	const wd = effective.getDay();
	const day = wd === 5 ? 'friday' : wd === 6 ? 'saturday' : wd === 0 ? 'sunday' : 'weekday';
	return {day, band, key: `${day}_${band}`};
};

export const encodeAnswers = (a) => JSON.stringify({
	company: a.company, time: a.time, mood: a.mood, kids: a.kidsAge, at: new Date(a.at).toISOString()
});

export const decodeAnswers = (source) => {
	if (!source) return null;
	try {
		const j = typeof source === 'string' ? JSON.parse(source) : source;
		if (!j || COMPANIES.indexOf(j.company) < 0 || TIMES.indexOf(j.time) < 0 || MOODS.indexOf(j.mood) < 0) return null;
		const at = Date.parse(j.at);
		if (isNaN(at)) return null;
		return {company: j.company, time: j.time, mood: j.mood, kidsAge: KIDS.indexOf(j.kids) >= 0 ? j.kids : 'from7to12', at};
	} catch (e) {
		return null;
	}
};

const EXACT_RATINGS = {
	'G': 0, 'U': 0, 'TP': 0, 'TOUS PUBLICS': 0, 'ALL': 0, 'AL': 0, 'TV-Y': 0, 'TV-G': 0,
	'TV-Y7': 7, 'TV-Y7-FV': 7, 'PG': 10, 'TV-PG': 10, 'PG-13': 13, 'TV-14': 14, 'R': 17,
	'TV-MA': 17, 'NC-17': 18, 'X': 18, 'XXX': 18, 'NR': null, 'UNRATED': null
};

// L'âge qu'autorise une classification (FR-12, Tous publics, PG-13, TV-MA…), null si illisible.
export const ratingAge = (rating) => {
	if (rating === undefined || rating === null) return null;
	let value = String(rating).trim().toUpperCase();
	if (!value) return null;
	const prefixed = /^[A-Z]{2}[-/ ](.+)$/.exec(value);
	if (prefixed && value.indexOf('TV-') !== 0 && value.indexOf('PG') !== 0) value = prefixed[1].trim();
	if (Object.prototype.hasOwnProperty.call(EXACT_RATINGS, value)) return EXACT_RATINGS[value];
	const number = /(\d{1,2})/.exec(value);
	return number ? parseInt(number[1], 10) : null;
};
