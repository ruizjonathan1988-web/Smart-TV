// Des idées pour une recherche vide (search_screen.dart, VJOD 4.28) : les
// titres de « Pour toi », des Top 10 et du cinéma français de l'accueil.
const IDEA_ROWS = ['seerr_for_you', 'top10_movies', 'top10_series', 'french_movies'];
let rows = [];

export const rememberHomeRows = (list) => {
	rows = Array.isArray(list) ? list : [];
};

export const searchIdeas = (limit = 16) => {
	const ideas = [];
	IDEA_ROWS.forEach((id) => {
		const row = rows.find((r) => r.id === id);
		((row && row.items) || []).slice(0, 5).forEach((item) => {
			const name = String(item.Name || item.title || item.name || '').trim();
			if (name && ideas.indexOf(name) < 0) ideas.push(name);
		});
	});
	return ideas.slice(0, limit);
};
