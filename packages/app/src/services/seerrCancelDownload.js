// VJOD 5.16 (seerr_cancel_download.dart de l'APK) : annuler une demande Seerr arrête aussi le
// téléchargement. Seerr ne supprime que la demande, Radarr / Sonarr gardent le titre et le
// torrent continue. Une fois la demande supprimée, Ma TV (IPTV Checker 3.91 et après) retire le
// téléchargement de la file de Radarr / Sonarr et du client torrent, et oublie le titre, sans
// jamais toucher à ce qui a déjà un fichier. Sans Ma TV, ou avec une plus ancienne, rien de plus.
import {REQUEST_STATUS} from '../utils/seerrStatus';
import {postMaTv} from './maTvPost';

const positive = (n) => typeof n === 'number' && n > 0;

// Ce qu'il faut dire à Ma TV : le type, les identifiants, les saisons.
export const cancelPayload = ({isMovie, tmdbId, tvdbId, seasons = []}) => {
	const body = {type: isMovie ? 'movie' : 'tv', tmdb: tmdbId};
	if (positive(tvdbId)) body.tvdb = tvdbId;
	if (!isMovie) body.seasons = [...new Set(seasons.filter(positive))].sort((a, b) => a - b);
	return body;
};

const seasonsOf = (requests) => {
	const out = new Set();
	requests.forEach((r) => (r.seasons || []).forEach((s) => out.add(s.seasonNumber)));
	return out;
};

// Ce qu'il faut arrêter une fois [cancelled] supprimées, ou null quand rien : quelqu'un d'autre
// demande encore le film, ou chacune des saisons annulées. Le téléchargement reste pour lui (même
// qualité seulement : une demande 4K est à part).
export const forCancel = ({all, cancelled, isMovie, tmdbId, tvdbId}) => {
	if (!positive(tmdbId) && !positive(tvdbId)) return null;
	const ids = new Set(cancelled);
	const gone = (all || []).filter((r) => ids.has(r.id));
	if (!gone.length) return null;
	const fourK = Boolean(gone[0].is4k);
	const kept = (all || []).filter((r) => !ids.has(r.id) && Boolean(r.is4k) === fourK &&
		(r.status === REQUEST_STATUS.PENDING || r.status === REQUEST_STATUS.APPROVED));
	if (isMovie) return kept.length ? null : cancelPayload({isMovie: true, tmdbId, tvdbId});
	const keptSeasons = seasonsOf(kept);
	const seasons = [...seasonsOf(gone)].filter((s) => !keptSeasons.has(s));
	// Une demande sans saisons, c'est toute la série : gardée, elle garde tout ; annulée, Ma TV
	// arrête toutes les saisons sans fichier.
	if (kept.some((r) => !(r.seasons || []).length)) return null;
	if (!seasons.length && gone.some((r) => (r.seasons || []).length)) return null;
	return cancelPayload({isMovie: false, tmdbId, tvdbId, seasons});
};

// Vrai quand Ma TV a arrêté quelque chose.
export const stopDownload = async (server, body) => {
	const {status, json} = await postMaTv(server, '/tv/api/seerr/cancel', body);
	if (status !== 200 || !json || typeof json !== 'object') return false;
	return (json.downloads || 0) > 0 || (Array.isArray(json.removed) && json.removed.length > 0);
};
