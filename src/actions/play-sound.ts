import streamDeck, { action, DidReceiveSettingsEvent, JsonValue, KeyDownEvent, KeyUpEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { DataSourcePayload, DataSourceResult } from "../sdpi";

const testing: boolean = false;
const webUrlBase: string = testing ? "http://localhost:3000" : "https://dev.savepointlodge.com";
const botUrlBase: string = testing ? "http://localhost:8080" : "https://joebotdiscord.com";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.joseph-claus.spl-soundboard.play" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
    private settings: SPLSoundboardSettings = {};
    private clips: { id: string; name: string; sound: string; volume: number }[] = [];

    constructor() {
        super();

        this.clips = [];
    }
    
    private generatePIPayloadFromClips(): DataSourcePayload {
        const items = this.clips.map((c: any) => {
            return {
                label: c.name,
                value: JSON.stringify(c)
            };
        });
        
        return {
            event: "getClips",
            items
        }
    }

    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}.
     */
    override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
        this.settings = await streamDeck.settings.getGlobalSettings<SPLSoundboardSettings>();

        if (this.settings.token && this.settings.token !== "") {
            streamDeck.logger.debug("onWillAppear - Token set");
        } else {
            streamDeck.logger.debug("onWillAppear - Opening setup URL");
            streamDeck.system.openUrl(`${webUrlBase}/streamdeck-setup`);
        }
    }

    /**
     * Occurs when an action disappears from the Stream Deck due to the user navigating to another page, profile, folder, etc. An action refers to _all_ types of actions, e.g. keys,
     * dials, touchscreens, pedals, etc.
     * @param ev Information about the event, including the source action and contextual payload information.
     */
    override async onWillDisappear?(ev: WillDisappearEvent<PlaySoundSettings>): Promise<void> {
        streamDeck.logger.debug("onWillDisappear - clearing clips for PlaySound");
        this.clips = [];
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
        streamDeck.logger.debug("onDidReceiveSettings - Settings received for PlaySound");
        const { sound: soundString } = ev.payload.settings || {};
        const sound = soundString ? JSON.parse(soundString) : null;
        if (sound) {
            streamDeck.logger.debug("onDidReceiveSettings - Setting title to sound name:", sound.name);
            ev.action.setTitle(sound.name);
        }
        // this.actionSettings = ev.payload.settings || {};
    }

    override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<PlaySoundSettings>): Promise<void> {
        // Send the current clips to the property inspector.
        if (this.clips.length) {
            streamDeck.ui.current?.sendToPropertyInspector(this.generatePIPayloadFromClips());
        } else {
            // Fetch the soundboard clips if not already fetched.
            const clips = await this.#getSoundboardClips();
            streamDeck.logger.debug("onPropertyInspectorDidAppear - Fetched soundboard clips:", clips);
            //@ts-ignore
            this.clips = clips;
            streamDeck.ui.current?.sendToPropertyInspector(this.generatePIPayloadFromClips());
        }
    }

    /**
     * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
     * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
     * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
     * settings using `setSettings` and `getSettings`.
     */
    override async onKeyUp(ev: KeyUpEvent<PlaySoundSettings>): Promise<void> {
        const { sound } = ev.payload.settings || {};
        const { token } = this.settings;
        streamDeck.logger.debug("onKeyUp - Attempting to play sound:", sound, "with token:", token);

        if (!token) {
            throw new Error("Token not configured.");
        }

        if (!sound) {
            streamDeck.logger.warn("No sound selected to play", sound);
            return;
        }

        await fetch(`${botUrlBase}/api/soundboard/${token}/postMsg`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "streamdeck://com.joseph-claus.spl-soundboard.play"
            },
            body: JSON.stringify({
                sound
            })
        });
    }

    override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, PlaySoundSettings>): Promise<void> {
        // Check if the payload is requesting a data source, i.e. the structure is { event: string }
		if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "getClips" && this.settings.token !== "") {
            if (this.clips.length) {
                // Send the product ranges to the property inspector.
                streamDeck.ui.current?.sendToPropertyInspector(this.generatePIPayloadFromClips());
            } else {
                const clips = await this.#getSoundboardClips();
                streamDeck.logger.debug("onSendToPlugin - Fetched soundboard clips:", clips);
                //@ts-ignore
                this.clips = clips;
                streamDeck.ui.current?.sendToPropertyInspector(this.generatePIPayloadFromClips());
            }
        }
    }

    async #getSoundboardClips(): Promise<DataSourceResult> {
        const { token } = this.settings;

        if (!token || token === "") {
            return [];
        }

        return new Promise(async (resolve, reject) => {
            let res: Response | undefined;
            try {
                res = await fetch(`${urlBase}/api/soundboard?token=${token}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Referer": "streamdeck://com.joseph-claus.spl-soundboard.play"
                    }
                });
            } catch (fetchClipsErr) {
                streamDeck.logger.error("Error fetching soundboard clips:", fetchClipsErr);
                reject(fetchClipsErr);
            }

            let data: any[] = [];
            try {
                data = await res?.json() || [];
            } catch (parseErr) {
                streamDeck.logger.error("Error parsing soundboard clips response:", parseErr);
                reject(parseErr);
            }

            resolve(data);
        });
    }
}

/**
 * Settings for {@link PlaySound}.
 */
type PlaySoundSettings = {
    sound?: string; // JSON stringified sound object
};

type Sound = {
    id: string;
    name: string;
    description?: string;
    url: string;
    volume?: number;
}

type SPLSoundboardSettings = {
    token?: string;
}
