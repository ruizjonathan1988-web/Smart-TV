import {discoverItemOf, chartCards, seerrCard} from './chartCards';

describe('Cartes d\'un classement', () => {
	test('une fiche devient une carte avec ses ids de genres', () => {
		expect(discoverItemOf({id: 4, genres: [{id: 18}, {id: 35}]}, 'movie')).toMatchObject({id: 4, mediaType: 'movie', genreIds: [18, 35]});
		expect(discoverItemOf(null, 'movie')).toBe(null);
	});

	test('reprend les cartes connues, passe les introuvables, garde l\'ordre', async () => {
		const load = jest.fn((type, id) => (id === 3 ? Promise.reject(new Error('404')) : Promise.resolve({id, mediaType: type})));
		const cards = await chartCards([1, 2, 3, 4], {known: {2: {id: 2, known: true}}, mediaType: 'tv', depth: 3, load});
		expect(cards.map((c) => c.id)).toEqual([1, 2]);
		expect(cards[1].known).toBe(true);
		expect(load).toHaveBeenCalledTimes(2);
	});

	test('une carte Seerr : la fiche du film ou de la série', async () => {
		const seerr = {getTv: jest.fn().mockResolvedValue({id: 9, genres: [{id: 16}]}), getMovie: jest.fn()};
		expect(await seerrCard(seerr)('tv', 9)).toMatchObject({id: 9, mediaType: 'tv', genreIds: [16]});
		expect(seerr.getMovie).not.toHaveBeenCalled();
	});
});
