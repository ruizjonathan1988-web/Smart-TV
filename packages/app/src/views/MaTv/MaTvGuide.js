// Grille des programmes de Ma TV (ma_tv_guide.dart de l'APK), comme une box :
// les chaînes à gauche, deux heures et demie en travers, le programme sous le
// curseur décrit en haut. ▲▼ changent de chaîne (CH+/CH- par pages), ◀ ▶
// vont de programme en programme (les heures suivent), OK regarde : le direct
// pour ce qui passe, le replay pour le passé quand le fournisseur le garde,
// l'enregistrement pour ce qui vient. Menu = favori. Retour est géré par l'hôte.
import {useState, useEffect, useCallback, useRef} from 'react';
import $L from '@enact/i18n/$L';

import {KEYS} from '../../utils/keys';
import {formatClockTime} from '../../utils/clock';
import {isMaTvFavorite, toggleMaTvFavorite} from '../../services/maTvMemory';
import {createRecorder, lastRecordings, recordingOf} from '../../services/maTvRecordings';
import {maTvColors as C} from './maTvTheme';
import {
	SPAN, halfHour, rowPrograms, programAt, earliestFor, moveTime, guideAction, dayName, cellBox
} from './maTvGuideLogic';

import css from './MaTvGuide.module.less';

const ROWS = 10;
const PAGE = 8;
const TOAST_MS = 3000;

const nowSeconds = () => Math.floor(Date.now() / 1000);
const clock = (sec) => formatClockTime(new Date(sec * 1000));
const range = (p) => `${clock(p.s)} – ${clock(p.e)}`;
const clampRow = (i, n) => Math.max(0, Math.min(n - 1, i));

// Choix d'enregistrement (maTvRecordProgram) : la première ligne a le focus.
const RecordDialog = ({title, subtitle, choices, selected}) => (
	<div className={css.dialogBackdrop}>
		<div className={css.dialog} style={{background: C.panel}}>
			<div className={css.dialogTitle} style={{color: C.ink}}>{title}</div>
			<div className={css.dialogSub} style={{color: C.mute}}>{subtitle}</div>
			{choices.map((c, i) => (
				<div
					key={c.id}
					className={css.dialogChoice}
					style={{background: i === selected ? C.rowOn : C.row, color: C.ink, borderColor: i === selected ? C.accent : 'transparent'}}
				>
					{c.label}
				</div>
			))}
		</div>
	</div>
);

