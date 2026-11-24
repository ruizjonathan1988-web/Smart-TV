// Briques communes des pages Ma TV (Sports, Recherche, Enregistrements) :
// page avec titre, ligne focalisable, choix en liste (premier focalisé) et
// message bref. Tout se pilote à la télécommande via Spotlight.
import {useEffect, useCallback} from 'react';
import Spotlight from '@enact/spotlight';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';

import {maTvColors as C} from './maTvTheme';

import css from './MaTvPages.module.less';

export const SpottableDiv = Spottable('div');
const PageContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
const DialogContainer = SpotlightContainerDecorator({restrict: 'self-only'}, 'div');

export const Page = ({title, subtitle, hint, spotlightId, children, scroll = true, right}) => (
	<PageContainer spotlightId={spotlightId} className={css.page} style={{background: '#0B0B0D'}}>
		<div className={css.head}>
			<div className={css.titleRow}>
				<span className={css.title} style={{color: C.ink}}>{title}</span>
				{subtitle ? <span className={css.subtitle} style={{color: C.mute}}>{subtitle}</span> : null}
				{right ? <span className={css.right}>{right}</span> : null}
			</div>
			{hint ? <div className={css.hint} style={{color: C.faint}}>{hint}</div> : null}
		</div>
		<div className={css.content}>
			{scroll ? (
				<Scroller direction="vertical" verticalScrollbar="auto">
					<div className={css.contentInner}>{children}</div>
				</Scroller>
			) : children}
		</div>
	</PageContainer>
);

// Ligne focalisable (_FocusRow de l'APK).
export const FocusRow = ({children, onClick, spotlightId, className, data}) => {
	const handleClick = useCallback(() => onClick && onClick(data), [onClick, data]);
	return (
		<SpottableDiv spotlightId={spotlightId} className={`${css.row} ${className || ''}`} onClick={handleClick}>
			{children}
		</SpottableDiv>
	);
};

export const SectionHeader = ({children}) => (
	<div className={css.sectionHeader} style={{color: C.mute}}>{children}</div>
);

export const Empty = ({children}) => (
	<div className={css.empty} style={{color: C.mute}}>{children}</div>
);

export const Toast = ({text}) => (text ? (
	<div className={css.toast} style={{background: C.panel, color: C.ink}}>{text}</div>
) : null);

const Choice = ({choice, onPick, index}) => {
	const handleClick = useCallback(() => onPick(choice.id), [onPick, choice.id]);
	return (
		<SpottableDiv
			spotlightId={index === 0 ? 'matv-choice-first' : undefined}
			className={css.choice}
			style={{color: C.ink, background: choice.strong ? 'rgba(229, 9, 20, 0.85)' : undefined}}
			onClick={handleClick}
		>
			{choice.icon ? <span className={css.choiceIcon} style={{color: choice.iconColor || C.ink}}>{choice.icon}</span> : null}
			{choice.label}
		</SpottableDiv>
	);
};

// Une courte liste de choix, facile à la télécommande : le premier a le focus.
export const ChoiceDialog = ({title, subtitle, choices, onPick}) => {
	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('matv-choice-first'), 0);
		return () => clearTimeout(t);
	}, [title]);
	return (
		<div className={css.dialogBackdrop}>
			<DialogContainer className={css.dialog} style={{background: '#17171A'}} spotlightId="matv-choice-dialog">
				<div className={css.dialogTitle} style={{color: C.ink}}>{title}</div>
				{subtitle ? <div className={css.dialogSub} style={{color: C.mute}}>{subtitle}</div> : null}
				{choices.map((c, i) => <Choice key={c.id} choice={c} index={i} onPick={onPick} />)}
			</DialogContainer>
		</div>
	);
};
