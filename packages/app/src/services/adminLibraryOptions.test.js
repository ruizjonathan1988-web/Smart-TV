import {seedLibraryOptions, newLibraryOptions, ordered, moveInOrder, toggleName, libraryTraits, imageOptionFor} from './adminLibraryOptions';

const available = {
	MetadataSavers: [{Name: 'Nfo', DefaultEnabled: false}],
	MetadataReaders: [{Name: 'Nfo'}, {Name: 'Local'}],
	SubtitleFetchers: [{Name: 'OpenSubtitles', DefaultEnabled: false}, {Name: 'Podnapisi', DefaultEnabled: true}],
	TypeOptions: [{
		Type: 'Movie',
		MetadataFetchers: [{Name: 'TheMovieDb', DefaultEnabled: true}, {Name: 'OMDb', DefaultEnabled: false}],
		ImageFetchers: [{Name: 'TheMovieDb', DefaultEnabled: true}]
	}]
};

describe('options de bibliothèque', () => {
	test('ordre : les noms configurés puis les autres, les disparus sortent', () => {
		expect(ordered([{Name: 'A'}, {Name: 'B'}, {Name: 'C'}], ['C', 'Z'])).toEqual(['C', 'A', 'B']);
	});

	test('listes effectives écrites dans les options', () => {
		const o = seedLibraryOptions({}, available);
		expect(o.MetadataSavers).toEqual([]);
		expect(o.LocalMetadataReaderOrder).toEqual(['Nfo', 'Local']);
		expect(o.SubtitleFetcherOrder).toEqual(['OpenSubtitles', 'Podnapisi']);
		expect(o.DisabledSubtitleFetchers).toEqual(['OpenSubtitles']);
		expect(o.TypeOptions).toEqual([{Type: 'Movie', MetadataFetcherOrder: ['TheMovieDb', 'OMDb'], MetadataFetchers: ['TheMovieDb'], ImageFetcherOrder: ['TheMovieDb'], ImageFetchers: ['TheMovieDb']}]);
	});

	test('les listes enregistrées l’emportent', () => {
		const o = seedLibraryOptions({DisabledSubtitleFetchers: [], TypeOptions: [{Type: 'Movie', MetadataFetchers: ['OMDb'], MetadataFetcherOrder: ['OMDb']}]}, available);
		expect(o.DisabledSubtitleFetchers).toEqual([]);
		expect(o.TypeOptions[0].MetadataFetchers).toEqual(['OMDb']);
		expect(o.TypeOptions[0].MetadataFetcherOrder).toEqual(['OMDb', 'TheMovieDb']);
	});

	test('nouvelle bibliothèque Jellyfin', () => {
		const o = newLibraryOptions(available);
		expect(o.Enabled).toBe(true);
		expect(o.SeasonZeroDisplayName).toBe('Specials');
		expect(o.TypeOptions).toHaveLength(1);
	});

	test('déplacer et cocher', () => {
		expect(moveInOrder(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
		expect(moveInOrder(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
		expect(toggleName(['a'], 'b', true)).toEqual(['a', 'b']);
		expect(toggleName(['a', 'b'], 'a', false)).toEqual(['b']);
	});

	test('sections selon le type', () => {
		expect(libraryTraits('music')).toMatchObject({subtitles: false, chapters: false, embeddedTitles: false});
		expect(libraryTraits(null)).toMatchObject({chapters: true, resume: true});
	});

	test('options d’images', () => {
		expect(imageOptionFor([], [], 'Primary')).toEqual({Type: 'Primary', Limit: 1, MinWidth: 0});
		expect(imageOptionFor([{Type: 'Logo', Limit: 1}], [], 'Logo').Limit).toBe(1);
	});
});
