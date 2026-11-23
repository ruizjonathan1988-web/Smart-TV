// Analyses du contenu (admin_media_analytics_provider.dart de l'APK) :
// totaux par type, puis pour chaque bibliothèque la lecture de ses éléments
// pour compter genres, auteurs ou artistes, années, classifications, durées,
// conteneurs et codecs. Une catégorie choisie liste ses éléments.

export const METRICS = [
	{key: 'movies', types: ['Movie'], counts: 'MovieCount'},
	{key: 'series', types: ['Series'], counts: 'SeriesCount'},
	{key: 'episodes', types: ['Episode'], counts: 'EpisodeCount'},
	{key: 'albums', types: ['MusicAlbum'], counts: 'AlbumCount'},
	{key: 'songs', types: ['Audio'], counts: 'SongCount'},
	{key: 'books', types: ['Book'], counts: 'BookCount'},
	{key: 'audiobooks', types: ['AudioBook'], counts: null},
	{key: 'collections', types: ['BoxSet'], counts: 'BoxSetCount'},
	{key: 'musicVideos', types: ['MusicVideo'], counts: 'MusicVideoCount'},
	{key: 'photos', types: ['Photo'], counts: null},
	{key: 'videos', types: ['Video'], counts: null}
];

// Les cartes de comptes du tableau de bord : toutes lues dans /Items/Counts.
export const DASHBOARD_METRICS = ['movies', 'series', 'episodes', 'albums', 'songs', 'musicVideos', 'books', 'collections'];

const metricsFor = (keys) => METRICS.filter((m) => keys.indexOf(m.key) >= 0);

export const metricsForCollectionType = (collectionType) => {
	switch (String(collectionType || '').toLowerCase()) {
		case 'movies': return metricsFor(['movies']);
		case 'tvshows': return metricsFor(['series', 'episodes']);
		case 'music': return metricsFor(['albums', 'songs']);
		case 'musicvideos': return metricsFor(['musicVideos']);
		case 'books': return metricsFor(['books', 'audiobooks']);
		case 'homevideos': return metricsFor(['videos', 'photos']);
		case 'boxsets': return [];
		default: return METRICS.filter((m) => m.key !== 'collections');
	}
};

// TV en direct, collections et listes de lecture n'ont pas de médias à elles.
export const skipsLibrary = (collectionType) => {
	const n = String(collectionType || '').toLowerCase();
	return n === 'livetv' || n === 'live tv' || n === 'boxsets' || n === 'collections' || n === 'playlists';
};

// Les types lus pour les détails d'une bibliothèque, null si elle n'en a pas.
export const insightTypesFor = (collectionType) => {
	switch (String(collectionType || '').toLowerCase()) {
		case 'movies': return ['Movie'];
		case 'tvshows': return ['Series', 'Episode'];
		case 'music': return ['Audio', 'MusicAlbum'];
		case 'books': return ['Book', 'AudioBook'];
		default: return null;
	}
};

export const runtimeBucket = (minutes) => {
	if (minutes < 15) return '<15m';
	if (minutes < 30) return '15-29m';
	if (minutes < 45) return '30-44m';
	if (minutes < 60) return '45-59m';
	if (minutes < 90) return '60-89m';
	if (minutes < 120) return '90-119m';
	return '120m+';
};
export const RUNTIME_ORDER = ['<15m', '15-29m', '30-44m', '45-59m', '60-89m', '90-119m', '120m+'];

const BOOK_FORMATS = ['epub', 'pdf', 'cbr', 'cbz', 'cb7', 'cbt', 'cba', 'mobi', 'azw', 'azw3', 'fb2', 'djvu', 'm4b', 'mp3', 'aac', 'flac', 'opus', 'ogg', 'wav'];

const token = (value) => {
	if (value === null || value === undefined) return null;
	const raw = String(value).trim().toLowerCase();
	if (!raw) return null;
	const parts = raw.split(/[,;|/ ]+/).filter(Boolean);
	return parts.length ? parts[0] : null;
};

const bookFormat = (path) => {
	if (!path) return null;
	const p = String(path).trim().toLowerCase();
	const name = p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1);
	const dot = name.lastIndexOf('.');
	if (dot <= 0 || dot === name.length - 1) return null;
	const ext = name.slice(dot + 1);
	return BOOK_FORMATS.indexOf(ext) >= 0 ? ext : null;
};

const strings = (value) => (Array.isArray(value) ? value.map((v) => String(v == null ? '' : v).trim()).filter(Boolean) : []);
const maps = (value) => (Array.isArray(value) ? value.filter((v) => v && typeof v === 'object') : []);