const MaTvGuide = ({client, channels, startIndex = 0, categoryLabel = '', onPick, backRef}) => {
	const [nowSec, setNowSec] = useState(nowSeconds());
	const [row, setRow] = useState(clampRow(startIndex, channels.length || 1));
	const [win, setWin] = useState(halfHour(nowSeconds()));
	const [cursor, setCursor] = useState(nowSeconds());
	const [progs, setProgs] = useState({});
	const [recs, setRecs] = useState(lastRecordings());
	const [toast, setToast] = useState(null);
	const [dialog, setDialog] = useState(null); // {channel, prog, choices, selected}
	const [, setFavVersion] = useState(0);
	const fetched = useRef({from: 0, to: 0, asked: {}});
	const timers = useRef({});
	const recorder = useRef(createRecorder(client));

	const say = useCallback((text) => {
		setToast(text);
		clearTimeout(timers.current.toast);
		timers.current.toast = setTimeout(() => setToast(null), TOAST_MS);
	}, []);

	useEffect(() => {
		const pending = timers.current;
		const t = setInterval(() => setNowSec(nowSeconds()), 30000);
		recorder.current.list().then((r) => r && setRecs(r));
		return () => {
			clearInterval(t);
			Object.keys(pending).forEach((k) => clearTimeout(pending[k]));
		};
	}, []);

	// Programmes des lignes autour du curseur, par lots, quelques heures autour.
	useEffect(() => {
		if (!channels.length) return undefined;
		const t = setTimeout(async () => {
			const f = fetched.current;
			if (!f.to || win < f.from + 1800 || win + SPAN > f.to) {
				fetched.current = {from: win - 7200, to: win + 6 * 3600, asked: {}};
			}
			const cur = fetched.current;
			const lo = clampRow(row - 12, channels.length);
			const hi = clampRow(row + 24, channels.length);
			const ids = [];
			for (let i = lo; i <= hi; i++) if (!cur.asked[channels[i].id]) ids.push(channels[i].id);
			if (!ids.length) return;
			ids.forEach((id) => {
				cur.asked[id] = true;
			});
			const got = await client.programs(ids, cur.from * 1000, cur.to * 1000);
			if (got) setProgs((p) => ({...p, ...got}));
		}, 200);
		return () => clearTimeout(t);
	}, [row, win, channels, client]);

	const channel = channels[row] || null;
	const progsOf = useCallback((i) => rowPrograms(channels[i], progs[channels[i].id]), [channels, progs]);
	const selected = channel ? programAt(progsOf(row), cursor) : null;
	const earliest = earliestFor(channel, nowSec);

	const moveRow = useCallback((d) => {
		if (!channels.length) return;
		const next = clampRow(row + d, channels.length);
		const e = earliestFor(channels[next], nowSec);
		setRow(next);
		if (win < e) setWin(e);
		if (cursor < e) setCursor(e);
	}, [channels, row, win, cursor, nowSec]);

	const move = useCallback((delta) => {
		const r = moveTime({progs: progsOf(row), cursor, win, delta, earliest, nowSec});
		if (!r) return;
		setCursor(r.cursor);
		setWin(r.win);
	}, [progsOf, row, cursor, win, earliest, nowSec]);

	const backToNow = useCallback(() => {
		const n = nowSeconds();
		setCursor(n);
		setWin(halfHour(n));
	}, []);

	const openRecord = useCallback((ch, p) => {
		const known = recordingOf(recs, ch.id, p.s);
		const choices = known
			? [{id: 'cancel', label: $L('Annuler l’enregistrement')}]
			: [
				{id: 'one', label: $L('Enregistrer cette émission')},
				{id: 'series', label: `${$L('Toutes les diffusions sur')} ${ch.name}`}
			];
		choices.push({id: 'none', label: $L('Retour')});
		setDialog({channel: ch, prog: p, known, choices, selected: 0});
	}, [recs]);

	const runRecord = useCallback(async (choice) => {
		const d = dialog;
		setDialog(null);
		if (!d || choice === 'none') return;
		const rec = recorder.current;
		if (choice === 'cancel') {
			const ok = await rec.remove(d.known.id);
			rec.list().then((r) => r && setRecs(r));
			say(ok ? $L('Enregistrement annulé') : $L('Ma TV ne répond pas'));
			return;
		}
		const err = await rec.add({
			channelId: d.channel.id, start: d.prog.s, end: d.prog.e,
			title: d.prog.t || '', subtitle: d.prog.st || '', series: choice === 'series'
		});
		rec.list().then((r) => r && setRecs(r));
		if (err) {
			say(err);
			return;
		}
		const onAir = d.prog.s <= nowSeconds() && nowSeconds() < d.prog.e;
		if (choice === 'series') say(`${$L('Toutes les diffusions de')} « ${d.prog.t} » ${$L('seront enregistrées')}`);
		else if (onAir) say($L('Enregistrement en cours (même télé éteinte)'));
		else say(`${$L('Enregistrement programmé à')} ${clock(d.prog.s)}`);
	}, [dialog, say]);

	const choose = useCallback(() => {
		if (!channel) return;
		const action = guideAction(selected, channel, nowSeconds());
		if (action === 'live') onPick({index: row});
		else if (action === 'replay') onPick({index: row, replay: selected});
		else if (action === 'noreplay') say(`${$L('Pas de replay pour')} ${channel.name}`);
		else openRecord(channel, selected);
	}, [channel, selected, row, onPick, say, openRecord]);

	const toggleFav = useCallback(() => {
		if (!channel) return;
		const on = toggleMaTvFavorite(channel.id);
		setFavVersion((v) => v + 1);
		say(`${channel.name} · ${on ? $L('ajoutée aux favoris') : $L('retirée des favoris')}`);
	}, [channel, say]);

	// Retour : ferme d'abord le choix d'enregistrement.
	useEffect(() => {
		if (!backRef) return undefined;
		const handler = () => {
			if (dialog) {
				setDialog(null);
				return true;
			}
			return false;
		};
		backRef.current = handler;
		return () => {
			if (backRef.current === handler) backRef.current = null;
		};
	}, [backRef, dialog]);

	const keysRef = useRef(null);
	keysRef.current = {dialog, setDialog, runRecord, moveRow, move, choose, toggleFav, backToNow};

	useEffect(() => {
		const onKey = (e) => {
			const code = e.keyCode || e.which;
			const k = keysRef.current;
			let handled = true;
			if (k.dialog) {
				const n = k.dialog.choices.length;
				if (code === KEYS.UP) k.setDialog({...k.dialog, selected: Math.max(0, k.dialog.selected - 1)});
				else if (code === KEYS.DOWN) k.setDialog({...k.dialog, selected: Math.min(n - 1, k.dialog.selected + 1)});
				else if (code === KEYS.ENTER) k.runRecord(k.dialog.choices[k.dialog.selected].id);
				else handled = false;
			} else if (code === KEYS.UP) {
				k.moveRow(-1);
			} else if (code === KEYS.DOWN) {
				k.moveRow(1);
			} else if (code === KEYS.CHANNEL_UP) {
				k.moveRow(-PAGE);
			} else if (code === KEYS.CHANNEL_DOWN) {
				k.moveRow(PAGE);
			} else if (code === KEYS.LEFT) {
				k.move(-1);
			} else if (code === KEYS.RIGHT) {
				k.move(1);
			} else if (code === KEYS.ENTER) {
				k.choose();
			} else if ((KEYS.MENU !== undefined && code === KEYS.MENU) || code === 10135 || code === 93) {
				k.toggleFav();
			} else if (code === 36 || code === KEYS.PLAY) {
				k.backToNow();
			} else {
				handled = false;
			}
			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		window.addEventListener('keydown', onKey, true);
		return () => window.removeEventListener('keydown', onKey, true);
	}, []);

	// Lignes affichées : une fenêtre qui garde la sélection à l'écran.
	const first = Math.max(0, Math.min(row - 2, channels.length - ROWS));
	const visible = channels.slice(first, first + ROWS);
	const live = selected && selected.s <= nowSec && nowSec < selected.e;
	const past = selected && selected.e <= nowSec;
	const nowPct = ((nowSec - win) / SPAN) * 100;
	const marks = [0, 1, 2, 3, 4].map((i) => win + i * 1800);
	const awayFromNow = win !== halfHour(nowSec);

	return (
		<div className={css.guide} style={{background: '#0B0B0D'}}>
			<div className={css.info}>
				<div className={css.infoText}>
					<div className={css.infoHead}>
						<span className={css.infoTitle} style={{color: C.ink}}>{$L('Grille')}</span>
						{categoryLabel ? <span className={css.infoCat} style={{color: C.mute}}>{categoryLabel}</span> : null}
						<span className={css.infoDay} style={{color: C.faint}}>{dayName(win, nowSec)}</span>
					</div>
					{channel ? (
						<div className={css.infoProgram} style={{color: C.ink}}>
							{selected ? selected.t : `${channel.name} · ${$L('pas de programme annoncé')}`}
						</div>
					) : null}
					{selected ? (
						<div className={css.infoMeta}>
							{live || (past && channel.arc > 0) ? (
								<span
									className={css.badge}
									style={{background: live ? C.live : 'rgba(229, 162, 58, 0.2)', color: live ? '#FFFFFF' : C.accent}}
								>
									{live ? $L('EN DIRECT') : $L('REPLAY')}
								</span>
							) : null}
							<span style={{color: C.mute}}>
								{[`${channel.num || ''} ${channel.name}`, `${dayName(selected.s, nowSec)} ${range(selected)}`, selected.c, selected.st]
									.filter(Boolean).join('  ·  ')}
							</span>
						</div>
					) : null}
					{selected && selected.d ? <div className={css.infoDesc} style={{color: C.mute}}>{selected.d}</div> : null}
				</div>
				<div className={css.infoSide}>
					<div className={css.infoClock} style={{color: C.ink}}>{clock(nowSec)}</div>
					<div className={css.infoHint} style={{color: C.faint}}>
						{selected && selected.s > nowSec ? $L('OK enregistrer · MENU favori') : $L('OK regarder · MENU favori')}
					</div>
					{awayFromNow ? <div className={css.infoHint} style={{color: C.faint}}>{$L('Lecture : revenir à maintenant')}</div> : null}
				</div>
			</div>

			<div className={css.timeline}>
				{marks.map((m) => (
					<span key={m} className={css.mark} style={{left: ((m - win) / SPAN) * 100 + '%', color: C.mute}}>{clock(m)}</span>
				))}
			</div>

			<div className={css.rows}>
				{visible.map((ch, k) => {
					const i = first + k;
					const on = i === row;
					const list = progsOf(i);
					return (
						<div key={ch.id} className={css.row}>
							<div className={css.chan} style={{background: on ? C.rowOn : C.row}}>
								<span className={css.chanNum} style={{color: C.mute}}>{ch.num || ''}</span>
								<span className={css.chanLogo}>{ch.logo ? <img src={ch.logo} alt="" /> : null}</span>
								<span className={css.chanName} style={{color: C.ink}}>{ch.name}</span>
								{isMaTvFavorite(ch.id) ? <span style={{color: C.accent}}>★</span> : null}
							</div>
							<div className={css.cells}>
								{list.length === 0 ? (
									<div
										className={css.cell}
										style={{left: 0, width: '100%', background: C.row, borderColor: on ? C.ink : 'transparent', color: C.faint}}
									>
										{$L('Pas de programme annoncé')}
									</div>
								) : null}
								{list.map((p) => {
									const box = cellBox(p, win);
									if (!box) return null;
									const isSel = on && selected && p.s === selected.s;
									const pLive = p.s <= nowSec && nowSec < p.e;
									const pPast = p.e <= nowSec;
									const rec = !pPast && recordingOf(recs, ch.id, p.s);
									const bg = isSel ? C.ink : pLive ? 'rgba(237, 235, 230, 0.14)' : pPast ? 'rgba(237, 235, 230, 0.04)' : C.row;
									return (
										<div
											key={`${p.s}-${p.t}`}
											className={css.cell}
											style={{left: box.left + '%', width: `calc(${box.width}% - 0.25rem)`, background: bg}}
										>
											<div className={css.cellTitle} style={{color: isSel ? '#000' : pPast ? C.mute : C.ink}}>
												{rec ? <span style={{color: C.live}}>● </span> : null}
												{pPast && ch.arc > 0 ? <span style={{color: isSel ? 'rgba(0,0,0,0.55)' : C.mute}}>↺ </span> : null}
												{p.t}
											</div>
											{box.width > 14 ? (
												<div className={css.cellTime} style={{color: isSel ? 'rgba(0,0,0,0.55)' : C.faint}}>{range(p)}</div>
											) : null}
										</div>
									);
								})}
								{nowPct >= 0 && nowPct <= 100 ? (
									<div className={css.nowLine} style={{left: nowPct + '%', background: C.live}} />
								) : null}
							</div>
						</div>
					);
				})}
			</div>

			{dialog ? (
				<RecordDialog
					title={dialog.prog.t}
					subtitle={`${dialog.channel.name} · ${dayName(dialog.prog.s, nowSec)} ${range(dialog.prog)}`}
					choices={dialog.choices}
					selected={dialog.selected}
				/>
			) : null}
			{toast ? <div className={css.toast} style={{background: C.panel, color: C.ink}}>{toast}</div> : null}
		</div>
	);
};

export default MaTvGuide;
