// Un titre lu chez le fournisseur IPTV qui ne répond plus (provider_stream.dart
// et dead_stream_dialog.dart de l'APK) : on propose de le demander à Seerr
// pour avoir un fichier sur le serveur.
import seerrApi from './seerrApi';
import {isProviderStreamPath} from '../utils/copyRank';

export {isProviderLibraryName, isProviderStreamPath} from '../utils/copyRank';

export const isProviderStream = (item) => Boolean(item) && (isProviderStreamPath(item.Path) ||
	isProviderStreamPath(item.MediaSources && item.MediaSources[0] && item.MediaSources[0].Path));

// {ok, message}
export const requestDeadStreamTitle = async (api, item) => {
	try {
		if (item.Type === 'Movie') {
			const movie = parseInt(item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb), 10);
			if (!movie) return {ok: false, message: 'Titre introuvable sur Seerr.'};
			await seerrApi.requestMovie(movie);
			return {ok: true, message: 'Demande envoyée.'};
		}
		let tmdb = item.Type === 'Series' ? parseInt(item.ProviderIds && (item.ProviderIds.Tmdb || item.ProviderIds.tmdb), 10) : NaN;
		if (!tmdb && item.SeriesId && api) {
			const series = await api.getItem(item.SeriesId);
			tmdb = parseInt(series && series.ProviderIds && (series.ProviderIds.Tmdb || series.ProviderIds.tmdb), 10);
		}
		if (!tmdb) return {ok: false, message: 'Série introuvable sur Seerr.'};
		const season = item.Type === 'Episode' ? item.ParentIndexNumber : null;
		if (!season || season <= 0) return {ok: false, message: 'Choisis les saisons depuis la fiche de la série (Demander).'};
		await seerrApi.requestTv(tmdb, {seasons: [season]});
		return {ok: true, message: `Saison ${season} demandée.`};
	} catch (e) {
		return {ok: false, message: 'La demande n’a pas pu partir. Réessayez depuis la fiche.'};
	}
};
