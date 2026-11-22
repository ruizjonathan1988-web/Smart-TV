import {
	buildMaTvCategories, maTvStartCategory, toggleMaTvFavorite, isMaTvFavorite, maTvWatched,
	maTvRecent, maTvLastCategory, fetchMaTvChannels, resetMaTvMemoryForTests
} from './maTvMemory';

jest.mock('./storage', () => ({
	getFromStorage: () => Promise.resolve(null),
	saveToStorage: () => Promise.resolve()
}));

const LABELS = {fav: 'Favoris', recent: 'Récentes'};

describe('maTvMemory', () => {
	beforeEach(() => resetMaTvMemoryForTests());

	test('favoris : ajout puis retrait', () => {
		expect(toggleMaTvFavorite('a')).toBe(true);
		expect(isMaTvFavorite('a')).toBe(true);
		expect(toggleMaTvFavorite('a')).toBe(false);
		expect(isMaTvFavorite('a')).toBe(false);
	});

	test('récentes : la dernière en tête, sans doublon ; catégorie action ignorée', () => {
		maTvWatched('a', 'c:FR');
		maTvWatched('b', 'sports');
		maTvWatched('a', 'c:FR');
		expect(maTvRecent()).toEqual(['a', 'b']);
		expect(maTvLastCategory()).toBe('c:FR');
	});

	test('catégories : Favoris et Récentes devant, actions retirées', () => {
		const server = [{id: 'c:FR', kind: 'country'}, {id: 'search', kind: 'search'}];
		const cats = buildMaTvCategories(server, LABELS, ['x'], []);
		expect(cats.map((c) => c.id)).toEqual(['fav', 'c:FR']);
	});

	test('catégorie de départ', () => {
		const cats = [{id: 'fav', kind: 'fav'}, {id: 'c:FR'}, {id: 'sport'}];
		expect(maTvStartCategory(cats, 'sport')).toBe(2);
		expect(maTvStartCategory(cats, 'inconnue')).toBe(0);
		expect(maTvStartCategory([{id: 'x'}, {id: 'c:FR'}], '')).toBe(1);
		expect(maTvStartCategory([], '')).toBe(0);
	});

	test('chaînes des favoris dans l\'ordre de la mémoire', async () => {
		resetMaTvMemoryForTests({fav: ['b', 'a']});
		const client = {channelsByIds: () => Promise.resolve({chans: [{id: 'a'}, {id: 'b'}]})};
		const list = await fetchMaTvChannels(client, {id: 'fav', kind: 'fav'});
		expect(list.map((c) => c.id)).toEqual(['b', 'a']);
	});
});
