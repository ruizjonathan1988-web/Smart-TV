// Calculs et mises en forme de la console d'admin, repris de l'APK :
// tailles, durées, « il y a », tranches du journal d'activité, mode de
// lecture d'une session, comparaison de versions de plugins, déclencheurs des
// tâches planifiées. Sans texte en dur : les libellés viennent de `t`.

export const TICKS_PER_SECOND = 10000000;
export const TICKS_PER_MS = 10000;

const pad2 = (n) => (n < 10 ? '0' + n : String(n));

// 1536 → « 1,5 Ko » (unités françaises, base 1024 comme l'APK).
export const formatBytes = (bytes) => {
	const n = Number(bytes);
	if (!isFinite(n) || n < 0) return '';
	const units = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
	let v = n;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	const digits = i === 0 || v >= 100 ? 0 : 1;
	return `${v.toFixed(digits).replace('.', ',')} ${units[i]}`;
};

// Durée en ticks → « 1 h 02 min », « 3 min 05 s », « 12 s ».
export const formatDuration = (ms) => {
	const total = Math.max(0, Math.round(Number(ms) / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h) return `${h} h ${pad2(m)} min`;
	if (m) return `${m} min ${pad2(s)} s`;
	return `${s} s`;
};

export const ticksToMs = (ticks) => Number(ticks || 0) / TICKS_PER_MS;

// Position d'une lecture « 1:02:03 / 1:45:00 ».
export const formatClock = (ms) => {
	const total = Math.max(0, Math.floor(Number(ms) / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
};

export const formatDateTime = (value) => {
	if (!value) return '';
	const d = new Date(value);
	if (isNaN(d.getTime())) return '';
	return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const formatDate = (value) => {
	if (!value) return '';
	const d = new Date(value);
	if (isNaN(d.getTime())) return '';
	return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// La tranche d'une entrée du journal (activityBucketLabel).
export const activityBucket = (date, now = Date.now()) => {
	const d = new Date(date);
	const diff = now - d.getTime();
	if (diff < 5 * 60000) return 'adminActivityJustNow';
	if (diff < 60 * 60000) return 'adminActivityLastHour';
	const ref = new Date(now);
	const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
	const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	if (day >= today) return 'adminActivityToday';
	if (diff < 2 * 86400000) return 'adminActivityYesterday';
	return 'adminActivityOlder';
};

// Les entrées entrecoupées de leurs titres de tranche (buildActivityListItems).
export const groupActivity = (entries, now = Date.now()) => {
	const out = [];
	let last = null;
	(entries || []).forEach((e) => {
		const bucket = activityBucket(e.Date, now);
		if (bucket !== last) {
			out.push({bucket});
			last = bucket;
		}
		out.push({entry: e});
	});
	return out;
};

// « il y a » compact : clé et paramètres (activityTimeAgo).
export const timeAgo = (date, now = Date.now()) => {
	const d = new Date(date);
	const diff = now - d.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);
	if (minutes < 1) return {key: 'adminActivityNow'};
	if (minutes < 60) return {key: 'adminActivityMinutesShort', params: {minutes}};
	if (hours < 24) return {key: 'adminActivityHoursShort', params: {hours}};
	if (days < 7) return {key: 'adminActivityDaysShort', params: {days}};
	return {key: 'adminActivityDateShort', params: {day: d.getDate(), month: d.getMonth() + 1}};
};

// Le mode de lecture d'une session (active_sessions_card.dart).
export const playMethodOf = (session) => {
	if (!session || !session.NowPlayingItem) return null;
	const tr = session.TranscodingInfo;
	const videoDirect = tr && tr.IsVideoDirect === true;
	if (tr && (videoDirect || tr.VideoCodec == null) && tr.IsAudioDirect === true) {
		return 'Remux';
	}
	const method = session.PlayState && session.PlayState.PlayMethod;
	if (method === 'DirectStream' || method === 'Transcode' || method === 'DirectPlay') return method;
	return 'DirectPlay';
};

// Part utilisée d'un dossier du serveur (StorageInfo.usageFraction).
export const usageFraction = (folder) => {
	if (!folder) return null;
	const used = Number(folder.UsedSpace);
	const free = Number(folder.FreeSpace);
	if (!isFinite(used) || !isFinite(free) || used + free <= 0) return null;
	return used / (used + free);
};

// Compare « 10.9.1.0 » et « 10.10.0 » numériquement (compareVersionStrings).
export const compareVersions = (a, b) => {
	const pa = String(a || '').split(/[.\-+]/).map((x) => parseInt(x, 10));
	const pb = String(b || '').split(/[.\-+]/).map((x) => parseInt(x, 10));
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = isFinite(pa[i]) ? pa[i] : 0;
		const y = isFinite(pb[i]) ? pb[i] : 0;
		if (x !== y) return x > y ? 1 : -1;
	}
	return 0;
};

// La version la plus récente d'un paquet du catalogue, plus récente que celle installée, ou null.
export const updateFor = (plugin, packages) => {
	const pkg = (packages || []).find((p) => p.guid && plugin.Id && p.guid.replace(/-/g, '').toLowerCase() === String(plugin.Id).replace(/-/g, '').toLowerCase());
	if (!pkg || !plugin.Version) return null;
	const newer = (pkg.versions || []).filter((v) => v.version && compareVersions(v.version, plugin.Version) > 0);
	if (!newer.length) return null;
	newer.sort((x, y) => compareVersions(y.version, x.version));
	return {pkg, version: newer[0]};
};

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Ticks depuis minuit → « 03:00 ».
export const ticksToTime = (ticks) => {
	const minutes = Math.floor(Number(ticks || 0) / (60 * TICKS_PER_SECOND));
	return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;
};

export const timeToTicks = (hours, minutes) => ((Number(hours) * 60) + Number(minutes)) * 60 * TICKS_PER_SECOND;

// La description d'un déclencheur : {key, params} (admin_task_detail_screen.dart).
export const describeTrigger = (trigger, dayName) => {
	const type = trigger && trigger.Type;
	if (type === 'DailyTrigger') return {key: 'adminTaskTriggerDaily', params: {time: ticksToTime(trigger.TimeOfDayTicks)}};
	if (type === 'WeeklyTrigger') return {key: 'adminTaskTriggerWeekly', params: {day: dayName ? dayName(trigger.DayOfWeek) : trigger.DayOfWeek, time: ticksToTime(trigger.TimeOfDayTicks)}};
	if (type === 'StartupTrigger') return {key: 'adminTaskTriggerStartup'};
	if (type === 'IntervalTrigger') {
		const minutes = Math.round(Number(trigger.IntervalTicks || 0) / (60 * TICKS_PER_SECOND));
		if (minutes === 60) return {key: 'adminTaskTriggerEveryHour'};
		if (minutes % 60 === 0) return {key: 'adminTaskTriggerEveryHours', params: {hours: minutes / 60}};
		return {key: 'adminTaskTriggerEveryMinutes', params: {minutes}};
	}
	if (type === 'SystemEventTrigger') return {key: 'adminTaskTriggerSystemEvent', params: {event: trigger.SystemEvent || ''}};
	return {key: 'unknown'};
};

// Le débit d'un nombre de bits/s → « 8 Mbit/s ».
export const formatBitrate = (bps) => {
	const n = Number(bps);
	if (!isFinite(n) || n <= 0) return '';
	if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.', ',')} Mbit/s`;
	return `${Math.round(n / 1000)} kbit/s`;
};

// Les adresses publiées (PublishedServerUriBySubnet) : « all=… », ou « internal=… » et « external=… »,
// plus d'autres entrées « sous-réseau=adresse » gardées telles quelles (admin_networking_screen.dart).
export const parsePublished = (entries) => {
	const list = (entries || []).map(String);
	const out = {all: '', internal: '', external: '', other: [], same: true};
	if (list.length === 1 && list[0].indexOf('=') < 0) {
		out.all = list[0];
	} else {
		list.forEach((entry) => {
			const split = entry.indexOf('=');
			const uri = entry.slice(split + 1);
			const key = split < 0 ? '' : entry.slice(0, split);
			if (key === 'all') out.all = uri;
			else if (key === 'internal') out.internal = uri;
			else if (key === 'external') out.external = uri;
			else out.other.push(entry);
		});
	}
	out.same = out.all !== '' || (out.internal === '' && out.external === '');
	return out;
};

export const writePublished = ({same, all, internal, external, other}) => {
	const a = String(all || '').trim();
	const i = String(internal || '').trim();
	const e = String(external || '').trim();
	return [].concat(
		same && a ? [`all=${a}`] : [],
		!same && i ? [`internal=${i}`] : [],
		!same && e ? [`external=${e}`] : [],
		other || []
	);
};
