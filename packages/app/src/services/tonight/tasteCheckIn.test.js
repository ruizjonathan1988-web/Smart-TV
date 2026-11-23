import {checkInSittings, applyVerdict, applyDropReason, releaseChoice, stillTrueQuestion, tastePromptDue, checkInKey} from './tasteCheckIn';
import {EMPTY_PROFILE} from './tasteProfile';

jest.mock('../storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = Date.parse('2026-11-23T20:00:00Z');
const DAY = 86400000;
const entry = (over) => ({itemId: 'i', at: NOW - DAY, mediaType: 'movie', tmdbId: 1, title: 'T', genres: ['drama'], runtimeMinutes: 120, watchedMinutes: 120, finished: true, ...over});

describe('le point du mois', () => {
	test('dernier vu jusqu\'au bout et dernier lâché', () => {
		const journal = [
			entry({itemId: 'a', tmdbId: 1, at: NOW - 3 * DAY}),
			entry({itemId: 'b', tmdbId: 2, finished: false, watchedMinutes: 20, at: NOW - 2 * DAY}),
			entry({itemId: 'c', tmdbId: 3, backfilled: true})
		];
		const s = checkInSittings({journal, profile: EMPTY_PROFILE, now: NOW});
		expect(s.finished.itemId).toBe('a');
		expect(s.dropped.itemId).toBe('b');
		const asked = new Set([checkInKey(journal[0])]);
		expect(checkInSittings({journal, profile: EMPTY_PROFILE, asked, now: NOW}).finished).toBe(null);
		const known = {...EMPTY_PROFILE, favorites: [{id: 2, type: 'movie', genres: []}]};
		expect(checkInSittings({journal, profile: known, now: NOW}).dropped).toBe(null);
	});

	test('réponses', () => {
		const e = entry();
		expect(applyVerdict(EMPTY_PROFILE, e, 'loved').pivots).toHaveLength(1);
		expect(applyVerdict(applyVerdict(EMPTY_PROFILE, e, 'good'), e, 'good').favorites).toHaveLength(1);
		expect(applyDropReason(EMPTY_PROFILE, e, 'tooSlow').axes.slowFast).toBe(0.5);
		expect(applyDropReason(EMPTY_PROFILE, e, 'tooDark').violence).toBe('justified');
		expect(applyDropReason(EMPTY_PROFILE, e, 'later')).toBe(EMPTY_PROFILE);
		const p = {...EMPTY_PROFILE, avoided: ['horror']};
		const q = stillTrueQuestion(p);
		expect(q).toEqual({kind: 'avoided', genre: 'horror'});
		expect(releaseChoice(p, q).avoided).toEqual([]);
	});

	test('quand le proposer', () => {
		expect(tastePromptDue({profile: EMPTY_PROFILE, promptedAt: null, now: NOW})).toBe('questionnaire');
		expect(tastePromptDue({profile: {...EMPTY_PROFILE, updatedAt: '2026-01-01T00:00:00Z'}, promptedAt: null, now: NOW})).toBe(null);
		expect(tastePromptDue({profile: EMPTY_PROFILE, promptedAt: NOW - 5 * DAY, now: NOW})).toBe(null);
		expect(tastePromptDue({profile: {...EMPTY_PROFILE, updatedAt: '2026-01-01T00:00:00Z'}, promptedAt: NOW - 40 * DAY, now: NOW})).toBe('checkIn');
	});
});
