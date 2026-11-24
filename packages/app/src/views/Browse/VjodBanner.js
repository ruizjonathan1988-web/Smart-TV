// La bannière VJOD de l'Accueil (_buildVjodSlideshow et VjodHeroContent de
// l'APK) : les réponses du soir et « Changer », pourquoi ce choix, son titre en
// grandes capitales, où il en est et à quelle heure il finirait, les boutons,
// et sous eux trois idées : ce qu'on reprend, le choix du soir, celui à
// demander. Les choix viennent du moteur « Ce soir » ; sans eux, la sélection
// habituelle de la bannière prend le relais.
//
// Télécommande (comme l'APK) : ▲▼ passent de « Changer » aux boutons puis aux
// idées, ◀ ▶ parcourent les boutons ou les idées, OK agit, OK maintenu = Infos.
import {useState, useEffect, useCallback, useMemo, useRef, memo} from 'react';
import Spottable from '@enact/spotlight/Spottable';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import {formatClockTime} from '../../utils/clock';
import {getFeaturedBackdropUrl, getImageUrl} from '../../utils/helpers';
import * as seerrApi from '../../services/seerrApi';
import {isKidsMode} from '../../utils/kidsMode';
import {loadTonightPicks, suggestAnswers, saveAnswers, onTonightChange, launched, loadTonight} from '../../services/tonight/tonightService';
import {onTasteChange, loadTaste} from '../../services/tonight/tasteProfile';
import {tastePromptDue} from '../../services/tonight/tasteCheckIn';
import {getFromStorage, saveToStorage} from '../../services/storage';
import TonightSheet, {companyLabel, timeLabel, moodLabel} from './TonightSheet';

import css from './VjodBanner.module.less';

const SpottableDiv = Spottable('div');
const ZONE_CHANGE = 0;
const ZONE_ACTIONS = 1;
const ZONE_CARDS = 2;
const LONG_PRESS_MS = 600;
const BLOCKED_RATING = /^(XXX|X|NC-17)$/i;

const ticksToMinutes = (ticks) => (ticks ? Math.round(ticks / 600000000) : null);
const lengthLabel = (min) => {
	const h = Math.floor(min / 60);
	const m = min % 60;
	if (!h) return `${m} min`;
	return `${h} h ${m < 10 ? '0' + m : m}`;
};

// Pourquoi ce choix : à qui il convient, d'après la première réponse.
const pickReason = (answers) => ({
	couple: $L('Le bon film pour vous deux'),
	family: $L('Le bon film pour toute la famille'),
	friends: $L('Le bon film entre amis')
}[answers.company] || $L('Le bon film pour vous'));

// « Seul · Rire » : les réponses montrées en pastilles.
const answerChips = (a) => [companyLabel(a.company), a.time === 'short' ? timeLabel(a.time) : null, a.mood !== 'surprise' ? moodLabel(a.mood) : null].filter(Boolean);

const slideTitle = (s) => (s.item.Type === 'Episode' ? s.item.SeriesName || s.item.Name : s.item.Name || s.item.title || s.item.name || '');

const slideImage = (s, getItemServerUrl) => {
	if (s.role === 'request') return s.candidate && s.candidate.backdropUrl;
	const item = s.item;
	const serverUrl = getItemServerUrl(item);
	if (item.Type === 'Episode' && item.ParentBackdropItemId) {
		return getImageUrl(serverUrl, item.ParentBackdropItemId, 'Backdrop', {maxWidth: 1920, quality: 85});
	}
	return getFeaturedBackdropUrl(serverUrl, item, {maxWidth: 1920, quality: 85});
};

// Ce qui reste d'un titre commencé, en minutes, et l'avancement 0..1.
const resumeState = (item) => {
	const run = item.RunTimeTicks;
	const pos = item.UserData && item.UserData.PlaybackPositionTicks;
	if (!run || !pos) return {left: null, progress: null};
	return {left: Math.round((run - pos) / 600000000), progress: Math.max(0, Math.min(1, pos / run))};
};

