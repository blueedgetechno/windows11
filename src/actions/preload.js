import store from "../reducers";
import { changeTheme } from "./";

import supabase from "../supabase/createClient";
import { FetchAuthorizedWorkers, FetchUserApplication } from "./fetch";
import {
  formatWorkerRenderTree,
  formatAppRenderTree,
} from "../utils/formatData";
import axios from "axios";

const loadWidget = async () => {
  var tmpWdgt = {
      ...store.getState().widpane,
    },
    date = new Date();

  // console.log('fetching ON THIS DAY');
  var wikiurl = "https://en.wikipedia.org/api/rest_v1/feed/onthisday/vents";
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

const loadSettings = async () => {
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
};

export const fetchApp = async () => {
  const data = await FetchUserApplication();
  const apps = (await formatAppRenderTree(data)).filter((x) => x !== undefined);

  store.dispatch({
    type: "DESKADD",
    payload: [...apps],
  });
};

// TODO
export const fetchWorker = async () => {
  const cpath = store.getState().worker.cpath ?? "Account";

  const res = await FetchAuthorizedWorkers();
  const dataFormat = formatWorkerRenderTree(res);

  store.dispatch({
    type: "FILEUPDATEWORKER",
    payload: {
      data: dataFormat,
      oldCpath: cpath ?? oldCpath,
    },
  });
};

export const fetchStore = async () => {
  const constantFetch = await supabase
    .from('constant')
    .select('value->virt')
  if (constantFetch.error) 
    throw constantFetch.error

  const url = constantFetch.data.at(0)?.virt.url;
  const key = constantFetch.data.at(0)?.virt.anon_key;
  if (url == undefined || key == undefined)
    return

  const resp = await fetch(
    `${url}/rest/v1/stores?select=id,name,icon,type,created_at,metadata->description,metadata->screenshoots,metadata->feature,metadata->platform`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
    },
  );
  if (resp.status != 200) throw await resp.text();
  const data = await resp.json();
  data.sort((a, b) => {
    if (a.created_at < b.created_at) return -1;
  });
  const content = {
    games: [],
    apps: [],
  };

  for (let index = 0; index < data.length; index++) {
    const appOrGame = data[index];

    if (appOrGame.type == "GAME") content.games.push(appOrGame);
    else if (appOrGame.type == "APP") content.apps.push(appOrGame);
  }

  store.dispatch({
    type: "UPDATEAPP",
    payload: content.apps,
  });
  store.dispatch({
    type: "UPDATEGAME",
    payload: content.games,
  });
};

export const preload = async () => {
  await Promise.all([
    loadSettings(),
    fetchWorker(),
    fetchStore(),
    //loadWidget(),
    fetchApp(),
  ]);
};