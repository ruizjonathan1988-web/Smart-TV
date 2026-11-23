// Tâches planifiées (admin_tasks_screen.dart) et fiche d'une tâche
// (admin_task_detail_screen.dart) : catégories, état et progression en
// direct, dernière exécution, lancer / arrêter, déclencheurs à ajouter ou
// retirer (quotidien, hebdomadaire, intervalle, au démarrage, durée maximale).
import {useState, useCallback, useMemo} from 'react';

import CoreDialog from '../../../components/CoreDialog/CoreDialog';
import {useAdmin, useAdminLoad, usePoll} from '../adminContext';
import {
	PageHeader, Section, Row, InfoRow, Btn, Chip, Progress, Loading, ErrorBox, Tabs, SelectRow, TextRow, Confirm,
	SpottableDiv, Group, css
} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {timeAgo, formatDuration, formatDateTime, describeTrigger, TICKS_PER_SECOND, ticksToTime} from '../../../services/adminFormat';
import {DAYS, dayLabel} from './adminLabels';

const POLL_MS = 2000;
const TICKS_MINUTE = 60 * TICKS_PER_SECOND;
const TICKS_HOUR = 60 * TICKS_MINUTE;

export const resultSuffix = (status) => {
	switch (status) {
		case 'Failed': return t('adminTaskResultFailed');
		case 'Cancelled': return t('adminTaskResultCancelled');
		case 'Aborted': return t('adminTaskResultAborted');
		default: return null;
	}
};

const lastRan = (result) => {
	if (!result) return t('adminTaskNeverRun');
	const ago = timeAgo(result.EndTimeUtc);
	const dur = formatDuration(new Date(result.EndTimeUtc) - new Date(result.StartTimeUtc));
	const suffix = resultSuffix(result.Status);
	return t('adminTaskLastRan', {time: t(ago.key, ago.params), duration: dur}) + (suffix ? ` (${suffix})` : '');
};

const TaskRow = ({task, onOpen, onRun, onStop}) => {
	const handleOpen = useCallback(() => onOpen(task), [onOpen, task]);
	const handleRun = useCallback(() => onRun(task.Id), [onRun, task.Id]);
	const handleStop = useCallback(() => onStop(task.Id), [onStop, task.Id]);
	const running = task.State === 'Running';
	const cancelling = task.State === 'Cancelling';
	return (
		<div className={css.splitRow}>
			<SpottableDiv className={css.splitMain} onClick={handleOpen}>
				<div className={css.rowLabel}>{task.Name}</div>
				<div className={css.rowHelp}>
					{running ? `${t('adminTaskRunning')} ${Math.round(task.CurrentProgressPercentage || 0)} %` : cancelling ? t('adminTaskCancelling') : lastRan(task.LastExecutionResult)}
				</div>
				{running ? <Progress value={task.CurrentProgressPercentage} /> : null}
			</SpottableDiv>
			{running || cancelling ? (
				<Btn small label={t('adminTaskStop')} disabled={cancelling} onClick={handleStop} />
			) : (
				<Btn small label={t('adminTaskRun')} onClick={handleRun} />
			)}
		</div>
	);
};

const useTaskActions = (reload) => {
	const {api, toast} = useAdmin();
	const run = useCallback(async (id) => {
		try {
			await api.startTask(id);
			reload(true);
		} catch (e) {
			toast(t('adminTaskStartFailed', {error: describeAdminError(e)}));
		}
	}, [api, reload, toast]);
	const stop = useCallback(async (id) => {
		try {
			await api.stopTask(id);
			reload(true);
		} catch (e) {
			toast(t('adminTaskStopFailed', {error: describeAdminError(e)}));
		}
	}, [api, reload, toast]);
	return {run, stop};
};

const Tasks = () => {
	const {api, push} = useAdmin();
	const load = useCallback(() => api.getTasks(false), [api]);
	const {status, data, error, reload} = useAdminLoad(load);
	const quiet = useCallback(() => reload(true), [reload]);
	usePoll(quiet, POLL_MS);
	const {run, stop} = useTaskActions(reload);
	const [category, setCategory] = useState('all');
	const handleOpen = useCallback((task) => push('taskDetail', {taskId: task.Id}, task.Name), [push]);

	const grouped = useMemo(() => {
		const g = {};
		(data || []).forEach((task) => {
			const c = task.Category || t('other');
			(g[c] = g[c] || []).push(task);
		});
		Object.keys(g).forEach((c) => g[c].sort((a, b) => a.Name.localeCompare(b.Name)));
		return g;
	}, [data]);
	const categories = Object.keys(grouped).sort();

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminTasksLoadFailed', {error})} onRetry={reload} />;
	const visible = categories.filter((c) => category === 'all' || c === category);
	const tabs = [{id: 'all', label: t('all')}].concat(categories.map((c) => ({id: c, label: c})));
	return (
		<div>
			<PageHeader title={t('adminDrawerScheduledTasks')} subtitle={t('adminPageDescTasks')} />
			{!data.length ? <InfoRow label={t('adminTasksEmpty')} /> : <Tabs tabs={tabs} value={category} onChange={setCategory} />}
			{data.length && !visible.length ? <InfoRow label={t('adminTasksNoFilterMatch')} /> : null}
			{visible.map((c) => (
				<Section key={c} title={c}>
					{grouped[c].map((task) => <TaskRow key={task.Id} task={task} onOpen={handleOpen} onRun={run} onStop={stop} />)}
				</Section>
			))}
		</div>
	);
};

