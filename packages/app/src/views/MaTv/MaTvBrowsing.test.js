import {act, fireEvent, render, screen} from '@testing-library/react';

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
jest.mock('../../context/AuthContext', () => {
	// Le même compte d'un rendu à l'autre, comme le vrai contexte.
	const auth = {user: {Id: 'u'}, serverUrl: 'https://jf', accessToken: 't'};
	return {useAuth: () => auth};
});
jest.mock('../../services/maTvSession', () => ({getMaTvClient: () => Promise.resolve({cats: () => Promise.resolve({cats: [{id: 'c1', name: 'Généralistes', n: 1}]})})}));
jest.mock('../../services/vjodSnapshots', () => ({readSnapshot: () => Promise.resolve(null), writeSnapshot: () => {}}));
jest.mock('../../services/maTvMemory', () => ({
	loadMaTvMemory: () => Promise.resolve(),
	buildMaTvCategories: () => [{id: 'c1', label: 'Généralistes', kind: 'cat', n: 1}],
	maTvStartCategory: () => 0,
	maTvLastCategory: () => null,
	fetchMaTvChannels: () => Promise.resolve([{id: 'tf1', name: 'TF1', num: 1}]),
	isMaTvFavorite: () => false,
	toggleMaTvFavorite: () => {},
	isActionCategory: () => false
}));
// Le lecteur et les autres pages : de simples repères.
jest.mock('./MaTvPlayer', () => () => 'lecteur du direct');
jest.mock('./MaTvGuide', () => () => 'grille');
jest.mock('./MaTvVodPlayer', () => () => 'replay');
jest.mock('./MaTvSearch', () => () => 'recherche');
jest.mock('./MaTvSports', () => () => 'sports');
jest.mock('./MaTvRecordingsView', () => () => 'enregistrements');

import MaTv from './MaTv';

describe('Ma TV sous la barre d\'onglets VJOD', () => {
	test('onBrowsing passe à false quand le lecteur s\'ouvre, à true au retour', async () => {
		const onBrowsing = jest.fn();
		const backHandlerRef = {current: null};
		render(<MaTv backHandlerRef={backHandlerRef} underBar onBrowsing={onBrowsing} />);
		fireEvent.click(await screen.findByText('Regarder'));
		expect(screen.getByText('lecteur du direct')).toBeTruthy();
		expect(onBrowsing).toHaveBeenLastCalledWith(false);
		let handled;
		act(() => {
			handled = backHandlerRef.current();
		});
		expect(handled).toBe(true);
		expect(onBrowsing).toHaveBeenLastCalledWith(true);
		expect(await screen.findByText('Regarder')).toBeTruthy();
	});

	test('rend la barre en partant', async () => {
		const onBrowsing = jest.fn();
		const {unmount} = render(<MaTv backHandlerRef={{current: null}} onBrowsing={onBrowsing} />);
		fireEvent.click(await screen.findByText('Regarder'));
		expect(onBrowsing).toHaveBeenLastCalledWith(false);
		unmount();
		expect(onBrowsing).toHaveBeenLastCalledWith(true);
	});
});
