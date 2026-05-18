import streamDeck, { action, DidReceiveSettingsEvent, KeyUpEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { JsonValue } from "@elgato/utils";
import { DataSourcePayload, DataSourceResult } from "../sdpi";

const testAuth: boolean = false;

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.joseph-claus.spl-soundboard.play-random" })
export class PlayRandom extends SingletonAction {
    private settings: SPLSoundboardSettings = {};
    private clips: Sound[] = [];
    public webUrlBase?: string;
    public botUrlBase?: string;

    constructor() {
        super();

        this.clips = [];
        streamDeck.settings.getGlobalSettings<SPLSoundboardSettings>().then((settings) => {
            if (settings.webUrlBase) {
                this.webUrlBase = settings.webUrlBase;
            }
            if (settings.botUrlBase) {
                this.botUrlBase = settings.botUrlBase;
            }
        });

        streamDeck.settings.onDidReceiveGlobalSettings<SPLSoundboardSettings>((ev) => {
            this.settings = ev.settings;
        });
    }

    private clearTokenAndRefetch() {
        streamDeck.logger.debug("Clearing token and refetching clips");
        streamDeck.settings.setGlobalSettings<SPLSoundboardSettings>({ token: undefined });
    }

    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}.
     */
    override async onWillAppear(ev: WillAppearEvent): Promise<void> {
        this.settings = await streamDeck.settings.getGlobalSettings<SPLSoundboardSettings>();

        if (this.settings.token && testAuth) {
            this.clearTokenAndRefetch();
        }
    }

    private async playSound(sound: Sound): Promise<void> {
        const { token } = this.settings;

        if (!token) {
            throw new Error("Token not configured.");
        }

        try {
            await fetch(`${this.botUrlBase}/api/soundboard/${token}/postMsg`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Referer": "streamdeck://com.joseph-claus.spl-soundboard.play",
                    "requester": "streamdeck://com.joseph-claus.spl-soundboard.play"
                },
                body: JSON.stringify(sound)
            });
        } catch (err) {
            streamDeck.logger.error("Error playing sound:", err);
        }
    }

    /**
     * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
     * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
     * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
     * settings using `setSettings` and `getSettings`.
     */
    override async onKeyUp(ev: KeyUpEvent): Promise<void> {
        const { token } = this.settings;

        if (!token) {
            streamDeck.logger.warn("Token not configured. Cannot play random sound.");
            ev.action.showAlert();
            return;
        }

        try {
            const sound = await this.#getRandomClip();
            streamDeck.logger.debug("Got random sound:", sound);
            if (sound) await this.playSound(sound);
            ev.action.showOk();
        } catch (err) {
            streamDeck.logger.error("Error playing sound:", err);
            ev.action.showAlert();
        }
    }

    async #getRandomClip(): Promise<Sound | undefined> {
        streamDeck.logger.trace("#getSoundboardClips - Fetching soundboard clips");
        const { token } = this.settings;

        if (!token || token === "") {
            return;
        }

        return new Promise(async (resolve, reject) => {
            let res: Response | undefined;
            try {
                res = await fetch(`${this.webUrlBase}/api/soundboard/random?token=${token}`, {
                    headers: {
                        "Accept": "application/json",
                        "Referer": "streamdeck://com.joseph-claus.spl-soundboard.play"
                    }
                });
            } catch (fetchClipsErr) {
                streamDeck.logger.error("Error fetching random soundboard clip:", fetchClipsErr);
                reject(fetchClipsErr);
            }

            let data: Sound | undefined;
            try {
                data = await res?.json();
            } catch (parseErr) {
                streamDeck.logger.error("Error parsing random soundboard clip response:", parseErr);
                reject(parseErr);
            }

            streamDeck.logger.debug("#getRandomClip - Successfully fetched clip:", data);
            resolve(data);
        });
    }
}

type Sound = {
    id: string;
    name: string;
    description?: string;
    url: string;
    volume?: number;
}

type SPLSoundboardSettings = {
    webUrlBase?: string;
    botUrlBase?: string;
    token?: string;
}