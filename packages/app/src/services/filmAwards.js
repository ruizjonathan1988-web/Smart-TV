// Les films primés (film_awards_client.dart de l'APK), lus sur Wikidata :
// César du meilleur film et du premier film, prix Louis-Delluc, et les films
// français qui ont eu la Palme, le Lion ou l'Ours d'or. Les plus récents d'abord.
import {fetchOutsideJson} from './outsideFetch';

const AWARDS = ['wd:Q645595', 'wd:Q655056', 'wd:Q734335', 'wd:Q179808', 'wd:Q209459', 'wd:Q154590'];
const FRENCH_ONLY = ['wd:Q645595', 'wd:Q655056', 'wd:Q734335'];

export const FRENCH_WINNERS_QUERY = `SELECT ?tmdb (MAX(?year) AS ?latest) WHERE {
  VALUES ?award { ${AWARDS.join(' ')} }
  ?film p:P166 ?won .
  ?won ps:P166 ?award .
  OPTIONAL { ?won pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
  ?film wdt:P4947 ?tmdb .
  FILTER(?award IN (${FRENCH_ONLY.join(', ')}) || EXISTS { ?film wdt:P495 wd:Q142 })
}
GROUP BY ?tmdb
ORDER BY DESC(?latest)
LIMIT 40`;

export const parseAwardWinners = (json) => {
	const bindings = json && json.results && json.results.bindings;
	if (!Array.isArray(bindings)) return [];
	const ids = [];
	bindings.forEach((row) => {
		const id = parseInt(row && row.tmdb && row.tmdb.value, 10);
		if (id > 0 && ids.indexOf(id) < 0) ids.push(id);
	});
	return ids;
};

let fetchJson = fetchOutsideJson;
let winners = null;

// Gardés pour la session une fois qu'ils sont venus.
export const frenchWinners = async () => {
	if (winners) return winners;
	const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(FRENCH_WINNERS_QUERY)}`;
	const ids = parseAwardWinners(await fetchJson(url, {headers: {Accept: 'application/sparql-results+json'}, timeoutMs: 15000}));
	if (ids.length) winners = ids;
	return ids;
};

export const setFilmAwardsFetchForTests = (fn) => {
	fetchJson = fn || fetchOutsideJson;
	winners = null;
};
