import {episodeAfter, correctedIntro} from './iptvNext';

jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const info = {seasons: {
	1: [{id: 'a', season: 1, number: 1}, {id: 'b', season: 1, number: 2}],
	2: [{id: 'c', season: 2, number: 1}]
}};

describe('iptvNext', () => {
	test('l’épisode d’après, saison suivante comprise', () => {
		expect(episodeAfter(info, {season: 1, number: 1}).id).toBe('b');
		expect(episodeAfter(info, {season: 0, number: 0, id: 'b'}).id).toBe('c');
		expect(episodeAfter(info, {season: 2, number: 1})).toBe(null);
		expect(episodeAfter(info, {season: 9, number: 9})).toBe(null);
	});
	test('la correction du générique est gardée si elle a du sens', () => {
		expect(correctedIntro(10000, 100000)).toBe(90000);
		expect(correctedIntro(10000, 15000)).toBe(null);
		expect(correctedIntro(10000, 400000)).toBe(null);
	});
});
