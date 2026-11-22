// Ce qui s'affiche par-dessus l'image du lecteur Ma TV, repris de
// ma_tv_widgets.dart : bandeau (MaTvBanner), liste des chaînes (_listPanel)
// et mini-guide (MaTvMiniGuide). Composants d'affichage seuls : la
// télécommande est lue par MaTvPlayer, qui leur passe la position du focus.
import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {formatClockTime} from '../../utils/clock';
import {maTvColors as C} from './maTvTheme';
import {programsAt, progressOf} from './maTvZap';

import css from './MaTvPlayer.module.less';

const TRACK = 'rgba(237, 235, 230, 0.15)';
const CHIP = 'rgba(237, 235, 230, 0.10)';

export const clock = (sec) => (sec ? formatClockTime(new Date(sec * 1000)) : '');
const range = (p) => (p && p.s ? `${clock(p.s)} – ${clock(p.e)}` : '');
const minutesLeft = (p, nowSec) => {
	if (!p || !p.e || p.e <= nowSec) return '';
	return `${$L('encore')} ${Math.max(1, Math.round((p.e - nowSec) / 60))} min`;
};

const Logo = ({url, className}) => {
	const [failed, setFailed] = useState(false);
	const handleError = useCallback(() => setFailed(true), []);
	useEffect(() => setFailed(false), [url]);
	return (
		<div className={className} style={{background: C.row}}>
			{url && !failed ? <img src={url} alt="" onError={handleError} /> : null}
		</div>
	);
};

const Progress = ({value}) => (
	<div className={css.progressTrack} style={{background: TRACK}}>
		<div className={css.progressFill} style={{width: Math.round(value * 1000) / 10 + '%', background: C.accent}} />
	</div>
);

// Garde l'élément focalisé visible dans sa colonne (scrollTop manuel :
// scrollIntoView est capricieux sur les vieux moteurs TV).
const useKeepVisible = (index) => {
	const boxRef = useRef(null);
	useEffect(() => {
		const box = boxRef.current;
		const row = box && box.children[index];
		if (!row) return;
		const top = row.offsetTop;
		const bottom = top + row.offsetHeight;
		if (top < box.scrollTop) box.scrollTop = top;
		else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
	}, [index]);
	return boxRef;
};

export const Banner = ({channel, categoryLabel, status, delayLabel, nowSec}) => {
	const {current, next} = programsAt(channel, nowSec);
	return (
		<div className={css.banner}>
			<div className={css.bannerNumber} style={{color: C.ink}}>{channel.num || ''}</div>
			<Logo url={channel.logo} className={css.bannerLogo} />
			<div className={css.bannerText}>
				<div className={css.bannerTitleRow}>
					<span className={css.bannerName} style={{color: C.ink}}>{channel.name}</span>
					{categoryLabel ? (
						<span className={css.bannerCategory} style={{color: C.faint}}>{categoryLabel}</span>
					) : null}
				</div>
				{delayLabel ? (
					<div className={css.bannerProgram} style={{color: C.accent}}>{delayLabel}</div>
				) : null}
				{!delayLabel && current ? (
					<div>
						<div className={css.bannerProgram} style={{color: C.ink}}>{current.t}</div>
						<div className={css.bannerTimeline}>
							<span className={css.bannerTime} style={{color: C.mute}}>{clock(current.s)}</span>
							<Progress value={progressOf(current, nowSec)} />
							<span className={css.bannerTime} style={{color: C.mute}}>{clock(current.e)}</span>
						</div>
						{next ? (
							<div className={css.bannerNext} style={{color: C.mute}}>
								{$L('Ensuite')}  {clock(next.s)}  {next.t}
							</div>
						) : null}
					</div>
				) : null}
				{!delayLabel && !current ? (
					<div className={css.bannerEmpty} style={{color: C.faint}}>{$L('Pas de programme annoncé')}</div>
				) : null}
				{status ? (
					<div className={css.bannerStatus} style={{color: C.accent}}>{status}</div>
				) : null}
			</div>
			<div className={css.bannerSide}>
				<div className={css.bannerClock} style={{color: C.ink}}>{clock(nowSec)}</div>
				<div className={css.bannerHints} style={{color: C.faint}}>
					<span>▲▼ {$L('chaînes')}</span>
					<span>OK {$L('liste')}</span>
					<span>◀ −30 s</span>
					<span>▶ +30 s</span>
					<span>{$L('OK long')} {$L('options')}</span>
				</div>
			</div>
		</div>
	);
};

