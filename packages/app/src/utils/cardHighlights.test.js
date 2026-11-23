import {cardHighlight, isFreshlyAdded} from './cardHighlights';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const movie = (extra = {}) => ({Type: 'Movie', ImageTags: {Primary: 'x'}, DateCreated: '2026-11-20T10:00:00Z', UserData: {}, ...extra});

describe('cardHighlights', () => {
	test('un film arrivé il y a trois jours est nouveau', () => {
		expect(isFreshlyAdded(movie(), NOW)).toBe(true);
	});
	test('plus de dix jours, entamé, vu ou sans affiche : pas nouveau', () => {
		expect(isFreshlyAdded(movie({DateCreated: '2026-11-01T10:00:00Z'}), NOW)).toBe(false);
		expect(isFreshlyAdded(movie({UserData: {PlayedPercentage: 12}}), NOW)).toBe(false);
		expect(isFreshlyAdded(movie({UserData: {Played: true}}), NOW)).toBe(false);
		expect(isFreshlyAdded(movie({ImageTags: {}}), NOW)).toBe(false);
	});
	test('un épisode sans série ne compte pas', () => {
		expect(isFreshlyAdded({Type: 'Episode', DateCreated: '2026-11-22T10:00:00Z'}, NOW)).toBe(false);
		expect(isFreshlyAdded({Type: 'Episode', SeriesId: 's', DateCreated: '2026-11-22T10:00:00Z'}, NOW)).toBe(true);
	});
	test('le rang passe avant la pastille, « Nouveau » seulement à l’accueil', () => {
		expect(cardHighlight({...movie(), _vjodRank: 3}, {home: true, now: NOW})).toEqual({rank: 3});
		expect(cardHighlight({_vjodPill: 'Pépite'})).toEqual({pill: 'Pépite'});
		expect(cardHighlight(movie(), {home: true, now: NOW})).toEqual({pill: 'Nouveau'});
		expect(cardHighlight(movie(), {now: NOW})).toBe(null);
	});
});
