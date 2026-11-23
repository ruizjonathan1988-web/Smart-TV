// Supprimer du serveur un film, un épisode, une saison ou une série (media_delete.dart de l'APK).
// Ma TV, sur la seedbox, fait tout : Jellyfin efface les fichiers (pour un profil que Jellyfin
// autorise), Sonarr / Radarr cessent de surveiller ce qui est supprimé pour qu'il ne revienne
// pas, et le torrent qui le partageait encore est retiré pour libérer vraiment la place. Sans
// Ma TV, Jellyfin seul efface les fichiers.
import {postMaTv} from './maTvPost';

export const DELETABLE_TYPES = ['Movie', 'Episode', 'Season', 'Series'];

// Comme _canDeleteFromServer : Jellyfin autorise ce profil, et c'est un film ou une série.
export const canDeleteFromServer = (item) => Boolean(item && item.CanDelete && DELETABLE_TYPES.includes(item.Type));

// Ce qu'on peut supprimer : pour un épisode, lui, sa saison ou toute la série ; pour une série,
// toute la série ou une de ses saisons. `leaves` : la fiche n'existe plus après.
export const deleteChoices = (item, seasons = []) => {
	const series = item.SeriesName || item.Name;
	const seasonNo = item.ParentIndexNumber;
	switch (item.Type) {
		case 'Episode': {
			const episode = seasonNo != null && item.IndexNumber != null ? ` (S${seasonNo} É${item.IndexNumber})` : '';
			const seasonLabel = seasonNo != null ? ` ${seasonNo}` : '';
			return [
				{id: item.Id, label: `Cet épisode${episode}`, what: `« ${item.Name} »`, leaves: true},
				...(item.SeasonId ? [{id: item.SeasonId, label: `Toute la saison${seasonLabel}`, what: `la saison${seasonLabel} de « ${series} »`, leaves: true}] : []),
				...(item.SeriesId ? [{id: item.SeriesId, label: 'Toute la série', what: `toute la série « ${series} »`, leaves: true}] : [])
			];
		}
		case 'Season':
			return [
				{id: item.Id, label: 'Cette saison', what: `${String(item.Name).toLowerCase()} de « ${series} »`, leaves: true},
				...(item.SeriesId ? [{id: item.SeriesId, label: 'Toute la série', what: `toute la série « ${series} »`, leaves: true}] : [])
			];
		case 'Series':
			return [
				{id: item.Id, label: 'Toute la série', what: `toute la série « ${item.Name} »`, leaves: true},
				...(seasons || [])
					.filter((s) => s && s.Type === 'Season' && s.CanDelete && s.Id)
					.map((s) => ({id: s.Id, label: `Seulement ${String(s.Name).toLowerCase()}`, what: `${String(s.Name).toLowerCase()} de « ${item.Name} »`, leaves: false}))
			];
		default:
			return [{id: item.Id, label: 'Supprimer', what: `« ${item.Name} »`, leaves: true}];
	}
};

export const confirmMessage = (item, pick) =>
	`Cela efface ${pick.what} de la seedbox pour libérer la place. ${item.Type === 'Movie' ? 'Radarr' : 'Sonarr'} ne le retéléchargera pas et le torrent sera retiré. C’est définitif.`;

const space = (freed) => {
	if (!(freed > 0)) return '';
	const gb = freed / (1 << 30);
	return gb >= 1 ? ` · ${gb.toFixed(1).replace('.', ',')} Go libérés` : ` · ${Math.round(freed / (1 << 20))} Mo libérés`;
};

// Une ligne pour le spectateur (summary de MediaDeleteResult), plus deux remarques de Ma TV au plus.
export const deleteSummary = (result, name) => {
	if (result.error) return result.error;
	if (result.jellyfinOnly) return `« ${name} » supprimé (Ma TV absent : Sonarr / Radarr et le torrent non prévenus)`;
	return [`« ${name} » supprimé du serveur${space(result.freed)}`, ...(result.notes || []).slice(0, 2)].join('\n');
};

// Le nom affiché dans le résumé : ce qui a été choisi, sans les guillemets.
export const pickName = (pick) => pick.what.replace(/« /g, '').replace(/ »/g, '');

// Supprime [itemId] pour le profil dont le jeton Jellyfin est [token]. [jellyfinDelete] n'est
// utilisé que sans Ma TV. Renvoie {error?, freed, notes, jellyfinOnly}.
export const deleteMedia = async ({server, itemId, token, jellyfinDelete, post = postMaTv}) => {
	if (!server) {
		try {
			await jellyfinDelete();
			return {freed: 0, notes: [], jellyfinOnly: true};
		} catch (err) {
			return {error: `Jellyfin n'a pas pu le supprimer (${err && err.message ? err.message : err})`};
		}
	}
	if (!token) return {error: 'Profil non connecté, rien n’a été supprimé'};
	const {status, json} = await post(server, '/tv/api/media/delete', {token, id: itemId}, 90000);
	if (status === 0) return {error: 'Ma TV ne répond pas. Rien n’a été supprimé, réessaie dans un instant.'};
	if (status !== 200 || !json || typeof json !== 'object') {
		const why = json && typeof json === 'object' && json.error != null ? String(json.error) : `Ma TV a répondu ${status}`;
		return {error: `${why}. Rien n’a été supprimé.`};
	}
	return {
		freed: typeof json.freed === 'number' ? Math.round(json.freed) : 0,
		notes: Array.isArray(json.notes) ? json.notes.map(String) : [],
		jellyfinOnly: false
	};
};
