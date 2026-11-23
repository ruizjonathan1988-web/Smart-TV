// Les routes d'administration de Jellyfin, reprises des Admin*Api de l'APK
// (packages/server_jellyfin/lib/src/api/jellyfin_admin_*.dart) : configuration
// du serveur, utilisateurs, bibliothèques, tâches, plugins, appareils, clés,
// sauvegardes, journaux, TV en direct et édition des métadonnées.
//
// `createAdminApi({fetch, baseUrl, authHeader})` se teste sans serveur ;
// `adminApi()` lie les routes au serveur sur lequel l'appli est connectée.
import {getServerUrl, getAuthHeader} from './jellyfinApi';
import {platformFetch} from './secureFetch';

const DEFAULT_TIMEOUT_MS = 30000;
// Une sauvegarde peut durer des heures (l'APK attend jusqu'à 12 h).
const BACKUP_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Les paramètres vides (null, undefined, '') ne partent pas, comme `?key` en Dart.
export const toQuery = (params) => {
	if (!params) return '';
	const parts = Object.keys(params)
		.filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
		.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`);
	return parts.length ? `?${parts.join('&')}` : '';
};

const enc = encodeURIComponent;

const asList = (data) => {
	if (Array.isArray(data)) return data.filter((e) => e && typeof e === 'object');
	if (data && typeof data === 'object') {
		const items = data.Items || data.items || data.Results || data.results;
		if (Array.isArray(items)) return items.filter((e) => e && typeof e === 'object');
	}
	return [];
};

const asMap = (data) => (data && typeof data === 'object' && !Array.isArray(data) ? data : {});

// Les versions de plugin comme « 10.9.0.0-beta » : le serveur peut ne connaître que « 10.9.0.0 ».
export const versionCandidates = (version) => {
	const trimmed = String(version == null ? '' : version).trim();
	const out = [trimmed || String(version == null ? '' : version)];
	const core = /^\d+(?:\.\d+){1,3}/.exec(trimmed);
	if (core && out.indexOf(core[0]) < 0) out.push(core[0]);
	return out;
};

export class AdminApiError extends Error {
	constructor (status, body) {
		super(`Erreur ${status}`);
		this.status = status;
		this.body = body;
	}
}

export const createAdminApi = ({fetch: send, baseUrl, authHeader}) => {
	const base = () => (typeof baseUrl === 'function' ? baseUrl() : baseUrl) || '';
	const auth = () => (typeof authHeader === 'function' ? authHeader() : authHeader);

	const call = async (method, path, {query, body, raw, contentType, timeoutMs} = {}) => {
		const headers = {Authorization: auth()};
		let payload;
		if (raw !== undefined) {
			payload = raw;
			headers['Content-Type'] = contentType || 'text/plain';
		} else if (body !== undefined) {
			payload = JSON.stringify(body);
			headers['Content-Type'] = 'application/json';
		}
		const response = await send(`${base()}${path}${toQuery(query)}`, {method, headers, body: payload}, timeoutMs || DEFAULT_TIMEOUT_MS);
		if (!response.ok) {
			let detail = '';
			try {
				detail = String(await response.text()).replace(/\s+/g, ' ').trim().slice(0, 500);
			} catch {
				// le code suffit
			}
			throw new AdminApiError(response.status, detail);
		}
		if (response.status === 204) return null;
		const text = await response.text();
		if (!text) return null;
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	};
	const get = (path, query, opts) => call('GET', path, {query, ...opts});
	const post = (path, body, query, opts) => call('POST', path, {body, query, ...opts});
	const del = (path, query) => call('DELETE', path, {query});

	// POST puis repli sur l'ancienne route (Jellyfin 10.8 et avant), comme _postWithLegacy.
	const postWithLegacy = async (path, legacyPath, userId, data) => {
		try {
			await post(path, data, {userId});
		} catch (e) {
			if (e.status === 400 || e.status === 404 || e.status === 405) {
				await post(legacyPath, data);
				return;
			}
			throw e;
		}
	};

	const withVersionFallback = async (pluginId, version, run) => {
		let lastNotFound = null;
		for (const candidate of versionCandidates(version)) {
			try {
				await run(`/Plugins/${enc(pluginId)}/${enc(candidate)}`);
				return;
			} catch (e) {
				if (e.status === 404) {
					lastNotFound = e;
					continue;
				}
				throw e;
			}
		}
		if (lastNotFound) throw lastNotFound;
	};

	return {
		call,

		// ---------------------------------------------------------- système
		getSystemInfo: () => get('/System/Info'),
		getServerConfiguration: async () => asMap(await get('/System/Configuration')),
		updateServerConfiguration: (config) => post('/System/Configuration', config),
		getNamedConfiguration: async (key) => asMap(await get(`/System/Configuration/${enc(key)}`)),
		updateNamedConfiguration: (key, config) => post(`/System/Configuration/${enc(key)}`, config),
		getStorageInfo: () => get('/System/Info/Storage'),
		restartServer: () => post('/System/Restart'),
		shutdownServer: () => post('/System/Shutdown'),
		getLogFiles: async () => asList(await get('/System/Logs')),
		getLogFileContent: async (name) => {
			const text = await get('/System/Logs/Log', {name}, {timeoutMs: 120000});
			return typeof text === 'string' ? text : JSON.stringify(text);
		},
		getActivityLog: ({startIndex, limit, hasUserId, minDate, maxDate, severity, username} = {}) => get('/System/ActivityLog/Entries', {
			startIndex,
			limit,
			hasUserId,
			minDate: minDate ? new Date(minDate).toISOString() : undefined,
			maxDate: maxDate ? new Date(maxDate).toISOString() : undefined,
			severity,
			username
		}),
		getCultures: async () => asList(await get('/Localization/Cultures')),
		getCountries: async () => asList(await get('/Localization/Countries')),
		getLocalizationOptions: async () => asList(await get('/Localization/Options')),
		getParentalRatings: async () => asList(await get('/Localization/ParentalRatings')),
		getAuthProviders: async () => asList(await get('/Auth/Providers')),
		getPasswordResetProviders: async () => asList(await get('/Auth/PasswordResetProviders')),
		deleteSplashscreen: () => del('/Branding/Splashscreen'),
		splashUrl: (version) => `${base()}/Branding/Splashscreen${toQuery({t: version})}`,
		getBrandingOptions: () => get('/Branding/Configuration'),
		getItemCounts: async () => asMap(await get('/Items/Counts')),

		// ---------------------------------------------------------- sessions (tableau de bord)
		getSessions: async (activeWithinSeconds = 960) => asList(await get('/Sessions', {activeWithinSeconds})),
		sendSessionMessage: (sessionId, text, timeoutMs = 5000) => post(`/Sessions/${enc(sessionId)}/Message`, {Header: '', Text: text, TimeoutMs: timeoutMs}),
		sendSessionPlaystate: (sessionId, command, seekPositionTicks) => post(`/Sessions/${enc(sessionId)}/Playing/${enc(command)}`, undefined, {seekPositionTicks}),
		sendSessionCommand: (sessionId, name, args) => post(`/Sessions/${enc(sessionId)}/Command`, {Name: name, Arguments: args || {}}),

		// ---------------------------------------------------------- utilisateurs
		getUsers: async (query) => asList(await get('/Users', query)),
		getUser: (userId) => get(`/Users/${enc(userId)}`),
		createUser: (name, password) => post('/Users/New', {Name: name, ...(password ? {Password: password} : null)}),
		deleteUser: (userId) => del(`/Users/${enc(userId)}`),
		updateUser: (userId, user) => postWithLegacy('/Users', `/Users/${enc(userId)}`, userId, user),
		updateUserPolicy: (userId, policy) => post(`/Users/${enc(userId)}/Policy`, policy),
		updateUserPassword: (userId, {currentPassword, newPassword, resetPassword = false} = {}) => postWithLegacy('/Users/Password', `/Users/${enc(userId)}/Password`, userId, {
			...(currentPassword != null ? {CurrentPw: currentPassword} : null),
			...(newPassword != null ? {NewPw: newPassword} : null),
			ResetPassword: resetPassword
		}),
		getChannels: async (supportsMediaDeletion) => asList(await get('/Channels', {supportsMediaDeletion})),

		// ---------------------------------------------------------- bibliothèques
		getVirtualFolders: async () => asList(await get('/Library/VirtualFolders')),
		addVirtualFolder: ({name, collectionType, paths, libraryOptions, refreshLibrary = false}) => {
			const hasPaths = Array.isArray(paths) && paths.length > 0;
			const body = {};
			if (libraryOptions || hasPaths) {
				body.LibraryOptions = {...(libraryOptions || {})};
				if (hasPaths) body.LibraryOptions.PathInfos = paths.map((p) => ({Path: p}));
			}
			return post('/Library/VirtualFolders', body, {name, collectionType, refreshLibrary});
		},
		removeVirtualFolder: (name, refreshLibrary = false) => del('/Library/VirtualFolders', {name, refreshLibrary}),
		renameVirtualFolder: (name, newName, refreshLibrary = false) => post('/Library/VirtualFolders/Name', undefined, {name, newName, refreshLibrary}),
		addMediaPath: (libraryName, path, refreshLibrary = false) => post('/Library/VirtualFolders/Paths', {Name: libraryName, Path: path}, {refreshLibrary}),
		updateMediaPath: (libraryName, pathInfo) => post('/Library/VirtualFolders/Paths/Update', {Name: libraryName, PathInfo: pathInfo}),
		removeMediaPath: (libraryName, path, refreshLibrary = false) => del('/Library/VirtualFolders/Paths', {name: libraryName, path, refreshLibrary}),
		updateLibraryOptions: (libraryId, options) => post('/Library/VirtualFolders/LibraryOptions', {Id: libraryId, LibraryOptions: options}),
		refreshLibrary: () => post('/Library/Refresh'),
		getMediaFolders: async (isHidden) => asList(await get('/Library/MediaFolders', {isHidden})),
		getAvailableLibraryOptions: async (contentType, isNewLibrary = false) => asMap(await get('/Libraries/AvailableOptions', {libraryContentType: contentType, isNewLibrary})),

		// ---------------------------------------------------------- fichiers du serveur
		getDirectoryContents: async (path, {includeFiles, includeDirectories} = {}) => asList(await get('/Environment/DirectoryContents', {path, includeFiles, includeDirectories})),
		validatePath: (path, {writable = false, isFile} = {}) => post('/Environment/ValidatePath', {ValidateWritable: writable, Path: path, ...(isFile != null ? {IsFile: isFile} : null)}),
		getDrives: async () => asList(await get('/Environment/Drives')),
		getParentPath: (path) => get('/Environment/ParentPath', {path}),

		// ---------------------------------------------------------- tâches planifiées
		getTasks: async (isHidden) => asList(await get('/ScheduledTasks', {isHidden})),
		getTask: (taskId) => get(`/ScheduledTasks/${enc(taskId)}`),
		startTask: (taskId) => post(`/ScheduledTasks/Running/${enc(taskId)}`),
		stopTask: (taskId) => del(`/ScheduledTasks/Running/${enc(taskId)}`),
		updateTaskTriggers: (taskId, triggers) => post(`/ScheduledTasks/${enc(taskId)}/Triggers`, triggers),

		// ---------------------------------------------------------- plugins et dépôts
		getInstalledPlugins: async () => asList(await get('/Plugins')),
		enablePlugin: (pluginId, version) => withVersionFallback(pluginId, version, (p) => post(`${p}/Enable`)),
		disablePlugin: (pluginId, version) => withVersionFallback(pluginId, version, (p) => post(`${p}/Disable`)),
		uninstallPlugin: (pluginId, version) => withVersionFallback(pluginId, version, (p) => del(p)),
		getPluginConfiguration: async (pluginId) => asMap(await get(`/Plugins/${enc(pluginId)}/Configuration`)),
		updatePluginConfiguration: (pluginId, config) => post(`/Plugins/${enc(pluginId)}/Configuration`, config),
		getPluginImageUrl: (plugin) => `${base()}/Plugins/${enc(plugin.Id)}/${enc(plugin.Version)}/Image`,
		getAvailablePackages: async () => asList(await get('/Packages')),
		getConfigurationPages: async () => asList(await get('/web/ConfigurationPages')),
		getPackageInfo: async (name, assemblyGuid) => {
			try {
				return await get(`/Packages/${enc(name)}`, {assemblyGuid});
			} catch (e) {
				if (e.status === 404) return null;
				throw e;
			}
		},
		installPackage: (name, {assemblyGuid, version, repositoryUrl} = {}) => post(`/Packages/Installed/${enc(name)}`, undefined, {assemblyGuid, version, repositoryUrl}),
		cancelPackageInstallation: (packageId) => del(`/Packages/Installing/${enc(packageId)}`),
		getRepositories: async () => asList(await get('/Repositories')),
		setRepositories: (repositories) => post('/Repositories', repositories),

		// ---------------------------------------------------------- appareils
		getDevices: async (userId) => asList(await get('/Devices', {userId})),
		getDeviceInfo: (id) => get('/Devices/Info', {id}),
		getDeviceOptions: async (id) => asMap(await get('/Devices/Options', {id})),
		updateDeviceOptions: (id, options) => post('/Devices/Options', options, {id}),
		deleteDevice: (id) => del('/Devices', {id}),

		// ---------------------------------------------------------- clés API
		getApiKeys: async () => asList(await get('/Auth/Keys')),
		createApiKey: (appName) => post('/Auth/Keys', undefined, {app: appName}),
		revokeApiKey: (key) => del(`/Auth/Keys/${enc(key)}`),

		// ---------------------------------------------------------- sauvegardes
		getBackups: async () => asList(await get('/Backup')),
		createBackup: async (options) => asMap(await post('/Backup/Create', options || {}, undefined, {timeoutMs: BACKUP_TIMEOUT_MS})),
		restoreBackup: (backupPath) => post('/Backup/Restore', {ArchiveFileName: backupPath}),
		getBackupManifest: async (backupPath) => asMap(await get('/Backup/Manifest', {path: backupPath})),

		// ---------------------------------------------------------- TV en direct
		getLiveTvConfiguration: async () => asMap(await get('/System/Configuration/livetv')),
		updateLiveTvConfiguration: (config) => post('/System/Configuration/livetv', config),
		getTunerHostTypes: async () => asList(await get('/LiveTv/TunerHosts/Types')),
		addTunerHost: async (tunerInfo) => asMap(await post('/LiveTv/TunerHosts', tunerInfo)),
		removeTunerHost: (id) => del('/LiveTv/TunerHosts', {id}),
		discoverTuners: async () => asList(await get('/LiveTv/Tuners/Discover', {NewDevicesOnly: true})),
		resetTuner: (id) => post(`/LiveTv/Tuners/${enc(id)}/Reset`),
		getDefaultListingProvider: async () => asMap(await get('/LiveTv/ListingProviders/Default')),
		addListingProvider: async (providerInfo, {validateLogin = false, validateListings = false} = {}) => asMap(await post('/LiveTv/ListingProviders', providerInfo, {
			ValidateLogin: validateLogin || undefined,
			ValidateListings: validateListings || undefined
		})),
		removeListingProvider: (id) => del('/LiveTv/ListingProviders', {id}),
		getSchedulesDirectCountries: async () => {
			const data = await get('/LiveTv/ListingProviders/SchedulesDirect/Countries');
			const countries = [];
			if (data && typeof data === 'object') {
				Object.keys(data).forEach((region) => {
					if (region === 'ZZZ' || !Array.isArray(data[region])) return;
					data[region].forEach((c) => {
						if (c && typeof c === 'object') countries.push(c);
					});
				});
			}
			const name = (c) => String(c.fullName || '');
			return countries.sort((a, b) => name(a).localeCompare(name(b)));
		},
		getListingProviderLineups: async ({providerId, location, country}) => asList(await get('/LiveTv/ListingProviders/Lineups', {Id: providerId, Location: location, Country: country})),
		getChannelMappingOptions: async (providerId) => asMap(await get('/LiveTv/ChannelMappingOptions', {providerId})),
		setChannelMapping: async (providerId, tunerChannelId, providerChannelId) => asMap(await post('/LiveTv/ChannelMappings', {
			ProviderId: providerId,
			TunerChannelId: tunerChannelId,
			ProviderChannelId: providerChannelId
		})),

		// ---------------------------------------------------------- éléments (métadonnées)
		getItem: (userId, itemId) => get(`/Users/${enc(userId)}/Items/${enc(itemId)}`),
		searchItems: async (userId, query) => asMap(await get(`/Users/${enc(userId)}/Items`, query)),
		updateItem: (itemId, itemData) => post(`/Items/${enc(itemId)}`, itemData),
		getMetadataEditor: async (itemId) => asMap(await get(`/Items/${enc(itemId)}/MetadataEditor`)),
		updateContentType: (itemId, contentType) => post(`/Items/${enc(itemId)}/ContentType`, undefined, {ContentType: contentType}),
		refreshItem: (itemId, {recursive, replaceAllMetadata, replaceAllImages, regenerateTrickplay, metadataRefreshMode = 'Default', imageRefreshMode = 'Default'} = {}) => post(`/Items/${enc(itemId)}/Refresh`, undefined, {
			Recursive: recursive,
			MetadataRefreshMode: metadataRefreshMode,
			ImageRefreshMode: imageRefreshMode,
			ReplaceAllMetadata: replaceAllMetadata,
			ReplaceAllImages: replaceAllImages,
			RegenerateTrickplay: regenerateTrickplay
		}),
		getExternalIdInfos: async (itemId) => asList(await get(`/Items/${enc(itemId)}/ExternalIdInfos`)),
		searchRemote: async (searchType, query) => asList(await post(`/Items/RemoteSearch/${enc(searchType)}`, query)),
		applyRemoteSearchResult: (itemId, result, replaceAllImages = true) => post(`/Items/RemoteSearch/Apply/${enc(itemId)}`, result, {replaceAllImages}),
		getRemoteImages: async (itemId, {imageType, startIndex, limit, providerName, includeAllLanguages}) => {
			const data = asMap(await get(`/Items/${enc(itemId)}/RemoteImages`, {Type: imageType, StartIndex: startIndex, Limit: limit, ProviderName: providerName, IncludeAllLanguages: includeAllLanguages}));
			return {
				Images: asList(data.Images),
				Providers: Array.isArray(data.Providers) ? data.Providers.map(String).filter(Boolean) : [],
				TotalRecordCount: data.TotalRecordCount || 0
			};
		},
		downloadRemoteImage: (itemId, {imageType, imageUrl}) => post(`/Items/${enc(itemId)}/RemoteImages/Download`, undefined, {Type: imageType, ImageUrl: imageUrl}),
		deleteItemImage: (itemId, {imageType, imageIndex}) => del(`/Items/${enc(itemId)}/Images/${enc(imageType)}`, {ImageIndex: imageIndex}),
		imageUrl: (itemId, type = 'Primary', tag, maxWidth = 400) => `${base()}/Items/${enc(itemId)}/Images/${enc(type)}${toQuery({tag, maxWidth})}`,
		userImageUrl: (userId, tag) => `${base()}/Users/${enc(userId)}/Images/Primary${toQuery({tag, maxWidth: 160})}`
	};
};

let bound = null;
// Les routes d'admin sur le serveur de la session en cours.
export const adminApi = () => {
	if (!bound) {
		bound = createAdminApi({fetch: platformFetch, baseUrl: getServerUrl, authHeader: getAuthHeader});
	}
	return bound;
};

// Un message d'erreur lisible pour l'administrateur.
export const describeAdminError = (error) => {
	if (!error) return 'Erreur inconnue';
	if (error.status === 401 || error.status === 403) return 'Accès refusé : ce compte n’est pas administrateur.';
	if (error.status === 404) return 'Introuvable sur ce serveur.';
	if (error.status) return error.body ? `Erreur ${error.status} : ${error.body}` : `Erreur ${error.status}`;
	return error.message || 'Erreur inconnue';
};
