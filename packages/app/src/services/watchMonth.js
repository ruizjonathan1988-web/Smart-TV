// « Le mois à la maison » (watch_month.dart) : d'après le module Playback
// Reporting de Jellyfin, les heures regardées par chacun, les séries et les
// films les plus vus des 30 derniers jours. Jellyfin ne répond qu'à un administrateur.
import {platformFetch} from './secureFetch';

export const WATCH_MONTH_QUERY = "SELECT UserId, ItemType, ItemName, SUM(PlayDuration) FROM PlaybackActivity WHERE DateCreated >= datetime('now', '-30 days') GROUP BY UserId, ItemType, ItemName";

// « Malcolm - s07e20 - Le grand jour » → « Malcolm ».
export const seriesOf = (name) => {
	const m = /^(.*?)\s+-\s+s\d+e\d+/i.exec(name);
	if (m) return m[1].trim();
	const dash = name.indexOf(' - ');
	return dash > 0 ? name.slice(0, dash).trim() : name.trim();
};

const top = (map, n) => Object.keys(map).map((k) => [k, map[k]]).sort((a, b) => b[1] - a[1]).slice(0, n);

export const watchMonthFromRows = (rows) => {
	const people = {};
	const series = {};
	const films = {};
	let total = 0;
	(rows || []).forEach((r) => {
		if (!Array.isArray(r) || r.length < 4) return;
		const h = (parseFloat(r[3]) || 0) / 3600;
		if (h <= 0) return;
		const who = String(r[0] == null ? '' : r[0]).trim();
		const type = String(r[1] == null ? '' : r[1]);
		const name = String(r[2] == null ? '' : r[2]).trim();
		total += h;
		if (who) people[who] = (people[who] || 0) + h;
		if (!name) return;
		if (type === 'Episode') {
			const s = seriesOf(name);
			series[s] = (series[s] || 0) + h;
		} else if (type === 'Movie') {
			films[name] = (films[name] || 0) + h;
		}
	});
	return {people: top(people, 20), series: top(series, 8), films: top(films, 8), totalHours: total};
};

// « 12 h 30 », « 45 min ».
export const hoursLabel = (h) => {
	const m = Math.round(h * 60);
	if (m < 60) return `${m} min`;
	return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

// {month} ou {error}.
export const loadWatchMonth = async ({serverUrl, accessToken, fetchImpl = (url, opts) => platformFetch(url, opts, 20000)}) => {
	try {
		const res = await fetchImpl(`${serverUrl}/user_usage_stats/submit_custom_query`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json', 'X-Emby-Token': accessToken, Accept: 'application/json'},
			body: JSON.stringify({CustomQueryString: WATCH_MONTH_QUERY, ReplaceUserId: true})
		});
		if (res.status === 404) return {error: 'Le module Playback Reporting n’est pas installé sur Jellyfin.'};
		if (res.status === 401 || res.status === 403) return {error: 'Réservé aux administrateurs de Jellyfin.'};
		if (res.status !== 200) return {error: `Jellyfin a répondu ${res.status}.`};
		const j = await res.json();
		return {month: watchMonthFromRows(j && Array.isArray(j.results) ? j.results : [])};
	} catch (e) {
		return {error: `Lecture impossible : ${e && e.message ? e.message : e}`};
	}
};
