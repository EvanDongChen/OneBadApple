/**
 * Stock lines for the no-AI brain. Placeholders:
 *   {x} the fruit being talked to or about
 *   {y} a second fruit (the one being gossiped about)
 *   {d} the most recently dead fruit
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
