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
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));
jest.mock('@enact/sandstone/Scroller', () => {
	const React = require('react');
	return {Scroller: ({children}) => React.createElement('div', null, children)};
});
jest.mock('../../components/LoadingSpinner', () => () => 'chargement');

import ReplayMine from './ReplayMine';
import {replayHome} from '../../services/maTvReplayHome';

const name = (chan) => chan.toUpperCase();
const mineProps = (home, extra = {}) => ({home, chanName: name, onPlay: jest.fn(), onInfo: jest.fn(), onFollow: jest.fn(() => Promise.resolve(true)), onReload: jest.fn(), ...extra});

describe('Mes émissions', () => {
	test('les nouveaux épisodes de ce qu\'on suit', () => {
		const p = mineProps(replayHome({mine: [{id: 'a', chan: 'tf1', show: 'Koh-Lanta', new: true}]}));
		render(<ReplayMine {...p} />);
		expect(screen.getByText('Mes émissions')).toBeTruthy();
		expect(screen.getByText('Koh-Lanta')).toBeTruthy();
		expect(screen.getByText('TF1')).toBeTruthy();
		expect(screen.getByText('NOUVEAU')).toBeTruthy();
	});

	test('rien de suivi : « Suis tes émissions en un appui », puis Suivre et Voir mes émissions', async () => {
		const p = mineProps(replayHome({suggest: [{id: 's', chan: 'm6', show: 'Top Chef', live_at: Math.floor(Date.now() / 1000)}]}));
		render(<ReplayMine {...p} />);
		expect(screen.getByText('Suis tes émissions en un appui')).toBeTruthy();
		expect(screen.getByText('vu en direct aujourd’hui')).toBeTruthy();
		fireEvent.click(screen.getByText('Regarder'));
		expect(p.onPlay).toHaveBeenCalledWith(expect.objectContaining({show: 'Top Chef'}));
		fireEvent.click(screen.getByText('+ Suivre'));
		expect(await screen.findByText('✓ Suivi')).toBeTruthy();
		expect(p.onFollow).toHaveBeenCalledWith('Top Chef', true);
		fireEvent.click(screen.getByText('Voir mes émissions'));
		expect(p.onReload).toHaveBeenCalled();
	});

	test('chargement, puis Ma TV absente', () => {
		const {rerender} = render(<ReplayMine {...mineProps(undefined)} />);
		expect(screen.getByText('chargement')).toBeTruthy();
		rerender(<ReplayMine {...mineProps(null)} />);
		expect(screen.getByText('Le replay ne répond pas (Ma TV 3.62 ou plus nécessaire).')).toBeTruthy();
	});
});
