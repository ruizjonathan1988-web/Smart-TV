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
jest.mock('../../components/LoadingSpinner', () => () => null);
jest.mock('../../services/maTvProgress', () => ({saveReplayPlace: jest.fn()}));
jest.mock('../../services/iptvLearning', () => ({recordIptvSitting: jest.fn()}));
jest.mock('../../services/iptvNext', () => ({
	introLengthFor: () => Promise.resolve(85000),
	correctedIntro: () => null,
	rememberIntro: jest.fn()
}));
jest.mock('../../services/vjodVotes', () => ({
	...jest.requireActual('../../services/vjodVotes'),
	loadVotes: () => Promise.resolve({}),
	voteFor: () => null,
	saveVote: jest.fn(() => Promise.resolve())
}));
// Un moteur de lecture factice : sa position et sa durée sont réglées par chaque test.
const mockEngine = {pos: 0, dur: 0, onState: null, seeks: [], seek: (ms) => mockEngine.seeks.push(ms), open: () => {}, pause: () => {}, resume: () => {}, destroy: () => {}};
jest.mock('./maTvPlayerShared', () => ({
	loadEngine: () => Promise.resolve({
		createEngine: ({onState}) => {
			mockEngine.onState = onState;
			return {
				open: mockEngine.open, seek: mockEngine.seek, pause: mockEngine.pause, resume: mockEngine.resume, destroy: mockEngine.destroy,
				position: () => mockEngine.pos, duration: () => mockEngine.dur, needsTransparency: false
			};
		}
	}),
	playerBackground: () => '#000',
	setAncestorsTransparent: jest.fn()
}));

import MaTvVodPlayer from './MaTvVodPlayer';
import {saveVote} from '../../services/vjodVotes';

const MIN = 60000;

// Le moteur se charge, se met à lire, puis une seconde passe : la position est lue.
const start = async (props, {pos, dur}) => {
	mockEngine.pos = pos;
	mockEngine.dur = dur;
	render(<MaTvVodPlayer id="vod:1" url="https://seed/tv/xc/1.mkv" title="Titre" {...props} />);
	await act(async () => {
		await Promise.resolve();
		await Promise.resolve();
	});
	act(() => {
		mockEngine.onState('playing');
		jest.advanceTimersByTime(1000);
	});
	await act(async () => {
		await Promise.resolve();
	});
};

describe('MaTvVodPlayer', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		mockEngine.seeks = [];
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	test('▲ passe le générique d\'un épisode', async () => {
		await start({watch: {kind: 'series', id: 's1', name: 'Dark'}}, {pos: 10000, dur: 50 * MIN});
		expect(screen.getByText('▲ Passer le générique')).toBeTruthy();
		fireEvent.keyDown(window, {keyCode: 38});
		act(() => {
			jest.advanceTimersByTime(800);
		});
		expect(mockEngine.seeks).toEqual([95000]);
		expect(screen.queryByText('▲ Passer le générique')).toBeNull();
	});

	test('la carte « Épisode suivant » à la fin, et OK l\'enchaîne', async () => {
		const onNextEpisode = jest.fn();
		await start({
			watch: {kind: 'series', id: 's1', name: 'Dark'},
			nextEpisode: {season: 1, number: 2, title: 'Mensonges'},
			onNextEpisode,
			nextUp: {show: true, seconds: 10}
		}, {pos: 50 * MIN - 30000, dur: 50 * MIN});
		expect(screen.getByText('Épisode suivant : S1 É2')).toBeTruthy();
		expect(screen.getByText('Mensonges')).toBeTruthy();
		fireEvent.keyDown(window, {keyCode: 13});
		expect(onNextEpisode).toHaveBeenCalledTimes(1);
	});

	test('▲ cache la carte, qui ne revient pas', async () => {
		const onNextEpisode = jest.fn();
		await start({watch: {kind: 'series', id: 's1', name: 'Dark'}, nextEpisode: {season: 1, number: 2, title: ''}, onNextEpisode}, {pos: 50 * MIN - 30000, dur: 50 * MIN});
		fireEvent.keyDown(window, {keyCode: 38});
		act(() => {
			jest.advanceTimersByTime(3000);
		});
		expect(screen.queryByText('Épisode suivant : S1 É2')).toBeNull();
		expect(onNextEpisode).not.toHaveBeenCalled();
	});

	test('un film du fournisseur demande « Alors, ce film ? » au générique de fin', async () => {
		saveVote.mockResolvedValue();
		await start({watch: {kind: 'movie', id: 'm1', name: 'Heat', tmdb: '949'}}, {pos: 115 * MIN, dur: 120 * MIN});
		expect(screen.getByText('Alors, ce film ?')).toBeTruthy();
		fireEvent.keyDown(window, {keyCode: 38});
		expect(saveVote).toHaveBeenCalledWith(expect.objectContaining({Id: 'iptv:movie:m1', Type: 'Movie'}), true);
		expect(screen.queryByText('Alors, ce film ?')).toBeNull();
	});
});
