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
	return ({spotlightId, spotlightDisabled, children, ...props}) => React.createElement(type, {...props, 'data-spotlight-id': spotlightId}, children); // eslint-disable-line no-unused-vars
});
jest.mock('@enact/spotlight', () => ({focus: jest.fn(), getCurrent: jest.fn()}));
jest.mock('@enact/i18n/$L', () => ({__esModule: true, default: (text) => text}));
jest.mock('../../components/LoopMarquee', () => ({text}) => text);
jest.mock('../../components/Aura', () => ({openAuraPropose: jest.fn()}));

import ModernActionButtons from './ModernActionButtons';
import {vjodRow, VJOD_MOVIE_BUTTONS} from '../../services/simpleMode';

const noop = () => {};

// Un film de la bibliothèque, avec tout ce qu'une fiche peut offrir.
const ficheProps = (settings = {}) => ({
	settings: {visualTheme: 'vjod', ...settings},
	item: {Id: 'm', Type: 'Movie', Name: 'Heat', CanDelete: true, UserData: {}},
	seerr: {showsRequest: true, offersRequest: true, requestLabel: 'Demander', showsRequest4k: true, offersRequest4k: true, requestLabel4k: 'Demander en 4K', showsReportIssue: true},
	effectiveServerUrl: 'https://jf',
	hasTrailer: true,
	isFavorite: false,
	showsPersonalRating: true,
	personalRatingStyle: 'thumbs',
	supportsMediaSourceSelection: true,
	handlePlay: noop, handleTrailer: noop, handleToggleWatched: noop, handleToggleFavorite: noop, handleOpenRatingDialog: noop,
	handleOpenSubtitleModal: noop, handleOpenPlaylistModal: noop, handleOpenDeleteDialog: noop, handleNotForMe: noop
});

const rowLabels = () => Array.from(document.querySelectorAll('[data-spotlight-id="details-action-buttons"] > *'))
	.map((n) => n.textContent.trim());

describe('fiche moderne, look VJOD : la rangée courte de la box', () => {
	test('vjodRow : la bande-annonce devant, le reste derrière « Plus d\'actions »', () => {
		const ids = ['seerrRequest', 'seerrRequest4k', 'subtitles', 'trailer', 'watched', 'favorite', 'personalRating', 'playlist', 'deleteFiles', 'notForMe', 'seerrReportIssue'];
		const {inline, menu} = vjodRow(ids.map((id) => ({id})), VJOD_MOVIE_BUTTONS);
		expect(inline.map((b) => b.id)).toEqual(['trailer', 'favorite', 'personalRating', 'notForMe', 'seerrRequest', 'seerrRequest4k']);
		expect(menu.map((b) => b.id)).toEqual(['subtitles', 'watched', 'playlist', 'deleteFiles', 'seerrReportIssue']);
	});

	test('la rangée : Lire, bande-annonce, Ma liste, pouce, « Pas pour moi », demandes, puis « Plus d\'actions »', () => {
		render(<ModernActionButtons {...ficheProps()} />);
		expect(rowLabels()).toEqual(['Play', 'Trailer', 'Ma liste', 'Rate', 'Pas pour moi', 'Demander', 'Demander en 4K', 'More Actions']);
	});

	test('« Pas pour moi » est un bouton transparent avec ses mots', () => {
		render(<ModernActionButtons {...ficheProps()} />);
		const ghost = screen.getByText('Pas pour moi').closest('[class*="actionBtn"]');
		expect(ghost.className).toContain('actionGhost');
		expect(ghost.className).not.toContain('actionSquare');
	});

	test('le reste attend derrière « Plus d\'actions »', () => {
		render(<ModernActionButtons {...ficheProps()} />);
		expect(screen.queryByText('Delete')).toBeNull();
		fireEvent.click(screen.getByText('More Actions'));
		expect(screen.getByText('Delete')).toBeTruthy();
		expect(screen.getByText('Subtitle')).toBeTruthy();
		expect(screen.getByText('Add to Playlist')).toBeTruthy();
	});

	test('hors look VJOD, « Pas pour moi » reste une case à icône', () => {
		render(<ModernActionButtons {...ficheProps({visualTheme: 'moonfin'})} />);
		const square = screen.getByText('Pas pour moi').closest('[class*="actionBtn"]');
		expect(square.className).not.toContain('actionGhost');
	});
});
