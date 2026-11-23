import {decodeProfile, encodeProfile, genreAffinity, tasteFactorFor, axisPosition, seriesFit, EMPTY_PROFILE} from './tasteProfile';
import {pickGridPage, buildDuel, soFarOf, quizTitleFromSeerr} from './tasteQuiz';

jest.mock('../storage', () => ({getFromStorage: () => Promise.resolve(null), saveToStorage: () => Promise.resolve()}));

const NOW = new Date(2026, 10, 23);
const base = (over) => ({...EMPTY_PROFILE, ...over});

describe('goûts', () => {
	test('aller-retour au format de l\'APK', () => {
		const p = decodeProfile({media: 'series', liked: ['drama', 'nope'], pivots: [{id: 1, type: 'movie', title: 'A', genres: ['scifi']}], axes: {darkLight: 1.5, x: 2}, kids: 'teen', surprise: true});
		expect(p.mediaPref).toBe('series');
		expect(p.liked).toEqual(['drama']);
		expect(p.axes).toEqual({darkLight: 1.5});
		const back = encodeProfile(p);
		expect(back.media).toBe('series');
		expect(back.kids).toBe('teen');
		expect(back.surprise).toBe(true);
		expect(decodeProfile(back).pivots[0].genres).toEqual(['scifi']);
		expect(decodeProfile(null).violence).toBe('fine');
	});

	test('affinité par genre', () => {
		const a = genreAffinity(base({pivots: [{id: 1, type: 'movie', genres: ['scifi']}], disliked: [{id: 2, type: 'movie', genres: ['horror']}]}));
		expect(a.scifi).toBeCloseTo(0.5);
		expect(a.horror).toBeCloseTo(-0.25);
	});

	test('facteur : écarté, neutre, favorisé', () => {
		const ctx = {mediaType: 'movie', language: 'en', year: 2020, voteCount: 5000, now: NOW};
		expect(tasteFactorFor({...ctx, genres: ['horror'], profile: base({avoided: ['horror']})})).toBe(0);
		expect(tasteFactorFor({...ctx, genres: ['horror'], profile: base({violence: 'none'})})).toBe(0);
		expect(tasteFactorFor({...ctx, language: 'ko', genres: ['drama'], profile: base({subtitles: 'never'})})).toBe(0);
		expect(tasteFactorFor({...ctx, genres: ['drama'], profile: EMPTY_PROFILE})).toBe(1);
		expect(tasteFactorFor({...ctx, genres: ['drama'], profile: base({liked: ['drama']})})).toBeCloseTo(1.3);
		expect(tasteFactorFor({...ctx, mediaType: 'tv', genres: ['drama'], profile: base({mediaPref: 'movies'})})).toBeCloseTo(0.45);
		expect(tasteFactorFor({...ctx, genres: ['comedy'], profile: EMPTY_PROFILE, feedback: {hidden: [], penalties: {comedy: 1}}})).toBeCloseTo(0.82);
	});

	test('axes et format de séries', () => {
		expect(axisPosition('darkLight', {genres: ['horror']})).toBe(-1);
		expect(axisPosition('recentClassic', {genres: [], year: 1990, now: NOW})).toBe(1);
		expect(axisPosition('popularNiche', {genres: [], voteCount: 500})).toBe(1);
		expect(seriesFit('mini', 1)).toBe(0.5);
		expect(seriesFit('long', 1)).toBe(-0.3);
		expect(seriesFit('any', 3)).toBe(0);
	});
});

describe('questionnaire', () => {
	const t = (id, over) => ({id, type: 'movie', key: `movie:${id}`, title: `T${id}`, poster: '/p', genres: ['drama'], year: 2010, rating: 7, votes: 3000, language: 'en', ...over});
	const pool = [
		t(1, {year: 1985, genres: ['crime']}), t(2, {language: 'fr', genres: ['comedy']}), t(3, {language: 'ko', genres: ['thriller']}),
		t(4, {genres: ['animation']}), t(5, {type: 'tv', key: 'tv:5', genres: ['scifi']}), t(6, {type: 'tv', key: 'tv:6', genres: ['war']}),
		t(7, {year: 2023, genres: ['action'], votes: 20000}), t(8, {genres: ['romance'], rating: 8, votes: 1000}), t(9, {genres: ['horror']}), t(10, {genres: ['fantasy'], year: 1960})
	];

	test('titre Seerr', () => {
		expect(quizTitleFromSeerr({id: 3, mediaType: 'tv', name: 'X', posterPath: '/x', genreIds: [10765], firstAirDate: '2019-01-01'}).genres).toEqual(['fantasy', 'scifi']);
		expect(quizTitleFromSeerr({id: 3, mediaType: 'movie', title: 'X'})).toBe(null);
	});

	test('page variée, genres évités écartés', () => {
		const page = pickGridPage({pool, count: 8, avoided: ['horror'], now: NOW});
		expect(page).toHaveLength(8);
		expect(page.some((x) => x.id === 9)).toBe(false);
		expect(page.some((x) => x.language === 'fr')).toBe(true);
		expect(page.some((x) => x.type === 'tv')).toBe(true);
	});

	test('pages suivantes : deux refus d\'un genre l\'écartent', () => {
		const first = [pool[0], pool[1], pool[8]];
		const verdicts = {'movie:1': 'disliked', 'movie:9': 'disliked'};
		const crimeAgain = t(11, {genres: ['crime']});
		const s = soFarOf([[first[0], first[2], t(12, {genres: ['crime']})]], {...verdicts, 'movie:12': 'disliked'});
		const page = pickGridPage({pool: pool.concat([crimeAgain]), count: 4, soFar: s, now: NOW});
		expect(page.some((x) => x.genres.indexOf('crime') >= 0)).toBe(false);
	});

	test('duel sombre contre léger', () => {
		const d = buildDuel('darkLight', {pool, now: NOW});
		expect(d.left.genres).toContain('crime');
		expect(d.right.genres.some((g) => ['comedy', 'animation'].indexOf(g) >= 0)).toBe(true);
	});
});