const distinct = (values) => {
	const seen = {};
	return values.filter((v) => {
		const k = v.toLowerCase();
		if (seen[k]) return false;
		seen[k] = true;
		return true;
	});
};

// Un élément réduit à ce que les graphiques comptent (AdminAnalyticsItem.fromJson).
export const analyticsItem = (item, collectionType) => {
	const type = String(collectionType || '').toLowerCase();
	const containers = [];
	const videoCodecs = [];
	const audioCodecs = [];
	let hasContainer = false;
	maps(item.MediaSources).forEach((source) => {
		if (type === 'books') {
			const f = bookFormat(source.Path);
			if (f) {
				containers.push(f);
				hasContainer = true;
			}
		}
		const c = token(source.Container);
		if (c && !(type === 'books' && hasContainer)) {
			containers.push(c);
			hasContainer = true;
		}
		maps(source.MediaStreams).forEach((stream) => {
			const st = token(stream.Type);
			const codec = token(stream.Codec);
			if (!codec) return;
			if (st === 'video') videoCodecs.push(codec);
			else if (st === 'audio') audioCodecs.push(codec);
		});
	});
	if (!hasContainer) {
		if (type === 'books') {
			const f = bookFormat(item.Path);
			if (f) {
				containers.push(f);
				hasContainer = true;
			}
		}
		const c = token(item.Container);
		if (c && !(type === 'books' && hasContainer)) containers.push(c);
	}
	let rating = null;
	let runtime = null;
	if (type === 'movies' || type === 'tvshows') {
		const r = String(item.OfficialRating || '').trim();
		if (r) rating = r.toUpperCase();
		if (Number(item.RunTimeTicks) > 0) runtime = runtimeBucket(Math.floor(Number(item.RunTimeTicks) / 600000000));
	}
	let contributors = [];
	if (type === 'music') {
		contributors = strings(item.Artists).concat(maps(item.AlbumArtists).filter((a) => a.Name != null).map((a) => String(a.Name)));
	} else {
		contributors = maps(item.People)
			.filter((p) => {
				const role = String(p.Type || '').toLowerCase();
				return (role === 'writer' || role === 'author') && p.Name != null;
			})
			.map((p) => String(p.Name));
	}
	let imageItemId = null;
	let imageTag = null;
	if (item.ImageTags && item.ImageTags.Primary) {
		imageItemId = item.Id;
		imageTag = item.ImageTags.Primary;
	} else if (item.SeriesId && item.SeriesPrimaryImageTag) {
		imageItemId = item.SeriesId;
		imageTag = item.SeriesPrimaryImageTag;
	} else if (item.AlbumId && item.AlbumPrimaryImageTag) {
		imageItemId = item.AlbumId;
		imageTag = item.AlbumPrimaryImageTag;
	}
	const year = Number(item.ProductionYear);
	return {
		id: String(item.Id || ''),
		name: String(item.Name || ''),
		type: String(item.Type || ''),
		parentName: item.SeriesName || item.AlbumArtist || null,
		year: year > 0 ? year : null,
		rating,
		runtime,
		genres: distinct(strings(item.Genres)),
		contributors: distinct(contributors),
		containers,
		videoCodecs,
		audioCodecs,
		imageItemId,
		imageTag
	};
};

// Compte sans tenir compte de la casse, sous la première graphie vue.
const counter = () => {
	const counts = {};
	const keys = {};
	return {
		counts,
		add: (value) => {
			const v = String(value || '').trim();
			if (!v) return;
			const k = keys[v.toLowerCase()] || (keys[v.toLowerCase()] = v);
			counts[k] = (counts[k] || 0) + 1;
		}
	};
};

export const insightsOf = (items) => {
	const c = {genres: counter(), contributors: counter(), years: counter(), ratings: counter(), runtimes: counter(), containers: counter(), videoCodecs: counter(), audioCodecs: counter()};
	(items || []).forEach((it) => {
		it.genres.forEach(c.genres.add);
		it.contributors.forEach(c.contributors.add);
		if (it.year) c.years.add(String(it.year));
		if (it.rating) c.ratings.add(it.rating);
		if (it.runtime) c.runtimes.add(it.runtime);
		it.containers.forEach(c.containers.add);
		it.videoCodecs.forEach(c.videoCodecs.add);
		it.audioCodecs.forEach(c.audioCodecs.add);
	});
	const out = {};
	Object.keys(c).forEach((k) => {
		out[k] = c[k].counts;
	});
	return out;
};

