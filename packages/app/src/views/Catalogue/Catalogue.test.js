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
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));
jest.mock('@enact/sandstone/Scroller', () => {
	const React = require('react');
	return {Scroller: ({children}) => React.createElement('div', null, children)};
});
jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../context/AuthContext', () => ({useAuth: () => ({user: {Id: 'u'}, serverUrl: 'https://jf', accessToken: 't', api: {}})}));
jest.mock('../../context/SeerrContext', () => ({useSeerr: () => ({isEnabled: true, isAuthenticated: true})}));
const mockSettings = {current: {}};
jest.mock('../../context/SettingsContext', () => ({useSettings: () => ({settings: mockSettings.current})}));
jest.mock('../../services/maTvSession', () => ({getMaTvClient: () => Promise.resolve(null)}));
jest.mock('../../services/maTvProgress', () => ({
	...jest.requireActual('../../services/maTvProgress'),
	loadReplayProgress: () => Promise.resolve(),
	resumePosition: () => 0
}));
jest.mock('../../services/seerrApi', () => {
	// Un titre déjà sur le serveur (statut 5) et un à demander, sur chaque page.
	const page = (p) => ({results: [
		{id: p * 10 + 1, title: `Sur le serveur ${p}`, mediaInfo: {status: 5}},
		{id: p * 10 + 2, title: `À demander ${p}`}
	]});
	return {discover: (p) => Promise.resolve(page(p)), discoverTv: (p) => Promise.resolve(page(p)), search: () => Promise.resolve({results: []}), getImageUrl: () => null};
});

import Catalogue from './Catalogue';

const show = async (simple) => {
	mockSettings.current = {vjodSimpleMode: simple, nextUpBehavior: 'enabled', nextUpTimeout: 10};
	render(<Catalogue kind="movie" onSelectSeerrItem={jest.fn()} />);
	await screen.findAllByText('Sur le serveur 1');
};

describe('Catalogue', () => {
	test('mode simple : affiches « Regarder / Demander », pas de filtres', async () => {
		await show(true);
		expect(screen.getAllByText('Regarder').length).toBeGreaterThan(0);
		expect(screen.getAllByText('Demander').length).toBeGreaterThan(0);
		expect(screen.queryByText('Tout')).toBeNull();
		expect(screen.queryByText('À regarder (IPTV)')).toBeNull();
		expect(screen.queryByText('À demander')).toBeNull();
	});

	test('mode normal : les filtres et les pastilles habituelles', async () => {
		await show(false);
		expect(screen.getByText('Tout')).toBeTruthy();
		expect(screen.getByText('À regarder (IPTV)')).toBeTruthy();
		expect(screen.getAllByText('À demander').length).toBeGreaterThan(1);
		expect(screen.queryByText('Regarder')).toBeNull();
	});
});
