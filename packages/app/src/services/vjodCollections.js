// Les collections VJOD (vjod_collections.dart de l'APK, généré à partir de
// lui) : des étagères à thème qui mêlent ce que le serveur a et tout le reste,
// à une demande près, chacune une recherche « discover » de Seerr.
export const FAMILIES = ['ready', 'ambiances', 'themes', 'series', 'platforms', 'studios', 'world'];

export const FAMILY_TITLES = {
	ready: 'Prêt à lancer',
	ambiances: 'Ambiances',
	themes: 'Thèmes',
	series: 'Séries',
	platforms: 'Plateformes',
	studios: 'Studios',
	world: 'Tour du monde'
};

export const VJOD_COLLECTIONS = [
	{id: 'gems', family: 'ready', title: 'Pépites jamais vues', subtitle: 'Les mieux notés du serveur, pas encore vus', query: {voteAverageGte: 7.5, voteCountGte: 1000, sortBy: 'vote_average.desc'}},
	{id: 'short_gems', family: 'ready', title: 'Petit film, grosse claque', subtitle: 'Moins d\'1 h 40 et excellent', query: {runtimeGte: 60, runtimeLte: 100, voteAverageGte: 7.3, voteCountGte: 1000, sortBy: 'vote_average.desc'}},
	{id: 'feel_good', family: 'ambiances', title: 'Feel good', subtitle: 'Des films qui font du bien', query: {genre: '35|10751|10402', voteAverageGte: 6.8, voteCountGte: 800}},
	{id: 'popcorn', family: 'ambiances', title: 'Mode pop-corn', subtitle: 'Action et aventure efficaces, moins de 2 h', query: {genre: '28|12', voteAverageGte: 6.3, voteCountGte: 2000, runtimeLte: 120}},
	{id: 'tearjerkers', family: 'ambiances', title: 'Mouchoirs obligatoires', subtitle: 'Les drames qui serrent la gorge', query: {genre: '18,10749', voteAverageGte: 7.2, voteCountGte: 800}},
	{id: 'mind_benders', family: 'ambiances', title: 'Ça retourne le cerveau', subtitle: 'Science-fiction et mystères à twist', query: {genre: '878|9648', voteAverageGte: 7.3, voteCountGte: 1500}},
	{id: 'sleepless', family: 'ambiances', title: 'Nuit blanche', subtitle: 'L\'horreur qui fait vraiment peur', query: {genre: '27', voteAverageGte: 6.6, voteCountGte: 800}},
	{id: 'epic', family: 'ambiances', title: 'Grand spectacle', subtitle: 'À voir sur le plus grand écran', query: {genre: '12|28|878|14|10752|36', runtimeGte: 130, voteAverageGte: 7.2, voteCountGte: 3000}},
	{id: 'family', family: 'ambiances', title: 'Soirée en famille', subtitle: 'Pour tous les âges', query: {genre: '10751|16', voteAverageGte: 6.8, voteCountGte: 800}},
	{id: 'classics', family: 'ambiances', title: 'Grands classiques', subtitle: 'Les incontournables d\'avant 1985', query: {dateLte: '1984-12-31', voteAverageGte: 7.8, voteCountGte: 1500, sortBy: 'vote_average.desc'}},
	{id: 'heist', family: 'themes', title: 'Casses et braquages', subtitle: '', query: {keyword: 'heist', voteCountGte: 300}},
	{id: 'time_travel', family: 'themes', title: 'Voyages dans le temps', subtitle: '', query: {keyword: 'time travel', voteCountGte: 300}},
	{id: 'space', family: 'themes', title: 'Perdus dans l\'espace', subtitle: '', query: {keyword: 'space travel', voteCountGte: 300}},
	{id: 'apocalypse', family: 'themes', title: 'Fin du monde', subtitle: '', query: {keyword: 'post-apocalyptic future', voteCountGte: 300}},
	{id: 'zombies', family: 'themes', title: 'Zombies', subtitle: '', query: {keyword: 'zombie', voteCountGte: 300}},
	{id: 'serial_killer', family: 'themes', title: 'Dans la tête d\'un tueur', subtitle: '', query: {keyword: 'serial killer', voteCountGte: 300}},
	{id: 'mafia', family: 'themes', title: 'Mafia et gangsters', subtitle: '', query: {keyword: 'mafia', voteCountGte: 300}},
	{id: 'prison_escape', family: 'themes', title: 'Évasions', subtitle: '', query: {keyword: 'prison escape', voteCountGte: 200}},
	{id: 'ai', family: 'themes', title: 'Machines et IA', subtitle: '', query: {keyword: 'artificial intelligence (a.i.)', voteCountGte: 300}},
	{id: 'true_story', family: 'themes', title: 'Histoires vraies', subtitle: '', query: {keyword: 'based on true story', voteAverageGte: 6.8, voteCountGte: 800}},
	{id: 'superheroes', family: 'themes', title: 'Super-héros', subtitle: '', query: {keyword: 'superhero', voteCountGte: 1000}},
	{id: 'christmas', family: 'themes', title: 'Films de Noël', subtitle: '', months: [11, 12], query: {keyword: 'christmas', voteCountGte: 300}},
	{id: 'halloween', family: 'themes', title: 'Frissons d\'Halloween', subtitle: '', months: [10], query: {keyword: 'halloween', voteCountGte: 200}},
	{id: 'binge', family: 'series', title: 'À binger ce week-end', subtitle: 'Séries terminées et excellentes', query: {mediaType: 'tv', status: '3', voteAverageGte: 8, voteCountGte: 300}},
	{id: 'miniseries', family: 'series', title: 'Mini-séries à binger', subtitle: 'Une histoire complète en quelques épisodes', query: {mediaType: 'tv', keyword: 'miniseries', voteAverageGte: 7.5, voteCountGte: 200}},
	{id: 'half_hour', family: 'series', title: 'Épisodes de 30 min', subtitle: 'Un épisode avant de dormir', query: {mediaType: 'tv', genre: '35', runtimeLte: 35, voteAverageGte: 7.5, voteCountGte: 300}},
	{id: 'airing', family: 'series', title: 'Toujours en cours', subtitle: 'Les séries qui continuent', query: {mediaType: 'tv', status: '0', voteAverageGte: 7.5, voteCountGte: 300}},
	{id: 'hbo', family: 'platforms', title: 'Séries HBO', subtitle: '', query: {mediaType: 'tv', network: 49, voteCountGte: 200}},
	{id: 'netflix', family: 'platforms', title: 'Séries Netflix', subtitle: '', query: {mediaType: 'tv', network: 213, voteCountGte: 200}},
	{id: 'disneyplus', family: 'platforms', title: 'Séries Disney+', subtitle: '', query: {mediaType: 'tv', network: 2739, voteCountGte: 100}},
	{id: 'prime', family: 'platforms', title: 'Séries Prime Video', subtitle: '', query: {mediaType: 'tv', network: 1024, voteCountGte: 100}},
	{id: 'appletv', family: 'platforms', title: 'Séries Apple TV+', subtitle: '', query: {mediaType: 'tv', network: 2552, voteCountGte: 100}},
	{id: 'paramountplus', family: 'platforms', title: 'Séries Paramount+', subtitle: '', query: {mediaType: 'tv', network: 4330, voteCountGte: 100}},
	{id: 'hulu', family: 'platforms', title: 'Séries Hulu', subtitle: '', query: {mediaType: 'tv', network: 453, voteCountGte: 100}},
	{id: 'peacock', family: 'platforms', title: 'Séries Peacock', subtitle: '', query: {mediaType: 'tv', network: 3353, voteCountGte: 100}},
	{id: 'bbc', family: 'platforms', title: 'Séries BBC', subtitle: '', query: {mediaType: 'tv', network: 4, voteCountGte: 100}},
	{id: 'pixar', family: 'studios', title: 'Pixar', subtitle: '', query: {studio: 3}},
	{id: 'ghibli', family: 'studios', title: 'Studio Ghibli', subtitle: '', query: {studio: 10342}},
	{id: 'a24', family: 'studios', title: 'A24', subtitle: '', query: {studio: 41077, voteCountGte: 100}},
	{id: 'disney', family: 'studios', title: 'Disney', subtitle: '', query: {studio: 2, voteCountGte: 200}},
	{id: 'marvel', family: 'studios', title: 'Marvel Studios', subtitle: '', query: {studio: 420, voteCountGte: 200}},
	{id: 'dc', family: 'studios', title: 'DC', subtitle: '', query: {studio: 9993, voteCountGte: 200}},
	{id: 'dreamworks', family: 'studios', title: 'DreamWorks', subtitle: '', query: {studio: 521, voteCountGte: 200}},
	{id: 'warner', family: 'studios', title: 'Warner Bros.', subtitle: '', query: {studio: 174, voteCountGte: 200}},
	{id: 'universal', family: 'studios', title: 'Universal', subtitle: '', query: {studio: 33, voteCountGte: 200}},
	{id: 'paramount', family: 'studios', title: 'Paramount', subtitle: '', query: {studio: 4, voteCountGte: 200}},
	{id: 'sony', family: 'studios', title: 'Sony Pictures', subtitle: '', query: {studio: 34, voteCountGte: 200}},
	{id: 'fox', family: 'studios', title: '20th Century Studios', subtitle: '', query: {studio: 127928, voteCountGte: 200}},
	{id: 'french', family: 'world', title: 'Le meilleur du cinéma français', subtitle: '', query: {language: 'fr', voteAverageGte: 7, voteCountGte: 300}},
	{id: 'russian', family: 'world', title: 'Cinéma russe et soviétique', subtitle: '', query: {language: 'ru', voteAverageGte: 6.5, voteCountGte: 100}},
	{id: 'korean', family: 'world', title: 'Cinéma coréen', subtitle: '', query: {language: 'ko', voteAverageGte: 7, voteCountGte: 200}},
	{id: 'japanese', family: 'world', title: 'Cinéma japonais', subtitle: '', query: {language: 'ja', voteAverageGte: 7, voteCountGte: 300}}
];