export const EMPTY_INSIGHTS = {genres: {}, contributors: {}, years: {}, ratings: {}, runtimes: {}, containers: {}, videoCodecs: {}, audioCodecs: {}};

export const totalOf = (counts) => Object.keys(counts || {}).reduce((s, k) => s + (counts[k] || 0), 0);

// Les valeurs les plus fréquentes, puis « Autre » pour le reste (_ranked de l'APK).
export const ranked = (counts, limit = 6) => {
	const entries = Object.keys(counts || {}).map((k) => ({label: k, values: [k], count: counts[k]}));
	entries.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
	if (entries.length <= limit) return entries;
	const head = entries.slice(0, limit);
	const rest = entries.slice(limit);
	head.push({label: null, values: rest.map((e) => e.label), count: rest.reduce((s, e) => s + e.count, 0), other: true});
	return head;
};

// Les années regroupées par décennie, de la plus ancienne à la plus récente.
export const decades = (years) => {
	const by = {};
	Object.keys(years || {}).forEach((y) => {
		const n = parseInt(y, 10);
		if (!isFinite(n)) return;
		const d = Math.floor(n / 10) * 10;
		if (!by[d]) by[d] = {label: `${d}s`, values: [], count: 0, decade: d};
		by[d].values.push(y);
		by[d].count += years[y];
	});
	return Object.keys(by).map((k) => by[k]).sort((a, b) => a.decade - b.decade);
};

export const runtimeSegments = (runtimes) => RUNTIME_ORDER.filter((k) => runtimes && runtimes[k]).map((k) => ({label: k, values: [k], count: runtimes[k]}));

export const topOf = (counts) => {
	let best = null;
	Object.keys(counts || {}).forEach((k) => {
		if (!best || counts[k] > best.count) best = {label: k, count: counts[k]};
	});
	return best;
};

export const yearSpan = (years) => {
	const list = Object.keys(years || {}).map((y) => parseInt(y, 10)).filter((n) => isFinite(n)).sort((a, b) => a - b);
	if (!list.length) return null;
	return list[0] === list[list.length - 1] ? String(list[0]) : `${list[0]}-${list[list.length - 1]}`;
};

export const percent = (count, total) => (total ? ((count / total) * 100).toFixed(1).replace('.', ',') : '0,0');

// Une catégorie choisie : {libraryId, dimension, values, title} (AdminAnalyticsQuery.matches).
export const matchesQuery = (query, item) => {
	const wanted = {};
	(query.values || []).forEach((v) => {
		wanted[String(v).toLowerCase()] = true;
	});
	const any = (list) => list.some((v) => wanted[v.toLowerCase()]);
	switch (query.dimension) {
		case 'type': return METRICS.some((m) => query.values.indexOf(m.key) >= 0 && m.types.indexOf(item.type) >= 0);
		case 'genre': return any(item.genres);
		case 'contributor': return any(item.contributors);
		case 'year': return item.year != null && (query.values.length === 0 || !!wanted[String(item.year)]);
		case 'rating': return item.rating != null && !!wanted[item.rating.toLowerCase()];
		case 'runtime': return item.runtime != null && !!wanted[item.runtime.toLowerCase()];
		case 'container': return any(item.containers);
		case 'videoCodec': return any(item.videoCodecs);
		case 'audioCodec': return any(item.audioCodecs);
		default: return false;
	}
};

// Épisodes et morceaux regroupés sous leur série ou leur artiste ; par année, les plus récents d'abord.
export const sortQueryItems = (items, query) => {
	const byYear = query.dimension === 'year';
	return items
		.map((item, index) => ({item, index, group: String(item.parentName || '').toLowerCase()}))
		.sort((a, b) => {
			if (byYear) {
				const y = (b.item.year || 0) - (a.item.year || 0);
				if (y) return y;
			}
			if (a.group !== b.group) return a.group < b.group ? -1 : 1;
			return a.index - b.index;
		})
		.map((e) => e.item);
};

// ----------------------------------------------------------------- lectures sur le serveur
const PAGE = 1000;
const PARALLEL = 4;

