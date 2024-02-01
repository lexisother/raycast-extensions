import { useEffect, useState } from "react";
import { watchEffect } from "@vue-reactivity/watch";
import { Icon, Image, MenuBarExtra, LaunchType, launchCommand } from "@raycast/api";
import { getClient, Song } from "./syncClient";
import { useCachedState } from "@raycast/utils";

export default function Command() {
  const client = getClient();
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useCachedState<Song>("track", {
    name: "",
    artist: "",
    submitter: "",
  });

  // This might be the worst thing I've ever seen or written.
  // Vue reactivity in a React component.
  useEffect(() => {
    const unwatch = watchEffect(() => {
      const track = client.current.value;
      if (track?.name !== "loading...") {
        setState({
          name: track?.name ?? "",
          artist: track?.artist ?? "",
          album: track?.album ?? "",
          artUrl: track?.artUrl,
          submitter: track?.submitter ?? "",
        });
      }
    });
    return () => unwatch();
  }, []);

  // Different effect because different dependency
  useEffect(() => {
    const unwatch = watchEffect(() => {
      console.log(client.loading.value);
      setIsLoading(client.loading.value);
    });
    return () => unwatch();
  });

  const title = `${state.name} - ${state.artist}`;

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={
        state.artUrl
          ? {
              source: state.artUrl,
              mask: Image.Mask.RoundedRectangle,
            }
          : Icon.PlayFilled
      }
      title={title}
      tooltip={title}
    >
      <MenuBarExtra.Item
        title="Open detailed view"
        icon={Icon.ArrowClockwise}
        onAction={() =>
          launchCommand({
            name: "detailView",
            type: LaunchType.UserInitiated,
          })
        }
      />
    </MenuBarExtra>
  );
}
