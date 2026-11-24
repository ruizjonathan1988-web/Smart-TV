import {render, screen} from '@testing-library/react';

// Le CLI apporte une seconde copie de React : le JSX des composants passe par celle des tests.
jest.mock('react/jsx-dev-runtime', () => {
	const React = require('react');
	return {
		Fragment: React.Fragment,
		jsxDEV: (type, {children, ...props}, key, isStaticChildren) => {
			const config = key === undefined ? props : {...props, key};
			if (children === undefined) return React.createElement(type, config);
			return isStaticChildren ? React.createElement(type, config, ...children) : React.createElement(type, config, children);
		}
	};
});
jest.mock('@enact/spotlight/Spottable', () => (type) => {
	const React = require('react');
	return ({spotlightId, spotlightDisabled, children, ...props}) => React.createElement(type, {...props, 'data-spotlight-id': props['data-spotlight-id'] || spotlightId}, children); // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight/SpotlightContainerDecorator', () => (config, type) => {
	const React = require('react');
	return ({spotlightId, spotlightDisabled, children, ...props}) => React.createElement(type, props, children); // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({focus: jest.fn(), getCurrent: jest.fn()}));
const mockSettings = {current: {}};
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: mockSettings.current})}));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => ({isEnabled: true})}));
jest.mock('../../hooks/useUserAvatar', () => () => ({avatarUrl: null, onError: () => {}}));

import VjodNavbarPreview, {vjodBarShown, vjodPreviewTabs} from './VjodNavbarPreview';

describe('aperçu en direct : la barre VJOD', () => {
	test('montrée dans le look VJOD en haut, pas ailleurs', () => {
		expect(vjodBarShown({visualTheme: 'vjod'})).toBe(true);
		expect(vjodBarShown({visualTheme: 'ecrin', navbarPosition: 'top'})).toBe(true);
		expect(vjodBarShown({visualTheme: 'vjod', navbarPosition: 'left'})).toBe(false);
		expect(vjodBarShown({visualTheme: 'vjod', customThemeId: 'x'})).toBe(false);
		expect(vjodBarShown({visualTheme: 'moonfin'})).toBe(false);
		expect(vjodBarShown({visualTheme: 'vjod', kidsModeEnabled: true})).toBe(false);
	});

	test('les onglets de la vraie barre', () => {
		expect(vjodPreviewTabs({seerr: true})).toEqual(['Accueil', 'Films', 'Séries', 'TV', 'Replay', 'Explorer', 'Bientôt', 'En route']);
		expect(vjodPreviewTabs({seerr: true, simple: true})).toEqual(['Accueil', 'Films', 'Séries', 'TV']);
		expect(vjodPreviewTabs({kids: true})).toEqual(['Accueil', 'TV des enfants']);
	});

	test('le logo, les onglets texte (Accueil souligné) et l\'avatar rouge', () => {
		mockSettings.current = {visualTheme: 'vjod', auraMode: 'off'};
		render(<VjodNavbarPreview userName="jon" />);
		expect(screen.getByAltText('VJOD')).toBeTruthy();
		expect(screen.getByText('Accueil')).toBeTruthy();
		expect(screen.getByText('Replay')).toBeTruthy();
		expect(screen.getByText('Film, acteur, chaîne…')).toBeTruthy();
		const underline = document.querySelector('[data-preview="vjod-tab-on"]');
		expect(underline.parentElement.textContent).toBe('Accueil');
		const avatar = document.querySelector('[data-preview="vjod-avatar"]');
		expect(avatar.textContent).toBe('J');
		expect(avatar.style.background).toMatch(/rgb\(201, 64, 63\)|#C9403F/i);
	});
});
