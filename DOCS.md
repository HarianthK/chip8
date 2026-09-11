# Notes on the CHIP-8 emulator

How it is checked, what it decides and why. The README covers using it.

## Working out the controls

The archive records a title, an author and a sentence about each program, and
nothing at all about its controls.

When you pick a program, a second machine loads it in the background, plays it
for a few seconds pressing every key in turn, and reports which ones the program
asked about. That costs about sixteen milliseconds, spread over a few frames so
the page never stalls.

Knowing which key starts a game is most of the problem.
`scripts/find-start-keys.mjs` tries every key on its own fresh machine and keeps
the one that clears the title screen when doing nothing does not. It finds a
start key for twenty six and leaves the rest alone.

Running it twice used to give two different answers, which is a poor state for a
file that gets published. Programs reaching for a random number were the cause.
The check meant to catch them only watched the settling window, so a program
that turned random later slipped through and was handed an answer decided by
chance. It now notices a request for a random number at any point and leaves
that program alone. Three entries went and two were corrected.

An early fix was to seed the randomness instead, which made the runs
reproducible and quietly made the check useless, because seeded runs always
match. Reproducible and honest are not the same thing.

The answers for `knight`, `octoma` and `octogon` come back as `R`, `E` and `A`,
which is exactly what those three print on their own title screens. That
agreement with the games that can be asked is the reason to trust the rest.

Forty seven programs also carry a written line in `notes.js`. Those cover only
what was checked: either the game prints its controls on its own screen, or each
key was held in turn and the thing that moved was watched. `scripts/render.mjs`
prints any program's screen as text, with a key held if you like, which is how
that checking is done.

Plenty of games resist it. If the same program rendered twice with identical
arguments gives two different pictures, it uses randomness and no change can be
pinned on a key. Others animate constantly, or have no player shape to follow.
Those were left with no note rather than a guessed one.

The counts below were true when they were measured. The archive gains a program
now and then, and the page reads the list live rather than carrying a copy, so
new ones appear on their own without a note until one is written.

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
fresh machine each time. They all pass. The one that never moves is a template
for drawing a Nokia 3310 screen, which is meant to sit still.

`run.mjs` runs a single program headlessly and prints the screen as text, which
is how the tests above were read without a browser. It takes a path, so point it
at a file you have downloaded.

## Asking whether a test would notice

A test suite passing tells you nothing on its own. It has to be capable of
failing, and the way to find out is to break the machine on purpose and see
whether the suite complains.

`scripts/mutate.mjs` does that. Each breakage replaces one instruction with a
version that is wrong in a specific way, and carries a small program of its own
proving it really is wrong. That second part matters: a breakage that behaves
identically to the real thing would sail through every test and teach you
nothing. The tool checks each one and says so when a breakage looks like a no
op, which it did for the first `5XY0` attempt here. Both the correct and the
broken path had ended on the same instruction, so the proof distinguished
nothing.

Eight breakages are built in and each one is run against all eight tests in the
suite, because a gap in one test may be covered by another.

| Breakage | Noticed by |
| --- | --- |
| `3XNN` skips when it should not | the opcode, flags, quirks and scrolling tests |
| `5XY0` never skips | the quirks, keypad, beep and scrolling tests, but not the opcode test |
| `FX33` writes its digits backwards | the opcode test |
| `8XY4` sets its carry the wrong way round | the flags test |
| `8XY5` sets its borrow the wrong way round | the flags and quirks tests |
| drawing never reports a collision | the quirks test only |
| `8XY7` takes its flag after the subtraction | **nothing in the suite** |
| the shift takes its flag from `VX` | **nothing in the suite** |

The last two are worth dwelling on. Both are wrong only in a case the suite
never exercises. `8XY7` is wrong when `X` and `Y` are the same register, and the
shift is wrong when the two registers differ in the bit being shifted out, but
every shift in the suite shifts a register into itself. An interpreter with
either mistake passes all eight tests.

The `5XY0` result is worth knowing too. The opcode test misses it, which is what
was reported, but four other tests catch it, so the suite as a whole does not
let it through.