const endsAt = (s) => {
	if (s.item.Type === 'Series' || s.role === 'request') return null;
	const minutes = s.role === 'resume' ? resumeState(s.item).left : ticksToMinutes(s.item.RunTimeTicks);
	if (!minutes) return null;
	return `${$L('Fin à')} ${formatClockTime(new Date(Date.now() + minutes * 60000))}`;
};

// Les trois idées sous la bannière : ce qu'on reprend, le choix, celle à
// demander, complétées par d'autres choix.
const stripOf = (slides) => {
	const find = (role) => {
		const i = slides.findIndex((s) => s.role === role);
		return i < 0 ? null : i;
	};
	const pick = find('pick');
	const strip = [find('resume'), pick === null && slides.length ? 0 : pick, find('request')].filter((i) => i !== null);
	for (let i = 0; i < slides.length && strip.length < 3; i++) if (strip.indexOf(i) < 0) strip.push(i);
	return strip;
};

// Construit les diapositives du soir : les choix de la bibliothèque, un titre
// à demander en troisième place, ce qui est à reprendre en dernier.
const buildSlides = async ({api, serverUrl, seerrEnabled, answers, maxItems}) => {
	const [lib, request, resume] = await Promise.all([
		loadTonightPicks(answers, {api, serverUrl, libraryOnly: true}),
		seerrEnabled
			? loadTonightPicks(answers, {api, serverUrl, seerr: seerrApi, requestableOnly: true}).catch(() => null)
			: Promise.resolve(null),
		api.getResumeItems(1).catch(() => null)
	]);
	const ids = [];
	const pickById = {};
	lib.result.picks.forEach((p) => {
		const id = p.candidate.libraryItemId;
		if (id && ids.indexOf(id) < 0 && ids.length < maxItems) {
			ids.push(id);
			pickById[id] = p;
		}
	});
	if (!ids.length) return [];
	const res = await api.getItems({Ids: ids.join(','), Fields: 'Overview,Genres,ProviderIds,OfficialRating,CommunityRating,ProductionYear,RunTimeTicks,ChildCount,UserData,Taglines'});
	const byId = {};
	((res && res.Items) || []).forEach((x) => {
		byId[x.Id] = x;
	});
	const slides = ids.filter((id) => byId[id] && !BLOCKED_RATING.test(byId[id].OfficialRating || ''))
		.map((id) => ({role: 'pick', item: byId[id], pick: pickById[id]}));
	if (!slides.length) return [];
	const toRequest = request && request.result.picks.find((p) => p.candidate.tmdbId && p.candidate.seerr);
	if (toRequest) {
		const c = toRequest.candidate;
		slides.splice(Math.min(2, slides.length), 0, {
			role: 'request',
			candidate: c,
			pick: toRequest,
			item: {...c.seerr, _seerr: true, Name: c.title, mediaType: c.mediaType, Type: c.mediaType === 'tv' ? 'Series' : 'Movie'}
		});
	}
	const r = resume && resume.Items && resume.Items[0];
	if (r && !BLOCKED_RATING.test(r.OfficialRating || '')) slides.push({role: 'resume', item: r});
	return slides;
};

const PickCard = ({slide, label, caption, captionGood, ringed, image}) => {
	const [failed, setFailed] = useState(false);
	const handleError = useCallback(() => setFailed(true), []);
	useEffect(() => setFailed(false), [image]);
	const progress = slide.role === 'resume' ? resumeState(slide.item).progress : null;
	return (
		<div className={css.card}>
			<div className={`${css.cardLabel} ${ringed ? css.cardLabelOn : ''}`}>{label}</div>
			<div className={`${css.cardPicture} ${ringed ? css.cardRinged : ''}`}>
				{image && !failed ? <img src={image} alt="" onError={handleError} /> : null}
				<div className={css.cardShade} />
				<div className={css.cardTitle}>{slideTitle(slide)}</div>
				{progress !== null ? (
					<div className={css.cardProgress}><div style={{width: Math.round(progress * 100) + '%'}} /></div>
				) : null}
			</div>
			{caption ? <div className={`${css.cardCaption} ${captionGood ? css.cardCaptionGood : ''}`}>{caption}</div> : null}
		</div>
	);
};

