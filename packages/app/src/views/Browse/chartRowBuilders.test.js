import {fuseCharts, takeTurns, chartPicks, isOutAtHome, nextInSagas, isComing, CHART_ROW_BUILDERS} from './chartRowBuilders';
import seerrApi from '../../services/seerrApi';
import {traktChart} from '../../services/trakt';
import {betaSeriesMovieChart, betaSeriesFrenchShowChart} from '../../services/betaSeries';
import {frenchWinners} from '../../services/filmAwards';

jest.mock('../../services/seerrApi', () => ({__esModule: true, default: {
	discoverRaw: jest.fn(), discoverFiltered: jest.fn(), getMovie: jest.fn(), getTv: jest.fn(), getImageUrl: (p) => p
}}));
jest.mock('../../services/trakt', () => ({TRAKT_CHARTS: ['watched/weekly', 'trending'], traktChart: jest.fn()}));
jest.mock('../../services/betaSeries', () => ({betaSeriesShowChart: jest.fn(), betaSeriesMovieChart: jest.fn(), betaSeriesFrenchShowChart: jest.fn()}));
jest.mock('../../services/filmAwards', () => ({frenchWinners: jest.fn()}));
jest.mock('../../services/storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = Date.parse('2026-11-23T20:00:00Z');
const DAY = 86400000;
const mk = (id, over = {}) => ({id, posterPath: '/p', ...over});

describe('classements et suites', () => {
	test('fusion des classements', () => {
		const fused = fuseCharts([[mk(1), mk(2), mk(3)], [mk(2), mk(4)]]);
		expect(fused.map((i) => i.id)).toEqual([2, 1, 4, 3]);
		expect(chartPicks([mk(1), mk(1), {id: 2}, mk(3)]).map((i) => i.id)).toEqual([1, 3]);
		expect(takeTurns([[mk(1), mk(2)], [mk(3), mk(1)]]).map((i) => i.id)).toEqual([1, 3, 2]);
	});

	test('sorti à la maison', () => {
		const rel = (type, days) => ({releases: {results: [{release_dates: [{type, release_date: new Date(NOW - days * DAY).toISOString()}]}]}});
		expect(isOutAtHome(rel(4, 1), NOW)).toBe(true);
		expect(isOutAtHome(rel(3, 30), NOW)).toBe(false);
		expect(isOutAtHome(rel(3, 200), NOW)).toBe(true);
		expect(isOutAtHome({}, NOW)).toBe(true);
	});

	test('la suite d\'une saga', () => {
		const parts = [mk(1, {releaseDate: '2001-01-01', title: 'Un'}), mk(2, {releaseDate: '2003-01-01'}), mk(3, {releaseDate: '2005-01-01'})];
		const picks = nextInSagas({watched: [{tmdbId: 1, title: 'Un'}], collectionOfFilm: {1: 9}, collections: {9: {name: 'S', parts}}, now: NOW});
		expect(picks).toHaveLength(1);
		expect(picks[0].item.id).toBe(2);
		expect(picks[0].afterTitle).toBe('Un');
	});

	test('à venir dans l\'année', () => {
		expect(isComing(mk(1, {releaseDate: new Date(NOW + 30 * DAY).toISOString()}), NOW)).toBe(true);
		expect(isComing(mk(1, {releaseDate: new Date(NOW - DAY).toISOString()}), NOW)).toBe(false);
		expect(isComing(mk(1, {releaseDate: new Date(NOW + 400 * DAY).toISOString()}), NOW)).toBe(false);
	});

	test('Top 10 films : Trakt et BetaSeries comptent avec les plateformes', async () => {
		const film = (id) => mk(id, {title: `F${id}`, voteCount: 50, mediaInfo: {status: 5}});
		seerrApi.discoverRaw.mockImplementation((type, params) => Promise.resolve({results: params.watchProviders === 8 ? [film(1), film(2)] : [film(3)]}));
		traktChart.mockImplementation((chart) => (chart === 'trending' ? Promise.reject(new Error('CORS')) : Promise.resolve([7, 1])));
		betaSeriesMovieChart.mockResolvedValue([7, 8]);
		seerrApi.getMovie.mockImplementation((id) => Promise.resolve({id, title: `F${id}`, posterPath: '/p', genres: [], mediaInfo: {status: 5}}));
		const [row] = await CHART_ROW_BUILDERS.top10_movies({blockAdult: true});
		const names = row.items.map((i) => i.Name);
		// 7 : nommé par Trakt et BetaSeries, il monte devant ce qu'une seule plateforme classe.
		expect(names.indexOf('F7')).toBeLessThan(names.indexOf('F2'));
		expect(names).toContain('F8');
		expect(row.items[0]._vjodRank).toBe(1);
	});

	test('séries françaises : ce que la France regarde sur BetaSeries d\'abord', async () => {
		const show = (id) => mk(id, {name: `S${id}`, voteCount: 500, voteAverage: 7});
		seerrApi.discoverFiltered.mockResolvedValue({results: [10, 11, 12, 13, 14].map(show)});
		betaSeriesFrenchShowChart.mockResolvedValue([90]);
		seerrApi.getTv.mockResolvedValue({id: 90, name: 'S90', posterPath: '/p', genres: []});
		const [row] = await CHART_ROW_BUILDERS.french_series({blockAdult: true});
		expect(row.items[0].Name).toBe('S90');
	});

	test('cinéma français : les films primés entrent dans le tour', async () => {
		const film = (id) => mk(id, {title: `F${id}`, voteCount: 500, voteAverage: 7, mediaInfo: {status: 5}});
		seerrApi.discoverFiltered.mockResolvedValue({results: [20, 21, 22, 23, 24, 25].map(film)});
		frenchWinners.mockResolvedValue([77]);
		seerrApi.getMovie.mockImplementation((id) => Promise.resolve({id, title: `F${id}`, posterPath: '/p', genres: [], mediaInfo: {status: 5}}));
		const [row] = await CHART_ROW_BUILDERS.french_movies({blockAdult: true});
		expect(row.items.map((i) => i.Name)).toContain('F77');
	});
});
