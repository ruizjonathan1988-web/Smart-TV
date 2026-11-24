import {copyRankOfPath, isLanguageCopyPath, isProviderStreamPath} from './copyRank';

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
