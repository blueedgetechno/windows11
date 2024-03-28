import { PayloadAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
    RootState,
    appDispatch,
    audio_status,
    close_remote,
    hard_reset,
    popup_close,
    popup_open,
    store,
    toggle_remote,
    video_status
} from '.';
import { RemoteDesktopClient } from '../../../src-tauri/core/app';
import { EventCode } from '../../../src-tauri/core/models/keys.model';
import {
    AddNotifier,
    ConnectionEvent
} from '../../../src-tauri/core/utils/log';
import { isMobile } from '../utils/checking';
import { sleep } from '../utils/sleep';
import { CAUSE } from './fetch/createClient';
import { BuilderHelper } from './helper';

const size = () =>
    client != null
        ? client.video.video.videoHeight * client.video.video.videoWidth
        : 1920 * 1080;
export const MAX_BITRATE = () => (20000 / (1920 * 1080)) * size();
export const MIN_BITRATE = () => (1000 / (1920 * 1080)) * size();
export const MAX_FRAMERATE = 120;
export const MIN_FRAMERATE = 40;
const ADS_RATIO = 2;

export let client: RemoteDesktopClient | null = null;
export const assign = (fun: () => RemoteDesktopClient) => {
    if (client != null) client.Close();
    client = fun();
    client.HandleMetricRaw = async (data) => {};
    client.HandleMetrics = async (metrics) => {
        switch (metrics.type) {
            case 'VIDEO':
                // appDispatch(update_metrics(metrics));
                break;
            case 'FRAME_LOSS':
                if ((store.getState() as RootState).remote.fullscreen) return;

                appDispatch(remoteSlice.actions.framedrop(true));
                await new Promise((r) => setTimeout(r, 100));
                appDispatch(remoteSlice.actions.framedrop(false));
                break;
            default:
                break;
        }
    };
};
export const ready = async () => {
    appDispatch(
        popup_open({
            type: 'notify',
            data: {
                loading: true
            }
        })
    );

    let start = new Date().getTime();
    while (client == null || !client?.ready()) {
        const now = new Date().getTime();
        if (now - start > 60 * 1000) {
            appDispatch(popup_close());
            appDispatch(close_remote());
            throw new Error(
                JSON.stringify({
                    message: 'remote timeout connect to machine',
                    code: CAUSE.REMOTE_TIMEOUT
                })
            );
        }

        await new Promise((r) => setTimeout(r, 1000));
    }

    appDispatch(remoteSlice.actions.internal_sync());
    appDispatch(popup_close());
};

AddNotifier(async (message, text, source) => {
    if (message == ConnectionEvent.WebRTCConnectionClosed)
        source == 'audio'
            ? appDispatch(audio_status('closed'))
            : appDispatch(video_status('closed'));
    if (message == ConnectionEvent.WebRTCConnectionDoneChecking)
        source == 'audio'
            ? appDispatch(audio_status('connected'))
            : appDispatch(video_status('connected'));
    if (message == ConnectionEvent.WebRTCConnectionChecking)
        source == 'audio'
            ? appDispatch(audio_status('connecting'))
            : appDispatch(video_status('connecting'));

    if (message == ConnectionEvent.ApplicationStarted) {
        appDispatch(audio_status('started'));
        appDispatch(video_status('started'));
    }
});

type ConnectStatus =
    | 'not started'
    | 'started'
    | 'connecting'
    | 'connected'
    | 'closed';

export type AuthSessionResp = {
    id: string;
    webrtc: RTCConfiguration;
    signaling: {
        audioUrl: string;
        videoUrl: string;
    };
};

export type Metric = {
    receivefps: number[];
    decodefps: number[];
    packetloss: number[];
    bandwidth: number[];
    buffer: number[];
};

type Data = {
    active: boolean;
    fullscreen: boolean;
    pointer_lock: boolean;
    relative_mouse: boolean;
    focus: boolean;
    local: boolean;

    scancode: boolean;
    old_version: boolean;

    bitrate: number;
    prev_bitrate: number;
    framerate: number;
    prev_framerate: number;
    prev_size: number;

    frame_drop?: boolean;

    auth?: AuthSessionResp;
    metrics?: Metric;
    peers: { email: string; last_check: number; start_at: number }[];
    connection?: {
        audio: ConnectStatus;
        video: ConnectStatus;
        paths: any[];
    };
};

