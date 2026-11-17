/**
 * Stock lines for the no-AI brain. Placeholders:
 *   {x} the fruit being talked to or about
 *   {y} a second fruit (the one being gossiped about)
 *   {d} the most recently dead fruit
 *   {n} a number: a day, or a percentage
 */

/** Meeting: accusing {x}, from an aggressive fruit. */
export const ACCUSE_HARSH = [
  "It's {x}. I'd bet my stem on it.",
  '{x}, you are rotten to the core and everyone can smell it.',
  'Stop wasting daylight. {x} is the wolf.',
  "Look at {x} squirm. That's guilt.",
  "I've seen compost more trustworthy than {x}.",
  '{x} has been lying since sunrise. Peel them.',
  'One of us is a monster and its name is {x}.',
  "{x}, wipe that look off your rind. We know.",
  'I want {x} gone before dark. No discussion.',
  'Every word out of {x} is mush. Vote them out.',
  "{x} did it. I'm done being polite about it.",
  "If {x} isn't the wolf, I'll eat my own leaf.",
  '{x} smells like wet dog and bad decisions.',
  "Don't let {x} talk their way out of this one.",
  'You think I did not notice, {x}? I notice everything.',
  '{x} has fangs under that smile. Open your eyes, all of you.',
  "I'm pointing at {x} and I'm not putting my arm down.",
  'Say what you like, {x}. You are going in the juicer.',
  '{x}. Wolf. Next question.',
  "The rot starts with {x}. Cut it out before it spreads.",
  'Funny how {x} is never surprised when someone dies.',
  "{x} is guilty and the rest of you are too soft to say it.",
]

/** Meeting: accusing {x}, from a gentle fruit. */
export const ACCUSE_MILD = [
  "I don't want to point fingers, but {x} seems a little off.",
  'Has anyone else noticed {x} acting strange?',
  "I could be wrong, but I'd keep an eye on {x}.",
  'Something about {x} is bruising my trust.',
  "No offence, {x}, but you've been very quiet about last night.",
  'I had a funny feeling when {x} walked past my hut.',
  "It's probably nothing, but {x} wouldn't look at me this morning.",
  'Would {x} mind telling us where they were?',
  "I'm sorry, {x}. My gut keeps landing on you.",
  "I hate this, but if I had to guess, I'd say {x}.",
  '{x} seems nervous. Or is that just me?',
  "I'm not accusing anyone. I'm just looking at {x} for a while.",
  'Maybe we should hear a bit more from {x}.',
  '{x} laughed at an odd moment yesterday. It stuck with me.',
  "I'd feel safer if {x} explained themselves.",
  "Don't be cross, {x}, but your story has a soft spot.",
  'My leaves stand up whenever {x} is near. That means something.',
  'I keep coming back to {x}. I wish I did not.',
  'Could it be {x}? I really hope not.',
  "{x} is lovely, truly. That's sort of what worries me.",
]

/** Meeting: {x} just accused me, and I bite back. */
export const DEFEND_HARSH = [
  "Me? That's rich coming from {x}.",
  'Accuse me again, {x}, and see what happens.',
  '{x} is pointing at me so nobody looks at them.',
  'Oh, sit down, {x}. You have nothing.',
  "That's the best you've got, {x}? Pathetic.",
  'Interesting how fast {x} found someone to blame.',
  "Keep my name out of your mouth, {x}.",
  'Classic wolf move, {x}. Pick a target and shout.',
  "I'm innocent and {x} knows it. Ask why they are lying.",
  '{x} wants me gone because I am onto them.',
  "Try that on someone softer, {x}.",
  'You will regret that, {x}. I have a long memory.',
  'Loud accusations, {x}. Empty basket.',
  "If I were the wolf, {x}, you'd already be pulp.",
  "Nice try, {x}. Now tell them where YOU were.",
  '{x} just made my list. Top of it.',
]