### What was done about them

All three went upstream as patches to the suite rather than as bug reports,
because the tool had already worked out what each test was missing.

`5XY0` fails to be caught by the opcode test because the registers it compares
hold different values, so a correct skip and a skip that never happens both fall
through to the same place. Two registers holding the same value fix it, and the
test already has spare ones. That is
[pull request 35](https://github.com/Timendus/chip8-test-suite/pull/35), against
issue 28.

`8XY7` is only wrong when `X` and `Y` name the same register, which the flags
test never does. Subtracting a register from itself has to give zero and leave
no borrow, and the assertion folds into the `vF` mark the test already carries,
so it costs no screen space. That is
[pull request 36](https://github.com/Timendus/chip8-test-suite/pull/36), against
issue 31.

The shift was the awkward one. The quirks test sets `v5` and `v7` to zero before
shifting, so the bit that gets shifted out is zero whichever register the
interpreter reads it from. Giving those registers values whose shifted-out bit
differs from `v6` and `v8` makes the flag say which register was really shifted,
and the values can be picked so every existing check sees exactly what it saw
before. The expected flag does not need spelling out per platform either, since
it is 1 exactly when the quirk is on, which the values have already revealed.
That is [pull request 37](https://github.com/Timendus/chip8-test-suite/pull/37),
against issue 32.

Each one was checked the same way. Build the current source and confirm it comes
out byte for byte identical to the published ROM, so the baseline is real before
anything changes. Then run the new ROM against an interpreter carrying the bug
and confirm it now complains, run it against a correct one and confirm the
screen is unchanged pixel for pixel, and re-run every other breakage to confirm
nothing the test used to catch got lost.

The shift patch only catches the bug on CHIP-8 and XO-CHIP. On both SCHIP
settings the shift quirk is on, so `VX` is both the source and the flag source
and the mistake cannot show itself. That is not a gap left behind, it is the
bug being unreachable there.

## The instructions programs disagree about

Six instructions have two accepted behaviours, and a program is written against
one or the other. `8XY6` either shifts `VY` into `VX` or shifts `VX` in place.
`FX55` either leaves `I` pointing past what it moved or leaves it where it was.
The logic operations either clear `VF` or leave it alone. Sprites either wrap
round the screen or clip at its edge. `BNNN` either adds `V0` or `VX`. And the
oldest machines could only draw once per sixtieth of a second.

The archive records which way round each program wants these, and for a long
time this emulator ignored that and did the same thing for all of them. It was
wrong for the majority: 88 of the 103 programs ask for `VY` shifting and it
shifted `VX`, and 86 ask for `I` to move on and it left `I` alone.

It now reads each program's settings and runs it the way its author meant. Doing
that changed the picture in 13 of the 103, and left none of them blank.

The reason this went unnoticed for so long is worth writing down. Every check
here asked whether pixels came on. A program that shifts the wrong register
still lights pixels, it just computes the wrong answer quietly, so the sweep,
the start key detection and the how-to-play notes were all incapable of seeing
it. The suite's quirks test had been running the whole time, but only ever to
compare one build against another for regressions. Nobody read what it said. It
now passes all six with the original machine's settings.

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

**Timers are counted against the clock, not against frames.** The machine's
timers run sixty times a second, and it is tempting to tick them once per
animation frame. That is right only on a sixty hertz screen. On a 120Hz monitor
every program pacing itself with the delay timer, which is most of them, would
run at double speed. The elapsed milliseconds are accumulated instead, so a
second of real time is sixty ticks whatever the screen is doing.

**Speed is a matter of taste.** The original had no fixed clock, so games ran at
whatever speed the host managed. Seven hundred instructions a second suits most
of them; the control adjusts it.

**Instructions are paced against real time**, not per animation frame, so the
speed setting means the same thing on a 60Hz screen and a 120Hz one.

**Sound is one square wave**, gated by the sound timer, and built only when the
reader first loads a program, because browsers refuse to make noise before then.

