// Les pages de la console et leurs sous-pages (admin_routes.dart).
import Dashboard from './pages/Dashboard';
import Analytics, {AnalyticsItems} from './pages/Analytics';
import Activity from './pages/Activity';
import Tasks, {TaskDetail} from './pages/Tasks';
import Libraries, {LibraryAdd, LibraryEdit} from './pages/Libraries';
import LiveTv from './pages/LiveTv';
import MetadataEdit from './pages/MetadataEdit';
import {Users, UserAdd, UserEdit, Devices, ApiKeys} from './pages/People';
import {Plugins, PluginDetail, Repositories, Backups, Logs, LogViewer} from './pages/System';
import {
	Display, LibraryMetadata, Nfo, Transcoding, Resume, Streaming, Trickplay, General, Branding, Networking
} from './pages/SettingsPages';

export const PAGES = {
	dashboard: Dashboard,
	analytics: Analytics,
	activity: Activity,
	tasks: Tasks,
	libraries: Libraries,
	display: Display,
	metadata: LibraryMetadata,
	nfo: Nfo,
	livetv: LiveTv,
	transcoding: Transcoding,
	resume: Resume,
	streaming: Streaming,
	trickplay: Trickplay,
	users: Users,
	devices: Devices,
	keys: ApiKeys,
	settings: General,
	branding: Branding,
	networking: Networking,
	plugins: Plugins,
	repositories: Repositories,
	backups: Backups,
	logs: Logs
};

export const SCREENS = {
	analyticsItems: AnalyticsItems,
	activity: Activity,
	taskDetail: TaskDetail,
	libraryAdd: LibraryAdd,
	libraryEdit: LibraryEdit,
	metadataEdit: MetadataEdit,
	userAdd: UserAdd,
	userEdit: UserEdit,
	pluginDetail: PluginDetail,
	logViewer: LogViewer
};
