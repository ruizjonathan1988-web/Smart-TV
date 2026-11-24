import {fireEvent, render, screen, waitFor} from '@testing-library/react';

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
	auraHousemates: jest.fn(),
	auraPropose: jest.fn(() => Promise.resolve())
}));

import AuraPropose from './AuraPropose';
import {auraHousemates, auraPropose} from '../../services/aura';

const film = {title: 'Heat', tmdbId: 949};

describe('AuraPropose', () => {
	beforeEach(() => jest.clearAllMocks());

	test('liste la maison puis envoie la proposition', async () => {
		auraHousemates.mockResolvedValue([{person: 'p1', name: 'Pauline'}]);
		const onClose = jest.fn();
		render(<AuraPropose film={film} onClose={onClose} />);
		expect(screen.getByText('Proposer « Heat » à…')).toBeTruthy();
		fireEvent.click(await screen.findByText('Pauline'));
		expect(screen.getByText('Un mot pour Pauline ?')).toBeTruthy();
		fireEvent.click(document.querySelector('[data-index="0"]'));
		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(auraPropose).toHaveBeenCalledWith(expect.objectContaining({title: 'Heat', to: {person: 'p1', name: 'Pauline'}}));
		expect(onClose).toHaveBeenCalledWith('Proposé à Pauline. Ton aura grandit s’il le regarde.');
	});

	test('personne d\'autre dans la maison', async () => {
		auraHousemates.mockResolvedValue([]);
		render(<AuraPropose film={film} onClose={jest.fn()} />);
		expect(await screen.findByText(/Personne d’autre ne joue encore à Aura/)).toBeTruthy();
	});

	test('une erreur s\'affiche', async () => {
		auraHousemates.mockRejectedValue(new Error('hors ligne'));
		render(<AuraPropose film={film} onClose={jest.fn()} />);
		expect(await screen.findByText('Impossible pour l’instant : hors ligne')).toBeTruthy();
	});
});
