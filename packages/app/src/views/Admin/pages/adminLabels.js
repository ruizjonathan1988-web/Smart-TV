// Libellés partagés entre les pages : types de médias, types de bibliothèque,
// gravité des entrées du journal, jours de la semaine.
import {t} from '../adminText';

const METRIC_KEYS = {
	movies: 'movies',
	series: 'series',
	episodes: 'episodes',
	albums: 'albums',
	songs: 'songs',
	books: 'books',
	audiobooks: 'audiobooks',
	collections: 'collections',
	musicVideos: 'musicVideos',
	photos: 'photos',
	videos: 'videos'
};

export const metricLabel = (key) => (METRIC_KEYS[key] ? t(METRIC_KEYS[key]) : key);

export const LIBRARY_TYPES = ['movies', 'tvshows', 'music', 'musicvideos', 'books', 'homevideos', 'boxsets', 'playlists', 'mixed'];

const TYPE_LABELS = {
	movies: 'movies',
	tvshows: 'tvShows',
	music: 'music',
	musicvideos: 'musicVideos',
	books: 'books',
	photos: 'photos',
	homevideos: 'homeVideos',
	boxsets: 'collections',
	playlists: 'playlists',
	livetv: 'liveTv'
};

const TYPE_ICONS = {
	movies: 'movie_filter',
	tvshows: 'tv',
	music: 'queue_music',
	musicvideos: 'theaters',
	books: 'menu_book',
	photos: 'photo_library',
	homevideos: 'photo_library',
	boxsets: 'collections_bookmark',
	playlists: 'playlist_play',
	livetv: 'settings_input_hdmi'
};

export const libraryTypeLabel = (type) => {
	if (!type || type === 'mixed') return t('mixedContent');
	const k = TYPE_LABELS[String(type).toLowerCase()];
	return k ? t(k) : type;
};

export const libraryTypeIcon = (type) => TYPE_ICONS[String(type || '').toLowerCase()] || 'folder';

export const severityTone = (severity) => {
	switch (String(severity || '').toLowerCase()) {
		case 'error':
		case 'critical':
			return {tone: 'bad', icon: 'warning'};
		case 'warning':
		case 'warn':
			return {tone: 'warn', icon: 'warning'};
		case 'information':
			return {tone: 'accent', icon: 'info'};
		default:
			return {tone: null, icon: 'info'};
	}
};

export const SEVERITIES = ['Trace', 'Debug', 'Information', 'Warning', 'Error', 'Critical', 'None'];
export const severityLabel = (s) => t(`adminLogLevel${s}`);

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayLabel = (d) => t(`adminDay${d}`);
