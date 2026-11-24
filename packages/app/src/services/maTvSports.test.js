import {
	parseSports, scoreText, clockText, followsTeam, toggleIn, kickOffs, oddText, momentLabel,
	toggleSportReminder, sportsChoices, resetSportsForTests
} from './maTvSports';

jest.mock('./storage', () => ({
	getFromStorage: () => Promise.resolve(null),
	saveToStorage: () => Promise.resolve()
}));

describe('maTvSports', () => {
	const data = parseSports({
		events: [
			{id: '1', home: 'Paris SG', away: 'OM', state: 'live', score: [2, 1], minute: 67, odds: {1: 1.85, N: 3.4}, chans: [{id: 'c', num: 4, name: 'Canal+'}], last: {text: 'But Mbappé', min: 64, at: 10}},
			{id: '2', home: 'Sinner', away: 'Alcaraz', state: 'live', sets: [[6, 3], [4, 5]]},
			{id: '3', home: 'A', away: 'B', state: 'end', score: [0, 0]}
		],
		sports: [{id: 'football', name: 'Football'}],
		source: 'Kambi'
	});

	test('lecture', () => {
		expect(data.events.length).toBe(3);
		expect(data.events[0].channels[0].name).toBe('Canal+');
		expect(data.kinds[0].name).toBe('Football');
		expect(parseSports(null)).toBeNull();
	});

	test('score et horloge', () => {
		expect(scoreText(data.events[0])).toBe('2 – 1');
		expect(scoreText(data.events[1])).toBe('6-4 3-5');
		expect(clockText(data.events[0])).toBe('67’');
		expect(clockText(data.events[2])).toBe('Terminé');
		expect(oddText(1.85)).toBe('1,85');
		expect(momentLabel(data.events[0].last)).toBe('But Mbappé (64’)');
	});

	test('équipes suivies, accents et casse compris', () => {
		expect(followsTeam(data.events[0], 'paris sg')).toBe(true);
		expect(followsTeam(data.events[0], 'PSG')).toBe(false);
		expect(followsTeam({home: 'Olympique de Marseille', away: 'X'}, 'marseille')).toBe(true);
		expect(toggleIn(['PSG'], 'psg')).toEqual([]);
		expect(toggleIn([], 'OM')).toEqual(['OM']);
	});

	test('coup d\'envoi annoncé une fois', () => {
		const ev = [{id: '1', state: 'live', home: 'X', away: 'Y'}];
		expect(kickOffs({1: 'pre'}, ev, {reminders: ['1'], teams: []}).length).toBe(1);
		expect(kickOffs({1: 'live'}, ev, {reminders: ['1'], teams: []}).length).toBe(0);
	});

	test('rappels : 40 au plus', () => {
		resetSportsForTests();
		for (let i = 0; i < 45; i++) toggleSportReminder(String(i));
		expect(sportsChoices().reminders.length).toBe(40);
		expect(sportsChoices().reminders[0]).toBe('5');
	});
});
