// Les marques d'une carte d'accueil, comme dans l'APK (home_screen.dart,
// _highlightOverlays) : son rang dans un Top 10, une pastille sur les cartes
// de certaines rangées VJOD, ou « Nouveau » sur ce qui vient d'arriver.

export const FRESH_DAYS = 10;
const DAY = 24 * 3600 * 1000;

// Un film ou un épisode arrivé il y a moins de 10 jours et pas encore entamé.
export const isFreshlyAdded = (item, now = Date.now()) => {
	if (!item || item._seerr || item.isSeerr) return false;
	const type = item.Type;
	if (type !== 'Movie' && type !== 'Episode') return false;
	// Un fichier que le serveur n'a pas reconnu : un téléchargement égaré.
	if (type === 'Movie' && !(item.ImageTags && item.ImageTags.Primary)) return false;
	if (type === 'Episode' && !item.SeriesId) return false;
	const ud = item.UserData || {};
	if (ud.Played || (ud.PlayedPercentage || 0) > 0 || (ud.PlaybackPositionTicks || 0) > 0) return false;
	const created = Date.parse(item.DateCreated || '');
	if (!Number.isFinite(created)) return false;
	const age = now - created;
	return age >= 0 && age <= FRESH_DAYS * DAY;
};

// {rank} ou {pill}, ou null quand la carte n'a rien à porter.
export const cardHighlight = (item, {home = false, now = Date.now()} = {}) => {
	if (!item) return null;
	if (item._vjodRank) return {rank: item._vjodRank};
	if (item._vjodPill) return {pill: item._vjodPill};
	if (home && isFreshlyAdded(item, now)) return {pill: 'Nouveau'};
	return null;
};
