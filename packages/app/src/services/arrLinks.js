// Le lien direct vers un titre dans Radarr ou Sonarr (arr_links.dart de
// l'APK), construit comme l'interface web de Seerr à partir de la liste des
// serveurs (/settings/radarr, /settings/sonarr, réservée aux administrateurs).
// Sur la TV le lien part vers le téléphone en QR code.

export const buildArrUrl = (servers, {serviceId, slug, isMovie}) => {
	if (!slug || !String(slug).trim()) return null;
	const list = (Array.isArray(servers) ? servers : []).filter((s) => s && typeof s === 'object');
	// Le seul serveur, ou le premier, quand l'id ne correspond pas.
	const server = list.find((s) => s.id === serviceId) || list[0];
	if (!server) return null;
	let base = typeof server.externalUrl === 'string' ? server.externalUrl.trim() : '';
	if (!base) {
		const host = server.hostname == null ? '' : String(server.hostname).trim();
		if (!host) return null;
		const port = server.port == null ? '' : `:${server.port}`;
		const path = typeof server.baseUrl === 'string' ? server.baseUrl.trim() : '';
		base = `${server.useSsl === true ? 'https' : 'http'}://${host}${port}${path}`;
	}
	return `${base.replace(/\/+$/, '')}/${isMovie ? 'movie' : 'series'}/${String(slug).trim()}`;
};

// Le lien d'une demande, ou null (pas les droits, pas de slug). Les listes de
// serveurs sont lues une fois.
const serverLists = {};
export const arrUrlForRequest = async (seerr, request) => {
	const media = request && request.media;
	if (!media) return null;
	const isMovie = request.type === 'movie';
	const kind = isMovie ? 'radarr' : 'sonarr';
	try {
		if (!serverLists[kind]) serverLists[kind] = await (isMovie ? seerr.getRadarrSettings() : seerr.getSonarrSettings());
	} catch (e) {
		return null;
	}
	return buildArrUrl(serverLists[kind], {
		serviceId: request.is4k ? media.serviceId4k : media.serviceId,
		slug: request.is4k ? media.externalServiceSlug4k : media.externalServiceSlug,
		isMovie
	});
};

export const resetArrLinksForTests = () => {
	delete serverLists.radarr;
	delete serverLists.sonarr;
};
