import {buildSeeds, rankForYou, becauseRows, gems, abandonedMovie, abandonedSeries, abandonedPenalties, signalsFrom, requestStrength, qualityFactor, isRequestable, ratingsFactor, rerankForYou, markRequested, requestedKeys} from './forYou';

jest.mock('../storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = Date.parse('2026-11-23T20:00:00Z');
const DAY = 86400000;
const sig = (id, type = 'movie', strength = 1) => ({tmdbId: id, mediaType: type, title: `T${id}`, strength, key: `${type}:${id}`});
const item = (id, over = {}) => ({id, mediaType: 'movie', posterPath: '/p', releaseDate: '2020-01-01', voteAverage: 7.5, voteCount: 1000, ...over});

describe('Pour toi', () => {
	test('graines : récence, favoris, poids', () => {
		const seeds = buildSeeds({recent: [sig(1), sig(2), sig(1)], favorites: [sig(2)], picked: [sig(3, 'tv', 3)]});
		expect(seeds.map((s) => s.key)).toEqual(['tv:3', 'movie:2', 'movie:1']);
		expect(seeds[1].source).toBe('watched');
		expect(seeds[1].weight).toBeCloseTo(0.88 + 1.4);
	});

	test('classement : soutien de plusieurs graines, exclusions, plafond par graine', () => {
		const seeds = buildSeeds({recent: [sig(1), sig(2)]});
		const recs = {
			'movie:1': [item(10), item(11), item(12, {mediaInfo: {status: 5}}), item(13, {adult: true}), item(1)],
			'movie:2': [item(11), item(14)]
		};
		const picks = rankForYou({seeds, recs, exclude: new Set(['movie:14']), now: NOW});
		expect(picks[0].key).toBe('movie:11');
		expect(picks[0].seedCount).toBe(2);
		expect(picks.map((p) => p.key)).toEqual(['movie:11', 'movie:10']);
		const many = {'movie:1': [1, 2, 3, 4, 5, 6].map((i) => item(100 + i))};
		const capped = rankForYou({seeds: buildSeeds({recent: [sig(1)]}), recs: many, now: NOW, limit: 6});
		expect(capped).toHaveLength(6);
	});

	test('rangées « Parce que » et pépites', () => {
		const seeds = buildSeeds({recent: [sig(1)]});
		const recs = {'movie:1': [1, 2, 3, 4, 5].map((i) => item(i + 10, {mediaInfo: i === 5 ? {status: 5} : undefined}))};
		const rows = becauseRows({seeds, recs, now: NOW});
		expect(rows).toHaveLength(1);
		expect(rows[0].items[0].key).toBe('movie:15');
		expect(becauseRows({seeds, recs, minItems: 6, now: NOW})).toEqual([]);
		const g = gems({seeds, recs: {'movie:1': [1, 2, 3, 4, 5, 6].map((i) => item(i + 20, {voteCount: 500}))}, now: NOW});
		expect(g).toHaveLength(6);
		expect(gems({seeds, recs: {'movie:1': [item(30, {voteCount: 9000})]}, now: NOW})).toEqual([]);
	});

	test('abandons et pénalités', () => {
		expect(abandonedMovie({PlayedPercentage: 20, LastPlayedDate: new Date(NOW - 20 * DAY).toISOString()}, NOW)).toBe(true);
		expect(abandonedMovie({PlayedPercentage: 20, LastPlayedDate: new Date(NOW - 2 * DAY).toISOString()}, NOW)).toBe(false);
		expect(abandonedSeries({PlayedPercentage: 10, UnplayedItemCount: 8, LastPlayedDate: new Date(NOW - 30 * DAY).toISOString()}, NOW)).toBe(true);
		expect(abandonedSeries({PlayedPercentage: 10, UnplayedItemCount: 2}, NOW)).toBe(false);
		const p = abandonedPenalties([[['movie:1', 0], ['movie:2', 3]], [['movie:1', 0]]]);
		expect(p['movie:1']).toBeCloseTo(0.36);
		expect(p['movie:2']).toBeCloseTo(0.8);
	});

	test('petits calculs', () => {
		expect(signalsFrom([{Type: 'Series', Name: 'S', ProviderIds: {Tmdb: '5'}, UserData: {PlayCount: 3}}])[0]).toMatchObject({key: 'tv:5', strength: 1.35});
		expect(requestStrength(5, new Date(NOW - 90 * DAY).toISOString(), NOW)).toBe(0.2);
		expect(requestStrength(2, null, NOW)).toBe(1);
		expect(qualityFactor({voteAverage: 8, voteCount: 5000})).toBeGreaterThan(0.9);
		expect(isRequestable(item(1, {releaseDate: '2030-01-01'}), true, NOW)).toBe(false);
	});

	test('notes MDBList : il en faut deux, de 0.8 à 1.2', () => {
		expect(ratingsFactor([{source: 'imdb', value: 8.5}])).toBe(1);
		expect(ratingsFactor([{source: 'imdb', value: 8.5}, {source: 'tomatoes', value: 95}])).toBeCloseTo(1.2);
		expect(ratingsFactor([{source: 'Letterboxd', value: 2}, {source: 'metacritic', value: 30}])).toBeCloseTo(0.8);
		expect(ratingsFactor(null)).toBe(1);
	});

	test('« Pour toi » repesé par VJOD : votes des genres, source, notes', () => {
		const pick = (id, score, genreIds) => ({key: `movie:${id}`, item: {id, genreIds}, mediaType: 'movie', score, because: {source: 'watched'}});
		const picks = [pick(1, 1, [27]), pick(2, 0.95, [878])];
		const at = new Date().toISOString();
		const votes = {votes: [{key: 'a', genres: ['scifi'], liked: true, at}, {key: 'b', genres: ['scifi'], liked: true, at}, {key: 'c', genres: ['horror'], liked: false, at}], suggested: {}};
		expect(rerankForYou(picks, {votes}).map((p) => p.item.id)).toEqual([2, 1]);
		expect(rerankForYou(picks, {votes: {votes: [], suggested: {}}}).map((p) => p.item.id)).toEqual([1, 2]);
		const ratings = {'movie:2': [{source: 'imdb', value: 9}, {source: 'tomatoes', value: 98}]};
		expect(rerankForYou(picks, {votes: {votes: [], suggested: {}}, ratings}).map((p) => p.item.id)).toEqual([2, 1]);
	});

	test('les titres demandés pendant la session', () => {
		markRequested('tv', 42);
		expect(requestedKeys()).toContain('tv:42');
	});
});
