import {loadTonightPicks, suggestAnswers, saveAnswers, rejected, resetTonightForTests} from './tonightService';

jest.mock('../storage', () => ({
	getFromStorage: () => Promise.resolve(null),
	saveToStorage: () => Promise.resolve()
}));

const movie = (i, extra = {}) => ({Id: `m${i}`, Type: 'Movie', Name: `Film ${i}`, Genres: ['Comédie'], RunTimeTicks: 100 * 600000000, CommunityRating: 6 + (i % 3), ProviderIds: {Tmdb: String(i)}, ...extra});

const api = {
	getItems: (q) => Promise.resolve({Items: q.IncludeItemTypes === 'Movie' ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => movie(i)) : []}),
	getNextUp: () => Promise.resolve({Items: []})
};

describe('tonightService', () => {
	beforeEach(() => resetTonightForTests());

	test('réponses gardées 5 h', () => {
		const now = Date.now();
		saveAnswers({company: 'couple', time: 'short', mood: 'laugh', kidsAge: 'teen', at: now});
		expect(suggestAnswers(now + 3600000).company).toBe('couple');
		expect(suggestAnswers(now + 6 * 3600000).mood).toBe('laugh');
	});

	test('suggestions depuis la bibliothèque, et « Autre idée » les fait reculer', async () => {
		const answers = {company: 'alone', time: 'evening', mood: 'laugh', kidsAge: 'from7to12', at: Date.now()};
		const {result} = await loadTonightPicks(answers, {api, serverUrl: 'http://s', libraryOnly: true});
		expect(result.picks.length).toBe(6);
		const first = result.picks[0];
		expect(first.candidate.libraryItemId).toMatch(/^m/);
		rejected(first);
		rejected(first);
		const again = await loadTonightPicks(answers, {api, serverUrl: 'http://s', libraryOnly: true});
		expect(again.result.picks[0].candidate.key).not.toBe(first.candidate.key);
	});
});
