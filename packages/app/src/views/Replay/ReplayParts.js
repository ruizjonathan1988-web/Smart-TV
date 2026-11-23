// Briques de l'écran Replay, reprises de ma_tv_replay_screen.dart : tuile
// d'épisode, rangée horizontale, la « une », le direct, les catégories, nos
// chaînes et la fiche d'un épisode. Un appui lit ; OK maintenu, Info ou Menu
// ouvre la fiche.
import {useState, useEffect, useCallback, useRef} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import SpotlightContainerDecorator from '@enact/spotlight/SpotlightContainerDecorator';
import {Scroller} from '@enact/sandstone/Scroller';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import {replayPercent} from '../../services/maTvProgress';
import {subtitleOf, dayLabel, firstSentence, genreColor} from '../../services/maTvReplay';
import {programsAt, progressOf} from '../MaTv/maTvZap';

import css from './Replay.module.less';

export const R = {
	bg: '#0B0B0D',
	ink: '#EDEBE6',
	mute: '#B8B4AC',
	good: '#5BC07A',
	live: '#E5484D',
	card: '#1B1C21',
	cardOn: '#24252B',
	chip: 'rgba(20, 18, 16, 0.8)',
	sheet: '#1C1418'
};

const SpottableDiv = Spottable('div');
const RowContainer = SpotlightContainerDecorator({enterTo: 'last-focused'}, 'div');
export const SheetContainer = SpotlightContainerDecorator({enterTo: 'default-element', restrict: 'self-only'}, 'div');

const LONG_PRESS_MS = 550;
const INFO_KEYS = [457, 10135, 93];

// OK maintenu (la télécommande répète la touche) ou Info / Menu : la fiche.
const useInfoPress = (onPress, onInfo) => {
	const down = useRef(0);
	const fired = useRef(false);
	const skipClick = useRef(false);
	const onKeyDown = useCallback((e) => {
		const code = e.keyCode || e.which;
		if (INFO_KEYS.indexOf(code) >= 0 || (KEYS.MENU !== undefined && code === KEYS.MENU)) {
			e.preventDefault();
			e.stopPropagation();
			onInfo();
			return;
		}
		if (code !== KEYS.ENTER) return;
		if (!down.current) {
			down.current = Date.now();
			fired.current = false;
		} else if (!fired.current && Date.now() - down.current > LONG_PRESS_MS) {
			fired.current = true;
			onInfo();
		}
	}, [onInfo]);
	const onKeyUp = useCallback((e) => {
		if ((e.keyCode || e.which) !== KEYS.ENTER) return;
		down.current = 0;
		if (fired.current) {
			fired.current = false;
			skipClick.current = true;
		}
	}, []);
	const onClick = useCallback(() => {
		if (skipClick.current) {
			skipClick.current = false;
			return;
		}
		onPress();
	}, [onPress]);
	return {onKeyDown, onKeyUp, onClick};
};

export const Chip = ({text, bg = R.chip, fg = R.ink, className}) => (
	<span className={className ? `${css.chip} ${className}` : css.chip} style={{background: bg, color: fg}}>{text}</span>
);

const Picture = ({url, className, children}) => {
	const [failed, setFailed] = useState(false);
	const handleError = useCallback(() => setFailed(true), []);
	useEffect(() => setFailed(false), [url]);
	return (
		<div className={className} style={{background: '#24252B'}}>
			{url && !failed ? <img src={url} alt="" onError={handleError} /> : null}
			{children}
		</div>
	);
};

