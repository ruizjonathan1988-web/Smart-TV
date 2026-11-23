// Chercher une chaîne en tapant (channel_search.dart de l'APK) : son nom, son
// numéro, ou ce qu'elle diffuse maintenant ou ensuite (« psg » trouve la
// chaîne du match). Casse, accents, espaces et ponctuation ne comptent pas.
const ACCENTS = {
	'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a', 'ã': 'a', 'ç': 'c',
	'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'í': 'i',
	'ô': 'o', 'ö': 'o', 'ó': 'o', 'õ': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
	'ÿ': 'y', 'ñ': 'n', 'œ': 'oe', 'æ': 'ae'
};

export const normalizeChannelQuery = (text) => {
	const low = String(text || '').toLowerCase();
	let out = '';
	for (let i = 0; i < low.length; i++) {
		const ch = low[i];
		if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) out += ch;
		else if (ACCENTS[ch]) out += ACCENTS[ch];
	}
	return out;
};

export const channelMatches = (query, channel) => {
	const q = normalizeChannelQuery(query);
	if (!q) return true;
	if (normalizeChannelQuery(channel.name).indexOf(q) >= 0) return true;
	if (channel.num !== undefined && normalizeChannelQuery(String(channel.num)) === q) return true;
	const titles = [channel.now && channel.now.t, channel.next && channel.next.t].filter(Boolean);
	return titles.some((t) => normalizeChannelQuery(t).indexOf(q) >= 0);
};

// Les chaînes trouvées (80 au plus), rien pour un champ vide.
export const searchChannels = (all, query, limit = 80) => {
	if (!normalizeChannelQuery(query)) return [];
	const out = [];
	for (let i = 0; i < (all || []).length && out.length < limit; i++) {
		if (channelMatches(query, all[i])) out.push(all[i]);
	}
	return out;
};