/** Meeting: {x} just accused me, and I plead. */
export const DEFEND_MILD = [
  "Please, {x}, I'm just a normal fruit. I was asleep.",
  "I understand why you'd wonder, {x}, but it isn't me.",
  "I promise I'm innocent. Ask anyone.",
  "That hurts, {x}. I thought we were friends.",
  "I wouldn't even know how to be a wolf, {x}.",
  'I was in my hut all night with the door bolted.',
  "{x}, I get it, everyone's scared. But you have the wrong fruit.",
  "Look at me. Do I look like I could hurt anybody?",
  "I'm as frightened as you are, {x}.",
  'If you vote me out, the wolf is still here tomorrow.',
  "I don't blame you, {x}. I'd just like you to be wrong more quietly.",
  'I have nothing to hide. Search my hut if you like.',
  "Oh dear. {x}, please, think it through.",
  "I couldn't sleep a wink last night, but I never left my bed.",
  "It's not me, {x}. I swear on my seeds.",
  'I only want us all to make it to harvest.',
]

/** Meeting: someone else already named {x} and I pile on. */
export const AGREE = [
  'I was thinking the same about {x}.',
  "Finally someone said it. {x} has been off all day.",
  "That's two of us looking at {x} now.",
  'Yes. {x}. I noticed it too.',
  "I didn't want to be first, but {x} worries me as well.",
  'If we are counting votes, mine is leaning toward {x}.',
  '{x} has not given one straight answer yet.',
  'Agreed. Something about {x} does not add up.',
  "I'll back that. {x} needs to explain.",
  'Same feeling here. {x} is hiding something.',
  'Makes sense to me. {x} was awfully calm this morning.',
  "I'm with you. Eyes on {x}.",
]

/** Meeting: standing up for {x}, a fruit I trust. */
export const VOUCH = [
  "Leave {x} alone. They're one of the good ones.",
  "It's not {x}. I'd stake my skin on that.",
  "{x} has been straight with me. I believe them.",
  "You're barking up the wrong tree with {x}.",
  'I trust {x}. Look somewhere else.',
  "{x} wouldn't hurt a fruit fly.",
  "If {x} is the wolf, I'm a turnip.",
  'Whoever it is, it is not {x}.',
  "{x} and I talked this morning. Nothing wolfish there.",
  "We're wasting time on {x}. The real wolf is enjoying this.",
  "I'll vouch for {x}. For what my word is worth.",
  "{x} is as scared as the rest of us. That's not an act.",
]

/** Meeting: nothing to add. */
export const IDLE = [
  "I don't have anything solid yet.",
  'Can we all stay calm and stay juicy?',
  "I'm just listening for now.",
  'Honestly, I have no idea who it is.',
  'I barely slept. I keep hearing scratching.',
  "Let's not rush this. A wrong vote helps the wolf.",
  'Somebody here is lying, and they are good at it.',
  "I wish I'd stayed on the tree.",
  'Has anyone got actual proof? Anyone?',
  'My stomach is in knots. Do I have a stomach?',
  'We need to think, not shout.',
  "I'll go along with the group. I think.",
  'Every night it gets quieter around here.',
  'I keep looking at everyone and trusting no one.',
  "This used to be such a nice village.",
  'Could we maybe just all agree not to be wolves?',
  "I'm watching. That's all I'll say.",
  'Whoever it is, they are standing right here listening.',
  'The village feels colder today.',
  "I don't like any of this.",
  'Talk it through. Someone will slip.',
  'We are running out of fruits to be wrong about.',
]

/** Meeting: remembering {d}, who died most recently. */
export const MOURN = [
  'Poor {d}. They deserved better than that.',
  "I still can't believe {d} is gone.",
  '{d} was right here yesterday, complaining about the weather.',
  'Whoever did that to {d} is standing in this circle.',
  'For {d}, then. Let us get this right.',
  '{d} would have known what to do.',
  'I keep expecting {d} to waddle round the corner.',
  "We owe it to {d} to find the wolf today.",
  '{d} never hurt anyone. Remember that when you vote.',
  'First {d}. Who is next? Think about that.',
]