const ListRow = ({channel, focused, playing, nowSec}) => {
	const {current} = programsAt(channel, nowSec);
	return (
		<div
			className={css.listChannel}
			style={{
				background: focused ? C.rowOn : C.row,
				boxShadow: focused ? `inset 0 0 0 0.12rem ${C.accent}` : 'none'
			}}
		>
			<div className={css.listNumber} style={{color: focused || playing ? C.accent : C.mute}}>{channel.num || ''}</div>
			<Logo url={channel.logo} className={css.listLogo} />
			<div className={css.listText}>
				<div className={css.listName} style={{color: C.ink}}>
					{channel.name}
					{playing ? <span className={css.listPlaying} style={{background: C.live}} /> : null}
				</div>
				{current ? (
					<div className={css.listNow} style={{color: C.mute}}>{clock(current.s)} · {current.t}</div>
				) : null}
			</div>
		</div>
	);
};

export const ChannelListPanel = ({cats, catIndex, channels, chanIndex, column, playingId, nowSec, loading}) => {
	const catBox = useKeepVisible(catIndex);
	const chanBox = useKeepVisible(chanIndex);
	return (
		<div className={css.listPanel} style={{background: C.panel}}>
			<div ref={catBox} className={css.listCats}>
				{cats.map((cat, i) => {
					const on = column === 0 && i === catIndex;
					return (
						<div
							key={cat.id}
							className={css.listCat}
							style={{
								background: on ? C.rowOn : (i === catIndex ? C.rowSelected : 'transparent'),
								color: on || i === catIndex ? C.ink : C.mute,
								boxShadow: on ? `inset 0 0 0 0.12rem ${C.accent}` : 'none'
							}}
						>
							{cat.label}
						</div>
					);
				})}
			</div>
			<div ref={chanBox} className={css.listChannels}>
				{loading ? (
					<div className={css.listHint} style={{color: C.mute}}>{$L('Chargement…')}</div>
				) : null}
				{!loading && channels.length === 0 ? (
					<div className={css.listHint} style={{color: C.mute}}>{$L('Aucune chaîne')}</div>
				) : null}
				{loading ? null : channels.map((ch, i) => (
					<ListRow
						key={ch.id}
						channel={ch}
						focused={column === 1 && i === chanIndex}
						playing={ch.id === playingId}
						nowSec={nowSec}
					/>
				))}
			</div>
		</div>
	);
};

export const MiniGuide = ({channel, current, later, actions, selected, nowSec}) => {
	const [imageFailed, setImageFailed] = useState(false);
	const handleImageError = useCallback(() => setImageFailed(true), []);
	useEffect(() => setImageFailed(false), [current]);
	const meta = current ? [range(current), minutesLeft(current, nowSec), current.st].filter(Boolean).join('  ·  ') : '';
	return (
		<div className={css.guide} style={{background: C.panel, borderColor: C.hairline}}>
			{current && current.i && !imageFailed ? (
				<div className={css.guideImage} style={{background: C.row}}>
					<img src={current.i} alt="" onError={handleImageError} />
				</div>
			) : null}
			<div className={css.guideText}>
				<div className={css.guideChannel} style={{color: C.mute}}>{channel.num || ''}  {channel.name}</div>
				<div className={css.guideTitle} style={{color: C.ink}}>
					{current ? current.t : $L('Pas de programme annoncé')}
				</div>
				{current ? (
					<div>
						<div className={css.guideMeta} style={{color: C.mute}}>{meta}</div>
						<div className={css.guideProgress}><Progress value={progressOf(current, nowSec)} /></div>
						{current.d ? <div className={css.guideDesc} style={{color: C.mute}}>{current.d}</div> : null}
					</div>
				) : null}
				{later.length ? (
					<div className={css.guideLater}>
						{later.map((p) => (
							<div key={`${p.s}-${p.t}`} className={css.guideLaterRow} style={{color: C.mute}}>
								<span className={css.guideLaterTime} style={{color: C.ink}}>{clock(p.s)}</span>
								{p.t}
							</div>
						))}
					</div>
				) : null}
				<div className={css.guideActions}>
					{actions.map((a, i) => (
						<div
							key={a.id}
							className={css.guideAction}
							style={{
								background: i === selected ? C.ink : CHIP,
								color: i === selected ? '#000' : C.ink
							}}
						>
							{a.label}
						</div>
					))}
				</div>
			</div>
		</div>
	);
};