// Tous les éléments d'une bibliothèque, la première page pour connaître le total puis le reste par lots.
export const fetchAllItems = async (call, {parentId, types, fields}) => {
	const page = (start) => call('GET', '/Items', {query: {
		ParentId: parentId,
		IncludeItemTypes: types.join(','),
		Recursive: true,
		Fields: fields,
		SortBy: 'SortName',
		SortOrder: 'Ascending',
		StartIndex: start,
		Limit: PAGE,
		EnableTotalRecordCount: true,
		EnableImageTypes: 'Primary',
		ImageTypeLimit: 1
	}});
	const first = await page(0);
	const items = maps(first && first.Items);
	const total = Number(first && first.TotalRecordCount) || 0;
	if (items.length < PAGE || total <= items.length) return items;
	const starts = [];
	for (let s = PAGE; s < total; s += PAGE) starts.push(s);
	for (let i = 0; i < starts.length; i += PARALLEL) {
		const pages = await Promise.all(starts.slice(i, i + PARALLEL).map(page));
		pages.forEach((p) => items.push(...maps(p && p.Items)));
	}
	return items;
};

export const fetchCount = async (call, {parentId, types}) => {
	try {
		const r = await call('GET', '/Items', {query: {ParentId: parentId, IncludeItemTypes: types.join(','), Recursive: true, Limit: 0, EnableTotalRecordCount: true}});
		return Number(r && r.TotalRecordCount) || 0;
	} catch {
		return 0;
	}
};

// Les totaux du tableau de bord (_loadSummary).
export const loadSummary = async (api, keys = DASHBOARD_METRICS) => {
	const metrics = metricsFor(keys);
	const totals = {};
	try {
		const counts = await api.getItemCounts();
		for (const m of metrics) {
			const v = m.counts ? counts[m.counts] : undefined;
			totals[m.key] = typeof v === 'number' ? v : await fetchCount(api.call, {types: m.types});
		}
	} catch {
		const values = await Promise.all(metrics.map((m) => fetchCount(api.call, {types: m.types})));
		metrics.forEach((m, i) => {
			totals[m.key] = values[i];
		});
	}
	return totals;
};

export const libraryCounts = async (api, library) => {
	const counts = {};
	METRICS.forEach((m) => {
		counts[m.key] = 0;
	});
	const id = library.ItemId;
	if (!id) return {name: library.Name, itemId: '', collectionType: library.CollectionType, counts, insights: EMPTY_INSIGHTS, pending: false};
	const ms = metricsForCollectionType(library.CollectionType);
	const values = await Promise.all(ms.map((m) => fetchCount(api.call, {parentId: id, types: m.types})));
	ms.forEach((m, i) => {
		counts[m.key] = values[i];
	});
	return {name: library.Name, itemId: id, collectionType: library.CollectionType, counts, insights: EMPTY_INSIGHTS, pending: insightTypesFor(library.CollectionType) !== null};
};

const itemsCache = {};

export const libraryItems = async (api, {itemId, collectionType}) => {
	const types = insightTypesFor(collectionType);
	if (!types) return [];
	if (itemsCache[itemId]) return itemsCache[itemId];
	const fields = String(collectionType || '').toLowerCase() === 'books' ? 'Genres,People,Path,MediaSources' : 'Genres,MediaSources';
	const raw = await fetchAllItems(api.call, {parentId: itemId, types, fields});
	const items = raw.map((r) => analyticsItem(r, collectionType));
	itemsCache[itemId] = items;
	return items;
};

export const forgetLibraryItems = () => {
	Object.keys(itemsCache).forEach((k) => {
		delete itemsCache[k];
	});
};

export const sumLibraries = (libraries) => {
	const add = (into, counts) => Object.keys(counts || {}).forEach((k) => {
		into[k] = (into[k] || 0) + counts[k];
	});
	const technical = {containers: {}, videoCodecs: {}, audioCodecs: {}};
	libraries.forEach((l) => {
		add(technical.containers, l.insights.containers);
		add(technical.videoCodecs, l.insights.videoCodecs);
		add(technical.audioCodecs, l.insights.audioCodecs);
	});
	return technical;
};

export const libraryTotal = (library) => totalOf(library.counts);

// Les éléments derrière une catégorie (adminAnalyticsItemsProvider).
export const queryItems = async (api, libraries, query) => {
	const targets = libraries.filter((l) => l.itemId && (!query.libraryId || l.itemId === query.libraryId));
	const lists = await Promise.all(targets.map(async (library) => {
		if (insightTypesFor(library.collectionType)) {
			const items = await libraryItems(api, library);
			return items.filter((it) => matchesQuery(query, it));
		}
		const metric = query.dimension === 'type' ? metricsForCollectionType(library.collectionType).find((m) => query.values.indexOf(m.key) >= 0) : null;
		if (!metric) return [];
		const raw = await fetchAllItems(api.call, {parentId: library.itemId, types: metric.types});
		return raw.map((r) => analyticsItem(r, library.collectionType));
	}));
	return sortQueryItems([].concat(...lists), query);
};
