import {genresFromNames, genresOfIds, slotOf, ratingAge, decodeAnswers, encodeAnswers} from './tonightModels';
import {recordEntry, backfillEntries, outcomeOf, watchedTmdbKeys} from './eveningJournal';
import {buildHabits, habitsFor, suggestCompany} from './habitModel';
import {rankTonight, learnWeights, PICK_COUNT} from './tonightEngine';

const at = (d, h) => new Date(2026, 10, d, h).getTime();

describe('tonightModels', () => {
	test('genres', () => {
		expect(genresFromNames(['Action & Adventure', 'Comédie']).sort()).toEqual(['action', 'adventure', 'comedy']);
		expect(genresOfIds([35, 27], 'movie').sort()).toEqual(['comedy', 'horror']);
		expect(genresOfIds([10765], 'tv').sort()).toEqual(['fantasy', 'scifi']);
	});

	test('créneaux : après minuit = la soirée de la veille', () => {
		expect(slotOf(at(20, 21)).key).toBe('friday_evening');
		expect(slotOf(at(21, 1)).key).toBe('friday_late');
		expect(slotOf(at(23, 14)).key).toBe('weekday_daytime');
	});

	test('classifications', () => {
		expect(ratingAge('FR-12')).toBe(12);
		expect(ratingAge('Tous publics')).toBe(0);
		expect(ratingAge('PG-13')).toBe(13);
		expect(ratingAge('TV-MA')).toBe(17);
		expect(ratingAge('NR')).toBeNull();
	});

	test('réponses', () => {
		const a = {company: 'couple', time: 'short', mood: 'laugh', kidsAge: 'teen', at: at(20, 21)};
		expect(decodeAnswers(encodeAnswers(a))).toEqual(a);
		expect(decodeAnswers('{"company":"x"}')).toBeNull();
	});
});

describe('journal et habitudes', () => {
	test('épisodes d\'affilée = une séance', () => {
		let j = recordEntry([], {at: at(20, 21), itemId: 's', mediaType: 'tv', watchedMinutes: 40});
		j = recordEntry(j, {at: at(20, 22), itemId: 's', mediaType: 'tv', watchedMinutes: 40});
		expect(j.length).toBe(1);
		expect(j[0].episodes).toBe(2);
		expect(outcomeOf(j[0])).toBe(0.6);
	});

	test('rattrapage sans doublon le même jour', () => {
		const j = backfillEntries([{at: at(20, 21), itemId: 'm', mediaType: 'movie', tmdbId: 1, finished: true}],
			[{at: at(20, 23), itemId: 'm', mediaType: 'movie'}, {at: at(18, 20), itemId: 'n', mediaType: 'movie', backfilled: true, tmdbId: 2}]);
		expect(j.map((e) => e.itemId)).toEqual(['n', 'm']);
		expect(Array.from(watchedTmdbKeys(j)).sort()).toEqual(['movie:1', 'movie:2']);
	});

	test('compagnie habituelle du créneau', () => {
		const entries = [];
		for (let i = 0; i < 4; i++) entries.push({at: at(6 + 7 * i, 21) - 0, itemId: `m${i}`, mediaType: 'movie', company: 'family', finished: true, genres: ['animation']});
		const model = buildHabits(entries, at(28, 23));
		const slot = slotOf(at(6, 21));
		expect(suggestCompany(model, slot, null)).toBe('family');
		expect(habitsFor(model, {slot, company: 'family'}).genreShare.animation).toBeGreaterThan(0.5);
	});
});

describe('tonightEngine', () => {
	const mk = (i, extra) => ({key: `movie:${i}`, mediaType: 'movie', tmdbId: i, title: `Film ${i}`, genres: ['comedy'], runtimeMinutes: 100, rating: 7, availability: 'inLibrary', ...extra});
	const base = {
		answers: {company: 'alone', time: 'evening', mood: 'laugh', kidsAge: 'from7to12'},
		now: at(20, 21),
		habits: buildHabits([], at(20, 21)),
		journal: []
	};

	test('six suggestions dont un joker, l\'envie respectée', () => {
		const candidates = [];
		for (let i = 1; i <= 20; i++) candidates.push(mk(i, {rating: 5 + (i % 5)}));
		candidates.push(mk(99, {genres: ['horror']}));
		const r = rankTonight({...base, candidates});
		expect(r.picks.length).toBe(PICK_COUNT);
		expect(r.picks.some((p) => p.candidate.key === 'movie:99')).toBe(false);
	});

	test('soirée en famille : rien d\'interdit au plus jeune', () => {
		const candidates = [mk(1, {genres: ['animation'], ratingAge: 0}), mk(2, {genres: ['comedy'], ratingAge: 16}), mk(3, {genres: ['comedy'], adult: true})];
		const r = rankTonight({...base, answers: {...base.answers, company: 'family', kidsAge: 'under7'}, candidates});
		expect(r.picks.map((p) => p.candidate.key)).toEqual(['movie:1']);
	});

	test('temps court : pas de film trop long, série en cours en tête', () => {
		const candidates = [mk(1, {runtimeMinutes: 180}), mk(2, {runtimeMinutes: 90}), {key: 'tv:5', mediaType: 'tv', tmdbId: 5, title: 'Série', genres: ['comedy'], runtimeMinutes: 25, inProgress: true}];
		const r = rankTonight({...base, answers: {...base.answers, time: 'short', mood: 'comfort'}, candidates});
		expect(r.picks.map((p) => p.candidate.key)).not.toContain('movie:1');
		expect(r.picks[0].reason.kind).toBe('resume');
	});

	test('les poids apprennent sans sortir des bornes', () => {
		const w = learnWeights({}, {mood: 2, rejected: 5}, {reward: 1});
		expect(w.mood).toBeCloseTo(1.2);
		expect(w.rejected).toBe(1);
	});
});
