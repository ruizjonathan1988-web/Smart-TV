import {copyRankOfPath, isLanguageCopyPath, isProviderStreamPath, withoutStreamDuplicates} from './copyRank';

describe('copyRankOfPath', () => {
	test('le fichier principal, puis la copie en langue, puis le flux', () => {
		expect(copyRankOfPath('/media/Films/Dune (2021)/Dune.mkv')).toBe(0);
		expect(copyRankOfPath('/media/Russian Movies/Dune (2021)/Dune.mkv')).toBe(1);
		expect(copyRankOfPath('/media/Films/Dune (2021)/Dune.strm')).toBe(2);
		expect(copyRankOfPath('/media/Fournisseur/Dune/Dune.mp4')).toBe(2);
	});
	test('sans chemin, rien à reprocher', () => {
		expect(copyRankOfPath(null)).toBe(0);
		expect(isLanguageCopyPath('')).toBe(false);
		expect(isProviderStreamPath(undefined)).toBe(false);
	});
	test('le nom du fichier lui-même ne compte pas', () => {
		expect(isLanguageCopyPath('/media/Films/Russian Doll.mkv')).toBe(false);
	});
});

describe('le fichier du serveur avant le flux du fournisseur', () => {
	const film = (Id, Path, extra = {}) => ({Id, Type: 'Movie', Name: 'Dune', ProductionYear: 2021, Path, ...extra});
	test('le flux s\'en va quand la liste a la copie du serveur, l\'ordre reste', () => {
		const items = [film('s', '/media/iptv/Dune.strm', {ProviderIds: {Tmdb: '438631'}}), film('a', '/media/Films/Dune.mkv', {ProviderIds: {Tmdb: '438631'}}), film('x', '/x.strm', {Name: 'Alien'})];
		expect(withoutStreamDuplicates(items).map((i) => i.Id)).toEqual(['a', 'x']);
	});
	test('sans copie du serveur, ou sans flux, rien ne change', () => {
		const alone = [film('s', '/media/iptv/Dune.strm')];
		expect(withoutStreamDuplicates(alone)).toBe(alone);
		const files = [film('a', '/media/Films/Dune.mkv'), {Id: 'e', Type: 'Episode', Path: '/x.strm'}];
		expect(withoutStreamDuplicates(files)).toEqual(files);
		expect(withoutStreamDuplicates([film('s', '/a.strm'), film('b', '/media/Dune.mkv', {ProductionYear: 1984})]).map((i) => i.Id)).toEqual(['s', 'b']);
	});
});
