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
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));
jest.mock('@enact/sandstone/Scroller', () => {
	const React = require('react');
	return {Scroller: ({children, className}) => React.createElement('div', {className}, children)};
});
// Le clavier natif, pour que le champ de recherche reste un simple <input>.
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: {keyboardStyle: 'native'}})}));
jest.mock('../../services/replayKeep', () => ({
	...jest.requireActual('../../services/replayKeep'),
	searchTrackers: jest.fn(),
	grabRelease: jest.fn()
}));

import TrackerSheet from './TrackerSheet';
import {grabRelease, searchTrackers} from '../../services/replayKeep';

const item = {show: 'Koh-Lanta', season: 25, episode: 3};
const server = {url: 'https://seed', key: 'k'};

const mount = async (props = {}) => {
	const onDone = jest.fn();
	const onSay = jest.fn();
	render(<TrackerSheet item={item} server={server} onDone={onDone} onSay={onSay} {...props} />);
	await waitFor(() => expect(searchTrackers).toHaveBeenCalled());
	await screen.findByText('Chercher sur mes trackers');
	await waitFor(() => expect(screen.queryByText('Recherche sur les trackers…')).toBeNull());
	return {onDone, onSay};
};

describe('TrackerSheet', () => {
	beforeEach(() => jest.clearAllMocks());

	test('cherche l\'épisode dès l\'ouverture et liste les versions', async () => {
		searchTrackers.mockResolvedValue({mayGrab: true, error: '', results: [{id: '1', title: 'Koh-Lanta S25E03 1080p', size: 0, seeders: 12, indexer: 'A', ageDays: 1}]});
		await mount();
		expect(searchTrackers).toHaveBeenCalledWith(server, 'Koh-Lanta S25E03');
		expect(screen.getByText('Koh-Lanta S25E03 1080p')).toBeTruthy();
		expect(screen.getByText('Rien ne part sans ton appui. Les plus partagés d’abord.')).toBeTruthy();
	});

	test('une version choisie part au téléchargement après confirmation', async () => {
		searchTrackers.mockResolvedValue({mayGrab: true, error: '', results: [{id: '1', title: 'Version A', size: 0, seeders: 2, indexer: '', ageDays: null}]});
		grabRelease.mockResolvedValue('Envoyé au téléchargement par Prowlarr.');
		const {onDone, onSay} = await mount();
		fireEvent.click(screen.getByText('Version A'));
		expect(screen.getByText('Télécharger cette version ?')).toBeTruthy();
		fireEvent.click(screen.getByText('Télécharger'));
		await waitFor(() => expect(onDone).toHaveBeenCalled());
		expect(grabRelease).toHaveBeenCalledWith(server, expect.objectContaining({id: '1'}), 'Koh-Lanta');
		expect(onSay).toHaveBeenCalledWith('Envoyé au téléchargement par Prowlarr.');
		expect(onDone).toHaveBeenCalled();
	});

	test('sans le droit de télécharger, on prévient au lieu d\'envoyer', async () => {
		searchTrackers.mockResolvedValue({mayGrab: false, error: '', results: [{id: '1', title: 'Version A', size: 0, seeders: 2, indexer: '', ageDays: null}]});
		const {onSay} = await mount();
		fireEvent.click(screen.getByText('Version A'));
		expect(onSay).toHaveBeenCalledWith('Seul un administrateur de Jellyfin peut lancer un téléchargement.');
		expect(grabRelease).not.toHaveBeenCalled();
	});

	test('montre l\'erreur de Ma TV', async () => {
		searchTrackers.mockResolvedValue({mayGrab: false, error: 'Il faut Ma TV 3.67 sur la seedbox.', results: []});
		await mount();
		expect(screen.getByText('Il faut Ma TV 3.67 sur la seedbox.')).toBeTruthy();
	});
});
