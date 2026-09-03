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
sound chip you load a waveform into. Every one of the 103 programs in the
archive runs.

## Running it

No build step and no dependencies. Serve the folder:

```bash
python -m http.server 3100
```

Then open <http://localhost:3100>. Pick a program from the dropdown and it
plays. All 103 of them, fetched from [John Earnest's CHIP-8
archive](https://github.com/JohnEarnest/chip8Archive) when you choose one. You
can also load your own `.ch8` file.

On a phone, tap the keypad at the bottom of the page instead of typing.

## Knowing how to play

The archive records a title, an author and a sentence about each program, and
nothing at all about its controls. So the page works them out. When you pick a
program, a second machine loads it in the background, plays it for a few seconds
pressing every key in turn, and reports which ones the program asked about. The
keypad lights those and dims the rest.

That is the only record of a game's controls that exists anywhere, and it is
right for all 103 because it comes from the program rather than from a list
somebody kept. It costs about sixteen milliseconds of work, spread over a few
frames so the page never stalls.

A handful of games also carry a line on how to play, in `notes.js`. Those are
written by hand and only cover what I checked: either the game prints its
controls on its own title screen, or I watched the thing on screen move and
noted which key moved it.

The original keypad was sixteen hex keys, mapped here as most emulators do:

```
1 2 3 4        1 2 3 C
Q W E R   ->   4 5 6 D
A S D F        7 8 9 E
Z X C V        A 0 B F
```

## How it is checked

The hard part of an emulator is not making it run, it is knowing whether it is
right. A program can look fine and still have a broken carry flag.

So correctness comes from [Timendus' test
suite](https://github.com/Timendus/chip8-test-suite), which runs every
instruction and draws a pass or fail against each one. Both bundled programs
pass.

That check was itself checked. It is easy to look at a grid of four-pixel
symbols and see what you hoped for, so an instruction was deliberately broken to
confirm the display actually changed. It did, visibly, and restoring the
instruction brought the clean grid back. A test that cannot fail proves nothing.

SUPER-CHIP and XO-CHIP are checked by the same suite's scrolling test, in both
resolutions and on both platforms. Its pass condition is that every arrow lands
inside its box pointing the way it came, which it does.

The screen and drawing code had to be rewritten for the bigger display, and
that is the easiest place in the project to break something quietly. So the
five instruction tests were run against the version before the rewrite and the
version after, and compared pixel by pixel. All five came out identical.

Every program in the archive is also run headlessly and its lit pixels counted,
which is how the silent failures below were found. Counting pixels only proves a
program is not a black screen, so a second pass checks that the picture actually
changes: either on its own, or in response to a key, trying all sixteen on a
fresh machine each time. All 103 pass. The one that never moves is a template
for drawing a Nokia 3310 screen, which is meant to sit still.

`run.mjs` runs a single program headlessly and prints the screen as text, which
is how the tests above were read without a browser. It takes a path, so point it
at a file you have downloaded.

## Decisions worth knowing

**Instruction order in the arithmetic opcodes.** The carry flag is written after
the result, not before. Several programs read `VF` as an operand and then expect
it to be overwritten, and getting this backwards passes casual testing and fails
the flags suite.

**A program can be too big without saying so.** The archive marks XO-CHIP
programs with a flag, but fourteen more ask for sixty four kilobytes of memory
while leaving that flag unset. Before XO-CHIP was implemented they loaded, ran,
and drew nothing, and the size a program asked for turned out to be a more
reliable signal than the flag.

**The two bitplanes are one screen, not two.** A pixel holds a number from zero
to three rather than a flag, so drawing, clearing and scrolling all work on the
selected planes and leave the rest standing. Sprites drawn with both planes
selected are stored twice over, one whole sprite after the other.

**A tap can be too quick to see.** A key that goes down and comes back up
between two frames never reaches the machine, because nothing runs in between.
Releases are held back until the machine has run a frame with the key down,
which is what makes the on-screen pad usable at all.

**Speed is a matter of taste.** The original had no fixed clock, so games ran at
whatever speed the host managed. Seven hundred instructions a second suits most
of them; the control adjusts it.

**Instructions are paced against real time**, not per animation frame, so the
speed setting means the same thing on a 60Hz screen and a 120Hz one.

**Sound is one square wave**, gated by the sound timer, and built only when the
reader first loads a program, because browsers refuse to make noise before then.

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

## What is not here

Games, and no test programs either. The two test buttons fetch from
[Timendus' suite](https://github.com/Timendus/chip8-test-suite) at the moment
you press them, because that suite is GPL-3.0 and bundling its files would
attach those terms to this repository. Fetching what somebody else publishes,
rather than copying it, keeps the question from arising. It does mean the test
buttons need a connection; your own files do not.

Nothing from the archive is left out any more. If a program does reach for an
instruction this machine does not have, it stops and names it rather than
leaving a black screen.
