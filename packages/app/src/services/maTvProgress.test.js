import {replayPercent, resumePosition, saveReplayPlace, resetReplayProgressForTests} from './maTvProgress';

jest.mock('./storage', () => ({
	getFromStorage: () => Promise.resolve(null),
	saveToStorage: () => Promise.resolve()
}));

describe('maTvProgress', () => {
	beforeEach(() => resetReplayProgressForTests());

	test('pourcentage et reprise', () => {
		expect(replayPercent('x')).toBeNull();
		saveReplayPlace('x', 30 * 60000, 60 * 60000);
		expect(replayPercent('x')).toBe(50);
		expect(resumePosition('x')).toBe(30 * 60000);
	});

	test('pas de reprise au tout début ni à la fin', () => {
		saveReplayPlace('a', 30000, 3600000);
		expect(resumePosition('a')).toBe(0);
		saveReplayPlace('b', 3500000, 3600000);
		expect(resumePosition('b')).toBe(0);
		expect(replayPercent('b')).toBe(100);
	});
});

describe('Continuer avec Ma TV', () => {
	const {continueOnMaTv, mergeByLastWatched} = require('./maTvProgress');
	test('en cours, avec de quoi le relancer', () => {
		resetReplayProgressForTests({});
		saveReplayPlace('a', 600000, 3000000, {url: 'u', title: 'Film'});
		saveReplayPlace('b', 600000, 3000000);
		saveReplayPlace('c', 2950000, 3000000, {url: 'u', title: 'Fini'});
		const items = continueOnMaTv();
		expect(items.map((i) => i.Id)).toEqual(['matv-a']);
		expect(items[0]._maTvResume.startMs).toBe(600000);
	});
	test('glissé par date de visionnage', () => {
		const lib = [{Id: 'x', UserData: {LastPlayedDate: '2026-11-22T00:00:00Z'}}, {Id: 'y', UserData: {LastPlayedDate: '2026-11-01T00:00:00Z'}}];
		const extra = [{Id: 'm', UserData: {LastPlayedDate: '2026-11-10T00:00:00Z'}}];
		expect(mergeByLastWatched(lib, extra).map((i) => i.Id)).toEqual(['x', 'm', 'y']);
	});
});