// Tuile d'un épisode (MediaCard de l'APK) : image, chaîne en haut à gauche,
// « NOUVEAU » ou badge en haut à droite, barre d'avancement, titre et sous-titre.
export const ReplayTile = ({item, chanName, portrait = false, width = 16.25, rank, words, showDay = false, onPlay, onInfo, spotlightId}) => {
	const handlePlay = useCallback(() => onPlay(item), [onPlay, item]);
	const handleInfo = useCallback(() => onInfo(item), [onInfo, item]);
	const press = useInfoPress(handlePlay, handleInfo);
	const usePoster = portrait && item.poster;
	const img = usePoster ? item.poster : item.img;
	const height = usePoster ? width * 4 / 3 : width * 9 / 16;
	const pct = replayPercent(item.id);
	let sub = words || subtitleOf(item) || dayLabel(item);
	if (showDay) {
		const day = dayLabel(item);
		const s = subtitleOf(item);
		sub = s && s !== day ? `${day} · ${s}` : day;
	}
	const tile = (
		<SpottableDiv
			spotlightId={spotlightId}
			className={css.tile}
			style={{width: width + 'rem'}}
			onKeyDown={press.onKeyDown}
			onKeyUp={press.onKeyUp}
			onClick={press.onClick}
		>
			<Picture url={img} className={css.tileImage}>
				<div style={{height: height + 'rem'}} />
				{chanName ? <Chip text={chanName} className={css.chipTopLeft} /> : null}
				{item.badge ? <Chip text={item.badge} bg="#FFFFFF" fg="#141210" className={css.chipTopRight} /> : null}
				{!item.badge && item.isNew ? <Chip text="NOUVEAU" bg={R.live} fg="#FFFFFF" className={css.chipTopRight} /> : null}
				{pct !== null ? (
					<div className={css.tileProgress}>
						<div style={{width: pct + '%', background: R.live, height: '100%'}} />
					</div>
				) : null}
			</Picture>
			<div className={css.tileTitle} style={{color: R.ink}}>{item.show}</div>
			{sub ? <div className={css.tileSub} style={{color: R.mute}}>{sub}</div> : null}
		</SpottableDiv>
	);
	if (!rank) return tile;
	return (
		<div className={css.ranked}>
			<div className={css.rank} style={{color: R.mute}}>{rank}</div>
			{tile}
		</div>
	);
};

// Rangée horizontale qui suit le focus.
export const Strip = ({children, spotlightId}) => (
	<RowContainer spotlightId={spotlightId} className={css.strip}>
		<Scroller direction="horizontal" horizontalScrollbar="hidden" verticalScrollbar="hidden">
			<div className={css.stripInner}>{children}</div>
		</Scroller>
	</RowContainer>
);

export const Section = ({title, dot = false, count, followed = false, children}) => (
	<div className={css.section}>
		<div className={css.sectionTitle}>
			{dot ? <span className={css.liveDot} style={{background: R.live}} /> : null}
			<span style={{color: R.ink}}>{title}</span>
			{count ? <span className={css.sectionCount} style={{color: R.mute}}>{count}</span> : null}
			{followed ? <span className={css.sectionCount} style={{color: R.good}}>✓ {$L('Suivi')}</span> : null}
		</div>
		{children}
	</div>
);

export const Button = ({children, primary = false, onClick, spotlightId, className}) => (
	<SpottableDiv
		spotlightId={spotlightId}
		className={`${css.button} ${primary ? css.buttonPrimary : ''} ${className || ''}`}
		onClick={onClick}
	>
		{children}
	</SpottableDiv>
);

// La « une » : grande image, chaîne et catégorie, titre, première phrase.
export const Hero = ({item, chanName, onPlay, onInfo}) => {
	const handlePlay = useCallback(() => onPlay(item), [onPlay, item]);
	const handleInfo = useCallback(() => onInfo(item), [onInfo, item]);
	const words = firstSentence(item.desc);
	return (
		<Picture url={item.img} className={css.hero}>
			<div className={css.heroShade} />
			<div className={css.heroText}>
				<div className={css.heroChips}>
					<Chip text={chanName} />
					{item.genre ? (
						<span className={css.chip} style={{background: R.chip, color: R.ink, borderColor: genreColor(item.genre)}}>
							{item.genre}
						</span>
					) : null}
				</div>
				<div className={css.heroTitle} style={{color: R.ink}}>{item.show}</div>
				{words ? <div className={css.heroWords} style={{color: R.ink}}>{words}</div> : null}
				<RowContainer className={css.heroButtons}>
					<Button primary onClick={handlePlay} spotlightId="replay-hero-play">{$L('Regarder')}</Button>
					<Button onClick={handleInfo}>{$L('Infos')}</Button>
				</RowContainer>
			</div>
		</Picture>
	);
};

