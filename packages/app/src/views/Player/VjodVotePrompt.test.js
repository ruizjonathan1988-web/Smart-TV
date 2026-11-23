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
jest.mock('../../services/vjodVotes', () => ({
	loadVotes: jest.fn(() => Promise.resolve({})),
	saveVote: jest.fn(() => Promise.resolve()),
	voteFor: jest.fn(() => null),
	voteKey: jest.fn(() => 'k'),
	creditsStarted: jest.fn(() => false)
}));

import VjodVotePrompt from './VjodVotePrompt';

describe('VjodVotePrompt', () => {
	test('caché tant qu\'il n\'est pas visible', () => {
		const {container} = render(<VjodVotePrompt visible={false} onVote={jest.fn()} />);
		expect(container.innerHTML).toBe('');
	});

	test('haut pour J’ai aimé, bas pour Bof', () => {
		const onVote = jest.fn();
		render(<VjodVotePrompt visible onVote={onVote} />);
		expect(screen.getByText('Alors, ce film ?')).toBeTruthy();
		fireEvent.keyDown(window, {keyCode: 38});
		fireEvent.keyDown(window, {keyCode: 40});
		fireEvent.keyDown(window, {keyCode: 13});
		expect(onVote.mock.calls).toEqual([[true], [false]]);
	});
});