/** Tacked on by talkative fruits. */
export const EXTRA = [
  'Think about it.',
  "I've been watching all morning.",
  "And I won't be quiet about it.",
  'Mark my words.',
  'That is all I am saying. For now.',
  'You all know I am right.',
  'And another thing, the fire is too small.',
  'I said what I said.',
  'Not that anyone listens to me.',
  'Honestly.',
  'I could go on. I will not. But I could.',
  'Sleep on that. If you dare sleep.',
  "It's obvious when you look at it my way.",
  "Anyway. That's my piece.",
  'Somebody write that down.',
  'I have a nose for these things.',
  "I'm rarely wrong. Occasionally. But rarely.",
  'Just saying.',
]

/** Morning, privately to {x}: an aggressive fruit confronting its suspect. */
export const CONFRONT = [
  "I've got my eye on you, {x}.",
  'Where were you last night, {x}?',
  "Don't think I haven't noticed, {x}.",
  'You and me are going to have a problem, {x}.',
  "Give me one reason not to name you at the vote, {x}.",
  'I heard footsteps by your hut, {x}. Explain.',
  "You're sweating, {x}. Fruits don't sweat.",
  'I know what you are, {x}.',
  'Tonight I sleep with one eye open, and it is on you, {x}.',
  "Smile all you want, {x}. I'm not buying it.",
  'If someone dies tonight, {x}, I am coming for you first.',
  "Tell the truth now, {x}, and I'll go easy.",
  'Something stinks, {x}, and I followed the smell here.',
  "You've been avoiding me, {x}. Why?",
]

/** Morning, privately to {x}: gossiping about {y}. */
export const GOSSIP = [
  'Psst. Do you trust {y}?',
  "Between us, I think it's {y}.",
  'Stick with me today. {y} worries me.',
  'Have you seen how {y} looks at everyone?',
  "Don't tell anyone, but I'm voting {y}.",
  'If I go missing tonight, it was {y}.',
  "Keep your door locked. I don't like {y} one bit.",
  'Did {y} seem jumpy to you this morning?',
  'I heard {y} was out after dark.',
  "You're sensible. What do you make of {y}?",
  "I'd watch your back around {y}.",
  'Quietly now. Me and you against {y}?',
  "{y} said something odd to me yesterday. I can't shake it.",
  "I think {y} is playing us all.",
  'Promise you will back me if I call out {y}.',
]

/** Morning, privately to {x}: making friends, no target. */
export const ALLY = [
  "You're one of the few I trust, {x}.",
  'Whatever happens today, {x}, I am on your side.',
  "Let's look out for each other, {x}.",
  "I'm glad you're still here, {x}.",
  "If you hear anything, {x}, tell me first.",
  'Stay close to me at the vote, {x}.',
  "I don't know who it is, {x}, but I know it's not you.",
  "We'll get through this, {x}. Probably.",
  "You sleep all right, {x}? I didn't.",
  'Us normal fruits have to stick together, {x}.',
]

/** Seer telling the meeting that {x} is a werewolf. */
export const SEER_REVEAL = [
  'I am the seer. I looked at {x} last night and saw a werewolf.',
  'I am the seer, and {x} is the wolf. I saw the teeth myself.',
  'Listen to me. I am the seer. {x} is not what they seem.',
  'I am the seer. I have been holding this in: {x} is a werewolf.',
  "I am the seer. Vote {x}. I won't get another chance to tell you.",
  'I am the seer. I peeked into the heart of {x} and it was all fur.',
]

/** Seer vouching for {x} from what it saw. */
export const SEER_CLEAR = [
  'I have my reasons, but trust me: {x} is clean.',
  "It's not {x}. I know that for certain. Don't ask how.",
  'Leave {x} out of it. I am sure of them.',
  '{x} is innocent. I would bet the whole orchard.',
]