export const collectionById = (id) => VJOD_COLLECTIONS.find((c) => c.id === id) || null;
export const inSeason = (c, now = new Date()) => !c.months || !c.months.length || c.months.indexOf(now.getMonth() + 1) >= 0;
export const readyOnly = (c) => c.family === 'ready';

// Au-delà des titres connus, la même collection sans seuil de votes (quelques
// votes quand même, pour éviter les pages vides) ; null s'il n'y en a pas.
export const RELAXED_VOTES = 5;
export const relaxed = (c) => {
	if ((c.query.voteCountGte || 0) <= RELAXED_VOTES) return null;
	return {...c, id: `${c.id}~suite`, query: {...c.query, voteCountGte: RELAXED_VOTES}};
};

// Disponibles, puis demandés ou en cours, puis le reste ; ordre de Seerr sinon.
export const availableFirst = (items) => {
	const rank = (item) => {
		const status = item.mediaInfo && item.mediaInfo.status;
		if (status === 5 || status === 4) return 0;
		if (status === 2 || status === 3) return 1;
		return 2;
	};
	return items.map((item, i) => [item, i]).sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1])).map((e) => e[0]);
};

// Palmarès : récompenses, tops, grands classiques.
export const isPalmares = (name) => {
	const n = String(name || '').toLowerCase();
	return ['top 250', 'oscar', 'cannes', 'césar', 'cesar', 'palmarès', 'grands classiques'].some((w) => n.indexOf(w) >= 0);
};

