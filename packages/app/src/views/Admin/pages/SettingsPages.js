// Les pages de réglages qui éditent un objet de configuration du serveur :
// Affichage, Métadonnées, NFO (groupe Bibliothèque) ; Transcodage, Reprise,
// Streaming, Trickplay (groupe Lecture) ; Paramètres, Image de marque, Réseau
// (groupe Système). Champs, sections et conditions repris des écrans de l'APK.
import {useState, useCallback, useEffect} from 'react';

import {useAdmin} from '../adminContext';
import {DraftForm, localizationOptions} from '../AdminForm';
import {Section, Row, SwitchRow, TextRow, InfoRow, Confirm, Note, css} from '../AdminUi';
import {t} from '../adminText';
import {describeAdminError} from '../../../services/adminApi';
import {parsePublished, writePublished} from '../../../services/adminFormat';

// Une cible de brouillon pour une configuration nommée (/System/Configuration/{key}).
const named = (api, key, value, post) => ({
	value,
	reload: () => api.getNamedConfiguration(key),
	post: post || ((v) => api.updateNamedConfiguration(key, v))
});
const main = (api, value) => ({value, reload: () => api.getServerConfiguration(), post: (v) => api.updateServerConfiguration(v)});

const opts = (pairs) => pairs.map(([value, label]) => ({value, label}));
const has = (cfg, key) => Object.prototype.hasOwnProperty.call(cfg || {}, key);

// ----------------------------------------------------------------- Bibliothèque › Affichage
const displayPage = {
	title: t('adminLibDisplayTitle'),
	load: async (api) => {
		const [config, metadata] = await Promise.all([api.getServerConfiguration(), api.getNamedConfiguration('metadata')]);
		return {targets: {main: main(api, config), metadata: named(api, 'metadata', metadata)}};
	},
	sections: () => [
		{id: 'date', title: t('adminLibDateAddedSection'), rows: [
			{kind: 'select', target: 'metadata', key: 'UseFileCreationTimeForDateAdded', label: t('adminLibDateAddedLabel'), fallback: true,
				options: [{value: false, label: t('adminLibDateAddedImport')}, {value: true, label: t('adminLibDateAddedFile')}]}
		]},
		{id: 'display', title: t('adminLibDisplaySection'), rows: [
			{kind: 'switch', key: 'EnableFolderView', label: t('adminLibFolderView')},
			{kind: 'switch', key: 'DisplaySpecialsWithinSeasons', label: t('adminLibSpecialsInSeasons'), fallback: true},
			{kind: 'switch', key: 'EnableGroupingMoviesIntoCollections', label: t('adminLibGroupMovies')},
			{kind: 'switch', key: 'EnableGroupingShowsIntoCollections', label: t('adminLibGroupShows')},
			{kind: 'switch', key: 'EnableExternalContentInSuggestions', label: t('adminLibExternalSuggestions'), fallback: true}
		]}
	]
};
export const Display = () => <DraftForm page={displayPage} />;

// ----------------------------------------------------------------- Bibliothèque › Métadonnées
const RESOLUTIONS = [['MatchSource', null], ['P144', '144p'], ['P240', '240p'], ['P360', '360p'], ['P480', '480p'], ['P720', '720p'], ['P1080', '1080p'], ['P1440', '1440p'], ['P2160', '2160p']];

const metadataPage = {
	title: t('adminLibMetadataTitle'),
	load: async (api) => {
		const [config, cultures, countries] = await Promise.all([
			api.getServerConfiguration(),
			api.getCultures().catch(() => []),
			api.getCountries().catch(() => [])
		]);
		return {targets: {main: main(api, config)}, extra: {cultures, countries}};
	},
	sections: (draft, extra) => {
		const cfg = draft.working();
		return [
			{id: 'lang', title: t('adminLibMetadataLangSection'), rows: [
				{kind: 'select', key: 'PreferredMetadataLanguage', label: t('adminGeneralMetadataLanguage'), read: (c) => c.PreferredMetadataLanguage || '',
					options: localizationOptions(extra.cultures, cfg.PreferredMetadataLanguage, (c) => c.TwoLetterISOLanguageName || c.ThreeLetterISOLanguageName, (c) => c.DisplayName || c.Name)},
				{kind: 'select', key: 'MetadataCountryCode', label: t('adminGeneralMetadataCountry'), read: (c) => c.MetadataCountryCode || '',
					options: localizationOptions(extra.countries, cfg.MetadataCountryCode, (c) => c.TwoLetterISORegionName || c.Name, (c) => c.DisplayName || c.Name)}
			]},
			{id: 'chapters', title: t('adminLibChaptersSection'), rows: [
				{kind: 'number', key: 'DummyChapterDuration', label: t('adminLibDummyChapterDuration'), help: t('adminLibDummyChapterDurationHint'), min: 0, empty: 0},
				{kind: 'select', key: 'ChapterImageResolution', label: t('adminLibChapterImageResolution'), fallback: 'MatchSource',
					options: RESOLUTIONS.map(([v, l]) => ({value: v, label: l || t('adminLibChapterImageResolutionMatchSource')}))}
			]}
		];
	}
};
export const LibraryMetadata = () => <DraftForm page={metadataPage} />;

