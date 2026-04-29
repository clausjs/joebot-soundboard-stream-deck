# SPL Soundboard

Stream Deck plugin for triggering Save Point Lodge soundboard clips.

The plugin adds a **Play Sound** action to Stream Deck. When the action appears, it checks for a saved setup token, fetches the available soundboard clips for that token, lets the user choose a clip in the property inspector, and posts the selected sound to the Save Point Lodge bot API when the key is pressed.

## Requirements

- Node.js 20
- npm
- Elgato Stream Deck 6.5 or newer
- Stream Deck CLI, provided by `@elgato/cli`

The plugin supports macOS 12+ and Windows 10+.

## Getting Started

Install dependencies:

```sh
npm install
```

Build the plugin:

```sh
npm run build
```

The compiled plugin entry point is written to:

```text
com.joseph-claus.spl-soundboard.sdPlugin/bin/plugin.js
```

For local development, run the watcher:

```sh
npm run watch
```

The watcher rebuilds with Rollup and restarts the plugin through the Stream Deck CLI after each successful build.

## Installing Locally

After building, install or link the plugin with the Stream Deck CLI:

```sh
npx streamdeck link com.joseph-claus.spl-soundboard.sdPlugin
```

If the plugin is already linked, use the watch script during development so Stream Deck restarts it automatically:

```sh
npm run watch
```

## Setup Flow

The plugin stores a Save Point Lodge token in Stream Deck global settings.

1. Add the **Play Sound** action to a Stream Deck profile.
2. If no token is configured, the plugin opens the setup page:

```text
https://dev.savepointlodge.com/streamdeck-setup
```

3. The setup page should deep-link back into the plugin with:

```text
streamdeck://plugins/message/com.joseph-claus.spl-soundboard/settings?token=<token>
```

4. The plugin saves that token and uses it to fetch available soundboard clips.
5. Select a clip from the action's property inspector.
6. Press the Stream Deck key to play the selected sound through the bot API.

## Actions

### Play Sound

- UUID: `com.joseph-claus.spl-soundboard.play`
- Property inspector: `ui/play-sound.html`
- Fetches clips from `https://dev.savepointlodge.com/api/soundboard?token=<token>`
- Plays clips by posting to `https://joebotdiscord.com/api/soundboard/<token>/postMsg`

The action title is updated to the selected clip name.

## Project Structure

```text
src/
  plugin.ts                  Plugin registration and deep-link handling
  actions/play-sound.ts      Main soundboard action
  sdpi.ts                    Property inspector data-source types

com.joseph-claus.spl-soundboard.sdPlugin/
  manifest.json              Stream Deck plugin manifest
  ui/play-sound.html         Property inspector for clip selection
  imgs/                      Plugin and action artwork

rollup.config.mjs            TypeScript build configuration
```

## Development Notes

- The production endpoints are selected in `src/actions/play-sound.ts`.
- Set `testing` to `true` in `src/actions/play-sound.ts` to use local endpoints:

```text
http://localhost:3000
http://localhost:8080
```

- Stream Deck logging is currently set to `TRACE` in `src/plugin.ts`.
- The property inspector uses `sdpi-components` from `https://sdpi-components.dev/releases/v4/sdpi-components.js`.

## Scripts

```sh
npm run build
```

Creates a minified production bundle.

```sh
npm run watch
```

Creates a development bundle with source maps, watches for changes, and restarts the plugin.