/** A dishonest werewolf inventing evidence against {x}. */
export const WOLF_LIE = [
  'I saw {x} sneaking around the huts last night. Explain that.',
  'I am the seer. I looked at {x} last night and saw a werewolf.',
  'There were muddy footprints outside the hut of {x} this morning.',
  'I woke in the night and {x} was standing in the plaza. Just standing.',
  '{x} told me this morning they wanted someone gone. Their words.',
  'I heard growling from the direction of {x}. I am not making it up.',
  "Ask {x} why their door was open at dawn.",
  'I did not want to say it, but I watched {x} follow the victim home.',
  '{x} had something on their mouth this morning. Red.',
  'I trust my eyes, and my eyes saw {x} out after dark.',
]

/** Said out loud while voting. */
export const VOTE_KNOWN = ['I know what I saw.', 'I am certain. Do not ask me how.', 'This one is not a guess.', 'I have looked into this one. Trust me.']
export const VOTE_GRUDGE = [
  'Nobody accuses me and walks away.',
  'You came for me first.',
  'You should have kept quiet about me.',
  'Call it self-defence.',
  'You pointed, I point back.',
]
export const VOTE_HARSH = [
  'Good riddance.',
  'Off you pop.',
  'Into the juicer.',
  'Should have done this yesterday.',
  'No hard feelings. Actually, plenty.',
  'Rotten. Out.',
  'I have heard enough.',
  'Easy choice.',
]
export const VOTE_MILD = [
  'Sorry. Just a feeling.',
  "I hope I'm wrong.",
  "Forgive me if it isn't you.",
  'I had to pick someone.',
  "It's nothing personal.",
  'I went back and forth all day.',
  'My gut says so. I am sorry.',
  'Please do not hate me for this.',
]
export const VOTE_FOLLOW = ['I am going with the group on this.', 'Everyone seems sure, so.', 'That makes it settled, I suppose.', 'What they said.']

/** Private thoughts shown in the mind reader. */
export const THOUGHT_WOLF = [
  "If I can pin this on {x}, I'm safe.",
  'Keep smiling. Let {x} take the fall.',
  '{x} is getting close. Tonight, maybe.',
  'Nobody suspects me while they are all shouting at {x}.',
  'Stay calm. Agree with whoever is loudest about {x}.',
]
export const THOUGHT_VILLAGER = [
  "I don't trust {x}.",
  'It has to be {x}. Doesn\'t it?',
  'Why does {x} keep looking at me?',
  "If I'm wrong about {x}, we are all jam.",
  'Watch {x}. Just watch.',
  'Something about {x} keeps me up at night.',
]

/** Conversation: reacting to gossip about {x} without taking a side. */
export const UNSURE = [
  "Hm. I hadn't thought about {x} like that.",
  "Maybe. I'd want to see more before I point at {x}.",
  "{x}? I don't know. Could be anyone.",
  "I'll keep an eye on {x}, then.",
  "You might be onto something with {x}. Or not.",
  "I've no quarrel with {x}, but I'm listening.",
  "That's a big thing to say about {x}.",
  "Let's see how {x} votes. That'll tell us.",
]

/** Conversation: warm replies with no accusation in them. */
export const SMALL_TALK = [
  'Thanks. I needed to hear that.',
  'Same to you. Stay safe tonight.',
  "Let's just get through today.",
  "I'm glad someone's still friendly.",
  'Keep your door bolted.',
  "If I hear anything, you'll be the first to know.",
  'We should talk again before the vote.',
  "I've got your back. For now.",
  'Did you sleep at all? I did not.',
  "Careful who you say that to.",
]