// Les anciennes collections SmartLists, désormais dessinées par VJOD lui-même.
export const REPLACED_SMARTLISTS = new Set([
	'feel good', 'mode pop-corn', 'mouchoirs obligatoires', 'ça retourne le cerveau', 'nuit blanche',
	'grand spectacle', 'petit film, grosse claque', 'soirée en famille', 'pépites jamais vues',
	'casses & braquages', 'voyages dans le temps', 'perdus dans l\'espace', 'fin du monde',
	'dans la tête d\'un tueur', 'mafia & gangsters', 'évasions', 'machines & ia',
	'inspiré d\'une histoire vraie', 'à binger ce week-end', 'épisodes de 30 min', 'toujours en cours',
	'le meilleur du cinéma français', 'cinéma russe & soviétique', 'cinéma coréen & japonais'
]);

const HUES = ['#3A2A2A', '#26313B', '#2F3A2C', '#3B3326', '#2D2A3A', '#3A2632', '#243534', '#33302A', '#2A3240', '#3D2B23'];
// La couleur d'une tuile, choisie par son nom pour qu'elle ne change pas.
export const tileHue = (key) => {
	let h = 0;
	for (let i = 0; i < key.length; i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0; // eslint-disable-line no-bitwise
	return HUES[h % HUES.length];
};
