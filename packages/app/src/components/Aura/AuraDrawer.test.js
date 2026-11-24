import {fireEvent, render, screen} from '@testing-library/react';

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
jest.mock('../../services/aura', () => ({
	...jest.requireActual('../../services/aura'),
	auraDrawer: jest.fn(),
	playCard: jest.fn(() => Promise.resolve())
}));

import AuraDrawer from './AuraDrawer';
import {auraDrawer} from '../../services/aura';

describe('AuraDrawer', () => {
	beforeEach(() => jest.clearAllMocks());

	test('s\'affiche sans partie en cours', async () => {
		auraDrawer.mockResolvedValue({state: null, received: [], ranking: [], me: 'moi', error: null});
		render(<AuraDrawer onClose={jest.fn()} onOpen={jest.fn()} />);
		expect(screen.getByText('Aura, le jeu de cinéma')).toBeTruthy();
		expect(await screen.findByText('La course du mois')).toBeTruthy();
		expect(screen.getByText('On te propose')).toBeTruthy();
	});

	test('dit quand le serveur d\'Aura ne répond pas', async () => {
		auraDrawer.mockResolvedValue({state: null, received: [], ranking: [], me: 'moi', error: 'hors ligne'});
		render(<AuraDrawer onClose={jest.fn()} onOpen={jest.fn()} />);
		expect(await screen.findByText('Le serveur d’Aura ne répond pas pour l’instant (hors ligne).')).toBeTruthy();
	});

	test('Retour ferme le tiroir', async () => {
		auraDrawer.mockResolvedValue({state: null, received: [], ranking: [], me: 'moi', error: null});
		const onClose = jest.fn();
		render(<AuraDrawer onClose={onClose} onOpen={jest.fn()} />);
		await screen.findByText('La course du mois');
		fireEvent.keyDown(window, {keyCode: 461, key: 'GoBack'});
		fireEvent.keyDown(window, {keyCode: 27, key: 'Escape'});
		expect(onClose).toHaveBeenCalled();
	});
});
