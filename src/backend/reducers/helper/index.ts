import {
    ActionReducerMapBuilder,
    AsyncThunk,
    CaseReducer,
    PayloadAction,
    UnknownAction
} from '@reduxjs/toolkit';

import Dexie, { Table } from 'dexie';
import { appDispatch, push_notification } from '..';
class TodoDB extends Dexie {
    data!: Table<{ timestamp: number; id: string; raw: any }, string>;
    constructor() {
        super('thinkmaydb2');
        this.version(2).stores({
            data: 'id,raw,timestamp'
        });
    }
}

const db = new TodoDB();
const PREFIX = (name: string) => `THINKMAY_${name}`;
export async function CacheRequest<T>(
    name: string,
    sec: number,
    req: () => Promise<T>
): Promise<T> {
    const store = async (raw: any, timestamp: number) => {
        if (db == null) {
            localStorage.setItem(
                PREFIX(name),
                JSON.stringify({
                    timestamp,
                    raw
                })
            );
        } else {
            await db.data.where('id').equals(PREFIX(name)).delete();
            await db.data.add({
                timestamp,
                raw,
                id: PREFIX(name)
            });
        }
    };

    const get = async (): Promise<any | null> => {
        if (db == null) {
            const data = localStorage.getItem(PREFIX(name));
            try {
                const { timestamp, raw } = JSON.parse(data ?? '');
                if (new Date().getTime() - timestamp > sec * 1000) return null;
                else return raw;
            } catch {
                return null;
            }
        } else {
            const { timestamp, raw } =
                (await db.data.where('id').equals(PREFIX(name)).first()) ?? {};

            if (timestamp == undefined) return null;
            if (new Date().getTime() - timestamp > sec * 1000) return null;
            else return raw;
        }
    };

    const do_req = async () => {
        const result = await req();
        const timestamp = new Date().getTime();
        store(result, timestamp);
        return result;
    };

    const cache = await get();
    if (cache == null) return await do_req();

    return cache;
}

const isPending = (action: UnknownAction) => action.type.endsWith('/pending');
const isFulfilled = (action: UnknownAction) =>
    action.type.endsWith('/fulfilled');
const isRejected = (action: UnknownAction) => action.type.endsWith('/rejected');

export const isPendingAction =
    (prefixs: string[]) =>
    (action: UnknownAction): action is UnknownAction => {
        // Note: this cast to UnknownAction could also be `any` or whatever fits your case best
        return (
            prefixs.find((prefix) => action.type.includes(prefix)) !=
                undefined && isPending(action)
        );
    };

export const isRejectedAction =
    (prefixs: string[]) =>
    (action: UnknownAction): action is UnknownAction => {
        // Note: this cast to UnknownAction could also be `any` or whatever fits your case best - like if you had standardized errors and used `rejectWithValue`
        return (
            prefixs.find((prefix) => action.type.includes(prefix)) !=
                undefined && isRejected(action)
        );
    };

export const isFulfilledAction =
    (prefixs: string[]) =>
    (action: UnknownAction): action is UnknownAction => {
        return (
            prefixs.find((prefix) => action.type.includes(prefix)) !=
                undefined && isFulfilled(action)
        );
    };

export async function BuilderHelper<T, U, V>(
    builder: ActionReducerMapBuilder<T>,
    ...handlers: {
        fetch: AsyncThunk<U, V, any>;
        hander: CaseReducer<
            T,
            PayloadAction<
                U,
                string,
                { arg: V; requestId: string; requestStatus: 'fulfilled' },
                never
            >
        >;
    }[]
) {
    let after = builder;

    handlers.forEach(
        (x) => (after = after.addCase(x.fetch.fulfilled, x.hander))
    );

    after
        // use scoped matchers to handle generic loading / error setting behavior for async thunks this slice cares about
        .addMatcher(
            isPendingAction(handlers.map((x) => x.fetch.typePrefix)),
            (state, action) => {
                const notify = () => appDispatch(push_notification({
                    title: action.type,
                    name: new Date().toUTCString(),
                    content: action.type,
                    url: action.type,
                    urlToImage: action.type,
                }))

                setTimeout(notify,500)
            }
        )
        .addMatcher(
            isRejectedAction(handlers.map((x) => x.fetch.typePrefix)),
            (state, action) => {
                const notify = () => appDispatch(push_notification({
                    title: action.type,
                    name: new Date().toUTCString(),
                    content: action.type,
                    url: action.type,
                    urlToImage: action.type,
                }))

                setTimeout(notify,500)
            }
        )
        .addMatcher(
            isFulfilledAction(handlers.map((x) => x.fetch.typePrefix)),
            (state, action) => {
                const notify = () => appDispatch(push_notification({
                    title: action.type,
                    name: new Date().toUTCString(),
                    content: action.type,
                    url: action.type,
                    urlToImage: action.type,
                }))

                setTimeout(notify,500)
            }
        );
}

export async function Confirms(): Promise<void> {
    throw 'not confirmed';
}