const initialState: Data = {
    local: false,
    focus: true,
    active: false,
    scancode: false,
    fullscreen: false,
    pointer_lock: false,
    relative_mouse: false,
    old_version: isMobile(),

    bitrate: 0,
    prev_bitrate: 0,
    framerate: 0,
    prev_framerate: 0,
    prev_size: 0,
    peers: []
};

export function WindowD() {
    if (client == null) return;

    client?.hid?.TriggerKey(EventCode.KeyDown, 'lwin');
    client?.hid?.TriggerKey(EventCode.KeyDown, 'd');
    client?.hid?.TriggerKey(EventCode.KeyUp, 'd');
    client?.hid?.TriggerKey(EventCode.KeyUp, 'lwin');
}

export function openRemotePage(
    url: string,
    options?: {
        app_name?: string;
        demoSession?: boolean;
    }
) {
    const Url = new URL(url);
    Url.searchParams.set('no_stretch', 'true');
    if (store.getState().remote.scancode)
        Url.searchParams.set('scancode', `true`);
    if (options?.demoSession) Url.searchParams.set('demo', `true`);
    if (options?.app_name) Url.searchParams.set('page', options.app_name);

    const open = Url.toString();
    if (isMobile()) {
        document.location.href = open;
        return;
    }

    setTimeout(() => {
        window.open(open, '_blank');
    }, 0);
}

export const remoteAsync = {
    check_worker: async () => {
        if (!store.getState().remote.active) return;
        else if (store.getState().remote.local) return;
        else if (client == null) return;
        else if (!client.ready()) return;

        // TODO
    },
    ping_session: async () => {
        if (!store.getState().remote.active) return;
        else if (client == null) return;
        else if (store.getState().remote.local) return;
        else if (!client.ready()) return;
        else if (client?.hid?.last_active() > 5 * 60) {
            if (store.getState().popup.data_stack.length > 0) return;

            appDispatch(
                popup_open({
                    type: 'notify',
                    data: {
                        loading: false,
                        tips: false,
                        title: 'please move your mouse'
                    }
                })
            );

            while (client?.hid?.last_active() > 2)
                await new Promise((r) => setTimeout(r, 1000));

            appDispatch(popup_close());
        }

        // TODO
    },
    sync: async () => {
        if (!store.getState().remote.active) return;
        else if (client == null) return;
        else if (!client.ready()) return;

        if (
            store.getState().remote.prev_bitrate !=
                store.getState().remote.bitrate ||
            store.getState().remote.prev_framerate !=
                store.getState().remote.framerate ||
            store.getState().remote.prev_framerate != size()
        )
            appDispatch(remoteSlice.actions.internal_sync());
    },
    cache_setting: createAsyncThunk(
        'cache_setting',
        async (_: void, { getState }) => {
            // TODO
        }
    ),
    load_setting: createAsyncThunk('load_setting', async (_: void) => {
        // TODO
    }),
    toggle_remote_async: createAsyncThunk(
        'toggle_remote_async',
        async (_: void, { getState }) => {
            if (!store.getState().remote.active) {
                appDispatch(toggle_remote());
                await sleep(2000);
                return;
            }

            appDispatch(toggle_remote());

            return;
        }
    ),
    hard_reset_async: createAsyncThunk(
        'hard_reset_async',
        async (_: void, { getState }) => {
            if (client == null) return;

            appDispatch(hard_reset());
            await ready();
            return;
        }
    )
};

