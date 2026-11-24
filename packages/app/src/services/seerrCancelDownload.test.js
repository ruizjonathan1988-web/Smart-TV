import {cancelPayload, forCancel} from './seerrCancelDownload';

const req = (id, extra = {}) => ({id, status: 2, is4k: false, ...extra});
const seasons = (...n) => n.map((seasonNumber) => ({seasonNumber}));

describe('seerrCancelDownload', () => {
	test('le corps envoyé à Ma TV', () => {
		expect(cancelPayload({isMovie: true, tmdbId: 5, tvdbId: 0})).toEqual({type: 'movie', tmdb: 5});
		expect(cancelPayload({isMovie: false, tmdbId: 5, tvdbId: 9, seasons: [3, 0, 1, 3]})).toEqual({type: 'tv', tmdb: 5, tvdb: 9, seasons: [1, 3]});
	});

	test('film : arrêté seulement si personne d\'autre ne le demande', () => {
		expect(forCancel({all: [req(1)], cancelled: [1], isMovie: true, tmdbId: 7})).toEqual({type: 'movie', tmdb: 7});
		expect(forCancel({all: [req(1), req(2)], cancelled: [1], isMovie: true, tmdbId: 7})).toBeNull();
		expect(forCancel({all: [req(1), req(2, {is4k: true})], cancelled: [1], isMovie: true, tmdbId: 7})).not.toBeNull();
		expect(forCancel({all: [req(1), req(2, {status: 3})], cancelled: [1], isMovie: true, tmdbId: 7})).not.toBeNull();
		expect(forCancel({all: [req(1)], cancelled: [1], isMovie: true, tmdbId: 0})).toBeNull();
		expect(forCancel({all: [req(1)], cancelled: [9], isMovie: true, tmdbId: 7})).toBeNull();
	});

	test('série : seulement les saisons que personne ne garde', () => {
		const all = [req(1, {seasons: seasons(1, 2)}), req(2, {seasons: seasons(2)})];
		expect(forCancel({all, cancelled: [1], isMovie: false, tmdbId: 7, tvdbId: 70})).toEqual({type: 'tv', tmdb: 7, tvdb: 70, seasons: [1]});
		expect(forCancel({all: [req(1, {seasons: seasons(2)}), req(2, {seasons: seasons(2)})], cancelled: [1], isMovie: false, tmdbId: 7})).toBeNull();
		expect(forCancel({all: [req(1, {seasons: seasons(1)}), req(2)], cancelled: [1], isMovie: false, tmdbId: 7})).toBeNull();
		expect(forCancel({all: [req(1)], cancelled: [1], isMovie: false, tmdbId: 7})).toEqual({type: 'tv', tmdb: 7, seasons: []});
	});
});
