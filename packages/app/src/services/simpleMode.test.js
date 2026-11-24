import {simpleModeFromPrefs, simpleRow} from './simpleMode';

jest.mock('./jellyfinApi', () => ({api: {}}));

describe('mode simple', () => {
	test('le drapeau tel que Jellyfin le garde', () => {
		expect(simpleModeFromPrefs({simpleMode: 'true'})).toBe(true);
		expect(simpleModeFromPrefs({simpleMode: 'false'})).toBe(false);
		expect(simpleModeFromPrefs(null)).toBe(false);
	});
	test('la fiche : la bande-annonce et la liste en ligne, le reste derrière « + »', () => {
		const row = simpleRow([{id: 'watched'}, {id: 'favorite'}, {id: 'trailer'}, {id: 'audio'}]);
		expect(row.inline.map((b) => b.id)).toEqual(['trailer', 'favorite']);
		expect(row.menu.map((b) => b.id)).toEqual(['watched', 'audio']);
	});
});