// ----------------------------------------------------------------- Bibliothèque › NFO
const nfoPage = {
	title: t('adminLibNfoTitle'),
	subtitle: t('adminLibNfoHelp'),
	load: async (api) => {
		const [config, users] = await Promise.all([api.getNamedConfiguration('xbmcmetadata'), api.getUsers().catch(() => [])]);
		return {
			targets: {main: named(api, 'xbmcmetadata', config, (value) => {
				if (!value.ReleaseDateFormat) value.ReleaseDateFormat = 'yyyy-MM-dd';
				return api.updateNamedConfiguration('xbmcmetadata', value);
			})},
			extra: {users}
		};
	},
	sections: (draft, extra) => [
		{id: 'nfo', title: t('adminDrawerNfo'), rows: [
			{kind: 'select', key: 'UserId', label: t('adminLibKodiUser'),
				read: (c) => (extra.users.some((u) => u.Id === c.UserId) ? c.UserId : ''),
				options: [{value: '', label: t('adminLibNone')}].concat(extra.users.map((u) => ({value: u.Id, label: u.Name})))},
			{kind: 'switch', key: 'SaveImagePathsInNfo', label: t('adminLibSaveImagePaths')},
			{kind: 'switch', key: 'EnablePathSubstitution', label: t('adminLibPathSubstitution')},
			{kind: 'switch', key: 'EnableExtraThumbsDuplication', label: t('adminLibExtraThumbs')}
		]}
	],
	footer: () => <Note>{t('adminLibMetadataChangeHelp')}</Note>
};
export const Nfo = () => <DraftForm page={nfoPage} />;

