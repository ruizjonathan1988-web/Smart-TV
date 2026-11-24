// Les pages de la console, regroupées par tâche comme admin_nav.dart de l'APK
// (seules les pages de Jellyfin : celles réservées à Emby n'existent pas ici).
import {t} from './adminText';

export const ADMIN_GROUPS = [
	{
		id: 'overview',
		icon: 'insights',
		title: 'adminGroupOverview',
		pages: [
			{id: 'dashboard', icon: 'dashboard_customize', title: 'adminDrawerDashboard', desc: 'adminPageDescDashboard'},
			{id: 'analytics', icon: 'bar_chart', title: 'adminDrawerAnalytics', desc: 'adminPageDescAnalytics'},
			{id: 'activity', icon: 'history', title: 'adminDrawerActivity', desc: 'adminPageDescActivity'},
			{id: 'tasks', icon: 'schedule', title: 'adminDrawerScheduledTasks', desc: 'adminPageDescTasks'}
		]
	},
	{
		id: 'library',
		icon: 'video_library',
		title: 'adminGroupLibrary',
		pages: [
			{id: 'libraries', icon: 'movie_filter', title: 'adminDrawerLibraries', desc: 'adminPageDescLibraries'},
			{id: 'display', icon: 'grid_view', title: 'adminDrawerDisplay', desc: 'adminPageDescDisplay'},
			{id: 'metadata', icon: 'description', title: 'adminDrawerMetadata', desc: 'adminPageDescMetadata'},
			{id: 'nfo', icon: 'text_snippet', title: 'adminDrawerNfo', desc: 'adminPageDescNfo'},
			{id: 'livetv', icon: 'settings_input_hdmi', title: 'adminDrawerLiveTv', desc: 'adminPageDescLiveTv'}
		]
	},
	{
		id: 'playback',
		icon: 'play_circle',
		title: 'adminGroupPlayback',
		pages: [
			{id: 'transcoding', icon: 'swap_horiz', title: 'adminDrawerTranscoding', desc: 'adminPageDescTranscoding'},
			{id: 'resume', icon: 'replay', title: 'adminDrawerResume', desc: 'adminPageDescResume'},
			{id: 'streaming', icon: 'speed', title: 'adminDrawerStreaming', desc: 'adminPageDescStreaming'},
			{id: 'trickplay', icon: 'view_carousel', title: 'adminDrawerTrickplay', desc: 'adminPageDescTrickplay'}
		]
	},
	{
		id: 'people',
		icon: 'groups',
		title: 'adminGroupPeople',
		pages: [
			{id: 'users', icon: 'person', title: 'adminDrawerUsers', desc: 'adminPageDescUsers'},
			{id: 'devices', icon: 'tv', title: 'adminDrawerDevices', desc: 'adminPageDescDevices'},
			{id: 'keys', icon: 'lock', title: 'adminDrawerApiKeys', desc: 'adminPageDescApiKeys'}
		]
	},
	{
		id: 'system',
		icon: 'tune',
		title: 'adminGroupSystem',
		pages: [
			{id: 'settings', icon: 'settings', title: 'adminDrawerSettings', desc: 'adminPageDescSettings'},
			{id: 'branding', icon: 'palette', title: 'adminDrawerBranding', desc: 'adminPageDescBranding'},
			{id: 'networking', icon: 'language', title: 'adminDrawerNetworking', desc: 'adminPageDescNetworking'},
			{id: 'plugins', icon: 'plug', title: 'adminDrawerPlugins', desc: 'adminPageDescPlugins'},
			{id: 'repositories', icon: 'folder_code', title: 'adminDrawerRepositories', desc: 'adminPageDescRepositories'},
			{id: 'backups', icon: 'cloud_download', title: 'adminDrawerBackups', desc: 'adminPageDescBackups'},
			{id: 'logs', icon: 'article', title: 'adminDrawerLogs', desc: 'adminPageDescLogs'}
		]
	}
];

export const pageById = (id) => {
	for (const g of ADMIN_GROUPS) {
		for (const p of g.pages) {
			if (p.id === id) return p;
		}
	}
	return null;
};

export const groupOfPage = (id) => ADMIN_GROUPS.find((g) => g.pages.some((p) => p.id === id)) || ADMIN_GROUPS[0];

export const pageTitle = (id) => {
	const p = pageById(id);
	return p ? t(p.title) : '';
};

// Le serveur doit être un Jellyfin et le compte administrateur (adminServerSupported).
export const canAdminister = (user, serverType) => Boolean(user && user.Policy && user.Policy.IsAdministrator) &&
	(!serverType || serverType === 'jellyfin');
