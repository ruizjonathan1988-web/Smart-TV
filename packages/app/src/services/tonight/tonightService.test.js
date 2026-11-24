import {loadTonightPicks, suggestAnswers, saveAnswers, rejected, launched, recordPlaybackStop, getJournal, loadTonight,
	finishedAt, fromLaunch, outcomeReward, contenders, resetTonightForTests} from './tonightService';
import {resetForYouForTests} from './forYou';

jest.mock('../betaSeries', () => ({betaSeriesSimilarMovies: () => Promise.resolve([]), betaSeriesSimilarShows: () => Promise.resolve([])}));
jest.mock('../trakt', () => ({traktRelated: () => Promise.resolve([])}));
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

	test('vu jusqu\'au bout, lancement reconnu, verdict', () => {
		const min = 600000000;
		expect(finishedAt(false, 100 * min, 93 * min)).toBe(true);
		expect(finishedAt(false, 200 * min, 175 * min)).toBe(false);
		expect(finishedAt(true, 40 * min, 37.5 * min)).toBe(true);
		expect(finishedAt(true, 40 * min, 0)).toBe(false);
		expect(finishedAt(false, 0, 10)).toBe(false);
		const launch = {at: 1000, playItemId: 'e1', libraryItemId: 's1', tmdbKey: 'tv:9'};
		expect(fromLaunch(launch, {startedAt: 2000, playItemId: 'e2', ownerId: 's1'})).toBe(true);
		expect(fromLaunch(launch, {startedAt: 2000, playItemId: 'x', ownerId: 'y', tmdbKey: 'tv:9'})).toBe(true);
		expect(fromLaunch(launch, {startedAt: 1000 + 9 * 3600000, playItemId: 'e1'})).toBe(false);
		expect(fromLaunch({at: 1000, itemId: 's1'}, {startedAt: 2000, ownerId: 's1'})).toBe(true);
		expect(outcomeReward({finished: true})).toBe(1);
		expect(outcomeReward({watchedMinutes: 10})).toBe(-1);
		expect(outcomeReward({watchedMinutes: 40})).toBe(0.2);
	});

	test('les films sans durée à demander : les propositions d\'abord, 30 au plus', () => {
		const c = (i, extra = {}) => ({key: `movie:${i}`, mediaType: 'movie', tmdbId: i, ...extra});
		const pool = [c(1), c(2, {runtimeMinutes: 90}), c(3), {key: 'tv:4', mediaType: 'tv', tmdbId: 4}].concat(Array.from({length: 40}, (_, i) => c(100 + i)));
		const out = contenders(pool, {picks: [{candidate: c(3)}]}, {picks: [{candidate: c(1)}]});
		expect(out.slice(0, 2).map((x) => x.tmdbId)).toEqual([3, 1]);
		expect(out).toHaveLength(30);
		expect(out.some((x) => x.tmdbId === 2 || x.tmdbId === 4)).toBe(false);
	});

	test('la fin d\'une lecture lancée depuis « Ce soir » apprend au moteur, une seule fois', async () => {
		await loadTonight();
		const pick = {candidate: {key: 'movie:1', mediaType: 'movie', tmdbId: 1, libraryItemId: 'm1', playItemId: 'm1'}, features: {mood: 2, quality: 1}};
		launched(pick);
		const getItem = jest.fn().mockResolvedValue(movie(1, {Genres: ['Comédie']}));
		const startedAt = Date.now();
		await recordPlaybackStop({getItem}, {itemId: 'm1', startedAt, startTicks: 0, stopTicks: 30 * 1000000});
		expect(getItem).not.toHaveBeenCalled();
		await recordPlaybackStop({getItem}, {itemId: 'm1', startedAt, startTicks: 0, stopTicks: 95 * 600000000});
		const journal = await getJournal();
		expect(journal[journal.length - 1]).toMatchObject({itemId: 'm1', finished: true, fromTonight: true, watchedMinutes: 95});
		await recordPlaybackStop({getItem}, {itemId: 'm1', startedAt: startedAt + 1000, startTicks: 0, stopTicks: 95 * 600000000});
		const again = await getJournal();
		expect(again[again.length - 1].fromTonight).toBe(false);
	});

	test('avec Seerr : la vraie durée des films est demandée avant de choisir', async () => {
		resetForYouForTests({recommendations: () => Promise.resolve([])});
		const film = (id, voteAverage) => ({id, title: `Seerr ${id}`, genreIds: [35], posterPath: '/p', releaseDate: '2020-01-01', voteAverage, voteCount: 3000});
		const seerr = {
			discoverFiltered: jest.fn((type) => Promise.resolve({results: type === 'movie' ? [film(501, 8.5), film(502, 7)] : []})),
			getImageUrl: (p) => p,
			getMovie: jest.fn((id) => Promise.resolve({id, runtime: id === 501 ? 170 : 95})),
			getWatchlist: () => Promise.resolve({results: []}),
			getUser: () => Promise.resolve({id: 1}),
			getMyRequests: () => Promise.resolve({results: []})
		};
		const answers = {company: 'alone', time: 'short', mood: 'laugh', kidsAge: 'from7to12', at: Date.now()};
		const {result} = await loadTonightPicks(answers, {api, serverUrl: 'http://s', seerr, requestableOnly: false});
		expect(seerr.getMovie).toHaveBeenCalled();
		const keys = result.picks.map((p) => p.candidate.key);
		expect(keys).not.toContain('movie:501');
	});
});
