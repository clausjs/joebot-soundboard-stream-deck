import streamDeck, { DidReceiveDeepLinkEvent } from "@elgato/streamdeck";

import { PlaySound } from "./actions/play-sound";
import { PlayRandom } from "./actions/play-random";

const testing: boolean = false;
streamDeck.settings.setGlobalSettings({
    webUrlBase: testing ? "http://localhost:3000" : "https://dev.savepointlodge.com",
    botUrlBase: testing ? "http://localhost:8080" : "https://joebotdiscord.com",
});

streamDeck.logger.setLevel('error');

streamDeck.system.onDidReceiveDeepLink(async (ev: DidReceiveDeepLinkEvent) => {
    streamDeck.logger.trace("Received deep link");
    streamDeck.logger.debug("Received deep link with URL:", ev.url);
    const { path, query } = ev.url;
    if (path === '/settings' && query !== "") {
        const token = new URLSearchParams(query).get("token") ?? undefined;
        streamDeck.ui.sendToPropertyInspector({
            event: "token-retrieved",
            token
        });
    }
});

streamDeck.actions.registerAction(new PlaySound());
streamDeck.actions.registerAction(new PlayRandom());
streamDeck.connect();