// ----------------------------------------------------------------- Lecture › Transcodage
const HW_ACCEL = [['none', null], ['amf', 'AMD AMF'], ['nvenc', 'Nvidia NVENC'], ['qsv', 'Intel Quicksync (QSV)'], ['vaapi', 'Video Acceleration API (VAAPI)'], ['rkmpp', 'Rockchip MPP (RKMPP)'], ['videotoolbox', 'Apple VideoToolBox'], ['v4l2m2m', 'Video4Linux2 (V4L2)']];
const HW_DECODE = [
	['h264', 'H.264', ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox', 'v4l2m2m']],
	['hevc', 'HEVC', ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox']],
	['mpeg1video', 'MPEG-1', ['rkmpp']],
	['mpeg2video', 'MPEG-2', ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp']],
	['mpeg4', 'MPEG-4', ['nvenc', 'rkmpp']],
	['vc1', 'VC-1', ['amf', 'nvenc', 'qsv', 'vaapi']],
	['vp8', 'VP8', ['nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox']],
	['vp9', 'VP9', ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox']],
	['av1', 'AV1', ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox']]
];
const TEN_BIT = ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp'];
const REXT = ['nvenc', 'qsv', 'vaapi'];
const HWA = ['amf', 'nvenc', 'qsv', 'vaapi', 'rkmpp', 'videotoolbox'];
const TONEMAP_ALGOS = opts([['none', 'None'], ['clip', 'Clip'], ['linear', 'Linear'], ['gamma', 'Gamma'], ['reinhard', 'Reinhard'], ['hable', 'Hable'], ['mobius', 'Mobius'], ['bt2390', 'BT.2390']]);
const TONEMAP_MODES = opts([['auto', 'Auto'], ['max', 'Max'], ['rgb', 'RGB'], ['lum', 'Luminance'], ['itp', 'ITP']]);
const TONEMAP_RANGES = opts([['auto', 'Auto'], ['tv', 'TV'], ['pc', 'PC']]);
const PRESETS = ['veryslow', 'slower', 'slow', 'medium', 'fast', 'faster', 'veryfast', 'superfast', 'ultrafast'];
const DEINTERLACE = opts([['yadif', 'YADIF'], ['bwdif', 'BWDIF']]);
const DOWNMIX = opts([['None', 'None'], ['Dave750', 'Dave750'], ['NightmodeDialogue', 'Nightmode Dialogue'], ['Rfc7845', 'RFC 7845'], ['Ac4', 'AC-4']]);

// Une liste déroulante qui garde une valeur inconnue enregistrée sur le serveur.
const keepUnknown = (options, current) => (current !== undefined && current !== null && current !== '' && !options.some((o) => o.value === current) ? options.concat([{value: current, label: String(current)}]) : options);

const transcodingPage = {
	title: t('adminDrawerTranscoding'),
	loadFailed: 'adminPlaybackLoadFailed',
	load: async (api) => {
		const config = await api.getNamedConfiguration('encoding');
		return {targets: {main: named(api, 'encoding', config)}};
	},
	sections: (draft) => {
		const cfg = draft.working();
		const accel = cfg.HardwareAccelerationType ? String(cfg.HardwareAccelerationType) : 'none';
		const isHwa = HWA.indexOf(accel) >= 0;
		const qsvOrVaapi = accel === 'qsv' || accel === 'vaapi';
		const codecs = HW_DECODE.filter((c) => c[2].indexOf(accel) >= 0);
		const sel = (key, labelKey, options, extra) => ({kind: 'select', key, label: t(labelKey), options: keepUnknown(options, cfg[key]), ...extra});
		const num = (key, labelKey, fallback, extra) => ({kind: 'number', key, label: t(labelKey), fallback, ...extra});
		const sw = (key, labelKey, extra) => ({kind: 'switch', key, label: t(labelKey), ...extra});
		const tone = [];
		if (qsvOrVaapi) {
			tone.push(sw('EnableVppTonemapping', 'adminPlaybackEnableVppTonemapping'));
			tone.push(num('VppTonemappingBrightness', 'adminPlaybackVppTonemappingBrightness', 16, {max: 100, decimals: 2}));
			tone.push(num('VppTonemappingContrast', 'adminPlaybackVppTonemappingContrast', 1, {min: 1, max: 2, decimals: 2}));
		}
		if (accel === 'videotoolbox') tone.push(sw('EnableVideoToolboxTonemapping', 'adminPlaybackEnableVtTonemapping'));
		if (accel === 'none' || isHwa) {
			if (isHwa) tone.push(sw('EnableTonemapping', 'adminPlaybackEnableTonemapping'));
			tone.push(sel('TonemappingAlgorithm', 'adminPlaybackTonemappingAlgorithm', TONEMAP_ALGOS));
			if (isHwa) tone.push(sel('TonemappingMode', 'adminPlaybackTonemappingMode', TONEMAP_MODES));
			tone.push(sel('TonemappingRange', 'adminPlaybackTonemappingRange', TONEMAP_RANGES));
			tone.push(num('TonemappingDesat', 'adminPlaybackTonemappingDesat', 0, {decimals: 2}));
			tone.push(num('TonemappingPeak', 'adminPlaybackTonemappingPeak', 100, {decimals: 2}));
			tone.push(num('TonemappingParam', 'adminPlaybackTonemappingParam', 0, {decimals: 2}));
		}
		const threads = [{value: -1, label: t('adminPlaybackAutoOption')}];
		for (let i = 1; i <= 16; i++) threads.push({value: i, label: String(i)});
		threads.push({value: 0, label: t('adminTranscodingThreadMax')});
		return [
			{id: 'hw', title: t('adminPlaybackHwAccel'), rows: [
				{kind: 'select', key: 'HardwareAccelerationType', label: t('adminPlaybackHwAccelLabel'), read: () => accel,
					options: HW_ACCEL.map(([v, l]) => ({value: v, label: l || t('none')}))},
				accel !== 'none' ? {kind: 'info', id: 'warn', label: t('adminPlaybackHwAccelWarning')} : null,
				accel === 'vaapi' ? {kind: 'text', key: 'VaapiDevice', label: t('adminPlaybackVaapiDevice'), placeholder: '/dev/dri/renderD128'} : null,
				accel === 'qsv' ? {kind: 'text', key: 'QsvDevice', label: t('adminPlaybackQsvDevice')} : null,
				accel !== 'none' && codecs.length ? {kind: 'multi', key: 'HardwareDecodingCodecs', label: t('adminTranscodingDecodingFor'), options: codecs.map((c) => ({value: c[0], label: c[1]}))} : null,
				TEN_BIT.indexOf(accel) >= 0 ? sw('EnableDecodingColorDepth10Hevc', 'adminPlaybackColorDepth10Hevc') : null,
				TEN_BIT.indexOf(accel) >= 0 ? sw('EnableDecodingColorDepth10Vp9', 'adminPlaybackColorDepth10Vp9') : null,
				REXT.indexOf(accel) >= 0 ? sw('EnableDecodingColorDepth10HevcRext', 'adminPlaybackColorDepth10HevcRext') : null,
				REXT.indexOf(accel) >= 0 ? sw('EnableDecodingColorDepth12HevcRext', 'adminPlaybackColorDepth12HevcRext') : null,
				accel === 'nvenc' ? sw('EnableEnhancedNvdecDecoder', 'adminPlaybackEnhancedNvdec') : null,
				accel === 'qsv' ? sw('PreferSystemNativeHwDecoder', 'adminPlaybackPreferNativeDecoder') : null
			]},
			accel !== 'none' ? {id: 'hwenc', title: t('adminPlaybackHwEncodingSection'), rows: [
				sw('EnableHardwareEncoding', 'adminPlaybackEnableHwEncoding'),
				qsvOrVaapi ? sw('EnableIntelLowPowerH264HwEncoder', 'adminPlaybackIntelLowPowerH264') : null,
				qsvOrVaapi ? sw('EnableIntelLowPowerHevcHwEncoder', 'adminPlaybackIntelLowPowerHevc') : null
			]} : null,
			{id: 'enc', title: t('adminPlaybackEncoding'), rows: [
				sw('AllowHevcEncoding', 'adminPlaybackAllowHevcEncoding'),
				sw('AllowAv1Encoding', 'adminPlaybackAllowAv1Encoding'),
				sel('EncoderPreset', 'adminPlaybackEncoderPreset', [{value: 'auto', label: t('adminPlaybackAutoOption')}].concat(PRESETS.map((p) => ({value: p, label: p}))), {fallback: 'auto'}),
				num('H265Crf', 'adminPlaybackH265Crf', 28, {min: 0, max: 51}),
				num('H264Crf', 'adminPlaybackH264Crf', 23, {min: 0, max: 51}),
				sel('EncodingThreadCount', 'adminPlaybackEncodingThreads', threads, {help: t('adminTranscodingThreadCountHelp'), fallback: -1}),
				sel('DeinterlaceMethod', 'adminPlaybackDeinterlaceMethod', DEINTERLACE),
				sw('DeinterlaceDoubleRate', 'adminPlaybackDeinterlaceDoubleRate')
			]},
			tone.length ? {id: 'tone', title: t('adminPlaybackToneMapping'), rows: tone} : null,
			{id: 'audio', title: t('adminPlaybackAudioSection'), rows: [
				sw('EnableAudioVbr', 'adminPlaybackEnableAudioVbr'),
				num('DownMixAudioBoost', 'adminPlaybackDownmixBoost', 2, {min: 0.5, max: 3, decimals: 2}),
				sel('DownMixStereoAlgorithm', 'adminPlaybackDownmixAlgorithm', DOWNMIX),
				sel('HlsAudioSeekStrategy', 'adminTranscodingAudioSeek', [
					{value: 'TrimCopiedAudio', label: t('adminTranscodingTrimCopiedAudio')},
					{value: 'TranscodeAudio', label: t('adminTranscodingTranscodeAudio')}
				], {help: t('adminTranscodingAudioSeekHelp')}),
				num('MaxMuxingQueueSize', 'adminPlaybackMaxMuxingQueue', 2048, {min: 1})
			]},
			{id: 'paths', title: t('adminGeneralSectionPaths'), rows: [
				{kind: 'info', key: 'EncoderAppPathDisplay', label: t('adminTranscodingFfmpegPath'), help: t('adminTranscodingFfmpegPathHelp')},
				{kind: 'path', key: 'TranscodingTempPath', label: t('adminPlaybackTranscodeTempPath')},
				{kind: 'path', key: 'FallbackFontPath', label: t('adminPlaybackFallbackFontPath')},
				sw('EnableFallbackFont', 'adminPlaybackFallbackFont')
			]},
			{id: 'stream', title: t('adminPlaybackStreaming'), rows: [
				sw('EnableSubtitleExtraction', 'adminPlaybackEnableSubtitleExtraction'),
				sw('EnableThrottling', 'adminPlaybackThrottleBuffering'),
				sw('EnableSegmentDeletion', 'adminPlaybackSegmentDeletion'),
				num('ThrottleDelaySeconds', 'adminPlaybackThrottleDelay', 180, {min: 10, max: 3600}),
				num('SegmentKeepSeconds', 'adminPlaybackSegmentKeep', 720, {min: 10, max: 3600})
			]}
		];
	}
};
export const Transcoding = () => <DraftForm page={transcodingPage} />;

// ----------------------------------------------------------------- Lecture › Reprise
const percent = (v) => `${v} %`;
const resumePage = {
	title: t('adminDrawerResume'),
	subtitle: t('adminResumeDescription'),
	loadFailed: 'adminResumeLoadFailed',
	load: async (api) => ({targets: {main: main(api, await api.getServerConfiguration())}}),
	sections: () => [
		{id: 'video', title: t('adminResumeVideo'), rows: [
			{kind: 'slider', key: 'MinResumePct', label: t('adminMinResumePercentage'), help: t('adminMinResumeSubtitle'), min: 0, max: 100, format: percent},
			{kind: 'slider', key: 'MaxResumePct', label: t('adminMaxResumePercentage'), help: t('adminMaxResumeSubtitle'), min: 1, max: 100, format: percent},
			{kind: 'number', key: 'MinResumeDurationSeconds', label: t('adminMinResumeDuration'), help: t('adminMinResumeDurationSubtitle'), fallback: 300, min: 0, empty: 300}
		]},
		{id: 'audiobooks', title: t('adminResumeAudiobooks'), rows: [
			{kind: 'number', key: 'MinAudiobookResume', label: t('adminResumeMinAudiobookMinutes'), help: t('adminResumeMinAudiobookHelp'), fallback: 5, min: 0, max: 100, empty: 5},
			{kind: 'number', key: 'MaxAudiobookResume', label: t('adminResumeAudiobookRemaining'), help: t('adminResumeAudiobookRemainingHelp'), fallback: 5, min: 1, max: 100, empty: 5}
		]}
	]
};
export const Resume = () => <DraftForm page={resumePage} />;

// ----------------------------------------------------------------- Lecture › Streaming
const streamingPage = {
	title: t('adminDrawerStreaming'),
	subtitle: t('adminStreamingDescription'),
	loadFailed: 'adminStreamingLoadFailed',
	load: async (api) => ({targets: {main: main(api, await api.getServerConfiguration())}}),
	sections: () => [
		{id: 'general', title: t('general'), rows: [
			// Le serveur garde des bits/s dans un entier : 2147,25 Mbit/s au plus ; vide = pas de limite.
			{kind: 'number', key: 'RemoteClientBitrateLimit', label: t('adminStreamingBitrateLimit'), help: t('adminStreamingBitrateLimitHint'), suffix: 'Mbps', decimals: 2, min: 0, max: 2147.25, empty: 0,
				read: (c) => {
					const bps = Number(c.RemoteClientBitrateLimit) || 0;
					return bps ? bps / 1000000 : '';
				},
				write: (c, v) => {
					c.RemoteClientBitrateLimit = Math.trunc((Number(v) || 0) * 1000000);
				}}
		]}
	]
};
export const Streaming = () => <DraftForm page={streamingPage} />;

// ----------------------------------------------------------------- Lecture › Trickplay
const trick = (key) => `TrickplayOptions.${key}`;
const trickplayPage = {
	title: t('adminDrawerTrickplay'),
	subtitle: t('adminTrickplayDescription'),
	loadFailed: 'adminTrickplayLoadFailed',
	load: async (api) => {
		const config = await api.getServerConfiguration();
		if (!config.TrickplayOptions) config.TrickplayOptions = {};
		return {targets: {main: main(api, config)}};
	},
	sections: () => [
		{id: 'hw', title: t('general'), rows: [
			{kind: 'switch', key: trick('EnableHwAcceleration'), label: t('adminTrickplayHwAccel')},
			{kind: 'switch', key: trick('EnableHwEncoding'), label: t('adminTrickplayHwEncoding')},
			{kind: 'switch', key: trick('EnableKeyFrameOnlyExtraction'), label: t('adminTrickplayKeyFrameOnly'), help: t('adminTrickplayKeyFrameOnlySubtitle')},
			{kind: 'select', key: trick('ScanBehavior'), label: t('adminTrickplayScanBehavior'), fallback: 'NonBlocking',
				options: [{value: 'NonBlocking', label: t('adminTrickplayNonBlocking')}, {value: 'Blocking', label: t('adminTrickplayBlocking')}]},
			{kind: 'select', key: trick('ProcessPriority'), label: t('adminTrickplayProcessPriority'), fallback: 'BelowNormal',
				options: [
					{value: 'High', label: t('adminTrickplayPriorityHigh')},
					{value: 'AboveNormal', label: t('adminTrickplayPriorityAboveNormal')},
					{value: 'Normal', label: t('adminTrickplayPriorityNormal')},
					{value: 'BelowNormal', label: t('adminTrickplayPriorityBelowNormal')},
					{value: 'Idle', label: t('adminTrickplayPriorityIdle')}
				]}
		]},
		{id: 'img', title: t('adminTrickplayImageSettings'), rows: [
			{kind: 'number', key: trick('Interval'), label: t('adminTrickplayInterval'), help: t('adminTrickplayIntervalSubtitle'), min: 1, fallback: 10000, empty: 10000},
			{kind: 'list', key: trick('WidthResolutions'), label: t('adminTrickplayWidthResolutions'), help: t('adminTrickplayWidthResolutionsHint'), numeric: true},
			{kind: 'number', key: trick('TileWidth'), label: t('adminTrickplayTileWidth'), min: 1, fallback: 10, empty: 10},
			{kind: 'number', key: trick('TileHeight'), label: t('adminTrickplayTileHeight'), min: 1, fallback: 10, empty: 10}
		]},
		{id: 'quality', title: t('adminTrickplayQuality'), rows: [
			{kind: 'slider', key: trick('Qscale'), label: t('adminTrickplayQScale'), help: t('adminTrickplayQScaleSubtitle'), min: 2, max: 31, fallback: 4},
			{kind: 'slider', key: trick('JpegQuality'), label: t('adminTrickplayJpegQuality'), min: 1, max: 100, fallback: 90}
		]},
		{id: 'proc', title: t('adminTrickplayProcessing'), rows: [
			{kind: 'number', key: trick('ProcessThreads'), label: t('adminTrickplayProcessThreads'), help: t('adminPlaybackAutomatic'), min: 0, fallback: 1, empty: 1}
		]}
	]
};
export const Trickplay = () => <DraftForm page={trickplayPage} />;

// ----------------------------------------------------------------- Système › Paramètres
const generalPage = {
	title: t('adminGeneralSettingsTitle'),
	load: async (api) => {
		const [config, cultures, countries, localization] = await Promise.all([
			api.getServerConfiguration(),
			api.getCultures().catch(() => []),
			api.getCountries().catch(() => []),
			api.getLocalizationOptions().catch(() => [])
		]);
		return {targets: {main: main(api, config)}, extra: {cultures, countries, localization}};
	},
	sections: (draft, extra) => {
		const cfg = draft.working();
		const lang = extra.cultures.length ? {kind: 'select', key: 'PreferredMetadataLanguage', label: t('adminGeneralMetadataLanguage'), read: (c) => c.PreferredMetadataLanguage || '',
			options: localizationOptions(extra.cultures, cfg.PreferredMetadataLanguage, (c) => c.TwoLetterISOLanguageName || c.ThreeLetterISOLanguageName, (c) => c.DisplayName || c.Name)}
			: {kind: 'text', key: 'PreferredMetadataLanguage', label: t('adminGeneralMetadataLanguage'), placeholder: t('adminGeneralMetadataLanguageHint')};
		const country = extra.countries.length ? {kind: 'select', key: 'MetadataCountryCode', label: t('adminGeneralMetadataCountry'), read: (c) => c.MetadataCountryCode || '',
			options: localizationOptions(extra.countries, cfg.MetadataCountryCode, (c) => c.TwoLetterISORegionName || c.Name, (c) => c.DisplayName || c.Name)}
			: {kind: 'text', key: 'MetadataCountryCode', label: t('adminGeneralMetadataCountry'), placeholder: t('adminGeneralMetadataCountryHint')};
		const ui = extra.localization.length ? {kind: 'select', key: 'UICulture', label: t('adminGeneralDisplayLanguage'), read: (c) => c.UICulture || '',
			options: localizationOptions(extra.localization, cfg.UICulture, (o) => o.Value, (o) => o.Name || o.Value)}
			: {kind: 'text', key: 'UICulture', label: t('adminGeneralDisplayLanguage')};
		return [
			{id: 'server', title: t('adminGeneralSectionServer'), rows: [
				{kind: 'text', key: 'ServerName', label: t('adminGeneralServerName')},
				ui,
				has(cfg, 'QuickConnectAvailable') ? {kind: 'switch', key: 'QuickConnectAvailable', label: t('adminGeneralQuickConnect')} : null
			]},
			has(cfg, 'IsInMaintenanceMode') ? {id: 'maint', title: t('adminGeneralSectionMaintenance'), rows: [
				{kind: 'switch', key: 'IsInMaintenanceMode', label: t('adminGeneralMaintenanceMode'), help: t('adminGeneralMaintenanceModeHelp')},
				cfg.IsInMaintenanceMode ? {kind: 'text', key: 'MaintenanceModeMessage', label: t('adminGeneralMaintenanceMessage'), help: t('adminGeneralMaintenanceMessageHelp')} : null
			]} : null,
			{id: 'meta', title: t('adminGeneralSectionMetadata'), rows: [lang, country]},
			{id: 'paths', title: t('adminGeneralSectionPaths'), rows: [
				{kind: 'path', key: 'CachePath', label: t('adminGeneralCachePath')},
				{kind: 'path', key: 'MetadataPath', label: t('adminGeneralMetadataPath')}
			]},
			{id: 'perf', title: t('adminGeneralSectionPerformance'), rows: [
				has(cfg, 'LibraryScanFanoutConcurrency') ? {kind: 'number', key: 'LibraryScanFanoutConcurrency', label: t('adminGeneralLibraryScanConcurrency'), min: 0, empty: 0} : null,
				has(cfg, 'ParallelImageEncodingLimit') ? {kind: 'number', key: 'ParallelImageEncodingLimit', label: t('adminGeneralImageEncodingLimit'), min: 0, empty: 0} : null,
				has(cfg, 'EnableSlowResponseWarning') ? {kind: 'switch', key: 'EnableSlowResponseWarning', label: t('adminGeneralEnableSlowResponse')} : null,
				has(cfg, 'SlowResponseThresholdMs') ? {kind: 'number', key: 'SlowResponseThresholdMs', label: t('adminGeneralSlowResponseThreshold'), min: 0, fallback: 500, empty: 500, disabled: !cfg.EnableSlowResponseWarning} : null
			]}
		];
	}
};
export const General = () => <DraftForm page={generalPage} />;

// ----------------------------------------------------------------- Système › Image de marque
const SplashSection = () => {
	const {api, toast} = useAdmin();
	const [version, setVersion] = useState(Date.now());
	const [enabled, setEnabled] = useState(null);
	const [saving, setSaving] = useState(false);
	const [confirm, setConfirm] = useState(false);
	useEffect(() => {
		api.getNamedConfiguration('branding').then((c) => setEnabled(!!c.SplashscreenEnabled), () => setEnabled(false));
	}, [api]);
	// Enregistré tout de suite, comme dans l'APK.
	const handleToggle = useCallback(async (v) => {
		setEnabled(v);
		setSaving(true);
		try {
			const fresh = await api.getNamedConfiguration('branding');
			fresh.SplashscreenEnabled = v;
			await api.updateNamedConfiguration('branding', fresh);
		} catch (e) {
			setEnabled(!v);
			toast(t('adminSettingsSaveFailed', {error: describeAdminError(e)}));
		} finally {
			setSaving(false);
		}
	}, [api, toast]);
	const handleAskDelete = useCallback(() => setConfirm(true), []);
	const handleClose = useCallback(() => setConfirm(false), []);
	const handleDelete = useCallback(async () => {
		setConfirm(false);
		try {
			await api.deleteSplashscreen();
			setVersion(Date.now());
			toast(t('adminBrandingSplashDeleted'));
		} catch (e) {
			toast(t('adminSettingsSaveFailed', {error: describeAdminError(e)}));
		}
	}, [api, toast]);
	return (
		<Section title={t('adminBrandingSplashSection')}>
			<SwitchRow label={t('adminBrandingEnableSplash')} value={!!enabled} disabled={enabled === null || saving} onChange={handleToggle} />
			<div className={css.btnRow}>
				<img className={css.splash} src={api.splashUrl(version)} alt={t('adminBrandingNoSplash')} />
			</div>
			<Row icon="warning" label={t('tvDeleteSplash')} onClick={handleAskDelete} />
			<InfoRow label={t('adminBrandingSplashUpload')} help={t('tvSplashUploadElsewhere')} />
			<Confirm open={confirm} title={t('tvDeleteSplash')} message={t('tvDeleteSplashConfirm')} confirmLabel={t('delete')} danger onConfirm={handleDelete} onClose={handleClose} />
		</Section>
	);
};

const brandingPage = {
	title: t('adminBrandingTitle'),
	loadFailed: 'adminBrandingLoadFailed',
	load: async (api) => ({targets: {main: named(api, 'branding', await api.getNamedConfiguration('branding'))}}),
	sections: () => [
		{id: 'web', title: t('adminBrandingSectionWebClient'), rows: [
			{kind: 'text', key: 'LoginDisclaimer', label: t('adminBrandingLoginDisclaimer'), help: t('adminBrandingLoginDisclaimerHint'), wide: true},
			{kind: 'text', key: 'CustomCss', label: t('adminBrandingCustomCss'), help: t('adminBrandingCustomCssHint'), wide: true}
		]}
	]
};
export const Branding = () => (
	<div>
		<DraftForm page={brandingPage} />
		<SplashSection />
	</div>
);

// ----------------------------------------------------------------- Système › Réseau
const PUBLISHED = 'PublishedServerUriBySubnet';

const PublishedRows = ({draft}) => {
	const cfg = draft.working();
	const parsed = parsePublished(cfg[PUBLISHED]);
	const write = useCallback((change) => {
		const next = {...parsePublished(draft.working()[PUBLISHED]), ...change};
		draft.set(PUBLISHED, writePublished(next));
	}, [draft]);
	const handleSame = useCallback((v) => write({same: v}), [write]);
	const handleAll = useCallback((v) => write({all: v}), [write]);
	const handleInternal = useCallback((v) => write({internal: v}), [write]);
	const handleExternal = useCallback((v) => write({external: v}), [write]);
	const handleOther = useCallback((v) => write({other: String(v || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean)}), [write]);
	return (
		<>
			<SwitchRow label={t('adminNetworkingSamePublishedUri')} value={parsed.same} onChange={handleSame} />
			{parsed.same ? <TextRow label={t('adminNetworkingPublishedUri')} help={t('adminNetworkingPublishedUriHelp')} value={parsed.all} onChange={handleAll} /> : null}
			{!parsed.same ? <TextRow label={t('adminNetworkingInternalUri')} help={t('adminNetworkingInternalUriHelp')} value={parsed.internal} onChange={handleInternal} /> : null}
			{!parsed.same ? <TextRow label={t('adminNetworkingExternalUri')} help={t('adminNetworkingExternalUriHelp')} value={parsed.external} onChange={handleExternal} /> : null}
			<TextRow label={t('adminNetworkingOtherPublishedUris')} help={t('adminNetworkingOtherPublishedUrisHelp')} placeholder={t('adminNetworkingOtherPublishedUriHint')} value={parsed.other.join(', ')} onChange={handleOther} />
		</>
	);
};

const port = (key, labelKey, helpKey) => ({kind: 'number', key, label: t(labelKey), help: helpKey ? t(helpKey) : undefined, min: 1, max: 65535, fallback: key.indexOf('Https') >= 0 ? 8920 : 8096, empty: key.indexOf('Https') >= 0 ? 8920 : 8096});
const list = (key, labelKey, helpKey) => ({kind: 'list', key, label: t(labelKey), help: t(helpKey)});

const networkingPage = {
	title: t('adminNetworkingTitle'),
	subtitle: t('adminNetworkingRestartWarning'),
	loadFailed: 'adminNetworkingLoadFailed',
	load: async (api) => ({targets: {main: named(api, 'network', await api.getNamedConfiguration('network'))}}),
	sections: () => [
		{id: 'addr', title: t('adminNetworkingSectionServerAddress'), rows: [
			port('InternalHttpPort', 'adminNetworkingLocalHttpPort', 'adminNetworkingLocalHttpPortHelp'),
			{kind: 'switch', key: 'EnableHttps', label: t('adminNetworkingEnableHttps'), help: t('adminNetworkingEnableHttpsHelp')},
			port('InternalHttpsPort', 'adminNetworkingLocalHttpsPort', 'adminNetworkingLocalHttpsPortHelp'),
			{kind: 'text', key: 'BaseUrl', label: t('adminNetworkingBaseUrl'), help: t('adminNetworkingBaseUrlHelp'), placeholder: t('adminNetworkingBaseUrlHint')},
			list('LocalNetworkAddresses', 'adminNetworkingBindAddress', 'adminNetworkingBindAddressHelp'),
			list('LocalNetworkSubnets', 'adminNetworkingLocalSubnets', 'adminNetworkingLanNetworksHelp'),
			list('KnownProxies', 'adminNetworkingKnownProxies', 'adminNetworkingKnownProxiesHelp')
		]},
		{id: 'https', title: t('adminNetworkingSectionHttps'), rows: [
			{kind: 'switch', key: 'RequireHttps', label: t('adminNetworkingRequireHttps'), help: t('adminNetworkingRequireHttpsHint')},
			{kind: 'path', key: 'CertificatePath', label: t('adminNetworkingCustomCertPath'), help: t('adminNetworkingCertPathHelp'), includeFiles: true},
			{kind: 'text', key: 'CertificatePassword', label: t('adminNetworkingCertPassword'), help: t('adminNetworkingCertPasswordHelp'), password: true}
		]},
		{id: 'remote', title: t('adminNetworkingSectionRemoteAccess'), rows: [
			{kind: 'switch', key: 'EnableRemoteAccess', label: t('adminNetworkingAllowRemote'), help: t('adminNetworkingAllowRemoteHelp')},
			list('RemoteIPFilter', 'adminNetworkingRemoteIpFilterLabel', 'adminNetworkingRemoteIpFilterHelp'),
			{kind: 'select', key: 'IsRemoteIPFilterBlacklist', label: t('adminNetworkingRemoteIpFilterMode'), fallback: false,
				options: [{value: false, label: t('adminNetworkingWhitelist')}, {value: true, label: t('adminNetworkingBlacklist')}]},
			port('PublicHttpPort', 'adminNetworkingPublicHttpPort', 'adminNetworkingPublicHttpPortHelp'),
			port('PublicHttpsPort', 'adminNetworkingPublicHttpsPort', 'adminNetworkingPublicHttpsPortHelp')
		]},
		{id: 'ip', title: t('adminNetworkingSectionIpProtocols'), rows: [
			{kind: 'switch', key: 'EnableIPv4', label: t('adminNetworkingEnableIpv4')},
			{kind: 'switch', key: 'EnableIPv6', label: t('adminNetworkingEnableIpv6')}
		]},
		{id: 'disc', title: t('adminNetworkingSectionDiscovery'), rows: [
			{kind: 'switch', key: 'AutoDiscovery', label: t('adminNetworkingAutoDiscoveryLabel'), help: t('adminNetworkingAutoDiscoveryHelp')}
		]},
		{id: 'pub', title: t('adminNetworkingSectionFirewall'), custom: (draft) => <PublishedRows draft={draft} />, rows: []}
	]
};
export const Networking = () => <DraftForm page={networkingPage} />;

