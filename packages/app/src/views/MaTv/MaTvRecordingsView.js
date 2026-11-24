// Enregistrements (ma_tv_recordings_screen.dart de l'APK) : ce que Ma TV
// enregistre sur la seedbox (la télé peut rester éteinte), en cours,
// programmés, enregistrés, et les séries suivies ; « Programmer une plage
// horaire » pour un créneau à la main. Retour est géré par l'hôte (backRef).
import {useState, useEffect, useCallback, useRef} from 'react';
import Spotlight from '@enact/spotlight';
import $L from '@enact/i18n/$L';

import LoadingSpinner from '../../components/LoadingSpinner';
import {formatClockTime} from '../../utils/clock';
import {createRecorder, isScheduled, isRecording, isFailed, isPlayable} from '../../services/maTvRecordings';
import {maTvColors as C} from './maTvTheme';
import {dayName} from './maTvGuideLogic';
import {Page, FocusRow, SectionHeader, Empty, Toast, ChoiceDialog, SpottableDiv} from './MaTvPageParts';
import MaTvSearch from './MaTvSearch';

import css from './MaTvPages.module.less';

const REFRESH_MS = 20000;
const TOAST_MS = 3000;
const clock = (sec) => formatClockTime(new Date(sec * 1000));
const when = (s, e, nowSec) => `${dayName(s, nowSec)} ${clock(s)} – ${clock(e)}`;

