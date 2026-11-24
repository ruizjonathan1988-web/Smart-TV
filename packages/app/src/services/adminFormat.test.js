import {
	formatBytes, formatDuration, formatClock, activityBucket, groupActivity, timeAgo, playMethodOf,
	usageFraction, compareVersions, updateFor, ticksToTime, timeToTicks, describeTrigger, formatBitrate, parsePublished, writePublished
} from './adminFormat';

const NOW = new Date(2026, 10, 23, 14, 0, 0).getTime();

describe('tailles et durées', () => {
	test('octets en unités françaises', () => {
		expect(formatBytes(512)).toBe('512 o');
		expect(formatBytes(1536)).toBe('1,5 Ko');
		expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe('5,0 Go');
		expect(formatBytes(-1)).toBe('');
	});

	test('durées et positions', () => {
		expect(formatDuration(12000)).toBe('12 s');
		expect(formatDuration(185000)).toBe('3 min 05 s');
		expect(formatDuration(3720000)).toBe('1 h 02 min');
		expect(formatClock(3723000)).toBe('1:02:03');
		expect(formatClock(65000)).toBe('1:05');
	});

	test('débit', () => {
		expect(formatBitrate(8000000)).toBe('8,0 Mbit/s');
		expect(formatBitrate(320000)).toBe('320 kbit/s');
		expect(formatBitrate(0)).toBe('');
	});
});

describe('journal d’activité', () => {
	test('tranches', () => {
		expect(activityBucket(NOW - 60000, NOW)).toBe('adminActivityJustNow');
		expect(activityBucket(NOW - 30 * 60000, NOW)).toBe('adminActivityLastHour');
		expect(activityBucket(new Date(2026, 10, 23, 8, 0).getTime(), NOW)).toBe('adminActivityToday');
		expect(activityBucket(new Date(2026, 10, 22, 20, 0).getTime(), NOW)).toBe('adminActivityYesterday');
		expect(activityBucket(new Date(2026, 10, 10).getTime(), NOW)).toBe('adminActivityOlder');
	});

	test('les entrées sous leur titre de tranche', () => {
		const items = groupActivity([{Date: NOW - 1000}, {Date: NOW - 2000}, {Date: NOW - 40 * 60000}], NOW);
		expect(items.map((i) => i.bucket || 'e')).toEqual(['adminActivityJustNow', 'e', 'e', 'adminActivityLastHour', 'e']);
	});

	test('il y a', () => {
		expect(timeAgo(NOW - 10000, NOW)).toEqual({key: 'adminActivityNow'});
		expect(timeAgo(NOW - 5 * 60000, NOW)).toEqual({key: 'adminActivityMinutesShort', params: {minutes: 5}});
		expect(timeAgo(NOW - 3 * 86400000, NOW)).toEqual({key: 'adminActivityDaysShort', params: {days: 3}});
	});
});

describe('sessions et disque', () => {
	test('mode de lecture', () => {
		expect(playMethodOf({})).toBeNull();
		expect(playMethodOf({NowPlayingItem: {}, PlayState: {PlayMethod: 'Transcode'}})).toBe('Transcode');
		expect(playMethodOf({NowPlayingItem: {}, TranscodingInfo: {IsVideoDirect: true, IsAudioDirect: true}, PlayState: {PlayMethod: 'Transcode'}})).toBe('Remux');
		expect(playMethodOf({NowPlayingItem: {}})).toBe('DirectPlay');
	});

	test('remplissage d’un dossier', () => {
		expect(usageFraction({UsedSpace: 75, FreeSpace: 25})).toBe(0.75);
		expect(usageFraction({UsedSpace: 0, FreeSpace: 0})).toBeNull();
		expect(usageFraction(null)).toBeNull();
	});
});

describe('plugins', () => {
	test('versions', () => {
		expect(compareVersions('10.10.0', '10.9.1.0')).toBe(1);
		expect(compareVersions('1.0', '1.0.0.0')).toBe(0);
		expect(compareVersions('2.0.0-beta', '2.0.1')).toBe(-1);
	});

	test('mise à jour disponible', () => {
		const plugin = {Id: 'aaaa-bbbb', Version: '1.0.0.0'};
		const packages = [{guid: 'aaaabbbb', versions: [{version: '1.0.0.0'}, {version: '1.2.0.0'}, {version: '1.1.0.0'}]}];
		expect(updateFor(plugin, packages).version.version).toBe('1.2.0.0');
		expect(updateFor({Id: 'x', Version: '1'}, packages)).toBeNull();
	});
});

describe('déclencheurs', () => {
	test('heures', () => {
		expect(ticksToTime(timeToTicks(3, 30))).toBe('03:30');
	});

	test('descriptions', () => {
		expect(describeTrigger({Type: 'DailyTrigger', TimeOfDayTicks: timeToTicks(2, 0)})).toEqual({key: 'adminTaskTriggerDaily', params: {time: '02:00'}});
		expect(describeTrigger({Type: 'IntervalTrigger', IntervalTicks: 36000000000})).toEqual({key: 'adminTaskTriggerEveryHour'});
		expect(describeTrigger({Type: 'IntervalTrigger', IntervalTicks: 6 * 36000000000})).toEqual({key: 'adminTaskTriggerEveryHours', params: {hours: 6}});
		expect(describeTrigger({Type: 'IntervalTrigger', IntervalTicks: 15 * 600000000})).toEqual({key: 'adminTaskTriggerEveryMinutes', params: {minutes: 15}});
		expect(describeTrigger({Type: 'WeeklyTrigger', DayOfWeek: 'Monday', TimeOfDayTicks: 0}, (d) => d.toLowerCase()).params.day).toBe('monday');
		expect(describeTrigger({Type: 'StartupTrigger'})).toEqual({key: 'adminTaskTriggerStartup'});
	});
});

describe('adresses publiées', () => {
	test('une adresse pour tous', () => {
		expect(parsePublished(['https://jf.example'])).toMatchObject({all: 'https://jf.example', same: true});
		expect(parsePublished(['all=https://a'])).toMatchObject({all: 'https://a', same: true});
	});
	test('interne et externe, autres entrées gardées', () => {
		const p = parsePublished(['internal=http://192.168.1.2', 'external=https://jf.example', '10.0.0.0/8=http://x']);
		expect(p).toMatchObject({same: false, internal: 'http://192.168.1.2', external: 'https://jf.example', other: ['10.0.0.0/8=http://x']});
		expect(writePublished(p)).toEqual(['internal=http://192.168.1.2', 'external=https://jf.example', '10.0.0.0/8=http://x']);
		expect(writePublished({...p, same: true, all: ' https://b '})).toEqual(['all=https://b', '10.0.0.0/8=http://x']);
	});
});
