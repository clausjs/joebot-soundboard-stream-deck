import streamDeck, { action, DidReceiveSettingsEvent, KeyUpEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { JsonValue } from "@elgato/utils";
import { DataSourcePayload, DataSourceResult } from "../sdpi";

const testAuth: boolean = false;

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.joseph-claus.spl-soundboard.play" })
export class PlaySound extends SingletonAction<PlaySoundSettings> {
    private settings: SPLSoundboardSettings = {};
    private clips: { id: string; name: string; sound: string; volume: number }[] = [];
    public webUrlBase: string = "https://savepointlodge.com";
    public botUrlBase: string = "https://joebotdiscord.com";

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
            this.fetchClipsAndUpdatePI();
        });
    }   
    
    private generatePIPayloadFromClips(): DataSourcePayload {
        const items = this.clips.sort((a, b) => a.name.localeCompare(b.name)).map((c: any) => {
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

    private clearTokenAndRefetch() {
        streamDeck.logger.debug("Clearing token and refetching clips");
        streamDeck.settings.setGlobalSettings<SPLSoundboardSettings>({ token: undefined });
    }

    /**
     * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
     * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}.
     */
    override async onWillAppear(ev: WillAppearEvent<PlaySoundSettings>): Promise<void> {
        this.settings = await streamDeck.settings.getGlobalSettings<SPLSoundboardSettings>();

        if (this.settings.token && testAuth) {
            this.clearTokenAndRefetch();
        }
    }

    /**
     * Occurs when an action disappears from the Stream Deck due to the user navigating to another page, profile, folder, etc. An action refers to _all_ types of actions, e.g. keys,
     * dials, touchscreens, pedals, etc.
     * @param ev Information about the event, including the source action and contextual payload information.
     */
    override async onWillDisappear?(ev: WillDisappearEvent<PlaySoundSettings>): Promise<void> {
        streamDeck.logger.trace("onWillDisappear - clearing clips for PlaySound");
        this.clips = [];
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PlaySoundSettings>): Promise<void> {
        streamDeck.logger.trace("onDidReceiveSettings - Settings received for PlaySound");
        const { sound: soundString } = ev.payload.settings || {};
        const sound = soundString ? JSON.parse(soundString) : null;
        if (sound) {
            streamDeck.logger.trace("onDidReceiveSettings - Setting title to sound name:", sound.name);
            ev.action.setTitle(sound.name);
        }
    }

    private async fetchClipsAndUpdatePI() {
        try {
            // Fetch the soundboard clips if not already fetched.
            const clips = await this.#getSoundboardClips();
            //@ts-ignore
            this.clips = clips;
            streamDeck.ui.sendToPropertyInspector(this.generatePIPayloadFromClips());
        } catch (err) {
            streamDeck.logger.error("Error fetching clips for property inspector:", err);
        }
    }

    override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<PlaySoundSettings>): Promise<void> {
        const { token } = this.settings;
        if (token) {
            // Send the current clips to the property inspector.
            if (this.clips.length) {
                streamDeck.ui.sendToPropertyInspector(this.generatePIPayloadFromClips());
            } else {
                await this.fetchClipsAndUpdatePI();
            }
        }
    }

    /**
     * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
     * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
     * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
     * settings using `setSettings` and `getSettings`.
     */
    override async onKeyUp(ev: KeyUpEvent<PlaySoundSettings>): Promise<void> {
        const { sound: soundString } = ev.payload.settings || '{}';
        const { token } = this.settings;

        if (!token) {
            throw new Error("Token not configured.");
        }

        if (!soundString) {
            streamDeck.logger.warn("No sound selected to play", soundString);
            return;
        }

        try {
            const sound: Sound = JSON.parse(soundString);

            const req = await fetch(`${this.botUrlBase}/api/soundboard/${token}/postMsg`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Referer": "streamdeck://com.joseph-claus.spl-soundboard.play",
                    "requester": "streamdeck://com.joseph-claus.spl-soundboard.play"
                },
                body: JSON.stringify(sound)
            });
            const res = await req.json();
            if (res.success) ev.action.showOk();
        } catch (err) {
            streamDeck.logger.error("Error playing sound:", err);
            ev.action.showAlert();
        }
    }

    override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, PlaySoundSettings>): Promise<void> {
        streamDeck.logger.trace("onSendToPlugin - Received message from property inspector");
        // Check if the payload is requesting a data source, i.e. the structure is { event: string }
		if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "getClips" && this.settings.token !== "") {
            if (this.clips.length) {
                // Send the product ranges to the property inspector.
                streamDeck.ui.sendToPropertyInspector(this.generatePIPayloadFromClips());
            } else {
                this.fetchClipsAndUpdatePI();
            }
        }
    }

    async #getSoundboardClips(): Promise<DataSourceResult> {
        streamDeck.logger.trace("#getSoundboardClips - Fetching soundboard clips");
        const { token } = this.settings;

        if (!token || token === "") {
            return [];
        }

        return new Promise(async (resolve, reject) => {
            let res: Response | undefined;
            try {
                res = await fetch(`${this.webUrlBase}/api/soundboard?token=${token}`, {
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
    webUrlBase?: string;
    botUrlBase?: string;
    token?: string;
}
