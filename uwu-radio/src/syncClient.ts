// Whole impl here shamelessly stolen from
// <https://github.com/uwu/radio/blob/master/clients/web/src/syncClient.ts>
// minor additions such as the `loading` ref by me

import { HubConnection, HubConnectionBuilder } from "@microsoft/signalr";
import { ref, reactive, computed } from "@vue/reactivity";
import { currentTimestamp } from "./util";
import { serverUrl } from "./constants";
import { fetch } from "cross-fetch";

const loadingSong: Song = {
  name: "loading...",
  artist: "...",
  submitter: "...",
};

export interface Song {
  name: string;
  artist: string;
  dlUrl?: string | null;
  sourceUrl?: string;
  artUrl?: string | null;
  album?: string | null;
  submitter: string;
}

export interface Submitter {
  name: string;
  pfpUrl: string;
  quotes: string[];
}

export default class SyncClient {
  #apiRes: (route: string) => string;

  constructor(host: string) {
    this.#apiRes = (route) => new URL(route, host).href;

    const connection = new HubConnectionBuilder()
      .withUrl(this.#apiRes("/sync"))
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: () => 15000,
      })
      .build();

    this.#connect(connection);
  }

  #connection: undefined | HubConnection;

  // this desperately needs a rewrite (when i do channels i'll redo all the sync and audio logic)
  current = ref<Song | undefined>(loadingSong);
  #next = ref<Song>();

  submitters = reactive(new Map<string, Submitter>());

  #currentStarted = ref<number>();
  #nextStarts = ref<number>();

  #interval?: NodeJS.Timeout;

  loading = ref<boolean>(true);
  reconnecting = false;

  get currentSong() {
    return this.current.value;
  }
  get nextSong() {
    return this.#next.value;
  }

  get currentStartedTime() {
    return this.#currentStarted.value;
  }

  get nextStartsTime() {
    return this.#nextStarts.value;
  }

  /** The seek into the current song in seconds */
  seekPos = computed(() => {
    const startTime = this.#currentStarted.value;
    return startTime ? currentTimestamp() - startTime : undefined;
  });

  #handlers = {
    BroadcastNext: (nextSong: Song, startTime: number) => {
      this.#next.value = nextSong;
      this.#nextStarts.value = startTime;
      this.#scheduleNext(startTime);
    },
    ReceiveState: (currentSong: Song, currentStarted: number, nextSong: Song, nextStart: number) => {
      this.current.value = currentSong;
      this.#currentStarted.value = currentStarted;
      this.#next.value = nextSong;
      this.#nextStarts.value = nextStart;

      if (this.#nextStarts.value! - currentTimestamp() < 30) this.#scheduleNext(this.#nextStarts.value!);
      this.loading.value = false;
    },
    ReceiveSeekPos: (currentStarted: number) => {
      // TODO: i guess emit events, like this should only really be used if we drop connection
      //       but even shouldn't we just call ReceiveState
      this.#currentStarted.value = currentStarted;
    },
  };

  async #connect(connection: HubConnection) {
    if (this.#connection) throw new Error("This client is already connected");
    this.#connection = connection;

    connection.onclose(() => (this.#connection = undefined));

    connection.onreconnecting(() => (this.reconnecting = true));
    connection.onreconnected(() => {
      this.updateState();
      this.reconnecting = false;
    });

    await connection.start();

    connection.on("BroadcastNext", this.#handlers.BroadcastNext);
    connection.on("ReceiveState", this.#handlers.ReceiveState);
    connection.on("ReceiveSeekPos", this.#handlers.ReceiveSeekPos);

    this.updateState();
  }

  updateState() {
    this.loading.value = true;

    fetch(this.#apiRes("/api/data"))
      .then((r) => r.json())
      .then((r) => {
        for (const submitter of r.submitters) this.submitters.set(submitter.name, submitter);
      });

    this.requestState();
  }

  requestState() {
    this.#connection?.invoke("RequestState");
  }

  requestSeekPos() {
    this.#connection?.invoke("RequestSeekPos");
  }

  #scheduleNext(startTime: number) {
    if (this.#next.value === undefined) return;

    clearInterval(this.#interval);
    this.#interval = setTimeout(
      () => {
        this.current.value = this.#next.value;
        this.#currentStarted.value = this.#nextStarts.value;
        this.#next.value = undefined;
        this.#nextStarts.value = undefined;

        // const correction = Math.min(-(startTime - currentTimestamp()), 0);
        // play(this.current.value!, correction);
      },
      1000 * (startTime - currentTimestamp()),
    );
  }
}

let clientInstance: SyncClient;

export const getClient = () => {
  if (!clientInstance) clientInstance = new SyncClient(serverUrl);
  return clientInstance;
};
