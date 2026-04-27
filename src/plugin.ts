import streamDeck, { DidReceiveDeepLinkEvent, LogLevel } from "@elgato/streamdeck";

import { PlaySound } from "./actions/play-sound";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the increment action.
// streamDeck.actions.registerAction(new IncrementCounter());
streamDeck.actions.registerAction(new PlaySound());

streamDeck.system.onDidReceiveDeepLink(async (ev: DidReceiveDeepLinkEvent) => {
    streamDeck.logger.debug("Received deep link - path:", ev.url.path);
    streamDeck.logger.debug("Received deep link - query:", ev.url.query);
    const { path, query } = ev.url;
    if (path === '/settings' && query !== "") {
        const token = new URLSearchParams(query).get("token");
        streamDeck.settings.setGlobalSettings({
            token: token || "",
        })
    }
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
