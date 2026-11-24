import {vodTitle, parseSeriesInfo, createVodClient, catalogueAvailability, catalogueFilterKeeps} from './maTvVod';

jest.mock('./secureFetch', () => ({platformFetch: () => Promise.resolve(null)}));

describe('maTvVod', () => {
	test('titre Ma TV', () => {
		const t = vodTitle({kind: 'movie', id: 12, name: 'Dune', tag: 'FR', tmdb: 438631, year: '2021', qualities: ['4K', '1080']});
		expect(t.extension).toBe('mp4');
		expect(t.tmdbId).toBe('438631');
		expect(t.qualities).toEqual(['4K', '1080']);
	});

	test('saisons et épisodes, triés', () => {
		const info = parseSeriesInfo({
			info: {plot: 'Résumé'},
			episodes: {1: [{id: 'b', episode_num: 2, title: 'FR - Deux'}, {id: 'a', episode_num: 1, container_extension: 'mp4'}], 2: [{id: 'c', episode_num: 1}]}
		});
		expect(info.plot).toBe('Résumé');
		expect(info.seasons[1].map((e) => e.id)).toEqual(['a', 'b']);
		expect(info.seasons[1][1].title).toBe('Deux');
		expect(info.seasons[1][0].extension).toBe('mp4');
		expect(info.seasons[2][0].title).toBe('Épisode 1');
		expect(parseSeriesInfo(null).seasons).toEqual({});
	});

	test('adresses de lecture', () => {
		const vod = createVodClient({server: {url: 'https://s.example', key: 'K/1'}});
		expect(vod.movieUrl({id: '12', extension: 'mkv'})).toBe('https://s.example/tv/xc/movie/vjod/K%2F1/12.mkv');
		expect(vod.episodeUrl({id: '7', extension: 'mp4'})).toBe('https://s.example/tv/xc/series/vjod/K%2F1/7.mp4');
	});

	test('disponibilité et filtre', () => {
		expect(catalogueAvailability(5, true)).toBe('server');
		expect(catalogueAvailability(1, true)).toBe('iptv');
		expect(catalogueAvailability(2, false)).toBe('requested');
		expect(catalogueAvailability(undefined, false)).toBe('toRequest');
		expect(catalogueFilterKeeps(3, 'requested')).toBe(true);
		expect(catalogueFilterKeeps(1, 'iptv')).toBe(false);
	});
});
