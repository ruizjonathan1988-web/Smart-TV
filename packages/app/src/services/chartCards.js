// Une liste d'ids TMDB (classement Trakt ou BetaSeries, palmarès) devient des
// cartes Seerr (chart_cards.dart de l'APK) : un titre déjà connu reprend sa
// carte, les autres sont demandés à Seerr, quelques-uns à la fois. Un titre
// introuvable est passé.
import {mapBounded} from './outsideFetch';

// La fiche Seerr d'un titre a la forme d'une carte de découverte, avec les
// ids de genres que le classement lit.
export const discoverItemOf = (details, mediaType) => {
	if (!details || !details.id) return null;
	const genreIds = Array.isArray(details.genreIds) ? details.genreIds
		: (details.genres || []).map((g) => g && g.id).filter((id) => typeof id === 'number');
	return {...details, mediaType, genreIds};
};

// Ce qui va chercher une carte chez ce Seerr-là.
export const seerrCard = (seerr) => async (mediaType, tmdbId) =>
	discoverItemOf(await (mediaType === 'tv' ? seerr.getTv(tmdbId) : seerr.getMovie(tmdbId)), mediaType);

export const chartCards = async (ids, {known = {}, mediaType, depth = 10, load} = {}) => {
	const cards = await mapBounded((ids || []).slice(0, depth), 4, (id) => known[id] || load(mediaType, id));
	return cards.filter(Boolean);
};
