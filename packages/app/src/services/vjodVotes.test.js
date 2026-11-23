import {decodeVotes, recordVote, voteFor, genreBias, factorFor, voteKey, creditsStarted} from './vjodVotes';

jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const NOW = Date.parse('2026-11-23T20:00:00Z');
const vote = (key, liked, genres, daysAgo = 0) => ({key, title: key, genres, liked, at: new Date(NOW - daysAgo * 86400000).toISOString()});

describe('votes du générique', () => {
	test('un vote par titre, le dernier gagne', () => {
		let s = decodeVotes(null);
		s = recordVote(s, vote('movie:1', true, ['drama']));
		s = recordVote(s, vote('movie:1', false, ['drama']));
		expect(s.votes).toHaveLength(1);
		expect(voteFor(s, 'movie:1').liked).toBe(false);
		expect(decodeVotes(JSON.stringify(s)).votes).toHaveLength(1);
	});
	test('les genres aimés montent un peu, les « bof » descendent, jamais à zéro', () => {
		const s = {votes: [vote('a', true, ['scifi']), vote('b', true, ['scifi']), vote('c', false, ['horror'])], suggested: {}};
		const bias = genreBias(s, NOW);
		expect(bias.scifi).toBeCloseTo(0.5);
		expect(factorFor(['scifi'], bias)).toBeCloseTo(1.175);
		expect(factorFor(['horror'], bias)).toBeLessThan(1);
		expect(factorFor([], bias)).toBe(1);
		const old = genreBias({votes: [vote('a', true, ['scifi'], 120)], suggested: {}}, NOW);
		expect(old.scifi).toBeCloseTo(0.5 / 2.5);
	});
	test('la clé du titre : TMDB, sinon Jellyfin', () => {
		expect(voteKey({Id: 'x', ProviderIds: {Tmdb: '603'}})).toBe('movie:603');
		expect(voteKey({Id: 'x'})).toBe('jellyfin:x');
	});
	test('le générique : le segment de fin, sinon les dernières minutes d’un vrai film', () => {
		expect(creditsStarted({currentTime: 6000, duration: 7000, segments: {list: [{type: 'outro', start: 5900 * 1e7, end: null}]}})).toBe(true);
		expect(creditsStarted({currentTime: 6700, duration: 7000, segments: null})).toBe(true);
		expect(creditsStarted({currentTime: 5000, duration: 7000, segments: null})).toBe(false);
		expect(creditsStarted({currentTime: 1300, duration: 1320, segments: null})).toBe(false);
	});
});
