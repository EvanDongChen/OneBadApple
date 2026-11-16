<div align="center">

# 🍎 One Bad Apple

**A village of little fruits with legs plays Werewolf while you watch. One of them is rotten.**

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![three.js](https://img.shields.io/badge/three.js-react--three--fiber-000000?logo=threedotjs&logoColor=white)](https://r3f.docs.pmnd.rs)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20(optional)-8e75b2?logo=googlegemini&logoColor=white)](https://aistudio.google.com)

[**Play in your browser**](https://evandongchen.github.io/OneBadApple/) · [Run it locally](#-quick-start) · [How a day goes](#-how-a-day-goes) · [Using Gemini](#-using-gemini)

<img src="docs/screenshots/hero.png" alt="Ten fruits with stick legs and tiny faces standing in a circle: a pear, a plum, a lemon, an orange, an apple, a kiwi, a cherry, a blueberry, a peach and a lime" width="820">

</div>

<br>

You set up the villagers and their personalities, press start, and the game plays itself in 3D. The fruits waddle about on wobbly physics, pair off to gossip, point fingers at the vote, and get sliced up in the night.

Nobody plays. You just watch it go wrong.

## ✨ What's in it

| | |
|---|---|
| 🧠 **Two brains** | **Gemini AI** decides everything each fruit does and says. **No AI** runs on built-in personality rules and about 280 stock lines, with no key and no cost. |
| 🎭 **Personalities** | Every fruit has four sliders (aggression, honesty, talkativeness, suspicion) and a free-text quirk like *"speaks like a tired old sailor"*. |
| 🐺 **Roles** | Werewolves and villagers, plus an optional seer, doctor, hunter and jester. You choose how many wolves and which roles are in play. |
| 🤫 **Private conversations** | Fruits pair off and talk at the same time. Only the fruits in a conversation hear it, so rumours spread by word of mouth and get passed on wrongly. |
| 💭 **Minds you can read** | Each fruit keeps a private thought and a trust score for every other fruit. Open one in the side panel, or float every thought over its owner's head. |
| 🔪 **Fruit physics** | Wobbly walking, floppy arms, stepping legs, and victims that fall apart into slices shaped like the fruit they were. |
| 😱 **Body language** | Fruits gasp and jump back at a death, shake when they are accused, cheer when a wolf is caught and sulk when they got it wrong. |
| 🗣️ **Voices** | Every fruit babbles in its own voice: the kind of fruit sets the pitch, and chatty fruits gabble faster. |
| 📜 **Recap** | When the game ends, read back who killed whom, how every vote went, and when each fruit changed its mind about another, marked right or wrong. |
| 🍐 **Ten fruits** | Apple, orange, lemon, plum, pear, lime, peach, blueberry, cherry and kiwi, each with its own shape. |
| ⏯️ **Spectator controls** | Pause, 1x / 2x / 4x speed (the fruits walk faster too), peek at roles, show thoughts, and sound on or off. |

## 📸 Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/setup.png" alt="The setup screen, with a choice of Gemini AI or No AI, house rules for werewolves and roles, and a list of villagers">
      <p align="center"><b>Set up the village</b><br>Pick the brain, the roles and each fruit's personality.</p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/talk.png" alt="Fruits split into two groups, each with its own speech bubble, and a log of who said what to whom">
      <p align="center"><b>Talking it over</b><br>Small groups talk at once. The log shows who said what to whom.</p>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <img src="docs/screenshots/vote.png" alt="Fruits gathered in a circle to vote. Two red crosses float over the lemon, and a side panel shows the orange's private thought and its trust in each other fruit">
      <p align="center"><b>The vote, and a mind laid open</b><br>Crosses stack up over whoever is being voted for. On the right, the seer's private thought and how far it trusts everyone else.</p>
    </td>
  </tr>
</table>

## 🚀 Quick start

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
git clone https://github.com/EvanDongChen/OneBadApple.git
cd OneBadApple
npm install
npm run dev
```

Open the address it prints, normally http://localhost:5173/OneBadApple/, choose **No AI**, and press **Wake the village**.

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and make a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## 🌗 How a day goes

1. **Night.** Everyone walks home. The wolf runs over with a knife and slices its victim, unless the doctor guarded them. The seer learns one fruit's side.
2. **Dawn.** The village finds out who died and what they were.
3. **Talking it over.** The fruits pair off for one or more rounds of private conversation.
4. **The vote.** Everyone gathers in the circle, points at their choice and says why. The fruit with the most votes is flung out. A tie eliminates nobody.

### Who wins

| Side | Wins when |
|---|---|
| 🏡 Village | Every werewolf is dead |
| 🐺 Werewolves | They make up at least half of the living fruits |
| 🃏 Jester | The village votes it out |

### Roles

| Role | Side | What it does |
|---|---|---|
| Werewolf | Wolves | Kills one fruit each night and lies about it by day |
| Villager | Village | No powers. Talks and votes |
| Seer | Village | Learns each night whether one fruit is a werewolf |
| Doctor | Village | Protects one fruit from the knife each night |
| Hunter | Village | Takes one fruit of its choice down with it when it dies |
| Jester | Itself | Tries to get voted out without making it obvious |

## 🤖 Using Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).
2. On the setup screen choose **Gemini AI** and paste the key.

The key is kept in your browser's local storage and is sent only to Google. It is never part of the site or this repository, so everyone who uses the hosted page pastes their own.

<details>
<summary><b>Skip the pasting during local development</b></summary>

<br>

Create a file called `.env.local` in the project folder:

```
VITE_GEMINI_API_KEY=your-key-here
```

The file is ignored by git and is only read by `npm run dev`, never by a production build.

</details>

<details>
<summary><b>What it costs</b></summary>

<br>

The game makes **two Gemini calls per in-game day**, one for the night and one for the day, so a whole game is usually 4 to 10 calls.

The default model is `gemini-flash-lite-latest`, and you can pick another on the setup screen. There is a cap on calls per game, 80 by default. If a call fails or the cap is hit, the fruits carry on using the No AI rules.

</details>

<details>
<summary><b>How the prompts work, and one caveat</b></summary>

<br>

Each call sends a fixed cast list, written once at the start of the game, followed by the current state of the world: who is alive, the public log, and a private section for each fruit holding what it knows, what it is thinking, how far it trusts each other fruit, and the conversations it was part of.

- The **night call** returns the wolf's victim, the doctor's and seer's choices, the hunter's standing target, and every fruit's updated thought and trust scores.
- The **day call** returns every conversation in every round, then every vote.

Anything missing or illegal in a reply is filled in by the No AI rules.

The caveat: to keep the call count low, one call plays every fruit at once and is told to keep each fruit's knowledge separate. That usually holds, but a model can occasionally let a fruit act on something it should not know.

</details>

## 🌍 Hosting on GitHub Pages

The repository includes a workflow, `.github/workflows/deploy.yml`, that builds and publishes the site whenever `main` is pushed.

One-time setup: on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

The site is built to live at `/OneBadApple/`. If you fork and rename it, change `base` in `vite.config.ts` to match.

## 🗂️ Project layout

```
src/
├── sim/                    the game, with no 3D in it
│   ├── engine.ts           game loop: deals roles, runs each night and day, checks for a winner
│   ├── geminiBrain.ts      builds prompts, calls Gemini, repairs anything illegal in the reply
│   ├── mockBrain.ts        the No AI brain: personality-driven decisions
│   ├── dialog.ts           stock lines for the No AI brain
│   ├── store.ts            shared game state and saved settings
│   └── types.ts            shared shapes, including the Brain interface
└── components/             what you see
    ├── Fruit.tsx           one fruit: wobble physics, legs, arms, face, bubbles
    ├── fruitShapes.tsx     the ten fruit shapes, and how each one slices
    ├── Stage.tsx           the white stage, grid floor and lights
    ├── SetupPanel.tsx      the setup screen
    ├── Hud.tsx             in-game overlay: phase sign, controls, villagers, gossip log
    └── Recap.tsx           the end-of-game recap
```

The engine only enforces the rules. Every choice comes from a `Brain`, which has two methods:

```ts
interface Brain {
  playNight(world: WorldView): Promise<NightScript>
  playDay(world: WorldView): Promise<DayScript>
}
```

Adding another AI provider means writing one more class with those two methods.

## 🛠️ Built with

- [React](https://react.dev), [TypeScript](https://www.typescriptlang.org) and [Vite](https://vite.dev)
- [three.js](https://threejs.org) through [react-three-fiber](https://r3f.docs.pmnd.rs) and [drei](https://drei.docs.pmnd.rs)
- [Rapier](https://rapier.rs) for physics
- [Zustand](https://zustand.docs.pmnd.rs) for state
- [Gemini API](https://ai.google.dev) for the optional AI brain

## 🤝 Contributing

Ideas, bug reports and pull requests are welcome. Good places to start:

- **New lines.** Add to the pools in `src/sim/dialog.ts`.
- **New fruits.** Add a silhouette to `SHAPES` in `src/components/fruitShapes.tsx` and a colour to `fruitLooks.ts`.
- **New roles.** Add the role to `types.ts`, deal it in `engine.ts`, and describe it in `geminiBrain.ts`.
- **Another AI provider.** Implement the `Brain` interface.

Run `npm run build` before opening a pull request; it type-checks the whole project.

<div align="center">
<br>

Made with too much fruit. 🍊🍋🍐🍒

</div>
