# CHIP-8

A 1977 virtual machine, rebuilt from its instruction set, running in a browser.

CHIP-8 was never a physical chip. It was an interpreter written for hobbyist
computers in the seventies so that people could write games without learning
each machine's own assembly. Programs written for it almost fifty years ago
still run, because the specification is small enough to implement exactly:
4 KB of memory, sixteen registers, a 64 by 32 screen, and thirty-five
instructions.

This is that machine, plus SUPER-CHIP, the extension that doubled the screen to
128 by 64 and added scrolling.

## Running it

No build step and no dependencies. Serve the folder:

```bash
python -m http.server 3100
```

Then open <http://localhost:3100>. Pick a program from the dropdown and it
plays. Seventy one of them, fetched from [John Earnest's CHIP-8
archive](https://github.com/JohnEarnest/chip8Archive) when you choose one. You
can also load your own `.ch8` file.

On a phone, tap the keypad at the bottom of the page instead of typing.

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

SUPER-CHIP is checked by the same suite's scrolling test, in both resolutions.
Its pass condition is that every arrow lands inside its box pointing the way it
came, which it does.

The screen and drawing code had to be rewritten for the bigger display, and
that is the easiest place in the project to break something quietly. So the
five instruction tests were run against the version before the rewrite and the
version after, and compared pixel by pixel. All five came out identical.

Every program in the archive is also run headlessly for three seconds and its
lit pixels counted, which is how the two silent failures below were found. It
reports sixty eight of seventy one drawing, and names the other three.

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
while leaving that flag unset. They loaded, ran, and drew nothing. The size a
program asks for turns out to be the more reliable signal than the flag.

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

XO-CHIP is not here. It adds a second colour plane, its own sound, and sixty
four kilobytes of memory, and thirty two of the archive's programs need it.
Those are left out of the list. Three more ask for an XO-CHIP instruction
partway through without declaring it, and the machine stops and names the
instruction rather than leaving a black screen.
