import {VJOD_COLLECTIONS, collectionById, inSeason, relaxed, availableFirst, isPalmares, tileHue} from './vjodCollections';

describe('vjodCollections', () => {
	test('toutes les collections de l\'APK', () => {
		expect(VJOD_COLLECTIONS).toHaveLength(52);
		expect(new Set(VJOD_COLLECTIONS.map((c) => c.id)).size).toBe(52);
		expect(collectionById('gems').family).toBe('ready');
	});

	test('saison', () => {
		const christmas = collectionById('christmas');
		expect(inSeason(christmas, new Date(2026, 11, 2))).toBe(true);
		expect(inSeason(christmas, new Date(2026, 5, 2))).toBe(false);
		expect(inSeason(collectionById('gems'))).toBe(true);
	});

	test('suite sans seuil de votes', () => {
		expect(relaxed(collectionById('gems')).query.voteCountGte).toBe(5);
		expect(relaxed(collectionById('gems')).query.voteAverageGte).toBe(7.5);
		expect(relaxed({id: 'x', query: {voteCountGte: 3}})).toBe(null);
	});

	test('disponibles d\'abord, ordre gardé', () => {
		const items = [{id: 1}, {id: 2, mediaInfo: {status: 5}}, {id: 3, mediaInfo: {status: 2}}, {id: 4, mediaInfo: {status: 4}}];
		expect(availableFirst(items).map((i) => i.id)).toEqual([2, 4, 3, 1]);
	});

	test('palmarès et couleurs', () => {
		expect(isPalmares('Palme d\'or — Cannes')).toBe(true);
		expect(isPalmares('Saga Alien')).toBe(false);
		expect(tileHue('feel_good')).toBe(tileHue('feel_good'));
	});
});