// ----------------------------------------------------------------- fiche d'une tâche
const hoursText = (hours) => (Number.isInteger(hours) ? t('adminTaskTriggerHours', {count: hours}) : t('adminTaskHoursValue', {hours: String(hours).replace('.', ',')}));

const triggerText = (trigger) => {
	const d = describeTrigger(trigger, dayLabel);
	return t(d.key, d.params);
};

const TriggerRow = ({trigger, index, onRemove}) => {
	const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);
	const limit = trigger.MaxRuntimeTicks ? t('adminTimeLimitDuration', {duration: hoursText(trigger.MaxRuntimeTicks / TICKS_HOUR)}) : null;
	if (trigger.Type === 'SystemEventTrigger') return <InfoRow icon="schedule" label={triggerText(trigger)} help={limit} />;
	return <Row icon="schedule" label={triggerText(trigger)} help={limit} value={t('delete')} onClick={handleRemove} />;
};

const INTERVALS = [15, 30, 45].map((m) => m * TICKS_MINUTE).concat([1, 2, 3, 4, 6, 8, 12, 24].map((h) => h * TICKS_HOUR));
const TIMES = [];
for (let m = 0; m < 24 * 60; m += 15) TIMES.push(m * TICKS_MINUTE);

// Heures saisies pour la durée maximale : au moins 1 et par demi-heure.
export const parseTimeLimit = (text) => {
	const s = String(text || '').trim().replace(',', '.');
	if (!s) return {ok: true, hours: null};
	const h = parseFloat(s);
	if (!isFinite(h) || h < 1 || h * 2 !== Math.round(h * 2)) return {ok: false};
	return {ok: true, hours: h};
};

const AddTriggerDialog = ({open, onAdd, onClose}) => {
	const [type, setType] = useState('DailyTrigger');
	const [time, setTime] = useState(0);
	const [day, setDay] = useState('Sunday');
	const [interval, setIntervalTicks] = useState(INTERVALS[0]);
	const [limit, setLimit] = useState('');
	const parsed = parseTimeLimit(limit);
	const handleTime = useCallback((v) => setTime(Number(v)), []);
	const handleInterval = useCallback((v) => setIntervalTicks(Number(v)), []);
	const handleAdd = useCallback(() => {
		const trigger = {Type: type};
		if (type === 'DailyTrigger' || type === 'WeeklyTrigger') trigger.TimeOfDayTicks = time;
		if (type === 'WeeklyTrigger') trigger.DayOfWeek = day;
		if (type === 'IntervalTrigger') trigger.IntervalTicks = interval;
		if (parsed.hours) trigger.MaxRuntimeTicks = Math.round(parsed.hours * TICKS_HOUR);
		onAdd(trigger);
	}, [type, time, day, interval, parsed.hours, onAdd]);
	const types = [
		{value: 'DailyTrigger', label: t('adminTaskTriggerTypeDaily')},
		{value: 'WeeklyTrigger', label: t('adminTaskTriggerTypeWeekly')},
		{value: 'IntervalTrigger', label: t('adminTaskTriggerTypeInterval')},
		{value: 'StartupTrigger', label: t('adminTaskTriggerStartup')}
	];
	const timeOptions = TIMES.map((v) => ({value: v, label: ticksToTime(v)}));
	const dayOptions = DAYS.map((d) => ({value: d, label: dayLabel(d)}));
	const intervalOptions = INTERVALS.map((v) => ({value: v, label: v < TICKS_HOUR ? t('adminTaskMinutesValue', {minutes: v / TICKS_MINUTE}) : t('adminTaskTriggerHours', {count: v / TICKS_HOUR})}));
	return (
		<CoreDialog open={open} onClose={onClose} title={t('adminAddTrigger')} spotlightId="admin-add-trigger">
			<div className={css.dialogBody}>
				<Group className={css.group}>
					<SelectRow label={t('adminTriggerType')} value={type} options={types} onChange={setType} />
					{type === 'WeeklyTrigger' ? <SelectRow label={t('adminDayOfWeek')} value={day} options={dayOptions} onChange={setDay} /> : null}
					{type === 'DailyTrigger' || type === 'WeeklyTrigger' ? <SelectRow label={t('adminTaskTriggerTime')} value={time} options={timeOptions} onChange={handleTime} /> : null}
					{type === 'IntervalTrigger' ? <SelectRow label={t('adminTaskTriggerIntervalLabel')} value={interval} options={intervalOptions} onChange={handleInterval} /> : null}
					<TextRow label={t('adminTimeLimitHours')} placeholder={t('adminNoLimit')} numeric value={limit} onChange={setLimit} />
				</Group>
				<div className={css.dialogActions}>
					<Btn label={t('cancel')} onClick={onClose} />
					<Btn primary label={t('add')} disabled={!parsed.ok} onClick={handleAdd} />
				</div>
			</div>
		</CoreDialog>
	);
};

