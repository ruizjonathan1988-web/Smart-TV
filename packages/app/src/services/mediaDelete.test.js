import {canDeleteFromServer, confirmMessage, deleteChoices, deleteMedia, deleteSummary, pickName} from './mediaDelete';

const episode = {Id: 'e', Type: 'Episode', Name: 'Pilote', SeriesName: 'Dark', ParentIndexNumber: 1, IndexNumber: 3, SeasonId: 's1', SeriesId: 'sr', CanDelete: true};

describe('mediaDelete', () => {
	test('seulement pour un profil autorisé, film ou série', () => {
		expect(canDeleteFromServer(episode)).toBe(true);
		expect(canDeleteFromServer({...episode, CanDelete: false})).toBe(false);
		expect(canDeleteFromServer({Type: 'Playlist', CanDelete: true})).toBe(false);
	});

	test('les choix comme l\'APK', () => {
		expect(deleteChoices(episode).map((c) => c.label)).toEqual(['Cet épisode (S1 É3)', 'Toute la saison 1', 'Toute la série']);
		expect(deleteChoices(episode)[1].what).toBe('la saison 1 de « Dark »');
		const series = {Id: 'sr', Type: 'Series', Name: 'Dark'};
		const choices = deleteChoices(series, [{Id: 's1', Type: 'Season', Name: 'Saison 1', CanDelete: true}, {Id: 's2', Type: 'Season', Name: 'Saison 2', CanDelete: false}]);
		expect(choices.map((c) => [c.label, c.leaves])).toEqual([['Toute la série', true], ['Seulement saison 1', false]]);
		expect(deleteChoices({Id: 'm', Type: 'Movie', Name: 'Heat'})).toEqual([{id: 'm', label: 'Supprimer', what: '« Heat »', leaves: true}]);
	});

	test('message et résumé', () => {
		const pick = deleteChoices({Id: 'm', Type: 'Movie', Name: 'Heat'})[0];
		expect(confirmMessage({Type: 'Movie'}, pick)).toContain('Radarr ne le retéléchargera pas');
		expect(pickName(pick)).toBe('Heat');
		expect(deleteSummary({freed: 3 * (1 << 30), notes: ['a', 'b', 'c']}, 'Heat')).toBe('« Heat » supprimé du serveur · 3,0 Go libérés\na\nb');
		expect(deleteSummary({freed: 5 * (1 << 20), notes: []}, 'Heat')).toBe('« Heat » supprimé du serveur · 5 Mo libérés');
		expect(deleteSummary({jellyfinOnly: true}, 'Heat')).toContain('Ma TV absent');
		expect(deleteSummary({error: 'Non'}, 'Heat')).toBe('Non');
	});

	test('Jellyfin seul sans Ma TV', async () => {
		const jellyfinDelete = jest.fn(() => Promise.resolve());
		expect(await deleteMedia({server: null, itemId: 'm', jellyfinDelete})).toEqual({freed: 0, notes: [], jellyfinOnly: true});
		expect(jellyfinDelete).toHaveBeenCalled();
		const failed = await deleteMedia({server: null, itemId: 'm', jellyfinDelete: () => Promise.reject(new Error('403'))});
		expect(failed.error).toContain('403');
	});

	test('Ma TV fait tout', async () => {
		const post = jest.fn(() => Promise.resolve({status: 200, json: {freed: 10, notes: ['Sonarr ne le surveille plus']}}));
		const result = await deleteMedia({server: {url: 'u', key: 'k'}, itemId: 'm', token: 't', post});
		expect(post).toHaveBeenCalledWith({url: 'u', key: 'k'}, '/tv/api/media/delete', {token: 't', id: 'm'}, 90000);
		expect(result).toEqual({freed: 10, notes: ['Sonarr ne le surveille plus'], jellyfinOnly: false});
		expect((await deleteMedia({server: {}, itemId: 'm', token: ''})).error).toContain('Profil non connecté');
		expect((await deleteMedia({server: {}, itemId: 'm', token: 't', post: () => Promise.resolve({status: 403, json: {error: 'Interdit'}})})).error).toBe('Interdit. Rien n’a été supprimé.');
		expect((await deleteMedia({server: {}, itemId: 'm', token: 't', post: () => Promise.resolve({status: 0, json: null})})).error).toContain('ne répond pas');
	});
});
