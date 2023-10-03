import store from "../reducers";
import { isAdmin } from "../utils/isAdmin";
import { log } from "../lib/log";
import { fetchApp, fetchStore, fetchWorker } from "./preload";
import supabase from "../supabase/createClient";
import {
  AccessApplication,
  ResetApplication,
  DeleteApplication,
  DownloadApplication,
  FetchUserApplication,
  StartApplication,
  StopApplication,
  StopVolume,
} from "./fetch";
import Swal from "sweetalert2";
import { SupabaseFuncInvoke } from "./fetch";
import i18next from "i18next";
import { sleep } from "../utils/sleep";
import { openRemotePage } from "./remote";


const formatEvent = (event) => {
  const pid = event.target.dataset.pid;
  const action = {
    type: event.target.dataset.action,
    payload: event.target.dataset.payload,
    pid: event.target.dataset.pid,
    ...store.getState().worker.data.getId(pid),
  };

  console.log(action);
  return action;
};

const wrapper = async (func, appType) => {
  let content = "It took about 5 minutes, take a break🧐"
  if (appType == 'startApp') content = i18next.t("info.startApp");
  if (appType == 'installApp') content = i18next.t("info.installApp")
  if (appType == 'pauseApp') content = i18next.t("info.pauseApp")


  try {
    log({
      type: "loading",
      content: content,
    });
    const result = await func();
    await log({
      type: "success",
      content: result,
    });

    return result;
  } catch (error) {
    await log({
      type: "error",
      content: error,
    });

    return error;
  }
};

export const deleteStore = async (app) => {
  if (!isAdmin()) return;

  const { data, error } = await supabase
    .from('constant')
    .select('value->virt')
  if (error)
    throw error

  const url = data.at(0)?.virt.url;
  const key = data.at(0)?.virt.anon_key;
  if (url == undefined || key == undefined)
    return

  const resp = await fetch(`${url}/rest/v1/stores?id=eq.${app.id}`,
    {
      method: 'DELETE',
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
        // "refer": "return=minimal"
      },
    }
  )

  console.log(resp)

  if (resp.status != 204 || 200 || 201) throw await resp.text();



  await log({
    error: null,
    type: "confirm",
    confirmCallback: deleteApp,
  });

  fetchStore();
};

// desktop app
export const openApp = async (appInput) =>
  wrapper(async () => {
    const payload = JSON.parse(appInput.payload);

    if (payload.status == "NOT_READY")
      throw (i18next.t("error.NOT_READY"));
    else if (payload.status != "RUNNING")
      throw (i18next.t("error.NOT_RUNNING"));

    const input = {
      storage_id: payload.storage_id,
      privateIp: payload.privateIp
    }
    const result = await AccessApplication(input);

    openRemotePage(result.url);
  });
export const resetApp = async (appInput) =>
  wrapper(async () => {
    const payload = JSON.parse(appInput.payload);

    if (payload.status == "NOT_READY")
      throw (i18next.t("error.NOT_READY"));
    else if (payload.status != "RUNNING")
      throw (i18next.t("error.NOT_RUNNING"));

    const input = {
      storage_id: payload.storage_id,
      privateIp: payload.privateIp
    }
    const result = await ResetApplication(input);

    openRemotePage(result.url);
  });
// Handle app
export const installApp = (payload) =>
  wrapper(async () => {
    await DownloadApplication(payload.app_template_id);
    await fetchApp();
  }, 'installApp');

// desktop app
export const startApp = async (appInput) =>
  wrapper(async () => {
    const payload = JSON.parse(appInput.payload);
    if (payload.status != "PAUSED") throw (i18next.t("error.NOT_PAUSED"));

    await StartApplication(payload.storage_id);
    for (let i = 0; i < 100; i++) {
      let { data, error } = await supabase
        .rpc('setup_status', {
          volume_id: payload.volume_id
        })

      if (error)
        throw error
      if (data == true)
        break

      await sleep(10 * 1000)
    }
    await fetchApp();
  }, 'startApp');

// desktop app
export const pauseApp = async (appInput) =>
  wrapper(async () => {
    const payload = JSON.parse(appInput.payload);
    if (payload.status != "RUNNING")
      throw (i18next.t("error.PAUSED"));

    await StopApplication(payload.storage_id);
    await sleep(15 * 1000)
    await fetchApp();
  }, 'pauseApp');

export const deleteApp = (appInput) =>
  wrapper(async () => {
    const payload = JSON.parse(appInput.payload);
    await DeleteApplication(payload.storage_id);
    await fetchApp();
  });

export const connectVolume = (e) =>
  wrapper(async () => {
    const payload = formatEvent(e);


    const input = {
      storage_id: payload.info.storage,
      privateIp: 'unknown'
    }

    const result = await AccessApplication(input);
    openRemotePage(result.url)
  });


export const stopVolume = (e) =>
  wrapper(async () => {
    const payload = formatEvent(e);

    const storage = payload.info.storage
    const volume = payload.info.id

    if (storage != undefined)
      await StopApplication(storage);
    else if (volume != undefined)
      await StopVolume(volume);
    else
      throw 'invalid request'

    await fetchWorker()
    return "success";
  });

export const ReleaseApp = async (store) => {
  wrapper(async () => {
    const { value: text } = await Swal.fire({
      input: 'textarea',
      inputLabel: 'Message',
      inputPlaceholder: 'Type your description here...',
      inputAttributes: {
        'aria-label': 'Type your description here'
      },
      showCancelButton: false
    })
    Swal.close();

    const { data, error } = await SupabaseFuncInvoke("request_application", {
      method: "POST",
      body: JSON.stringify({
        action: "RELEASE",
        store_id: store.id,
        desc: text
      }),
    });

    if (error)
      throw error
  })
}

export const PatchApp = async (app) => {
  wrapper(async () => {
    const { value: text } = await Swal.fire({
      input: 'textarea',
      inputLabel: 'Message',
      inputPlaceholder: 'Type your description here...',
      inputAttributes: {
        'aria-label': 'Type your description here'
      },
      showCancelButton: false
    })
    Swal.close();

    const { data, error } = await SupabaseFuncInvoke("request_application", {
      method: "POST",
      body: JSON.stringify({
        action: "PATCH",
        app_id: app.id,
        desc: text
      }),
    });

    if (error)
      throw error

  })
}