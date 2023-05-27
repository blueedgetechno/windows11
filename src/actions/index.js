import axios from "axios";
import store from "../reducers";
import { dfApps } from "../utils";
import { gene_name } from "../utils/apps";
import {
  CreateWorkerSession,
  DeactivateWorkerSession,
  FetchAuthorizedWorkers,
} from "../supabase/function";
import { autoFormatData } from "../utils/formatData";
import Swal, { swal } from "sweetalert2/dist/sweetalert2.js";
import "sweetalert2/src/sweetalert2.scss";
import { log, Log } from "../lib/log";
import supabase from "../supabase/createClient";
import { isAdmin } from "../utils/isAdmin";

export const dispatchAction = (event) => {
  const action = {
    type: event.target.dataset.action,
    payload: event.target.dataset.payload,
  };

  if (action.type) {
    store.dispatch(action);
  }
};

export const refresh = (pl, menu) => {
  if (menu.menus.desk[0].opts[4].check) {
    store.dispatch({ type: "DESKHIDE" });
    setTimeout(() => store.dispatch({ type: "DESKSHOW" }), 100);
  }
};

export const changeIconSize = (size, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[0].opts[0].dot = false;
  tmpMenu.menus.desk[0].opts[1].dot = false;
  tmpMenu.menus.desk[0].opts[2].dot = false;
  var isize = 1;

  if (size == "large") {
    tmpMenu.menus.desk[0].opts[0].dot = true;
    isize = 1.5;
  } else if (size == "medium") {
    tmpMenu.menus.desk[0].opts[1].dot = true;
    isize = 1.2;
  } else {
    tmpMenu.menus.desk[0].opts[2].dot = true;
  }

  refresh("", tmpMenu);
  store.dispatch({ type: "DESKSIZE", payload: isize });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const deskHide = (payload, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[0].opts[4].check ^= 1;

  store.dispatch({ type: "DESKTOGG" });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const changeSort = (sort, menu) => {
  var tmpMenu = { ...menu };
  tmpMenu.menus.desk[1].opts[0].dot = false;
  tmpMenu.menus.desk[1].opts[1].dot = false;
  tmpMenu.menus.desk[1].opts[2].dot = false;
  if (sort == "name") {
    tmpMenu.menus.desk[1].opts[0].dot = true;
  } else if (sort == "size") {
    tmpMenu.menus.desk[1].opts[1].dot = true;
  } else {
    tmpMenu.menus.desk[1].opts[2].dot = true;
  }

  refresh("", tmpMenu);
  store.dispatch({ type: "DESKSORT", payload: sort });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const changeTaskAlign = (align, menu) => {
  var tmpMenu = { ...menu };
  if (tmpMenu.menus.task[0].opts[align == "left" ? 0 : 1].dot) return;

  tmpMenu.menus.task[0].opts[0].dot = false;
  tmpMenu.menus.task[0].opts[1].dot = false;

  if (align == "left") {
    tmpMenu.menus.task[0].opts[0].dot = true;
  } else {
    tmpMenu.menus.task[0].opts[1].dot = true;
  }

  store.dispatch({ type: "TASKTOG" });
  store.dispatch({ type: "MENUCHNG", payload: tmpMenu });
};

export const performApp = (act, menu) => {
  var data = {
    type: menu.dataset.action,
    payload: menu.dataset.payload,
  };

  if (act == "open") {
    if (data.type) store.dispatch(data);
  } else if (act == "delshort") {
    if (data.type) {
      var apps = store.getState().apps;
      var app = Object.keys(apps).filter(
        (x) =>
          apps[x].action == data.type ||
          (apps[x].payload == data.payload && apps[x].payload != null)
      );

      app = apps[app];
      if (app) {
        store.dispatch({ type: "DESKREM", payload: app.name });
      }
    }
  }
};

// Handle app
export const installApp = async (appInput) => {
  var newApp = {
    ...appInput,
    name: appInput.title,
    icon: appInput.icon,
    action: "EXTERNAL_APP",
    type: "any",
  };

  //update to user metdata
  try {
    const {data,error} = await supabase
      .from("user_profile")
      .select("id,metadata->installed_app,metadata")
    if (error != null) 
      throw error

    console.log(data)

    store.dispatch({ type: "DESKADD", payload: newApp });

    const apps = data.at(0).installed_app ?? []
    apps.push(newApp)
    const updateResult = await supabase
      .from("user_profile")
      .update({
        metadata: {
          ...data.at(0).metadata,
          installed_app: apps
        }
      }).eq("id",data.at(0)?.id)
    if (updateResult.error != null) 
      throw updateResult.error.message
  } catch (error) {
    log({ type: "error", content: error });
  }
};

export const delApp = (act, menu, event) => {
  var data = {
    type: menu.dataset.action,
    payload: menu.dataset.payload,
  };
  console.log(menu);
  if (act == "delete") {
    if (data.type !== "EXTERNAL_APP") {
      var apps = store.getState().apps;
      var app = Object.keys(apps).filter((x) => apps[x].action == data.type);
      if (app) {
        app = apps[app];
        if (app?.pwa == true) {
          store.dispatch({ type: app.action, payload: "close" });
          store.dispatch({ type: "DELAPP", payload: app.icon });

          let installed = "[]";

          installed = JSON.parse(installed);
          installed = installed.filter((x) => x.icon != app.icon);

          store.dispatch({ type: "DESKREM", payload: app.name });
        }
      }
    } else {
      const appId = menu.dataset.id;
      deleteExternalApp(appId);
    }
  }
};

export const openExternalApp = async () => {
  console.log("open"); // TODO this logic
};
export const deleteExternalApp = async (appId) => {
  // delete in db

  try {
    const oldUserMetaData = store.getState().user?.user_metadata;
    const newListAppMetadata = oldUserMetaData.apps.filter(
      (app) => app.id != appId
    );

    oldUserMetaData.apps = newListAppMetadata;
    const { error } = await supabase.auth.updateUser({ data: oldUserMetaData });
    if (error) throw(error);
  } catch (error) {
    log({ type: "error", content: error });
  }

  // delete in state
  const listApp = store.getState().desktop.apps;

  const newListApp = listApp.filter((app) => app?.id != appId);

  store.dispatch({ type: "DESK_APP_UPDATE", payload: newListApp });
};

export const getTreeValue = (obj, path) => {
  if (path == null) return false;

  var tdir = { ...obj };
  path = path.split(".");
  for (var i = 0; i < path.length; i++) {
    tdir = tdir[path[i]];
  }

  return tdir;
};

export const changeTheme = () => {
  var thm = store.getState().setting.person.theme,
    thm = thm == "light" ? "dark" : "light";
  var icon = thm == "light" ? "sun" : "moon";

  document.body.dataset.theme = thm;
  store.dispatch({ type: "STNGTHEME", payload: thm });
  store.dispatch({ type: "PANETHEM", payload: icon });
  store.dispatch({ type: "WALLSET", payload: thm == "light" ? 0 : 1 });
};

const loadWidget = async () => {
  var tmpWdgt = {
      ...store.getState().widpane,
    },
    date = new Date();

  // console.log('fetching ON THIS DAY');
  var wikiurl = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/events";
  await axios
    .get(`${wikiurl}/${date.getMonth()}/${date.getDay()}`)
    .then((res) => res.data)
    .then((data) => {
      var event = data.events[Math.floor(Math.random() * data.events.length)];
      date.setYear(event.year);

      tmpWdgt.data.date = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      tmpWdgt.data.event = event;
    })
    .catch((error) => {});

  // console.log('fetching NEWS');
  await axios
    .get("https://github.win11react.com/api-cache/news.json")
    .then((res) => res.data)
    .then((data) => {
      var newsList = [];
      data["articles"].forEach((e) => {
        e.title = e["title"].split(`-`).slice(0, -1).join(`-`).trim();
        newsList.push(e);
      });
      tmpWdgt.data.news = newsList;
    })
    .catch((error) => {});

  store.dispatch({
    type: "WIDGREST",
    payload: tmpWdgt,
  });
};

export const loadSettings = () => {
  let sett = JSON.parse("[]"); // TODO setting from database

  if (sett.person == null) {
    sett = JSON.parse(JSON.stringify(store.getState().setting));
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      sett.person.theme = "dark";
    }
  }

  if (sett.person.theme != "light") changeTheme();

  store.dispatch({ type: "SETTLOAD", payload: sett });
  if (import.meta.env.MODE != "development") {
    loadWidget();
  }
};

// mostly file explorer
export const handleFileOpen = (id) => {
  // handle double click open
  const item = store.getState().files.data.getId(id);
  if (item != null) {
    if (item.type == "folder") {
      store.dispatch({ type: "FILEDIR", payload: item.id });
    }
  }
};

//USER:

export const handleLogOut = async () => {
  const logging = new Log();
  logging.loading();
  const { error } = await supabase.auth.signOut();
  if (error) {
    logging.error();
    throw(error);
  }
  logging.close();
  store.dispatch({ type: "DELETE_USER" });
  store.dispatch({ type: "WALLALOCK" });
};

export const handleFileOpenWorker = (id) => {
  // handle double click open
  const item = store.getState().worker.data.getId(id);
  if (item != null) {
    if (item.type !== "file") {
      store.dispatch({ type: "FILEDIRWORKER", payload: item.id });
    }

    //console.log("user");
  }
};

export const handleOpenModalDetailWorker = (id) => {
  const foundItem = store.getState().worker.data.getId(id);
  if (!foundItem) return;
  store.dispatch({ type: "OPEN_MODAL", payload: foundItem.info });
};

//

//
export const fetchWorker = async (oldCpath = "Account") => {
  const cpath = store.getState().worker.cpath ?? "Account";
  const res = await FetchAuthorizedWorkers();
  if (res instanceof Error) {
    return new Error(res);
  }
  const dataFormat = autoFormatData(res);
  store.dispatch({
    type: "FILEUPDATEWORKER",
    payload: { data: dataFormat, oldCpath: cpath ?? oldCpath },
  });
};

export const refeshFetchWorker = async () => {
  log({ type: "loading" });
  const error = await fetchWorker();
  if (error instanceof Error) {
    log({ type: "error", content: error });
    return;
  }

  log({ type: "success" });
};

export const deactiveWorkerSeesion = async (workerId) => {
  const item = store.getState().worker.data.getId(workerId);
  if (!item) return;
  const { worker_session_id, ended } = item.info;

  if (ended || !worker_session_id) return;

  log({ type: "loading" });
  const res = await DeactivateWorkerSession(worker_session_id);
  if (res instanceof Error) {
    log({ type: "error", content: res });
    return;
  }
  const error = await fetchWorker();
  if (error instanceof Error) {
    log({ type: "error", content: error });
    return;
  }

  log({ type: "success" });
};

export const createWorkerSession = async (workerId) => {
  const workerFound = store.getState().worker.data.getId(workerId);

  if (!workerFound) return;

  const { worker_profile_id, media_device, last_check, isActive } =
    workerFound.info;
  if (!worker_profile_id || isActive) return;

  log({ type: "loading" });

  const res = await CreateWorkerSession(worker_profile_id, media_device);
  if (res instanceof Error) {
    log({ type: "error", content: res });
    return;
  }
  const error = await fetchWorker();
  if (error instanceof Error) {
    log({ type: "error", content: error });
    return;
  }

  log({ type: "success" });
};

export const connectWorker = async (workerId) => {
  const workerFound = store.getState().worker.data.getId(workerId);
  if (!workerFound) return;

  const sessionUrlFound = workerFound.data.find(
    (session) => session.info.ended === false
  )?.info?.remote_url;
  if (sessionUrlFound) {
    window.open(sessionUrlFound, "_blank");
    return;
  }

  const media_device = workerFound.info.media_device ?? "";
  log({ type: "loading", title: "Await create a new session" });
  const res = await CreateWorkerSession(
    workerFound.info.worker_profile_id,
    media_device
  );
  if (res instanceof Error) {
    log({ type: "error", title: "Create Worker Session Fail!", content: res });
    return;
  }

  log({ type: "close" });
  window.open(res.url, "_blank");
};

//TODO: have bug when navigate(-1) after fetch data.
export const connectWorkerSession = (itemId) => {
  const item = store.getState().worker.data.getId(itemId);
  if (!item.info.remote_url) return;

  window.open(item.info.remote_url, "_blank");
};

// For admin

export const handleDeleteApp = async (app) => {
  if (!isAdmin()) 
    return;
  
  const { id } = app;
  const deleteApp = async () => {
    const {data,error} = await supabase
      .from("store")
      .delete()
      .eq("id", id);

    if (error) 
      return { error: `fail to delete app ${error.message}`}
    
    return {error : null}
  };

  await log({ 
    error: null,
    type: "confirm", 
    confirmCallback: deleteApp 
  });
};
