import {fromServerImageType, toServerImageType, readLibraryImageType, writeLibraryImageType} from './libraryImageType';

describe('type d\'image d\'une bibliothèque, rangé dans Jellyfin', () => {
	test('les noms de l\'APK et de la TV', () => {
		expect(toServerImageType('thumbnail')).toBe('thumb');
		expect(fromServerImageType('Thumb')).toBe('thumbnail');
		expect(fromServerImageType('banner')).toBe('banner');
		expect(fromServerImageType('autre')).toBe(null);
	});

	test('lu et écrit dans les préférences « moonfin » de la bibliothèque, sans perdre le reste', async () => {
		const api = {
			getDisplayPreferences: jest.fn().mockResolvedValue({Id: 'lib1', SortBy: 'SortName', CustomPrefs: {imageType: 'thumb', other: '1'}}),
			saveDisplayPreferences: jest.fn().mockResolvedValue(null)
		};
		expect(await readLibraryImageType(api, 'lib1')).toBe('thumbnail');
		expect(api.getDisplayPreferences).toHaveBeenCalledWith('lib1', 'moonfin');
		await writeLibraryImageType(api, 'lib1', 'banner');
		expect(api.saveDisplayPreferences).toHaveBeenCalledWith('lib1', 'moonfin', {Id: 'lib1', SortBy: 'SortName', CustomPrefs: {imageType: 'banner', other: '1'}});
	});

	test('les vues par genre ou par studio restent sur la télé, une panne ne casse rien', async () => {
		const api = {getDisplayPreferences: jest.fn().mockRejectedValue(new Error('500')), saveDisplayPreferences: jest.fn().mockRejectedValue(new Error('500'))};
		expect(await readLibraryImageType(api, 'genre-12')).toBe(null);
		expect(api.getDisplayPreferences).not.toHaveBeenCalled();
		expect(await readLibraryImageType(api, 'lib1')).toBe(null);
		await writeLibraryImageType(api, 'lib1', 'poster');
		expect(api.saveDisplayPreferences).toHaveBeenCalledWith('lib1', 'moonfin', {Id: 'lib1', CustomPrefs: {imageType: 'poster'}});
	});
});
