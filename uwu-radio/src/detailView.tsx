import { Detail, Image } from "@raycast/api";
import { useEffect, useState } from "react";
import { watchEffect } from "@vue-reactivity/watch";
import { getClient, Song, Submitter } from "./syncClient";
import { useCachedState } from "@raycast/utils";
import outdent from "outdent";

export default function Command() {
  const client = getClient();
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useCachedState<Song>("track", {
    name: "",
    artist: "",
    submitter: "",
  });
  const [submitter, setSubmitter] = useCachedState<Partial<Submitter>>("submitter", {});

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

  // Effect #2: Submitter tracking
  useEffect(() => {
    const unwatch = watchEffect(() => {
      if (client.current.value?.name !== "loading...") {
        const submitter = client.submitters.get(client.current.value?.submitter ?? "")!;
        setSubmitter({
          name: submitter.name,
          pfpUrl: submitter.pfpUrl,
          quotes: submitter.quotes,
        });
      }
    });
    return () => unwatch();
  }, []);

  // Effect #3: Loading tracking
  useEffect(() => {
    const unwatch = watchEffect(() => {
      console.log(client.loading.value);
      setIsLoading(client.loading.value);
    });
    return () => unwatch();
  });

  const markdown = outdent`
    ![](${state.artUrl})
  `.trim();

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle="radio.uwu.network"
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Title" text={state.name} />
          <Detail.Metadata.Label title="Artist" text={state.artist} />
          <Detail.Metadata.Label title="Album" text={state.album!} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Submitter"
            text={submitter.name}
            {...(submitter.pfpUrl ? { icon: { source: submitter.pfpUrl, mask: Image.Mask.Circle } } : {})}
          />
        </Detail.Metadata>
      }
    />
  );
}
