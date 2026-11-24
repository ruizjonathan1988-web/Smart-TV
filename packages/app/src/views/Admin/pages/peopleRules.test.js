import {badSchedule, groupRatings, ratingIndex} from './peopleRules';

// Réponse de /Localization/ParentalRatings : Jellyfin 10.10+ envoie RatingScore, les anciens Value.
const SERVER = [
	{Name: 'Approved', RatingScore: {score: 0, subScore: null}},
	{Name: 'G', RatingScore: {score: 0, subScore: null}},
	{Name: 'FR-10', RatingScore: {score: 10, subScore: null}},
	{Name: 'FR-12', RatingScore: {score: 12, subScore: null}},
	{Name: 'TV-14', RatingScore: {score: 14, subScore: 1}},
	{Name: 'FR-16', RatingScore: {score: 16, subScore: null}},
	{Name: 'FR-18', RatingScore: {score: 18, subScore: null}}
];

describe('classifications parentales du serveur', () => {
	test('regroupe les classifications de même note', () => {
		const grouped = groupRatings(SERVER);
		expect(grouped.map((r) => r.name)).toEqual(['Approved/G', 'FR-10', 'FR-12', 'TV-14', 'FR-16', 'FR-18']);
		expect(grouped[3]).toEqual({name: 'TV-14', score: 14, subScore: 1});
	});

	test('lit Value sur un ancien serveur et ignore les entrées sans note', () => {
		expect(groupRatings([{Name: 'PG', Value: 7}, {Name: 'Sans'}, null, {Value: 3}])).toEqual([{name: 'PG', score: 7, subScore: null}]);
		expect(groupRatings(null)).toEqual([]);
	});

	test('retrouve la limite de l\'utilisateur', () => {
		const grouped = groupRatings(SERVER);
		expect(ratingIndex(grouped, undefined)).toBe(-1);
		expect(ratingIndex(grouped, 12)).toBe(2);
		expect(ratingIndex(grouped, 14, 1)).toBe(3);
		expect(ratingIndex(grouped, 13)).toBe(2);
		expect(ratingIndex(grouped, -5)).toBe(-1);
	});

	test('repère une plage horaire impossible', () => {
		expect(badSchedule({AccessSchedules: [{StartHour: 8, EndHour: 20}, {StartHour: 22, EndHour: 6}]})).toBe(1);
		expect(badSchedule({AccessSchedules: [{StartHour: 8, EndHour: 20}]})).toBeNull();
		expect(badSchedule(null)).toBeNull();
	});
});
