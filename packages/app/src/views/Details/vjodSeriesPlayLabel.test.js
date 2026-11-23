import {vjodSeriesPlayLabel} from './vjodPlayLabel';

jest.mock('@enact/i18n/$L', () => (s) => s);

const vjod = {visualTheme: 'vjod'};
const series = (ud, extra = {}) => ({Type: 'Series', RecursiveItemCount: 10, UserData: ud, ...extra});

describe('vjodSeriesPlayLabel', () => {
	test('en cours : reprendre l\'épisode N', () => {
		expect(vjodSeriesPlayLabel(vjod, series({UnplayedItemCount: 6}), [{ParentIndexNumber: 2, IndexNumber: 4}])).toBe('Reprendre l\'épisode 4');
	});
	test('tout vu : revoir', () => {
		expect(vjodSeriesPlayLabel(vjod, series({Played: true}), [])).toBe('Revoir');
	});
	test('jamais commencée, autre allure ou film : libellé par défaut', () => {
		expect(vjodSeriesPlayLabel(vjod, series({UnplayedItemCount: 10}), [{ParentIndexNumber: 1, IndexNumber: 1}])).toBe(null);
		expect(vjodSeriesPlayLabel({visualTheme: 'moonfin'}, series({UnplayedItemCount: 6}), [{IndexNumber: 4}])).toBe(null);
		expect(vjodSeriesPlayLabel(vjod, {Type: 'Movie', UserData: {}}, [])).toBe(null);
	});
});