/** The jester wants to be voted out, so it acts as shifty as it can. */
export const JESTER = [
  'Maybe it IS me. Who can say? Not me. Or can I?',
  "I wouldn't vote for me. Unless you wanted to. You could.",
  'Funny how I was nowhere near my hut last night.',
  'Awoo. Sorry. Something in my throat.',
  "I'm definitely not the wolf. Definitely. Stop looking at my teeth.",
  'If I were you, I would be very suspicious of me.',
  'What a lovely night for a murder. I mean, a walk.',
  "Don't ask where I was. You won't like the answer.",
  'I have nothing to hide. Except the thing I am hiding.',
  'Has anyone seen my other knife? My ONLY knife. My no knife.',
  'You can trust me as far as you can throw me. Go on. Throw me.',
  'I slept terribly. All that howling I was doing. Hearing.',
]

/** The hunter's last words as it takes {x} down with it. */
export const HUNTER_SHOT = [
  "If I'm going, {x} is coming with me.",
  'One last shot. This one is for you, {x}.',
  "I had {x} marked from the start.",
  'See you in the compost, {x}.',
]

/** Last words of an innocent fruit being voted out: pleading. */
export const LAST_PLEA = [
  'Wait. Please. You are making a mistake.',
  'It was not me. You will see in the morning.',
  'I am just a fruit. I never hurt anyone.',
  'Look after each other. The wolf is still here.',
  'I forgive you. Mostly.',
  'Somebody check my room. There is no knife. There is no knife!',
  'Oh no. Oh no, no, no.',
  'Remember I said it was not me.',
]

/** Last words of an innocent fruit being voted out: furious. */
export const LAST_CURSE = [
  'You fools. You absolute pips.',
  'I hope the wolf eats every last one of you.',
  'Enjoy tonight. One of you will not see the morning.',
  'Wrong fruit. Again. Well done, everyone.',
  'I will haunt this village. I will haunt it so hard.',
  'May you all go soft and brown.',
  'When I am proved right, I want an apology on my grave.',
  'Rot. All of you. Rot.',
]

/** Last words of a werewolf that has been caught. */
export const LAST_WOLF = [
  'Fine. It was me. And it was delicious.',
  'Took you long enough.',
  'You got one of us. Sleep well.',
  'I regret nothing. Especially the pear.',
  'Clever little fruits. I almost had you.',
  'Ha. You only caught me because I got bored.',
  'It was me the whole time. Did you like the knife?',
  'I would do it again. Slowly.',
]

/** Last words of the jester, which wanted this. */
export const LAST_JESTER = [
  'Yes. YES. Thank you. Thank you all.',
  'You fell for it. Every one of you.',
  'This is the best day of my life.',
  'I could not have done it without your terrible judgement.',
]

/** One werewolf suggests a victim, {x}, to the pack. */
export const WOLF_PROPOSE = [
  'I say we take {x} tonight.',
  '{x}. It has to be {x}.',
  'I have been watching {x}. Too clever by half.',
  '{x} looks at me funny. Let us fix that.',
  'What about {x}? Nobody would miss them.',
  'My knife says {x}.',
]

/** Another werewolf disagrees and wants {x} instead. */
export const WOLF_COUNTER = [
  'No. {x} is the dangerous one.',
  'Forget that. {x} is on to us.',
  'Too obvious. {x} is the better kill.',
  'You are thinking with your stomach. It should be {x}.',
  'Leave them. {x} keeps saying my name.',
  'I would sooner have {x}.',
]

/** A werewolf agrees with the victim, {x}. */
export const WOLF_AGREE = [
  'Agreed. {x} it is.',
  'I was going to say {x} myself.',
  'Good. {x} has had it coming.',
  'Yes. {x}. Quietly.',
]

/** A werewolf gives way: the pack will go for {x}. */
export const WOLF_GIVE_IN = [
  'Fine. {x}. But tomorrow night is my pick.',
  'Have it your way. {x}.',
  'All right, all right. {x}.',
  'If it goes wrong, {x} was your idea.',
]

