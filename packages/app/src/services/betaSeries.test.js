import {parseRanking, parseMovies, parseShow, parseSimilars, betaSeriesFrenchShowChart, betaSeriesSimilarShows, betaSeriesMovieChart, setBetaSeriesFetchForTests} from './betaSeries';

describe('BetaSeries', () => {
	afterEach(() => setBetaSeriesFetchForTests(null));

	test('lecture des réponses', () => {
		expect(parseRanking({shows: [{show_id: 3}, {show_id: 'x'}]})).toEqual([3]);
		expect(parseMovies({movies: [{tmdb_id: 8}, {tmdb_id: 0}]})).toEqual([8]);
		expect(parseShow({show: {themoviedb_id: 12, language: 'fr'}})).toEqual({tmdbId: 12, language: 'fr'});
		expect(parseShow({show: {themoviedb_id: 0}})).toBe(null);
		const similars = {similars: [
			{show: {themoviedb_id: 1, followers: 10}},
			{show: {themoviedb_id: 2, followers: 500}},
			{show: {themoviedb_id: 1, followers: 900}},
			{show: {themoviedb_id: 3}}
		]};
		expect(parseSimilars(similars, 'tv')).toEqual([2, 1, 3]);
	});

	test('séries françaises de la semaine : seulement celles en français', async () => {
		setBetaSeriesFetchForTests((url) => {
			if (url.indexOf('/stats/shows_ranking') >= 0) return Promise.resolve({shows: [{show_id: 1}, {show_id: 2}, {show_id: 3}]});
			const id = Number(/id=(\d+)/.exec(url)[1]);
			if (id === 3) return Promise.reject(new Error('404'));
			return Promise.resolve({show: {themoviedb_id: id * 100, language: id === 1 ? 'fr' : 'en'}});
		});
		expect(await betaSeriesFrenchShowChart()).toEqual([100]);
	});

	test('séries proches : par l\'id TheTVDB, gardées pour la session', async () => {
		const urls = [];
		setBetaSeriesFetchForTests((url) => {
			urls.push(url);
			return Promise.resolve({similars: [{show: {themoviedb_id: 9}}]});
		});
		const tvdb = jest.fn().mockResolvedValue(4242);
		expect(await betaSeriesSimilarShows(5, tvdb)).toEqual([9]);
		expect(await betaSeriesSimilarShows(5, tvdb)).toEqual([9]);
		expect(urls).toHaveLength(1);
		expect(urls[0]).toContain('thetvdb_id=4242');
		expect(await betaSeriesSimilarShows(6, () => Promise.resolve(null))).toEqual([]);
	});

	test('films les plus suivis', async () => {
		setBetaSeriesFetchForTests(() => Promise.resolve({movies: [{tmdb_id: 4}, {tmdb_id: 5}]}));
		expect(await betaSeriesMovieChart()).toEqual([4, 5]);
	});
});