// Une chaîne du replay en direct dans Ma TV.
const LiveTile = ({channel, index, nowSec, onOpen}) => {
	const handleClick = useCallback(() => onOpen(index), [onOpen, index]);
	const {current} = programsAt(channel, nowSec);
	return (
		<SpottableDiv className={css.liveTile} style={{background: R.card}} onClick={handleClick}>
			<div className={css.liveTop}>
				<Picture url={channel.logo} className={css.liveLogo} />
				<Chip text={`● ${$L('Direct')}`} bg={R.live} fg="#FFFFFF" />
			</div>
			<div className={css.liveTitle} style={{color: R.ink}}>{current ? current.t : channel.name}</div>
			<div className={css.liveTrack}>
				<div style={{width: Math.round(progressOf(current, nowSec) * 100) + '%', background: R.live, height: '100%'}} />
			</div>
		</SpottableDiv>
	);
};

export const LiveRow = ({channels, onOpen}) => {
	const nowSec = Math.floor(Date.now() / 1000);
	return (
		<Strip spotlightId="replay-live">
			{channels.map((c, i) => (
				<LiveTile key={c.id} channel={c} index={i} nowSec={nowSec} onOpen={onOpen} />
			))}
		</Strip>
	);
};

const GenrePill = ({genre, onOpen}) => {
	const handleClick = useCallback(() => onOpen(genre), [onOpen, genre]);
	const color = genreColor(genre);
	return (
		<SpottableDiv
			className={css.pill}
			style={{borderColor: color, background: color + '40', color: R.ink}}
			onClick={handleClick}
		>
			{genre}
		</SpottableDiv>
	);
};

export const GenrePills = ({genres, onOpen}) => (
	<RowContainer className={css.wrap}>
		{genres.map((g) => <GenrePill key={g} genre={g} onOpen={onOpen} />)}
	</RowContainer>
);

const ChannelCard = ({channel, logo, onOpen}) => {
	const [failed, setFailed] = useState(false);
	const handleError = useCallback(() => setFailed(true), []);
	const handleClick = useCallback(() => onOpen(channel), [onOpen, channel]);
	return (
		<SpottableDiv className={css.chanCard} style={{background: R.cardOn}} onClick={handleClick}>
			{logo && !failed ? (
				<img src={logo} alt={channel.name} onError={handleError} />
			) : (
				<span style={{color: R.ink}}>{channel.name}</span>
			)}
		</SpottableDiv>
	);
};

export const ChannelGrid = ({channels, logos, onOpen}) => (
	<RowContainer className={css.wrap}>
		{channels.map((c) => <ChannelCard key={c.chan} channel={c} logo={logos[c.chan]} onOpen={onOpen} />)}
	</RowContainer>
);

// Fiche d'un épisode : Regarder, Suivre, Garder les prochains épisodes,
// Épisode suivant, Pas pour nous.
export const Sheet = ({item, chanName, next, followed, kept, onPlay, onNext, onFollow, onKeep, onHide}) => {
	const handlePlay = useCallback(() => onPlay(item), [onPlay, item]);
	const handleNext = useCallback(() => onNext(next), [onNext, next]);
	const day = dayLabel(item);
	const sub = subtitleOf(item);
	const meta = [chanName, day, sub !== day ? sub : ''].filter(Boolean).join(' · ');
	return (
		<div className={css.sheetBackdrop}>
			<SheetContainer className={css.sheet} style={{background: R.sheet}} spotlightId="replay-sheet">
				<div className={css.sheetMeta} style={{color: R.mute}}>{meta.toUpperCase()}</div>
				<div className={css.sheetShow} style={{color: R.ink}}>{item.show}</div>
				{item.title && item.title !== item.show ? (
					<div className={css.sheetTitle} style={{color: R.ink}}>{item.title}</div>
				) : null}
				{item.desc ? <div className={css.sheetDesc} style={{color: R.ink}}>{item.desc}</div> : null}
				<div className={css.sheetButtons}>
					<Button primary onClick={handlePlay} spotlightId="replay-sheet-play">▶ {$L('Regarder')}</Button>
					<Button onClick={onFollow}>{followed ? `✓ ${$L('Suivi')}` : `+ ${$L('Suivre')}`}</Button>
					<Button onClick={onKeep}>{kept ? `✓ ${$L('Gardée automatiquement')}` : $L('Garder les prochains épisodes')}</Button>
					{next ? <Button onClick={handleNext}>{$L('Épisode suivant')}</Button> : null}
					<Button onClick={onHide}>{$L('Pas pour nous')}</Button>
				</div>
			</SheetContainer>
		</div>
	);
};
