# CHIP-8

A 1977 virtual machine, rebuilt from its instruction set, running in a browser.

CHIP-8 was never a physical chip. It was an interpreter written for hobbyist
computers in the seventies so that people could write games without learning
each machine's own assembly. Programs written for it almost fifty years ago
still run, because the specification is small enough to implement exactly:
4 KB of memory, sixteen registers, a 64 by 32 screen, and thirty-five
instructions.

This is that machine, plus both extensions people built on top of it:
SUPER-CHIP, which doubled the screen to 128 by 64 and added scrolling, and
XO-CHIP, which added a second colour plane, sixty four kilobytes of memory and a
sound chip you load a waveform into. Every one of the programs in the
archive runs.

## Running it

No build step and no dependencies. Serve the folder:

```bash
python -m http.server 3100
```

Then open <http://localhost:3100>. Pick a program from the dropdown and it
plays. Every one of them, fetched from [John Earnest's CHIP-8
archive](https://github.com/JohnEarnest/chip8Archive) when you choose one, and
above them the four games written in [Nibble](https://github.com/HarianthK/nibble),
the language that compiles for this machine, fetched from there the same way.
You can also load your own `.ch8` file.

On a phone, tap the keypad at the bottom of the page instead of typing.

The address follows what you pick, so `?p=snake` on the end of the page's
address opens straight onto that program, which makes a game something you can
send as a link.

## Knowing how to play

Nothing in the archive says how any of these are played, so the page works it
out. Pick a program and the keypad below lights up the keys that program
watches, dimming the rest. Fifty four also carry a written line on how to play,
and nine more say which key starts them.

The keys are worked out from the programs themselves, two ways that check each
other, which is why that part covers every one of them. The written lines are
the opposite: each was watched happening, and a check holds every key they
name against what the program actually asks about. How it is done, and what it
refuses to guess at, is in [DOCS.md](DOCS.md).

The original keypad was sixteen hex keys, mapped here as most emulators do:

```
1 2 3 4        1 2 3 C
Q W E R   ->   4 5 6 D
A S D F        7 8 9 E
Z X C V        A 0 B F
```

## Speed

Every program in the archive carries the speed its author intended, and the
emulator applies it on selection. This matters more than it sounds: those
figures run from 7 to 1000, so a single fixed speed suits almost nothing.
Breakout wants 420 instructions a second and is unplayable at 60,000, which is
what a bullet-hell shooter in the same archive asks for.

The published figure is per frame rather than per second, which is worth knowing
because reading it as per second runs a game sixty times too slowly and shows an
apparently blank screen.

The slider overrides it. Winding a slow game up to the maximum is worth doing
once.

## Reading a program

```bash
node scripts/disassemble.mjs snake
```

prints a program as Octo source: instructions where the machine would run
them, bytes where it would not, and a label wherever something jumps or
points. Which is which comes from walking every path from the start rather
than guessing, and the listing is real Octo, so it compiles. The same listing
is on the page: load anything and open "Read the program" under the screen.

```bash
node scripts/roundtrip.mjs
```

checks that across the archive two ways. Octo's own compiler has to turn every
listing back into exactly the bytes it came from, which it does for all 104.
And running each program must never execute an address the listing called
data, which holds for 98; the other six write or patch their own code while
running, and no reading of the file can see that.

## Which keys a game uses

The keypad on the page lights up the keys a program watches, found two ways.
Reading it works out which key each test is asking about by following every
path from the start; playing it presses everything on a throwaway machine and
sees what gets asked. Reading is ready at once and covers paths the probe never
reaches, playing catches the programs that work a key number out as they go.

```bash
node scripts/keys.mjs
```

runs both over the archive and checks them against each other, and

```bash
node scripts/whatkeysdo.mjs piper --start 1
```

holds each key a program watches and says how the picture moved, which is
how a how-to-play line gets written from something seen rather than assumed.

## The XO-CHIP test

Timendus' suite has no XO-CHIP test yet, and the one bug this emulator was
found to have was an XO-CHIP one, so `tests/xochip.8o` is a small test of its
own. Eight rows, each a tick or a cross: scrolling only the selected plane,
`scroll-up`, memory above 4K through `i := long`, a skip clearing all four
bytes of that instruction, planes being separate, `save vX - vY` leaving `i`
alone, saved flags coming back, and a 16 by 16 sprite really being sixteen
wide. It is on the page as a button,
and `node scripts/build-tests.mjs` rebuilds it with Octo's own compiler.

Each row was checked the only way a test can be: `scripts/check-xochip.mjs`
breaks each of the eight things in turn and confirms that exactly that row goes
red and no other. The mutation tool also runs the suite against those eight
breakages, and none of them is noticed there. The plane scroll row found this
emulator scrolling both planes whatever was selected, which is now fixed.

## Checking another emulator

The same suite that checks this emulator can check somebody else's, and the
quickest way to read its results is to diff screens. `scripts/reference.mjs`
prints what a correct interpreter shows for any ROM after a set number of
frames, with keys pressed on a schedule, so another emulator's output can be
compared line for line:

    node scripts/reference.mjs 3-corax+.ch8 > expected.txt
    node scripts/reference.mjs 5-quirks.ch8 --as schip --key 2:60:70 --key 1:90:100 --rows
    node scripts/reference.mjs --score their-quirks-screen.txt

`--as` picks the platform the ROM should be judged as, `--key` is a hex key
with the frames it goes down and up on (the quirks test's menus need `1` for
CHIP-8, `2` then `1` for SUPER-CHIP), and `--rows` or `--score` reads the six
ok/X words off a quirks screen rather than printing it. The other side is a
small `main` around the other emulator's core that feeds the same key
schedule and prints its screen the same way; one has been written for C,
C++, Python, Rust and Java cores in an afternoon each, and DOCS.md says what
they turned up.

## What is not here

Games, and only one test program of my own. The other test buttons fetch from
[Timendus' suite](https://github.com/Timendus/chip8-test-suite) at the moment
you press them, because that suite is GPL-3.0 and bundling its files would
attach those terms to this repository. Fetching what somebody else publishes,
rather than copying it, keeps the question from arising. It does mean the test
buttons need a connection; your own files do not.

Nothing from the archive is left out any more. If a program does reach for an
instruction this machine does not have, it stops and names it rather than
leaving a black screen.

## Notes

How this is checked, and the decisions behind it, are in [DOCS.md](DOCS.md).
