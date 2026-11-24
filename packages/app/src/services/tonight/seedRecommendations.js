// Ce qui va avec une graine (seed_recommendations.dart de l'APK) : les
// recommandations de TMDB par Seerr, affinées par ce que les membres de
// BetaSeries et de Trakt rapprochent du titre. Un titre qu'ils nomment aussi
// passe devant ; quelques-uns que seuls eux nomment rejoignent la liste, ce
// qui amène ce que TMDB propose peu, les séries françaises surtout. Sans eux,
// la liste de TMDB reste telle quelle.
import {betaSeriesSimilarMovies, betaSeriesSimilarShows} from '../betaSeries';
import {traktRelated} from '../trakt';
import {chartCards, seerrCard} from '../chartCards';

// Combien de titres nommés seulement par les communautés rejoignent la liste
// d'une graine : chacun coûte un appel à Seerr pour sa carte.
const COMMUNITY_EXTRAS = 4;

// [a] et [b] en une liste : ce que les deux nomment d'abord, dans l'ordre de
// [a], puis le reste de chacune, à tour de rôle.
export const mergeCommunities = (a, b) => {
	const inB = new Set(b);
	const both = a.filter((id) => inB.has(id));
	const bothSet = new Set(both);
	const restA = a.filter((id) => !bothSet.has(id));
	const restB = b.filter((id) => !bothSet.has(id));
	const out = both.slice();
	for (let i = 0; i < restA.length || i < restB.length; i++) {
		if (i < restA.length && out.indexOf(restA[i]) < 0) out.push(restA[i]);
		if (i < restB.length && out.indexOf(restB[i]) < 0) out.push(restB[i]);
	}
	return out;
};

// La liste de TMDB avec les titres que les membres nomment : ceux que les deux
// nomment d'abord, dans l'ordre de TMDB, puis les autres de TMDB à tour de
// rôle avec [extras].
export const withCommunity = (tmdb, named, extras) => {
	const ids = new Set(named);
	const confirmed = tmdb.filter((i) => ids.has(i.id));
	const others = tmdb.filter((i) => !ids.has(i.id));
	const out = confirmed.slice();
	for (let i = 0; i < others.length || i < extras.length; i++) {
		if (i < others.length) out.push(others[i]);
		if (i < extras.length) out.push(extras[i]);
	}
	return out;
};

const quiet = (promise) => promise.catch(() => []);

const communityIds = async (seerr, seed) => {
	const beta = seed.mediaType === 'tv'
		? betaSeriesSimilarShows(seed.tmdbId, async () => {
			const d = await seerr.getTv(seed.tmdbId);
			return d && d.externalIds && d.externalIds.tvdbId;
		})
		: betaSeriesSimilarMovies(seed.tmdbId);
	const [a, b] = await Promise.all([quiet(beta), seed.tmdbId > 0 ? quiet(traktRelated(seed.mediaType, seed.tmdbId)) : []]);
	return mergeCommunities(a, b);
};

// Les recommandations d'une graine, dans le format d'une page de découverte.
export const seedRecommendations = async (seerr, seed, {card = seerrCard(seerr)} = {}) => {
	const community = communityIds(seerr, seed);
	const page = await (seed.mediaType === 'tv' ? seerr.getTvRecommendations(seed.tmdbId) : seerr.getMovieRecommendations(seed.tmdbId));
	const results = (page && page.results) || [];
	const named = await community;
	if (!named.length) return results;
	const listed = new Set(results.map((i) => i.id));
	const extras = await chartCards(named.filter((id) => !listed.has(id) && id !== seed.tmdbId), {mediaType: seed.mediaType, depth: COMMUNITY_EXTRAS, load: card});
	return withCommunity(results, named, extras);
};