export const TaskDetail = ({taskId}) => {
	const {api, toast} = useAdmin();
	const load = useCallback(() => api.getTask(taskId), [api, taskId]);
	const {status, data: task, error, reload} = useAdminLoad(load);
	const quiet = useCallback(() => reload(true), [reload]);
	usePoll(quiet, POLL_MS);
	const {run, stop} = useTaskActions(reload);
	const [adding, setAdding] = useState(false);
	const [removing, setRemoving] = useState(null);
	const handleRun = useCallback(() => run(taskId), [run, taskId]);
	const handleStop = useCallback(() => stop(taskId), [stop, taskId]);
	const handleAdd = useCallback(() => setAdding(true), []);
	const handleAddClose = useCallback(() => setAdding(false), []);
	const handleRemoveClose = useCallback(() => setRemoving(null), []);

	const saveTriggers = useCallback(async (triggers, failKey) => {
		try {
			await api.updateTaskTriggers(taskId, triggers);
			reload(true);
		} catch (e) {
			toast(t(failKey, {error: describeAdminError(e)}));
		}
	}, [api, taskId, reload, toast]);
	const handleAdded = useCallback((trigger) => {
		setAdding(false);
		saveTriggers((task.Triggers || []).concat([trigger]), 'adminTriggerAddFailed');
	}, [saveTriggers, task]);
	const handleRemoveConfirm = useCallback(() => {
		const i = removing;
		setRemoving(null);
		saveTriggers((task.Triggers || []).filter((x, j) => j !== i), 'adminTriggerRemoveFailed');
	}, [removing, saveTriggers, task]);

	if (status === 'loading') return <Loading />;
	if (status === 'error') return <ErrorBox message={t('adminTaskLoadFailed', {error})} onRetry={reload} />;
	const running = task.State === 'Running';
	const cancelling = task.State === 'Cancelling';
	const result = task.LastExecutionResult;
	return (
		<div>
			<PageHeader title={task.Name} subtitle={task.Description}>
				{task.Category ? <Chip>{task.Category}</Chip> : null}
			</PageHeader>
			<Section title={t('status')}>
				<InfoRow label={running ? t('adminTaskRunning') : cancelling ? t('adminTaskCancelling') : t('tvTaskIdle')} value={running ? `${(task.CurrentProgressPercentage || 0).toFixed(1).replace('.', ',')} %` : ''} />
				{running ? <Progress value={task.CurrentProgressPercentage} /> : null}
				<div className={css.btnRow}>
					{running || cancelling ? (
						<Btn icon="pause_circle" label={t('adminTaskStop')} disabled={cancelling} onClick={handleStop} />
					) : (
						<Btn primary icon="play_arrow" label={t('adminRunNow')} onClick={handleRun} />
					)}
				</div>
			</Section>
			{result ? (
				<Section title={t('adminTaskDetailLastExecution')}>
					<InfoRow label={t('status')} value={resultSuffix(result.Status) || t('tvTaskCompleted')} />
					<InfoRow label={t('adminTaskDetailStarted')} value={formatDateTime(result.StartTimeUtc)} />
					<InfoRow label={t('adminTaskDetailEnded')} value={formatDateTime(result.EndTimeUtc)} />
					<InfoRow label={t('adminTaskDetailDuration')} value={formatDuration(new Date(result.EndTimeUtc) - new Date(result.StartTimeUtc))} />
					{result.ErrorMessage ? <InfoRow label={t('adminTaskDetailErrorLabel')} help={result.ErrorMessage} /> : null}
				</Section>
			) : null}
			<Section title={t('adminTriggers')}>
				{!(task.Triggers || []).length ? <InfoRow label={t('adminNoTriggers')} /> : null}
				{(task.Triggers || []).map((tr, i) => <TriggerRow key={i} trigger={tr} index={i} onRemove={setRemoving} />)}
				<Row icon="add" label={t('adminAddTrigger')} onClick={handleAdd} />
			</Section>
			<AddTriggerDialog open={adding} onAdd={handleAdded} onClose={handleAddClose} />
			<Confirm
				open={removing !== null}
				title={t('adminDeleteTaskTrigger')}
				message={t('adminDeleteTaskTriggerConfirm')}
				confirmLabel={t('delete')}
				danger
				onConfirm={handleRemoveConfirm}
				onClose={handleRemoveClose}
			/>
		</div>
	);
};

export default Tasks;
