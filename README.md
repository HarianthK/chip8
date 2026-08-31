# CHIP-8

A 1977 virtual machine, rebuilt from its instruction set, running in a browser.

CHIP-8 was never a physical chip. It was an interpreter written for hobbyist
computers in the seventies so that people could write games without learning
each machine's own assembly. Programs written for it almost fifty years ago
still run, because the specification is small enough to implement exactly:
4 KB of memory, sixteen registers, a 64 by 32 screen, and thirty-five
instructions.

This is that machine, in about two hundred lines.

## Running it

No build step and no dependencies. Serve the folder:

```bash
python -m http.server 3100
```

Then open <http://localhost:3100>. Load one of the test programs, or your own
`.ch8` file.

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

`run.mjs` runs a program headlessly and prints the screen as text, which is how
the tests above were read without a browser. It takes a path, so point it at a
file you have downloaded.

## Decisions worth knowing

**Instruction order in the arithmetic opcodes.** The carry flag is written after
the result, not before. Several programs read `VF` as an operand and then expect
it to be overwritten, and getting this backwards passes casual testing and fails
the flags suite.

**Speed is a matter of taste.** The original had no fixed clock, so games ran at
whatever speed the host managed. Seven hundred instructions a second suits most
of them; the control adjusts it.

**Instructions are paced against real time**, not per animation frame, so the
speed setting means the same thing on a 60Hz screen and a 120Hz one.

**Sound is one square wave**, gated by the sound timer, and built only when the
reader first loads a program, because browsers refuse to make noise before then.

## What is not here

Games, and no test programs either. The two test buttons fetch from
[Timendus' suite](https://github.com/Timendus/chip8-test-suite) at the moment
you press them, because that suite is GPL-3.0 and bundling its files would
attach those terms to this repository. Fetching what somebody else publishes,
rather than copying it, keeps the question from arising. It does mean the test
buttons need a connection; your own files do not.

Also no SUPER-CHIP or XO-CHIP extensions, which add a larger screen and more
instructions. The original set is the interesting part.
