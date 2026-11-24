// Les options d'une bibliothèque (library_options_defaults.dart de l'APK).
// Chaque liste de fournisseurs vient de /Libraries/AvailableOptions, et une
// liste absente vaut « les fournisseurs activés par défaut » : on écrit ces
// listes effectives dans les options pour que les pages les lisent et les
// modifient directement.

// Par type : (clé disponible, clé activée, clé d'ordre).
const TYPE_KEYS = [
	['MetadataFetchers', 'MetadataFetchers', 'MetadataFetcherOrder'],
	['ImageFetchers', 'ImageFetchers', 'ImageFetcherOrder'],
	['SimilarItemProviders', 'SimilarItemProviders', 'SimilarItemProviderOrder']
];

// Pour toute la bibliothèque : (clé disponible, clé désactivée, clé d'ordre).
export const GLOBAL_KEYS = [
	['SubtitleFetchers', 'DisabledSubtitleFetchers', 'SubtitleFetcherOrder'],
	['LyricFetchers', 'DisabledLyricFetchers', 'LyricFetcherOrder'],
	['LyricsFetchers', 'DisabledLyricsFetchers', 'LyricsFetcherOrder'],
	['MediaSegmentProviders', 'DisabledMediaSegmentProviders', 'MediaSegmentProviderOrder']
];

export const providers = (raw) => (Array.isArray(raw) ? raw.filter((e) => e && typeof e === 'object').map((e) => ({...e})) : []);

const strings = (raw) => (Array.isArray(raw) ? raw.map(String) : null);

const defaultEnabled = (list) => list.filter((p) => p.DefaultEnabled === true).map((p) => String(p.Name));

// Les noms configurés d'abord, puis les autres fournisseurs proposés ; ceux qui ont disparu sortent.
export const ordered = (available, order) => {
	const names = available.map((p) => (p.Name == null ? '' : String(p.Name)));
	return order.filter((n) => names.indexOf(n) >= 0).concat(names.filter((n) => n && order.indexOf(n) < 0));
};

export const seedLibraryOptions = (options, available) => {
	const avail = available || {};
	const savers = providers(avail.MetadataSavers);
	if (savers.length) options.MetadataSavers = strings(options.MetadataSavers) || defaultEnabled(savers);
	const readers = providers(avail.MetadataReaders);
	if (readers.length) options.LocalMetadataReaderOrder = ordered(readers, strings(options.LocalMetadataReaderOrder) || []);
	GLOBAL_KEYS.forEach(([availKey, disabledKey, orderKey]) => {
		const list = providers(avail[availKey]);
		if (!list.length) return;
		options[orderKey] = ordered(list, strings(options[orderKey]) || []);
		options[disabledKey] = strings(options[disabledKey]) || list.filter((p) => p.DefaultEnabled !== true).map((p) => String(p.Name));
	});
	const typeOptions = (Array.isArray(options.TypeOptions) ? options.TypeOptions : []).filter((x) => x && typeof x === 'object').map((x) => ({...x}));
	providers(avail.TypeOptions).forEach((availType) => {
		const type = availType.Type == null ? null : String(availType.Type);
		if (!type) return;
		TYPE_KEYS.forEach(([availKey, enabledKey, orderKey]) => {
			const list = providers(availType[availKey]);
			if (!list.length) return;
			let stored = typeOptions.find((x) => x.Type === type);
			if (!stored) {
				stored = {Type: type};
				typeOptions.push(stored);
			}
			stored[orderKey] = ordered(list, strings(stored[orderKey]) || []);
			stored[enabledKey] = strings(stored[enabledKey]) || defaultEnabled(list);
		});
	});
	options.TypeOptions = typeOptions;
	return options;
};

// Les options d'une nouvelle bibliothèque (le serveur les garde telles qu'envoyées).
export const jellyfinNewLibraryOptions = () => ({
	Enabled: true,
	EnablePhotos: true,
	EnableRealtimeMonitor: true,
	EnableLUFSScan: true,
	ExtractTrickplayImagesDuringLibraryScan: false,
	SaveTrickplayWithMedia: false,
	EnableTrickplayImageExtraction: false,
	ExtractChapterImagesDuringLibraryScan: false,
	EnableChapterImageExtraction: false,
	EnableInternetProviders: true,
	SaveLocalMetadata: false,
	EnableAutomaticSeriesGrouping: false,
	PreferredMetadataLanguage: '',
	MetadataCountryCode: '',
	SeasonZeroDisplayName: 'Specials',
	AutomaticRefreshIntervalDays: 0,
	EnableEmbeddedTitles: false,
	EnableEmbeddedExtrasTitles: false,
	EnableEmbeddedEpisodeInfos: false,
	AllowEmbeddedSubtitles: 'AllowAll',
	SkipSubtitlesIfEmbeddedSubtitlesPresent: false,
	SkipSubtitlesIfAudioTrackMatches: false,
	SaveSubtitlesWithMedia: true,
	SaveLyricsWithMedia: false,
	RequirePerfectSubtitleMatch: true,
	AutomaticallyAddToCollection: false,
	PreferNonstandardArtistsTag: false,
	UseCustomTagDelimiters: false,
	SubtitleDownloadLanguages: [],
	CustomTagDelimiters: ['/', '|', ';', '\\'],
	DelimiterWhitelist: [],
	TypeOptions: []
});

export const newLibraryOptions = (available) => seedLibraryOptions(
	available && available.DefaultLibraryOptions && typeof available.DefaultLibraryOptions === 'object'
		? {...available.DefaultLibraryOptions}
		: jellyfinNewLibraryOptions(),
	available
);

// Déplace un nom d'une place vers le haut (-1) ou le bas (+1) dans une liste d'ordre.
export const moveInOrder = (list, index, delta) => {
	const out = (list || []).slice();
	const target = index + delta;
	if (target < 0 || target >= out.length) return out;
	const [x] = out.splice(index, 1);
	out.splice(target, 0, x);
	return out;
};

// Coche ou décoche un nom dans une liste.
export const toggleName = (list, name, on) => {
	const rest = (list || []).filter((n) => n !== name);
	return on ? rest.concat([name]) : rest;
};

// Ce que la bibliothèque propose selon son type (visibilité des sections).
export const libraryTraits = (collectionType) => {
	const type = collectionType || null;
	return {
		type,
		subtitles: ['tvshows', 'movies', 'musicvideos', 'mixed'].indexOf(type) >= 0,
		chapters: type === null || ['homevideos', 'movies', 'musicvideos', 'tvshows'].indexOf(type) >= 0,
		embeddedTitles: ['books', 'boxsets', 'playlists', 'music'].indexOf(type) < 0,
		resume: type === null || ['tvshows', 'movies', 'homevideos', 'musicvideos', 'mixed', 'audiobooks'].indexOf(type) >= 0
	};
};

// Les options d'images d'un type (ImageOptions) : celles enregistrées, sinon celles par défaut.
export const imageOptionFor = (stored, defaults, imageType) => (stored || []).find((o) => o.Type === imageType) ||
	(defaults || []).find((o) => o.Type === imageType) ||
	{Type: imageType, Limit: imageType === 'Primary' ? 1 : 0, MinWidth: 0};