/** The pack sets off for {x}. */
export const WOLF_SETTLE = [
  'Then it is settled. {x} does not see the morning.',
  'Knives out. {x} first.',
  'Go on, then. Make it clean.',
  'Back before dawn, and not a word.',
]

// ---------- What the dead think. Ghosts know who everyone really was. {x} is whoever it is about. ----------

/** A fruit has just been killed in the night. */
export const GHOST_DEATH = [
  'Oh, {x}. Not you too.',
  'Welcome to the other side, {x}. It is quiet here.',
  'I tried to warn them. Nobody listens to a ghost.',
  'Budge up, everyone. {x} is joining us.',
  'Poor {x}. Sliced so thin.',
  'I saw the whole thing. I always see the whole thing.',
]

export const GHOST_SAVED = ['The doctor earned its keep tonight.', 'Close one. Nobody new up here today.', 'Good. It is crowded enough already.']

/** A vote has just been cast against an innocent fruit. */
export const GHOST_BALLOT_WRONG = [
  'No. Not {x}. {x} is innocent!',
  'Wrong fruit. Wrong fruit!',
  'I cannot watch this.',
  'They are doing it again.',
  '{x} never hurt a soul, you pips.',
  'If I had hands I would be wringing them.',
]

/** A vote has just been cast against a werewolf. */
export const GHOST_BALLOT_RIGHT = ['Yes. {x}. Keep going.', 'Finally, someone with eyes.', 'That is the one. THAT one.', 'Warmer. Much warmer.', 'Oh, please let the others follow.']

/** An innocent fruit has been voted out. */
export const GHOST_OUT_WRONG = [
  'And there goes {x}. Innocent as a pip.',
  'Well done. Another one for my side of the fence.',
  'I would scream, but nobody would hear it.',
  'Sorry, {x}. They never learn.',
  'The wolf must be laughing itself sick.',
]

/** A werewolf has been voted out. */
export const GHOST_OUT_RIGHT = ['Got one. About time.', 'That one was for me, {x}.', 'Ha. Enjoy being dead, {x}.', 'Justice. Late, but justice.', 'I knew it. I KNEW it.']

export const GHOST_TIE = ['A tie. Brilliant. Just brilliant.', 'They cannot even agree on who to get wrong.', 'Another day wasted.']

/** The werewolves are whispering and only the dead can hear them. */
export const GHOST_WHISPER = ['They are RIGHT THERE. Look!', 'I can hear every word. Much good it does me.', 'Somebody wake up. Anybody.', 'Oh, so THAT is who it was.']

/** A dead werewolf, when things go well for the pack. */
export const GHOST_WOLF_GLAD = ['Lovely. Keep it up.', 'Still winning, even dead.', 'The pack sends its regards.', 'Oh, this is going beautifully.', 'They make it so easy.']

/** A dead werewolf, when the village is closing in on {x}. */
export const GHOST_WOLF_SORE = ['No, no, no. Leave {x} alone.', 'Tch. Sloppy.', 'They got lucky.', 'Do not look at {x}. Look anywhere else.']

/** One line of history for a fruit, in its own words. Each villager is dealt one at random. */
export const BACKSTORIES = [
  'I fell off the tree early. Nobody caught me.',
  'I used to be in a pie. I got out.',
  'I grew up at the bottom of the fruit bowl.',
  'I was the last one picked. Every single time.',
  'I once rolled all the way down the hill and never told anyone why.',
  'I was nearly a smoothie. You do not forget that.',
  'I spent a summer in a lunchbox. I saw things.',
  'I was raised by a family of onions. I do not cry easily.',
  'I won the county fair. Third place, but still.',
  'I ran away from the orchard and never looked back.',
  'I have a twin. We do not speak.',
  'I survived the back of the fridge.',
  'I used to be a decoration. They thought I was wax.',
  'A bird carried me here. I never asked where from.',
  'I was in the bargain bin once. It changes you.',
  'I learned everything I know from a jar of jam.',
]

