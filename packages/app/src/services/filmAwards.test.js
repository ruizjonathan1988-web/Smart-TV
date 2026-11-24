import {parseAwardWinners, frenchWinners, setFilmAwardsFetchForTests} from './filmAwards';

describe('Films primés (Wikidata)', () => {
	afterEach(() => setFilmAwardsFetchForTests(null));

	test('lit les ids TMDB, chacun une fois', () => {
		const json = {results: {bindings: [{tmdb: {value: '12'}}, {tmdb: {value: '12'}}, {tmdb: {value: 'x'}}, {tmdb: {value: '7'}}]}};
		expect(parseAwardWinners(json)).toEqual([12, 7]);
		expect(parseAwardWinners(null)).toEqual([]);
	});

	test('demandés une fois par session quand la réponse est bonne', async () => {
		const ask = jest.fn().mockResolvedValue({results: {bindings: [{tmdb: {value: '3'}}]}});
		setFilmAwardsFetchForTests(ask);
		expect(await frenchWinners()).toEqual([3]);
		expect(await frenchWinners()).toEqual([3]);
		expect(ask).toHaveBeenCalledTimes(1);
		expect(ask.mock.calls[0][0]).toContain('query.wikidata.org/sparql');
	});
});
