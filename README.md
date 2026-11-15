# One Bad Apple

A village of little fruits with legs plays Werewolf (Mafia) while you watch. One of them is rotten.

You set up the villagers and their personalities, press start, and the game plays itself in 3D: the fruits waddle around on wobbly physics, pair off to gossip, vote someone out, and get chopped up in the night.

## What it does

- **Two brains.** In **Gemini AI** mode, Google's Gemini decides everything each fruit does and says. In **No AI** mode, each fruit decides from its personality sliders using built-in rules and a library of about 320 stock lines. No AI mode needs no key and costs nothing.
- **Personalities.** Every fruit has a name, a fruit type, four sliders (aggression, honesty, talkativeness, suspicion) and a free-text quirk. The quirk is only used in Gemini mode.
- **Roles.** Werewolves, villagers, and optionally a seer, a doctor, a hunter (takes someone down when it dies) and a jester (wins alone if voted out). You choose how many wolves and which roles are in play.
- **Private conversations.** Each day the fruits split into pairs and talk at the same time, for as many rounds as you set. Only the fruits in a conversation hear it, so rumours spread from fruit to fruit and can be passed on wrongly.
- **Minds you can read.** Each fruit keeps a private thought and a trust score for every other fruit. Click a fruit in the Villagers panel to see them, or turn on **Show thoughts** to float every thought over its owner's head.
- **Spectator controls.** Pause, 1x/2x/4x speed, peek at roles, and sound on or off.

## How a day goes

1. **Night.** Everyone walks home. The wolf runs over with a knife and slices its victim, unless the doctor guarded them. The seer learns one fruit's side.
2. **Dawn.** The village finds out who died and what they were.
3. **Talking it over.** The fruits pair off for one or more rounds of private conversation.
4. **The vote.** Everyone gathers in the circle, points at their choice and says why. The fruit with the most votes is flung out; a tie eliminates nobody.

The village wins when every werewolf is dead. The werewolves win when they make up at least half of the living fruits. The jester wins if it is voted out.

## Running it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (normally http://localhost:5173/OneBadApple/).

`npm run build` makes a production build in `dist/`, and `npm run preview` serves that build locally.

## Using Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. On the setup screen choose **Gemini AI** and paste the key.

The key is kept in your browser's local storage and is sent only to Google. It is never part of the site or the repository, so everyone who uses the hosted page pastes their own.

For local development you can skip the pasting: create a file called `.env.local` in the project folder containing

```
VITE_GEMINI_API_KEY=your-key-here
```

This file is ignored by git and is only read by `npm run dev`, never by a production build.

**Cost.** The game makes two Gemini calls per in-game day, one for the night and one for the day, so a whole game is usually 4 to 10 calls. The default model is `gemini-flash-lite-latest`; you can pick another from the setup screen. There is a cap on calls per game (80 by default), and if a call fails or the cap is hit, the fruits carry on using the No AI rules.

**A caveat.** To keep the call count low, one call plays every fruit at once and is told to keep each fruit's knowledge separate. That usually holds, but a model can occasionally let a fruit act on something it should not know.

## Hosting on GitHub Pages

The repository includes a workflow, `.github/workflows/deploy.yml`, that builds and publishes the site whenever `main` is pushed.

One-time setup: in the repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

The site is built to live at `/OneBadApple/`. If you rename the repository, change `base` in `vite.config.ts` to match.

## How the code is laid out

| Path | What is in it |
|---|---|
| `src/sim/engine.ts` | The game loop: deals roles, runs each night and day, checks for a winner |
| `src/sim/geminiBrain.ts` | Builds the prompts, calls Gemini, and repairs anything illegal in the reply |
| `src/sim/mockBrain.ts` | The No AI brain: personality-driven decisions |
| `src/sim/dialog.ts` | Stock lines for the No AI brain |
| `src/sim/store.ts` | Shared game state and saved settings |
| `src/sim/types.ts` | The shapes everything else agrees on, including the `Brain` interface |
| `src/components/Fruit.tsx` | One fruit: wobble physics, stepping legs, floppy arms, face, speech and thought bubbles, slicing |
| `src/components/Stage.tsx` | The white stage, grid floor and lights |
| `src/components/SetupPanel.tsx` | The setup screen |
| `src/components/Hud.tsx` | The in-game overlay: phase sign, controls, villager list, gossip log |

The engine only enforces the rules. All choices come from a `Brain`, which has two methods: `playNight` and `playDay`. Adding another AI provider means writing one more class with those two methods.

## Built with

React, TypeScript and Vite, with three.js through react-three-fiber and drei for the 3D, Rapier for physics, and Zustand for state.
