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
