import {mergeCommunities, withCommunity, seedRecommendations} from './seedRecommendations';
import {betaSeriesSimilarMovies, betaSeriesSimilarShows} from '../betaSeries';
import {traktRelated} from '../trakt';

jest.mock('../betaSeries', () => ({betaSeriesSimilarMovies: jest.fn(), betaSeriesSimilarShows: jest.fn()}));
jest.mock('../trakt', () => ({traktRelated: jest.fn()}));

const rec = (id) => ({id, posterPath: '/p'});

describe('Recommandations d\'une graine', () => {
	test('les deux communautés : ce qu\'elles nomment ensemble, puis à tour de rôle', () => {
		expect(mergeCommunities([1, 2, 3], [3, 4, 1])).toEqual([1, 3, 2, 4]);
		expect(mergeCommunities([], [5])).toEqual([5]);
	});

	test('TMDB confirmé d\'abord, puis TMDB et les ajouts à tour de rôle', () => {
		const out = withCommunity([rec(10), rec(11), rec(12)], [12, 99], [rec(99)]);
		expect(out.map((i) => i.id)).toEqual([12, 10, 99, 11]);
	});

	test('sans communauté, la liste de TMDB telle quelle', async () => {
		betaSeriesSimilarMovies.mockResolvedValue([]);
		traktRelated.mockResolvedValue([]);
		const seerr = {getMovieRecommendations: jest.fn().mockResolvedValue({results: [rec(1), rec(2)]})};
		expect((await seedRecommendations(seerr, {tmdbId: 5, mediaType: 'movie'})).map((i) => i.id)).toEqual([1, 2]);
	});

	test('une série : BetaSeries par TheTVDB, Trakt, et quatre ajouts au plus', async () => {
		betaSeriesSimilarShows.mockImplementation(async (id, tvdbOf) => ((await tvdbOf()) === 77 ? [2, 30, 31] : []));
		traktRelated.mockResolvedValue([32, 33, 34, 5]);
		const seerr = {
			getTvRecommendations: jest.fn().mockResolvedValue({results: [rec(1), rec(2)]}),
			getTv: jest.fn().mockResolvedValue({externalIds: {tvdbId: 77}})
		};
		const card = jest.fn((type, id) => Promise.resolve({...rec(id), mediaType: type}));
		const out = await seedRecommendations(seerr, {tmdbId: 5, mediaType: 'tv'}, {card});
		expect(out[0].id).toBe(2);
		expect(card).toHaveBeenCalledTimes(4);
		expect(out.map((i) => i.id)).not.toContain(5);
		expect(out).toHaveLength(6);
	});

	test('BetaSeries ou Trakt en panne : rien ne casse', async () => {
		betaSeriesSimilarMovies.mockRejectedValue(new Error('CORS'));
		traktRelated.mockRejectedValue(new Error('CORS'));
		const seerr = {getMovieRecommendations: jest.fn().mockResolvedValue({results: [rec(1)]})};
		expect(await seedRecommendations(seerr, {tmdbId: 5, mediaType: 'movie'})).toHaveLength(1);
	});
});