export const sizeLabel = (bytes) => {
	if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1).replace('.', ',')} Go`;
	return `${Math.round(bytes / 1048576)} Mo`;
};

const RecRow = ({rec, nowSec, onOpen}) => {
	const icon = isRecording(rec) ? '●' : isScheduled(rec) ? '◷' : isFailed(rec) ? '!' : '▶';
	const iconColor = isRecording(rec) || isFailed(rec) ? C.live : isScheduled(rec) ? C.mute : C.ink;
	const side = isFailed(rec)
		? rec.message || $L('Échec')
		: [rec.size ? sizeLabel(rec.size) : '', rec.keep ? $L('gardé') : ''].filter(Boolean).join(' · ');
	return (
		<FocusRow onClick={onOpen} data={rec}>
			<span className={css.recIcon} style={{color: iconColor}}>{icon}</span>
			<span className={css.recText}>
				<div className={css.recTitle}>{rec.title}{rec.subtitle ? ` · ${rec.subtitle}` : ''}</div>
				<div className={css.recSub} style={{color: C.mute}}>
					{[rec.number ? `${rec.number} ${rec.channelName}` : rec.channelName, when(rec.start, rec.end, nowSec)].filter(Boolean).join(' · ')}
				</div>
			</span>
			{side ? <span className={css.recSide} style={{color: isFailed(rec) ? C.live : C.mute}}>{side}</span> : null}
		</FocusRow>
	);
};

const Step = ({label, onStep, delta}) => {
	const handleClick = useCallback(() => onStep(delta), [onStep, delta]);
	return <SpottableDiv className={css.step} style={{color: C.ink}} onClick={handleClick}>{label}</SpottableDiv>;
};

const lengthLabel = (sec) => {
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	if (!h) return `${m} min`;
	return m ? `${h} h ${m < 10 ? '0' + m : m}` : `${h} h`;
};

// Programmer une plage (MaTvManualRecordScreen) : chaîne, jour, début, durée.
const ManualRecord = ({channel, onChooseChannel, onSaved, onCancel, recorder}) => {
	const initial = () => {
		const d = new Date();
		d.setMinutes(Math.floor(d.getMinutes() / 15) * 15 + 15, 0, 0);
		return Math.floor(d.getTime() / 1000);
	};
	const [start, setStart] = useState(initial);
	const [length, setLength] = useState(3600);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);

	useEffect(() => {
		const t = setTimeout(() => Spotlight.focus('matv-manual-first'), 0);
		return () => clearTimeout(t);
	}, []);

	const shift = useCallback((d) => {
		const next = start + d;
		const now = Math.floor(Date.now() / 1000);
		if (next + length < now || next > now + 7 * 86400) return;
		setStart(next);
	}, [start, length]);

	const resize = useCallback((d) => {
		const next = length + d;
		if (next < 900 || next > 6 * 3600) return;
		setLength(next);
	}, [length]);

	const save = useCallback(async () => {
		if (!channel) {
			onChooseChannel();
			return;
		}
		setBusy(true);
		setError(null);
		const err = await recorder.add({channelId: channel.id, start, end: start + length, title: `${channel.name} · ${clock(start)}`});
		if (!err) {
			onSaved(`${$L('Plage programmée')} : ${channel.name}, ${dayName(start, Math.floor(Date.now() / 1000))} ${clock(start)}`);
			return;
		}
		setBusy(false);
		setError(err);
	}, [channel, start, length, recorder, onChooseChannel, onSaved]);

	const nowSec = Math.floor(Date.now() / 1000);
	return (
		<Page title={$L('Programmer une plage')} spotlightId="matv-manual">
			<FocusRow onClick={onChooseChannel} spotlightId="matv-manual-first">
				<span className={css.stepperLabel} style={{color: C.mute}}>{$L('Chaîne')}</span>
				<span className={css.stepperValue} style={{color: channel ? C.ink : C.accent}}>
					{channel ? `${channel.num || ''} ${channel.name}` : $L('Choisir une chaîne…')}
				</span>
				<span style={{color: C.mute}}>⌕</span>
			</FocusRow>
			<div className={css.stepper}>
				<span className={css.stepperLabel} style={{color: C.mute}}>{$L('Jour')}</span>
				<span className={css.stepperValue} style={{color: C.ink}}>{dayName(start, nowSec)}</span>
				<Step label={`− 1 ${$L('jour')}`} delta={-86400} onStep={shift} />
				<Step label={`+ 1 ${$L('jour')}`} delta={86400} onStep={shift} />
			</div>
			<div className={css.stepper}>
				<span className={css.stepperLabel} style={{color: C.mute}}>{$L('Début')}</span>
				<span className={css.stepperValue} style={{color: C.ink}}>{clock(start)}</span>
				<Step label="− 1 h" delta={-3600} onStep={shift} />
				<Step label="− 5 min" delta={-300} onStep={shift} />
				<Step label="+ 5 min" delta={300} onStep={shift} />
				<Step label="+ 1 h" delta={3600} onStep={shift} />
			</div>
			<div className={css.stepper}>
				<span className={css.stepperLabel} style={{color: C.mute}}>{$L('Durée')}</span>
				<span className={css.stepperValue} style={{color: C.ink}}>{`${lengthLabel(length)}  (${$L('fin')} ${clock(start + length)})`}</span>
				<Step label="− 15 min" delta={-900} onStep={resize} />
				<Step label="+ 15 min" delta={900} onStep={resize} />
			</div>
			{error ? <div className={css.error} style={{color: C.live}}>{error}</div> : null}
			<div className={css.actions}>
				<SpottableDiv className={css.action} style={{color: C.ink}} onClick={busy ? null : save}>
					<span style={{color: C.live}}>●</span> {channel ? $L('Programmer') : $L('Choisir la chaîne')}
				</SpottableDiv>
				<SpottableDiv className={css.action} style={{color: C.ink}} onClick={onCancel}>{$L('Annuler')}</SpottableDiv>
			</div>
		</Page>
	);
};

const MaTvRecordingsView = ({client, onPlay, backRef}) => {
	const recorder = useRef(createRecorder(client)).current;
	const [data, setData] = useState(null);
	const [failed, setFailed] = useState(false);
	const [toast, setToast] = useState(null);
	const [dialog, setDialog] = useState(null); // {title, subtitle, choices, target}
	const [manual, setManual] = useState(null); // null | {channel, choosing}
	const toastTimer = useRef(null);

	const say = useCallback((text) => {
		setToast(text);
		clearTimeout(toastTimer.current);
		toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
	}, []);

	const load = useCallback(async () => {
		const d = await recorder.list();
		if (d) setData(d);
		setFailed((f) => (d ? false : f || !d));
	}, [recorder]);

	useEffect(() => {
		load();
		const t = setInterval(load, REFRESH_MS);
		return () => {
			clearInterval(t);
			clearTimeout(toastTimer.current);
		};
	}, [load]);

	const focusList = useCallback(() => {
		setTimeout(() => Spotlight.focus('matv-recordings'), 0);
	}, []);

	useEffect(() => {
		if (data && !manual) focusList();
	}, [!!data, manual]); // eslint-disable-line react-hooks/exhaustive-deps

	const nowSec = Math.floor(Date.now() / 1000);
	const keepDays = data ? data.keepDays : 7;

	const openRec = useCallback((r) => {
		const choices = [];
		if (isPlayable(r)) choices.push({id: 'play', icon: '▶', label: isRecording(r) ? $L('Regarder (en cours)') : $L('Regarder'), strong: true});
		if (!isScheduled(r) && !isRecording(r)) {
			choices.push(r.keep
				? {id: 'unkeep', icon: '☐', label: `${$L('Ne plus garder (effacé après')} ${keepDays} ${$L('jours)')}`}
				: {id: 'keep', icon: '☑', label: $L('Garder (ne pas effacer)')});
		}
		if (isScheduled(r) || isRecording(r)) {
			choices.push({id: 'delete', icon: '■', label: isRecording(r) ? $L('Arrêter et effacer') : $L('Annuler l’enregistrement')});
		} else {
			choices.push({id: 'delete', icon: '✕', label: $L('Effacer')});
		}
		choices.push({id: 'none', icon: '←', label: $L('Retour')});
		setDialog({title: r.title, subtitle: `${r.channelName} · ${when(r.start, r.end, Math.floor(Date.now() / 1000))}`, choices, target: {rec: r}});
	}, [keepDays]);

	const openRule = useCallback((rule) => {
		setDialog({
			title: rule.title,
			subtitle: `${$L('Toutes les diffusions sur')} ${rule.channelName}`,
			choices: [{id: 'stop', icon: '■', label: $L('Ne plus enregistrer')}, {id: 'none', icon: '←', label: $L('Retour')}],
			target: {rule}
		});
	}, []);

	const pick = useCallback(async (id) => {
		const d = dialog;
		setDialog(null);
		focusList();
		if (!d || id === 'none') return;
		const noAnswer = $L('Ma TV ne répond pas');
		if (d.target.rule) {
			const ok = await recorder.removeRule(d.target.rule.id);
			say(ok ? $L('Plus enregistré (déjà enregistrés gardés)') : noAnswer);
		} else {
			const r = d.target.rec;
			if (id === 'play') {
				onPlay({url: recorder.playUrl(r), title: r.subtitle ? `${r.title} · ${r.subtitle}` : r.title, id: `rec:${r.id}`, subtitle: r.channelName});
				return;
			}
			if (id === 'keep' || id === 'unkeep') {
				const ok = await recorder.keep(r.id, id === 'keep');
				say(ok ? (id === 'keep' ? $L('Gardé') : `${$L('Sera effacé après')} ${keepDays} ${$L('jours')}`) : noAnswer);
			} else if (id === 'delete') {
				const ok = await recorder.remove(r.id);
				say(ok ? (isScheduled(r) ? $L('Annulé') : $L('Effacé')) : noAnswer);
			}
		}
		load();
	}, [dialog, recorder, say, load, keepDays, onPlay, focusList]);

	const openManual = useCallback(() => setManual({channel: null, choosing: false}), []);
	const chooseChannel = useCallback(() => setManual((m) => ({...m, choosing: true})), []);
	const channelChosen = useCallback(({channels, index}) => setManual((m) => ({...m, channel: channels[index], choosing: false})), []);
	const manualSaved = useCallback((msg) => {
		setManual(null);
		say(msg);
		load();
	}, [say, load]);
	const manualCancel = useCallback(() => setManual(null), []);

	// Retour : ferme le choix, la recherche de chaîne, puis la plage horaire.
	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (dialog) {
				setDialog(null);
				focusList();
				return true;
			}
			if (manual && manual.choosing) {
				setManual({...manual, choosing: false});
				return true;
			}
			if (manual) {
				setManual(null);
				return true;
			}
			return false;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, dialog, manual, focusList]);

	if (manual && manual.choosing) {
		return <MaTvSearch client={client} title={$L('Choisir une chaîne')} onPick={channelChosen} />;
	}
	if (manual) {
		return (
			<ManualRecord
				channel={manual.channel}
				recorder={recorder}
				onChooseChannel={chooseChannel}
				onSaved={manualSaved}
				onCancel={manualCancel}
			/>
		);
	}

	const items = data ? data.items : [];
	const running = items.filter(isRecording);
	const planned = items.filter(isScheduled);
	const ready = items.filter((r) => !isRecording(r) && !isScheduled(r));
	const subtitle = data ? [
		data.used > 0 ? `${sizeLabel(data.used)} ${$L('utilisés')}` : '',
		data.free !== null ? `${sizeLabel(data.free)} ${$L('libres')}` : '',
		`${$L('effacés après')} ${data.keepDays} ${$L('jours sauf « gardés »')}`
	].filter(Boolean).join(' · ') : '';

	return (
		<div>
			<Page
				title={$L('Enregistrements')}
				subtitle={subtitle}
				hint={$L('Ma TV enregistre sur la seedbox : la télé peut rester éteinte. Pour enregistrer une émission, OK sur une émission à venir dans la grille.')}
				spotlightId="matv-recordings"
			>
				{!data ? (
					failed ? <Empty>{$L('Ma TV ne répond pas, réessaie dans un instant.')}</Empty> : <div className={css.empty}><LoadingSpinner /></div>
				) : (
					<div>
						<FocusRow onClick={openManual}>
							<span className={css.recIcon} style={{color: C.accent}}>+</span>
							<span style={{fontWeight: 600}}>{$L('Programmer une plage horaire')}</span>
						</FocusRow>
						{running.length ? <SectionHeader>{$L('En cours')}</SectionHeader> : null}
						{running.map((r) => <RecRow key={r.id} rec={r} nowSec={nowSec} onOpen={openRec} />)}
						{planned.length ? <SectionHeader>{$L('Programmés')}</SectionHeader> : null}
						{planned.map((r) => <RecRow key={r.id} rec={r} nowSec={nowSec} onOpen={openRec} />)}
						<SectionHeader>{$L('Enregistrés')}</SectionHeader>
						{ready.length ? null : <div style={{color: C.mute, marginBottom: '0.5rem'}}>{$L('Rien pour le moment.')}</div>}
						{ready.map((r) => <RecRow key={r.id} rec={r} nowSec={nowSec} onOpen={openRec} />)}
						{data.rules.length ? <SectionHeader>{$L('Séries suivies')}</SectionHeader> : null}
						{data.rules.map((rule) => (
							<FocusRow key={rule.id} onClick={openRule} data={rule}>
								<span className={css.recIcon} style={{color: C.mute}}>↻</span>
								<span className={css.recText}><div className={css.recTitle}>{rule.title}</div></span>
								<span className={css.recSide} style={{color: C.mute}}>{rule.channelName}</span>
							</FocusRow>
						))}
					</div>
				)}
			</Page>
			{dialog ? <ChoiceDialog title={dialog.title} subtitle={dialog.subtitle} choices={dialog.choices} onPick={pick} /> : null}
			<Toast text={toast} />
		</div>
	);
};

export default MaTvRecordingsView;