/** Ways a fruit brings its backstory, {b}, into a conversation. */
export const BACKSTORY_TALK = ['Did I ever tell you? {b}', 'This is nothing. {b}', 'It takes me back. {b}', 'You would not understand. {b}', 'I have seen worse. {b}']

// ---------- Lines that quote a fruit's memory. {x} is who it is about, {y} a second fruit, {n} a day number. ----------

/** Said to a third fruit about {x}. */
export const CITE_VOTED_INNOCENT = ['{x} voted for {y} on day {n}, and {y} was innocent.', 'Remember day {n}? {x} helped vote {y} out. {y} was one of us.', 'I keep coming back to day {n}. {x} pointed at {y}, and {y} was clean.']
export const CITE_DEFENDED_WOLF = ['{x} stood up for {y}. And {y} was a wolf.', 'Who defended {y}, right up until the teeth came out? {x} did.', '{x} told us {y} was fine. {y} was a werewolf.']
export const CITE_ACCUSED_DEAD = ['{x} kept naming {y}. Then {y} turned up dead.', 'On day {n}, {x} wanted {y} gone. The wolf obliged.', 'Funny how {x} had it in for {y}, and now {y} is in slices.']
export const CITE_ACCUSED_ME = ['{x} came for me on day {n}. I have not forgotten.', 'On day {n}, {x} tried to pin it on me. Ask yourself why.', '{x} has been after me since day {n}.']
export const CITE_VOTED_ME = ['{x} voted for me on day {n}. I remember every vote.', 'On day {n}, {x} tried to have me thrown out.']
export const CITE_CAUGHT = ['{x} told me two different stories about the same night.', 'Ask {x} where it was that night. Then ask again tomorrow.', "{x}'s story keeps changing. I heard both versions."]
export const CITE_VOTED_WOLF = ['{x} voted for {y}, and {y} was a wolf. That counts for something.', 'Say what you like about {x}, but it got {y} right on day {n}.']
export const CITE_DEFENDED_ME = ['{x} stood by me on day {n}. I do not forget that.', '{x} spoke up for me when nobody else would.']

/** The same memories, said to {x}'s face. */
export const FACE_VOTED_INNOCENT = ['You voted for {y} on day {n}, {x}, and {y} was innocent.', 'Day {n}, {x}. You helped throw {y} out. {y} was one of us.']
export const FACE_DEFENDED_WOLF = ['You stood up for {y}, {x}. And {y} was a wolf.', 'You told us {y} was fine, {x}. Care to explain?']
export const FACE_ACCUSED_DEAD = ['You kept naming {y}, {x}. Then {y} turned up dead.', 'You wanted {y} gone on day {n}, {x}. Somebody listened.']
export const FACE_ACCUSED_ME = ['You came for me on day {n}, {x}. I have not forgotten.', 'You tried to pin it on me on day {n}, {x}. Why was that?']
export const FACE_VOTED_ME = ['You voted for me on day {n}, {x}. I remember every vote.', 'You tried to have me thrown out on day {n}, {x}.']
export const FACE_CAUGHT = ['That is not what you told me before, {x}.', 'Your story has changed, {x}. I heard the first version too.', 'Which is it, {x}? You have told it two ways now.']

/** A werewolf claiming to have seen {x} out on the night in question. Its lies about a night are tracked. */
export const WOLF_SAW = [
  'I saw {x} sneaking around the huts last night. Explain that.',
  'I woke in the night and {x} was standing in the plaza. Just standing.',
  'I trust my eyes, and my eyes saw {x} out after dark.',
  'I did not want to say it, but I watched {x} creep past my door last night.',
  'Last night I looked out and there was {x}, wide awake and going somewhere.',
]

