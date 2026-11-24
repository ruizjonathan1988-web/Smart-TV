import {
	stateFromPrefs, cardsFor, raceLine, proposalFromJson, isSealed, opensLabel, ranking, scores,
	watchFromUserData, patchFor, newInHouse, auraPseudo, auraName, createAuraCloud, AuraCloudError, playedValue
} from './aura';

jest.mock('./jellyfinApi', () => ({api: {}, getUserId: () => 'u1', resolveItemsByProviderIds: jest.fn()}));
jest.mock('./secureFetch', () => ({platformFetch: jest.fn()}));
jest.mock('./storage', () => ({getFromStorage: jest.fn(), saveToStorage: jest.fn()}));

const prop = (o) => proposalFromJson({id: 'p', de: 'joueur', de_nom: 'Jon', film: {titre: 'Dune'}, cree_le: '2026-11-01T00:00:00Z', ...o});

describe('Aura, les règles', () => {
	test('l’état publié par Aura : la course et les cartes du jour', () => {
		const state = stateFromPrefs({etat: JSON.stringify({v: 1, position: 12, pop: 9, cartes: {'2026-11-23': [{type: 'A', defi: 'Un film en noir et blanc', cases: 2, film: {id: 'jf1', titre: 'M', annee: 1931, jellyfin: true}}]}, seance: {titre: 'M'}})});
		expect(state.position).toBe(12);
		expect(raceLine(state)).toBe('Tu as 3 cases d’avance sur Pop.');
		const [card] = cardsFor(state, new Date(2026, 10, 23));
		expect(card).toEqual(expect.objectContaining({challenge: 'Un film en noir et blanc', squares: 2, onServer: true, year: 1931}));
		expect(state.playingTitle).toBe('M');
		expect(stateFromPrefs({etat: JSON.stringify({v: 2})})).toBe(null);
		expect(stateFromPrefs({})).toBe(null);
	});

	test('la carte jouée, au format qu’Aura lit', () => {
		expect(JSON.parse(playedValue('2026-11-23', 1, new Date('2026-11-23T20:00:00Z')))).toEqual({jour: '2026-11-23', index: 1, quand: '2026-11-23T20:00:00.000Z'});
	});

	test('+1 vu, +2 aimé, +3 quand plusieurs aiment le même film', () => {
		const list = [
			prop({de_personne: 'h:jon', pour_personne: 'h:a', film_cle: 'tmdb:1', vu_le: '2026-11-02', aime: true}),
			prop({de_personne: 'h:jon', pour_personne: 'h:b', film_cle: 'tmdb:1', vu_le: '2026-11-02', note: 5}),
			prop({de_personne: 'h:lea', de_nom: 'Léa', pour_personne: 'h:jon', film_cle: 'tmdb:2', vu_le: '2026-11-02'})
		];
		expect(scores(list)).toEqual({'h:jon': 9, 'h:lea': 1});
		expect(ranking(list).map((r) => r.name)).toEqual(['Jon', 'Léa']);
	});

	test('un film cacheté garde son titre jusqu’au jour prévu', () => {
		const p = prop({film: {titre: 'Secret', ouvrir_le: '2026-11-25'}});
		const now = new Date(2026, 10, 23, 20);
		expect(isSealed(p, now)).toBe(true);
		expect(opensLabel(p, now)).toBe('à ouvrir mercredi');
		expect(isSealed(p, new Date(2026, 10, 25, 9))).toBe(false);
	});

	test('ce que Jellyfin dit d’un titre : vu, aimé, et on n’enlève jamais rien', () => {
		const w = watchFromUserData({Played: true, IsFavorite: true});
		expect(patchFor(w, prop({}), new Date('2026-11-23T00:00:00Z'))).toEqual({vu_le: '2026-11-23T00:00:00.000Z', aime: true});
		expect(patchFor(watchFromUserData({PlayCount: 1}), prop({vu_le: '2026-11-02'}))).toBe(null);
		expect(watchFromUserData({UnplayedItemCount: 3, PlayedPercentage: 10}).played).toBe(true);
	});

	test('une proposition : noms et mot raccourcis comme le serveur les veut', () => {
		const body = newInHouse({fromPerson: 'h:jon', fromName: 'Jon', toPerson: 'h:a', toName: 'Anna', house: 'h', title: 'Dune', year: 2021, tmdbId: 438631, series: false, note: '  Tu vas adorer. '});
		expect(body).toEqual({de_personne: 'h:jon', de_nom: 'Jon', pour_personne: 'h:a', pour_nom: 'Anna', maison: 'h', film_cle: 'tmdb:438631', film: {titre: 'Dune', type: 'movie', annee: 2021, tmdb: 438631}, mot: 'Tu vas adorer.'});
		expect(auraPseudo('J')).toBe('J.');
		expect(auraName('')).toBe('?');
	});
});

describe('Aura, le serveur', () => {
	const reply = (status, json) => ({status, text: async () => (json === undefined ? '' : JSON.stringify(json))});

	test('un compte anonyme par télé, gardé, puis les propositions', async () => {
		let saved = null;
		const fetcher = jest.fn(async (url) => {
			if (url.endsWith('/auth/v1/signup')) return reply(200, {user: {id: 'anon1'}, access_token: 'tok', refresh_token: 'ref', expires_in: 3600});
			if (url.includes('/rest/v1/propositions')) return reply(200, [{id: 'p1', de: 'x', film: {titre: 'Dune'}}]);
			return reply(404);
		});
		const cloud = createAuraCloud({load: async () => saved, save: async (v) => {
			saved = v;
		}, fetcher, clock: () => 1000});
		const list = await cloud.proposals();
		expect(list[0].title).toBe('Dune');
		expect(JSON.parse(saved).u).toBe('anon1');
		const [, opts] = fetcher.mock.calls[1];
		expect(opts.headers.Authorization).toBe('Bearer tok');
	});

	test('déjà proposé : le serveur répond 409', async () => {
		const fetcher = jest.fn(async (url) => (url.includes('/auth/') ? reply(200, {user: {id: 'a'}, access_token: 't', refresh_token: 'r'}) : reply(409)));
		const cloud = createAuraCloud({load: async () => null, save: async () => {}, fetcher});
		await expect(cloud.propose({})).rejects.toEqual(new AuraCloudError('Déjà proposé.'));
	});
});
