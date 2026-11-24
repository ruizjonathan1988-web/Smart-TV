import {
	analyticsItem, insightsOf, matchesQuery, ranked, decades, runtimeSegments, yearSpan, metricsForCollectionType,
	skipsLibrary, sortQueryItems, fetchAllItems, loadSummary, percent
} from './adminAnalytics';

const movie = {
	Id: 'm1', Name: 'Le Film', Type: 'Movie', ProductionYear: 1999, OfficialRating: 'tous publics', RunTimeTicks: 95 * 600000000,
	Genres: ['Drame', 'drame', 'Policier'],
	MediaSources: [{Container: 'mkv,webm', MediaStreams: [{Type: 'Video', Codec: 'HEVC'}, {Type: 'Audio', Codec: 'eac3'}, {Type: 'Audio', Codec: 'aac'}]}],
	ImageTags: {Primary: 'tag'}
};

describe('un élément réduit', () => {
	test('film : conteneur, codecs, durée, classification', () => {
		const one = analyticsItem(movie, 'movies');
		expect(one.containers).toEqual(['mkv']);
		expect(one.videoCodecs).toEqual(['hevc']);
		expect(one.audioCodecs).toEqual(['eac3', 'aac']);
		expect(one.runtime).toBe('90-119m');
		expect(one.rating).toBe('TOUS PUBLICS');
		expect(one.genres).toEqual(['Drame', 'Policier']);
		expect(one.imageTag).toBe('tag');
	});

	test('livre : format tiré du chemin, auteurs dans People', () => {
		const one = analyticsItem({Id: 'b', Type: 'Book', Path: '/livres/Roman.EPUB', People: [{Name: 'Hugo', Type: 'Author'}, {Name: 'X', Type: 'Actor'}]}, 'books');
		expect(one.containers).toEqual(['epub']);
		expect(one.contributors).toEqual(['Hugo']);
	});

	test('musique : artistes et artistes de l’album sans doublon', () => {
		const one = analyticsItem({Id: 's', Type: 'Audio', Artists: ['Daft Punk'], AlbumArtists: [{Name: 'Daft Punk'}], AlbumArtist: 'Daft Punk', AlbumId: 'a', AlbumPrimaryImageTag: 't'}, 'music');
		expect(one.contributors).toEqual(['Daft Punk']);
		expect(one.imageItemId).toBe('a');
	});
});

describe('comptes', () => {
	const items = [analyticsItem(movie, 'movies'), analyticsItem({...movie, Id: 'm2', ProductionYear: 2005, Genres: ['drame']}, 'movies')];

	test('genres sans tenir compte de la casse', () => {
		const ins = insightsOf(items);
		expect(ins.genres).toEqual({Drame: 2, Policier: 1});
		expect(ins.years).toEqual({1999: 1, 2005: 1});
		expect(yearSpan(ins.years)).toBe('1999-2005');
	});

	test('catégories et éléments correspondants', () => {
		expect(items.filter((i) => matchesQuery({dimension: 'genre', values: ['policier']}, i)).map((i) => i.id)).toEqual(['m1']);
		expect(items.filter((i) => matchesQuery({dimension: 'year', values: []}, i))).toHaveLength(2);
		expect(items.filter((i) => matchesQuery({dimension: 'type', values: ['movies']}, i))).toHaveLength(2);
		expect(items.filter((i) => matchesQuery({dimension: 'videoCodec', values: ['HEVC']}, i))).toHaveLength(2);
	});

	test('classement avec « Autre »', () => {
		const r = ranked({a: 5, b: 4, c: 3, d: 1}, 2);
		expect(r.map((e) => e.label)).toEqual(['a', 'b', null]);
		expect(r[2]).toMatchObject({other: true, count: 4, values: ['c', 'd']});
	});

	test('décennies et durées dans l’ordre', () => {
		expect(decades({1999: 1, 1991: 2, 2005: 1}).map((d) => [d.label, d.count])).toEqual([['1990s', 3], ['2000s', 1]]);
		expect(runtimeSegments({'120m+': 1, '<15m': 2}).map((s) => s.label)).toEqual(['<15m', '120m+']);
		expect(percent(1, 3)).toBe('33,3');
	});

	test('bibliothèques', () => {
		expect(metricsForCollectionType('tvshows').map((m) => m.key)).toEqual(['series', 'episodes']);
		expect(skipsLibrary('livetv')).toBe(true);
		expect(skipsLibrary('movies')).toBe(false);
	});

	test('tri : par série, puis par année pour les années', () => {
		const list = [{id: 1, parentName: 'B', year: 2000}, {id: 2, parentName: 'A', year: 1990}, {id: 3, parentName: 'A', year: 2010}];
		expect(sortQueryItems(list, {dimension: 'genre'}).map((i) => i.id)).toEqual([2, 3, 1]);
		expect(sortQueryItems(list, {dimension: 'year'}).map((i) => i.id)).toEqual([3, 1, 2]);
	});
});

describe('lectures', () => {
	test('toutes les pages d’une bibliothèque', async () => {
		const call = jest.fn(async (m, p, {query}) => {
			const start = query.StartIndex;
			const n = start === 0 ? 1000 : 500;
			return {TotalRecordCount: 1500, Items: Array.from({length: n}, (_, i) => ({Id: String(start + i)}))};
		});
		const items = await fetchAllItems(call, {parentId: 'lib', types: ['Movie']});
		expect(items).toHaveLength(1500);
		expect(call).toHaveBeenCalledTimes(2);
	});

	test('totaux : /Items/Counts puis /Items pour ce qui manque', async () => {
		const api = {
			getItemCounts: async () => ({MovieCount: 12}),
			call: jest.fn(async () => ({TotalRecordCount: 3}))
		};
		expect(await loadSummary(api, ['movies', 'audiobooks'])).toEqual({movies: 12, audiobooks: 3});
	});
});
