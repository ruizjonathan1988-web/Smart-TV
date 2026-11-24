import {parseTraktTitles, traktChart, traktRelated, setTraktFetchForTests} from './trakt';

describe('Trakt sans compte', () => {
	afterEach(() => setTraktFetchForTests(null));

	test('lit les ids TMDB d\'un classement et d\'une liste de titres liés', () => {
		expect(parseTraktTitles([{watcher_count: 3, movie: {ids: {tmdb: 10}}}, {movie: {ids: {tmdb: 10}}}, {movie: {ids: {}}}], 'movie')).toEqual([10]);
		expect(parseTraktTitles([{title: 'A', ids: {tmdb: 4}}, {title: 'B', ids: {tmdb: 5}}], 'tv')).toEqual([4, 5]);
		expect(parseTraktTitles(null, 'movie')).toEqual([]);
	});

	test('classement : la bonne adresse et les en-têtes de l\'appli', async () => {
		const calls = [];
		setTraktFetchForTests((url, opts) => {
			calls.push([url, opts.headers['trakt-api-key']]);
			return Promise.resolve([{show: {ids: {tmdb: 7}}}]);
		});
		expect(await traktChart('watched/weekly', 'tv')).toEqual([7]);
		expect(calls[0][0]).toBe('https://api.trakt.tv/shows/watched/weekly?limit=20');
		expect(calls[0][1]).toBeTruthy();
	});

	test('titres liés : retrouve l\'id Trakt, puis rien quand Trakt ne connaît pas', async () => {
		setTraktFetchForTests((url) => Promise.resolve(url.indexOf('/search/') >= 0
			? (url.indexOf('/99?') >= 0 ? [] : [{movie: {ids: {trakt: 55}}}])
			: [{ids: {tmdb: 1}}, {ids: {tmdb: 2}}]));
		expect(await traktRelated('movie', 12)).toEqual([1, 2]);
		expect(await traktRelated('movie', 99)).toEqual([]);
		setTraktFetchForTests(() => Promise.reject(new Error('CORS')));
		expect(await traktRelated('movie', 13)).toEqual([]);
	});
});
