import { useEffect, useState } from "react";
import { watchEffect } from "@vue-reactivity/watch";
import { Icon, Image, MenuBarExtra, LaunchType, launchCommand } from "@raycast/api";
import { getClient } from "./syncClient";
import { useCachedState } from "@raycast/utils";

export default function Command() {
  const client = getClient();
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useCachedState<{ title?: string; artist?: string; album?: string; cover?: string | null }>(
    "track",
    {
      title: "",
      artist: "",
    },
  );

  // This might be the worst thing I've ever seen or written.
  // Vue reactivity in a React component.
  useEffect(() => {
    const unwatch = watchEffect(() => {
      if (client.current.value?.name !== "loading...") {
        console.log(client.current.value);
        setState({
          title: client.current.value?.name,
          artist: client.current.value?.artist,
          album: client.current.value?.album ?? "",
          cover: client.current.value?.artUrl,
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

  const title = `${state.title} - ${state.artist}`;

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={
        state.cover
          ? {
              source: state.cover,
              mask: Image.Mask.RoundedRectangle,
            }
          : Icon.PlayFilled
      }
      title={title}
      tooltip={title}
    >
    </MenuBarExtra>
  );
}