/** A careless werewolf forgetting what it claimed: now it says it slept and saw nothing. */
export const WOLF_SLIP = ['I slept straight through last night. Saw nothing, heard nothing.', 'How would I know? I was fast asleep all night.', 'I never left my bed last night. I did not see a soul.']

/** Theory of mind: {y} suspects the speaker, so it asks {x} for support before the vote. */
export const ALLY_PLEA = ['{y} thinks it is me, {x}. Will you stand with me at the vote?', '{x}, {y} is going to come for me today. I need someone on my side.', 'I can tell {y} has made up its mind about me. Do not let them do it, {x}.']
export const PLEA_YES = ["I'm with you. I never believed it.", 'You have my vote. Well, not that way.', 'I will speak up for you. You have my word.']
export const PLEA_NO = ['We will see how the vote goes.', 'I am not promising anything.', 'Give me a reason, and I might.']

/** A contrarian doubting {x}'s guilt because everyone else is sure of it. */
export const CONTRARY = ['Everyone says {x}. That is exactly why I doubt it.', 'When the whole village agrees on {x}, I get nervous.', 'It is too neat. {x} is who the wolf WANTS us to pick.']

/** Grief: {d} is dead and the speaker blames {x}. */
export const GRIEF_TALK = ['They took {d}. And I think it was {x}.', '{d} was my friend. {x} is going to answer for it.', 'I cannot stop thinking about {d}. I look at {x} and I just know.']

/** Smug: the speaker voted for {y}, who turned out to be a wolf. */
export const TOLD_YOU = ['I said it was {y}. Nobody listened.', 'Who called {y}? I did. You are welcome.', 'Next time, perhaps we go with my guess first.']

/** Defending itself while frightened. */
export const DEFEND_SCARED = ['Please. It is not me. Why would you say that?', 'I did not do anything. I swear on my stem.', 'Do not look at me like that. I am scared too.']

/** Vote reasons shaped by mood. */
export const VOTE_GUILT = ['I got it wrong last time. I do not trust my own judgement today.', 'After what we did yesterday, I am just going with the rest of you.', 'I still feel sick about the last vote. Forgive me.']
export const VOTE_AFRAID = ['I do not want to be next. I am voting with everyone else.', 'Please do not turn on me. I will go along with it.']

/** A guilty fruit apologising to the ghost of {x}, whom it helped vote out. */
export const APOLOGY = ['I am sorry, {x}. I was wrong about you.', '{x}, if you can hear me: I should not have voted for you.', 'We got it wrong, {x}. I got it wrong.']
export const GHOST_APOLOGY = ['Too late. But thank you.', 'I know. Now go and find the real one.', 'Hm. I will haunt you a little less.']

/** More private thoughts. {x} is who it is about, {n} a percentage. */
export const THOUGHT_SURE = ['I am {n}% sure it is {x}.', '{n}% it is {x}. That is enough for me.', 'If I had to bet: {x}, {n}%.']
export const THOUGHT_THREAT = ['{x} thinks it is me. I need friends before the vote.', '{x} is going to vote for me. I have to get ahead of it.', 'I can see what {x} believes. I need allies.']
export const THOUGHT_CAUGHT = ["{x} changed its story. I heard both versions.", 'Two nights, two stories. {x} is lying.']
export const THOUGHT_GRIEF = ['I miss them. And {x} is going to pay.', 'It should have been me. It should have been {x}.']
export const THOUGHT_GUILT = ['We killed an innocent fruit. I helped.', 'I cannot trust my own vote any more.']
export const THOUGHT_PROTECT = ['Whatever happens, {x} stays safe.', 'I do not care who the wolf is, as long as it is not {x}.']
export const THOUGHT_REVENGE = ['Wolf or not, I want {x} gone.', 'This is my chance to be rid of {x}.']
export const THOUGHT_SURVIVE = ['Keep my head down. Vote with the crowd. Stay alive.', 'I do not need to be right. I need to be here tomorrow.']
