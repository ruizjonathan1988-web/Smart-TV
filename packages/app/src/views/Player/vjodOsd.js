// Le lecteur dans le look VJOD (video_player_screen.dart, _vjodOsd) : reculer,
// lecture, avancer ; à droite « Audio et sous-titres », « Épisodes » et
// « Épisode suivant », puis « … » qui montre les icônes habituelles.
const TRANSPORT = ['rewind', 'playPause', 'forward'];
const TRACK_IDS = ['audio', 'subtitles'];

export const vjodOsdButtons = ({topButtons = [], bottomButtons = [], more = false, nextIcon = null}) => {
	const transport = TRANSPORT.map((id) => topButtons.find((b) => b.id === id)).filter(Boolean);
	const next = topButtons.find((b) => b.id === 'next' || b.id === 'nextTrack');
	const tracks = bottomButtons.filter((b) => TRACK_IDS.includes(b.id));
	const episodes = bottomButtons.find((b) => b.id === 'episodes');
	const words = [];
	if (tracks.length === 2) words.push({id: 'vjodTracks', label: 'Audio et sous-titres', action: 'vjodTracks'});
	else if (tracks.length === 1) words.push({id: tracks[0].id, label: 'Audio et sous-titres', action: tracks[0].action});
	if (episodes) words.push({id: 'episodes', label: 'Épisodes', action: episodes.action});
	if (next) words.push({id: next.id, label: 'Épisode suivant', action: next.action, icon: nextIcon});
	const extra = more ? bottomButtons.filter((b) => !TRACK_IDS.includes(b.id) && b.id !== 'episodes') : [];
	return {transport, words, extra};
};

// Le titre : la série (ou le film) en capitales, puis « Saison 1 · Épisode 2 · Titre ».
export const vjodTitleLines = (item, fallback) => {
	const series = item && item.SeriesName;
	const name = (item && item.Name) || fallback || '';
	const line = [
		item && item.ParentIndexNumber != null ? `Saison ${item.ParentIndexNumber}` : null,
		item && item.IndexNumber != null && series ? `Épisode ${item.IndexNumber}` : null,
		series ? name : null
	].filter(Boolean).join(' · ');
	return {main: series || name, line};
};