const VjodBanner = memo(({
	isVisible, featuredItems, api, serverUrl, settings, seerrEnabled, getItemServerUrl,
	onSelectItem, onPlayItem, onNavigateDown, onFeaturedFocus, backRef, onEditTaste
}) => {
	const kids = isKidsMode(settings);
	const [answers, setAnswers] = useState(null);
	const [slides, setSlides] = useState([]);
	const [index, setIndex] = useState(0);
	const [focused, setFocused] = useState(false);
	const [zone, setZone] = useState(ZONE_ACTIONS);
	const [action, setAction] = useState(0);
	const [card, setCard] = useState(1);
	const [sheet, setSheet] = useState(false);
	const [version, setVersion] = useState(0);
	const enterDown = useRef(0);

	// Les choix du soir, rechargés quand les réponses changent.
	useEffect(() => onTonightChange(() => setVersion((v) => v + 1)), []);
	useEffect(() => onTasteChange(() => setVersion((v) => v + 1)), []);
	// La première fois le questionnaire de goûts s'ouvre de lui-même, puis le point du mois tous les 30 jours.
	useEffect(() => {
		if (!onEditTaste) return undefined;
		let alive = true;
		Promise.all([loadTaste(), getFromStorage('vjodTastePrompted').catch(() => null)]).then(([taste, prompted]) => {
			const due = alive ? tastePromptDue({profile: taste.profile, promptedAt: typeof prompted === 'number' ? prompted : null}) : null;
			if (!due) return;
			saveToStorage('vjodTastePrompted', Date.now()).catch(() => {});
			onEditTaste(due === 'checkIn' ? 'checkIn' : 'quiz');
		});
		return () => {
			alive = false;
		};
	}, [onEditTaste]);
	useEffect(() => {
		let alive = true;
		(async () => {
			await loadTonight();
			const a = suggestAnswers();
			if (!alive) return;
			setAnswers(a);
			let built = [];
			try {
				const max = parseInt(settings.featuredItemCount, 10) || 10;
				// Pas de demande Seerr pour les enfants : la carte « Pas encore chez vous » disparaît.
				built = await buildSlides({api, serverUrl, seerrEnabled: seerrEnabled && !kids, answers: a, maxItems: max});
			} catch (e) {
				built = [];
			}
			if (!alive) return;
			setSlides(built);
			setIndex(0);
		})();
		return () => {
			alive = false;
		};
	}, [api, serverUrl, seerrEnabled, version, settings.featuredItemCount, kids]);

	// Sans choix du soir, la sélection habituelle de la bannière.
	const shown = slides.length ? slides : (featuredItems || []).map((it) => ({role: 'pick', item: it}));
	const current = shown[Math.min(index, Math.max(0, shown.length - 1))];
	const strip = stripOf(shown);
	const remoteOn = focused && !sheet;

	const nextIdea = useCallback(() => {
		for (let step = 1; step <= shown.length; step++) {
			const i = (index + step) % shown.length;
			if (shown[i].role !== 'resume') return i;
		}
		return (index + 1) % Math.max(1, shown.length);
	}, [shown, index]);

	const play = useCallback((s) => {
		if (!s) return;
		if (s.role === 'request') {
			onSelectItem(s.item);
			return;
		}
		if (s.pick) launched(s.pick, shown.filter((x) => x !== s && x.pick).map((x) => x.pick));
		onPlayItem(s.item);
	}, [onSelectItem, onPlayItem, shown]);

	const details = useCallback((s) => s && onSelectItem(s.item), [onSelectItem]);

	const currentRole = current ? current.role : null;
	const canAnother = shown.length > 1;
	const actions = useMemo(() => (currentRole ? [
		{id: 'play', label: currentRole === 'request' ? $L('Le demander') : currentRole === 'resume' ? $L('Reprendre') : $L('Lecture'), icon: currentRole === 'request' ? '+' : '▶'},
		canAnother ? {id: 'another', label: $L('Autre idée')} : null,
		{id: 'details', label: $L('Infos')}
	].filter(Boolean) : []), [currentRole, canAnother]);

	const runAction = useCallback((id) => {
		if (id === 'play') play(current);
		else if (id === 'another') setIndex(nextIdea());
		else details(current);
	}, [play, current, nextIdea, details]);

	const closeSheet = useCallback(() => {
		setSheet(false);
		setTimeout(() => Spotlight.focus('featured-banner'), 0);
	}, []);

	const handleEditTaste = useCallback(() => {
		closeSheet();
		if (onEditTaste) onEditTaste('quiz');
	}, [closeSheet, onEditTaste]);

	const handleSheetDone = useCallback((a) => {
		saveAnswers(a);
		closeSheet();
	}, [closeSheet]);

	// Retour ferme les questions du soir.
	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (!sheet) return false;
			closeSheet();
			return true;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, sheet, closeSheet]);

	const handleKeyDown = useCallback((e) => {
		const code = e.keyCode;
		if (code === KEYS.ENTER) {
			e.preventDefault();
			e.stopPropagation();
			if (!enterDown.current) enterDown.current = Date.now();
			return;
		}
		const handled = () => {
			e.preventDefault();
			e.stopPropagation();
		};
		if (code === KEYS.LEFT || code === KEYS.RIGHT) {
			handled();
			const step = code === KEYS.RIGHT ? 1 : -1;
			if (zone === ZONE_ACTIONS) {
				const next = Math.min(actions.length - 1, action) + step;
				if (next < 0) {
					if (settings.navbarPosition === 'left') Spotlight.focus('navbar');
				} else if (next < actions.length) setAction(next);
			} else if (zone === ZONE_CARDS && strip.length) {
				const next = Math.min(strip.length - 1, card) + step;
				if (next >= 0 && next < strip.length) {
					setCard(next);
					setIndex(strip[next]);
				} else if (next < 0 && settings.navbarPosition === 'left') Spotlight.focus('navbar');
			}
		} else if (code === KEYS.DOWN) {
			handled();
			if (zone === ZONE_CHANGE) setZone(ZONE_ACTIONS);
			else if (zone === ZONE_ACTIONS && strip.length) {
				const here = strip.indexOf(index);
				setCard(here < 0 ? 0 : here);
				setZone(ZONE_CARDS);
			} else {
				setFocused(false);
				onNavigateDown?.();
			}
		} else if (code === KEYS.UP) {
			handled();
			if (zone === ZONE_CARDS) setZone(ZONE_ACTIONS);
			else if (zone === ZONE_ACTIONS && slides.length) setZone(ZONE_CHANGE);
			else if (settings.navbarPosition !== 'left') Spotlight.focus('navbar-home');
		}
	}, [zone, actions.length, action, strip, card, index, slides.length, settings.navbarPosition, onNavigateDown]);

	const handleKeyUp = useCallback((e) => {
		if (e.keyCode !== KEYS.ENTER || !enterDown.current) return;
		e.preventDefault();
		e.stopPropagation();
		const held = Date.now() - enterDown.current;
		enterDown.current = 0;
		if (held >= LONG_PRESS_MS) {
			details(current);
		} else if (zone === ZONE_CHANGE) {
			setSheet(true);
		} else if (zone === ZONE_CARDS && strip.length) {
			const target = strip[Math.min(card, strip.length - 1)];
			if (target === index) play(current);
			else setIndex(target);
		} else if (actions.length) {
			runAction(actions[Math.min(action, actions.length - 1)].id);
		}
	}, [details, current, zone, strip, card, index, play, actions, action, runAction]);

	const handleFocus = useCallback(() => {
		setFocused(true);
		setZone(ZONE_ACTIONS);
		onFeaturedFocus?.();
	}, [onFeaturedFocus]);
	const handleBlur = useCallback(() => setFocused(false), []);

	if (!isVisible || !current || !answers) return null;

	const image = slideImage(current, getItemServerUrl);
	const isRequest = current.role === 'request';
	const isResume = current.role === 'resume';
	const reason = pickReason(answers);
	const firstPick = shown.findIndex((s) => s.role === 'pick');
	const labelFor = (s, i) => (s.role === 'resume' ? $L('Reprendre') : s.role === 'request' ? $L('Pas encore chez vous') : i === firstPick ? reason : $L('Autre idée'));
	const captionFor = (s) => {
		if (s.role === 'resume') {
			const {left} = resumeState(s.item);
			return [s.item.Type === 'Episode' && s.item.IndexNumber ? `${$L('Épisode')} ${s.item.IndexNumber}` : '', left > 0 ? `${$L('reste')} ${left} min` : ''].filter(Boolean).join(' · ');
		}
		if (s.role === 'request') return $L('Une pression pour le demander');
		return [$L('Prêt'), endsAt(s)].filter(Boolean).join(' · ');
	};
	const item = current.item;
	const minutes = isRequest ? (current.candidate && current.candidate.runtimeMinutes) : ticksToMinutes(item.RunTimeTicks);
	const rating = isRequest ? current.candidate && current.candidate.rating : item.CommunityRating;
	const genre = isRequest ? null : item.Genres && item.Genres[0];
	const meta = [
		genre,
		isResume ? captionFor(current) : minutes && item.Type !== 'Series' ? lengthLabel(minutes) : null,
		rating > 0 ? `★ ${rating.toFixed(1).replace('.', ',')}` : null
	].filter(Boolean);
	const ends = endsAt(current);
	const activeAction = remoteOn && zone === ZONE_ACTIONS ? Math.min(action, actions.length - 1) : null;

	return (
		<div className={css.vjodBanner}>
			<SpottableDiv
				className={css.inner}
				spotlightId="featured-banner"
				onKeyDown={handleKeyDown}
				onKeyUp={handleKeyUp}
				onFocus={handleFocus}
				onBlur={handleBlur}
			>
				<div className={css.picture}>
					{image ? <img key={image} src={image} alt="" /> : null}
					<div className={css.shadeLeft} />
					<div className={css.shadeBottom} />
					<div className={css.shadeTop} />
				</div>

				<div className={`${css.hero} ${settings.navbarPosition === 'left' ? css.heroSidebar : ''}`}>
					<div className={css.evening}>
						<span className={css.tonightLabel}>{$L('Ce soir')}</span>
						{slides.length ? answerChips(answers).map((c) => <span key={c} className={css.chip}>{c}</span>) : null}
						{slides.length ? (
							<span className={`${css.chip} ${css.chipOutlined} ${remoteOn && zone === ZONE_CHANGE ? css.chipFocused : ''}`}>
								{$L('Changer')}
							</span>
						) : null}
					</div>
					<div className={css.kicker}>
						{(isRequest ? $L('Pas encore chez vous') : isResume ? $L('Reprendre') : reason).toUpperCase()}
					</div>
					<div className={css.title}>{slideTitle(current).toUpperCase()}</div>
					<div className={css.meta}>
						<span className={isRequest ? css.statusRequest : css.statusReady}>
							{isRequest ? `+ ${$L('Demander')}` : `▶ ${$L('Prêt')}`}
						</span>
						{meta.map((m) => <span key={m}>{m}</span>)}
						{ends ? <span className={css.ends}>{ends}</span> : null}
					</div>
					<div className={css.buttons}>
						{actions.map((a, i) => (
							<span
								key={a.id}
								className={`${css.button} ${i === (activeAction === null ? 0 : activeAction) ? css.buttonLight : ''} ${activeAction === i ? css.buttonRinged : ''}`}
							>
								{a.icon ? `${a.icon} ` : ''}{a.label}
							</span>
						))}
					</div>
				</div>

				{strip.length ? (
					<div className={`${css.strip} ${settings.navbarPosition === 'left' ? css.heroSidebar : ''}`}>
						{strip.map((slideIndex, i) => {
							const s = shown[slideIndex];
							const ringed = remoteOn ? zone === ZONE_CARDS && card === i : slideIndex === index;
							return (
								<PickCard
									key={`${slideIndex}-${s.item.Id || s.item.id}`}
									slide={s}
									label={labelFor(s, slideIndex)}
									caption={captionFor(s)}
									captionGood={s.role === 'pick'}
									ringed={ringed}
									image={slideImage(s, getItemServerUrl)}
								/>
							);
						})}
					</div>
				) : null}
			</SpottableDiv>
			{sheet ? <TonightSheet answers={answers} onDone={handleSheetDone} onEditTaste={onEditTaste ? handleEditTaste : null} /> : null}
		</div>
	);
});

export default VjodBanner;