export const remoteSlice = createSlice({
    name: 'remote',
    initialState,
    reducers: {
        remote_connect: (
            state,
            {
                payload: { audioUrl, videoUrl, rtc_config }
            }: PayloadAction<{
                audioUrl: string;
                videoUrl: string;
                rtc_config: RTCConfiguration;
            }>
        ) => {
            state.local = true;
            state.auth = {
                id: undefined,
                webrtc: rtc_config,
                signaling: {
                    audioUrl,
                    videoUrl
                }
            };

            if (!state.active) {
                state.connection = {
                    audio: 'started',
                    video: 'started',
                    paths: []
                };
                state.metrics = {
                    receivefps: [],
                    decodefps: [],
                    packetloss: [],
                    bandwidth: [],
                    buffer: []
                };
            }

            state.active = true;
            state.fullscreen = true;
        },
        loose_focus: (state) => {
            state.focus = false;
            client?.hid?.ResetKeyStuck();
        },
        have_focus: (state) => {
            state.focus = true;
        },
        close_remote: (state) => {
            state.active = false;
            state.auth = undefined;
            state.connection = undefined;
            state.metrics = undefined;
            state.fullscreen = false;
            setTimeout(() => client?.Close(), 100);
        },
        toggle_remote: (state) => {
            if (!state.active) {
                state.fullscreen = true;
                state.connection = {
                    audio: 'started',
                    video: 'started',
                    paths: []
                };
                state.metrics = {
                    receivefps: [],
                    decodefps: [],
                    packetloss: [],
                    bandwidth: [],
                    buffer: []
                };
            } else {
                state.connection = undefined;
                state.metrics = undefined;
                state.fullscreen = false;
                setTimeout(() => client?.Close(), 100);
            }
            state.active = !state.active;
        },
        hard_reset: () => {
            if (client == null) return;

            client?.HardReset();
        },
        scancode_toggle: (state) => {
            state.scancode = !state.scancode;
            if (client) client.hid.scancode = state.scancode;
        },
        scancode: (state, action: PayloadAction<boolean>) => {
            state.scancode = action.payload;
        },
        framedrop: (state, action: PayloadAction<boolean>) => {
            if (state.active) state.frame_drop = action.payload;
        },
        homescreen: () => {
            WindowD();
        },
        remote_version: (state) => {
            state.old_version = !state.old_version;
            // setTimeout(() => appDispatch(cache_setting()), 500);
        },
        set_fullscreen: (state, action: PayloadAction<boolean>) => {
            state.fullscreen = action.payload;
        },
        toggle_fullscreen: (state) => {
            state.fullscreen = !state.fullscreen;
        },
        pointer_lock: (state, action: PayloadAction<boolean>) => {
            state.pointer_lock = action.payload;
            if (client == null) return;
            client.PointerVisible(action.payload);
        },
        relative_mouse: (state) => {
            state.relative_mouse = !state.relative_mouse;
        },
        internal_sync: (state) => {
            if (
                state.bitrate != state.prev_bitrate ||
                state.prev_size != size()
            )
                client?.ChangeBitrate(
                    Math.round(
                        ((MAX_BITRATE() - MIN_BITRATE()) / 100) *
                            state.bitrate +
                            MIN_BITRATE()
                    )
                );
            if (state.framerate != state.prev_framerate) {
                client?.SetPeriod(
                    Math.round((1000 / state.framerate) * ADS_RATIO)
                );
                client?.ChangeFramerate(
                    Math.round(
                        ((MAX_FRAMERATE - MIN_FRAMERATE) / 100) *
                            state.framerate +
                            MIN_FRAMERATE
                    )
                );
            }

            state.prev_framerate = state.framerate;
            state.prev_bitrate = state.bitrate;
            state.prev_size = size();
        },
        change_framerate: (state, action: PayloadAction<number>) => {
            state.framerate = action.payload;
        },
        change_bitrate: (state, action: PayloadAction<number>) => {
            state.bitrate = action.payload;
        },
        audio_status: (state, action: PayloadAction<ConnectStatus>) => {
            if (state.connection != undefined)
                state.connection.audio = action.payload;
        },
        video_status: (state, action: PayloadAction<ConnectStatus>) => {
            if (state.connection != undefined)
                state.connection.video = action.payload;
        },
        update_metrics: (state, action: PayloadAction<Metric>) => {
            if (state.metrics != undefined) state.metrics = action.payload;
        },
        update_peers: (
            state,
            action: PayloadAction<
                { email: string; last_check: number; start_at: number }[]
            >
        ) => {
            if (!state.active) return;
            state.peers = action.payload;
        },
        update_connection_path: (state, action: PayloadAction<any>) => {
            if (state.connection != undefined)
                state.connection.paths.push(action.payload);
        }
    },
    extraReducers: (builder) => {
        BuilderHelper<Data, any, any>(
            builder,
            {
                fetch: remoteAsync.load_setting,
                hander: (state, action: PayloadAction<any>) => {
                    const { bitrate, framerate, old_version } = action.payload;
                    state.bitrate = bitrate;
                    state.framerate = framerate;

                    if (isMobile()) return;

                    state.old_version = old_version;
                }
            },
            {
                fetch: remoteAsync.cache_setting,
                hander: (state, action: PayloadAction<void>) => {}
            },
            {
                fetch: remoteAsync.toggle_remote_async,
                hander: (state, action: PayloadAction<void>) => {}
            },
            {
                fetch: remoteAsync.hard_reset_async,
                hander: (state, action: PayloadAction<void>) => {}
            }
        );
    }
});
