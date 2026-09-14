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

Seventeen breakages are built in and each one is run against all eight tests
in the suite and the XO-CHIP test kept here, because a gap in one test may be
covered by another.

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
| a skip steps two bytes over the four byte `i := long` | **nothing in the suite**, only the XO-CHIP test here |
| `F000` keeps twelve bits of its address | only the XO-CHIP test here |
| `FN01` does nothing, so there is one plane | only the XO-CHIP test here |
| scrolling moves every plane, not the selected one | only the XO-CHIP test here |
| `00DN` does nothing | only the XO-CHIP test here |
| `5XY2` and `5XY3` move `i` | only the XO-CHIP test here |
| `FX85` does nothing | only the XO-CHIP test here |
| a 16 by 16 sprite is drawn eight wide | only the XO-CHIP test here |

The last two are worth dwelling on. Both are wrong only in a case the suite
never exercises. `8XY7` is wrong when `X` and `Y` are the same register, and the
shift is wrong when the two registers differ in the bit being shifted out, but
every shift in the suite shifts a register into itself. An interpreter with
either mistake passes all eight tests.

The long skip is different from the other two. Those are wrong in a case the
suite does not exercise; this one is an instruction the suite never uses at
all, on any path, so no menu choice would help. The maintainer knows: an
XO-CHIP test covering it is on the project's own wish list and has not been
written. It was the bug this emulator had, found by the disassembler.

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

## What the suite says about this emulator

Run through its menus properly, the quirks test passes every row as CHIP-8,
as SUPER-CHIP modern and as XO-CHIP, and the scrolling test shows the complete
picture on every path except one. The exception in both is SUPER-CHIP legacy,
meaning the HP48 itself, which waited for the display only in low resolution
and scrolled its 128x64 buffer as it was, so a low resolution scroll moved half
a pixel. This emulator does neither, and it will not: its settings come from
the archive, the archive describes programs in Octo's terms, and Octo has no
such mode. No program here can ask for it.

"Through its menus properly" is the important phrase. The SUPER-CHIP entry in
the quirks test opens a second menu, and for a day the checks here pressed a
key that landed on nothing, which made two of the four platforms pass by
never running. The recording of which keys select what now lives in the
verification scripts, and that mistake is recorded upstream on the pull
request it touched.

The keypad test caught something real. `FX0A` here resumed the moment a key
went down. The original waits until it is let go, and the test reports NOT
RELEASED when it is not. It was found while using this emulator as the
reference to fix the same instruction in somebody else's, which is a good
argument for never trusting a reference that has not itself been checked.

## Reading a program back

The hard part of a CHIP-8 disassembler is not the opcodes, it is that sprites
sit between instructions with nothing to mark them. Treat everything as code
and every sprite becomes nonsense instructions. Treat everything as data and
there is no listing. So the disassembler walks: from the start, follow every
jump, call, skip and fall-through, and whatever the walk never reaches is
data. That is the same rule the machine uses, which is why it works.

Three idioms needed more than the plain walk. Programs written in Octo use
`jump0` for computed jumps, usually into a row of `jump` lines or a row of
same-sized blocks each ending in `return`, so the walk follows a `jump0` table
for as long as the words there are jumps, and on paths that began in a table
it tries the word after each ending as another entry. Programs that patch
their own code leave a word of zeros where the patch goes, which decodes as a
call into 1977 machine code that every interpreter now steps over, so one such
word is stepped over too. Two in a row is a table of small numbers, and the
walk stops.

Labels are named by what the walk learned: `sub_` for anything called,
`L_` for anything jumped to, `sprite_` for data a draw reaches for within a
few instructions of `i` being pointed at it, and `data_` for the rest. The
instructions use those names rather than addresses. One subtlety: a program
can point `i` or a jump into the middle of an instruction, and such an
address never gets a line of its own, so it stays as a number. The listing
works out which addresses it will land on before it names anything, which is
what keeps the round trip at 104 of 104.

The listing is Octo syntax, checked against Octo's own compiler rather than
against a private assembler, because an assembler written to match the
disassembler would confirm its mistakes. Every one of the 104 programs comes
back byte for byte. Flipping one mnemonic on purpose takes that to 0 of 104,
which is how the check earns trust.

The second check runs each program and records where it fetched instructions
from and where it drew sprites from. Executing an address the listing called
data means the walk missed a path; drawing from an address it called code
means the walk was too eager. It is 98 of 104 and 103 of 104. The misses are
programs that write code into memory at run time, patch the targets of their
own jumps, or draw their own instructions as pixels on purpose, and no reading
of the file can know those.

That second check is what found the skip bug. `i := long` is four bytes and a
skip has to clear all of it. The machine here stepped two, landed on the
address half, and ran it as a jump. The walker knew the rule, the machine did
not, and the disagreement showed up as an executed address inside an
instruction. Three programs in the archive had been running wrong because of
it.

## Working out the controls twice

The page used to find a program's keys one way: run it on a throwaway machine,
press everything, and see what it asks about. That only finds keys on paths the
probe reaches in its budget, which for a program that opens on a menu is often
just the one key that gets past the menu.

Reading finds them the other way. The walker already follows every path from
the start, so carrying what each register is known to hold along those paths
says which key each `EX9E` and `EXA1` is asking about. Where two paths disagree
about a register, it becomes unknown, and where a key number is loaded from
memory or worked out at run time, reading says so rather than guessing.

The two methods check each other, and that is the point of having both. Reading
sees every key the program could ask about; playing only sees the ones it
reached. So wherever reading claims to know them all, it has to cover what
playing found. It does, for all 104. Dropping `EXA1` from the reader on purpose
breaks that for 24 of them, so the check can fail.

Fifty eight programs work at least one key number out at run time, and for
those the probe is still the only way. Twenty six watch a key the probe never
reached, and those are the ones the page now gets right: Chicken Scratch used
to light up `E` alone and now lights `Q W E A S D`.

What neither method gives is what a key *does*. That still means sitting down
with the game, which is why the notes file grows slowly. But the two methods
can guard the notes: `check-notes.mjs` takes every key a note names in bold
and requires that reading or playing saw the program ask about it. Fifty
notes name keys and none names a wrong one. Planting a wrong key in a
program whose keys are fully known fails the check; planting one in a program
that works keys out at run time gets a question mark, since neither method
can be sure there, and four notes sit in that state on purpose.

## A test of my own

The long skip mutation showed that no ROM in Timendus' suite uses `i := long`
at all, and an XO-CHIP test is on that project's wish list unwritten. Rather
than wait, `tests/xochip.8o` is one, small and in Octo, built with Octo's own
compiler so the bytes are what any XO-CHIP interpreter would be handed.

Each row is one thing and is arranged so a wrong interpreter cannot pass by
accident. The skip row is the neat one: the address it loads is `0x6F01`,
which read as an instruction is `vF := 1`, so an interpreter that steps two
bytes instead of four runs it, and the flag it leaves behind is the failure.
The scroll row goes first because scrolling moves everything already drawn.

A test that says pass has to be shown able to say fail. `check-xochip.mjs`
applies each of the five breakages from the mutation tool and requires that
exactly the matching row goes red. Writing that found a bug in a breakage,
not in the test: the skip breakage was also catching `5XY2` and `5XY3` as if
they were `5XY0`, which reddened the range row too.

Three more rows went in the same afternoon: scrolling only the selected plane,
`saveflags` and `loadflags` round-tripping, and a 16 by 16 sprite being sixteen
wide. The first of those was red on this emulator with nothing broken, and the
breakage written for it proved to be a no-op against the emulator, which is
the mutation tool's way of saying the emulator already had the bug. It scrolled
every plane whichever was selected. Octo moves only the selected ones, and so
does this now. That is two real bugs the test has found in the machine it was
written on, before it has been offered to anyone.

Both scroll rows run before anything is shown, because a scroll would move a
result already on the screen. The row check caught that too, as a row that
went red only when a different row's scroll had run.

If the three small pull requests upstream get a reply, this is ready to offer.

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

## Checking other people's emulators

Once the emulator passed the suite, the suite plus the emulator became a
tool for reading other emulators. The method is always the same. Clone the
project, find the core (the part that owns registers, memory and the screen
and has no window in it), and write a `main` around it that loads a ROM,
sets keys from a `K:down:up` schedule, runs thirty instructions a frame for
nine hundred frames and prints the screen as `#` and `.`. Then print the
same thing from `scripts/reference.mjs` and diff. The opcode test and the
flags test should come out identical; the quirks test's six words say which
flavour the other emulator is; the keypad test's third check says whether
`FX0A` waits for the key to be released.

Fifteen emulators went through this on 2026-09-14. The same handful of
mistakes came up again and again, in this order of frequency:

- `FX0A` completing when a key goes down rather than when it comes back up.
  Nearly all of them. The original interpreter waits for the release.
- `VF` written before the result in `8XY4` to `8XYE`, so that when `VX` is
  `VF` the result overwrites the flag. About half.
- No clipping in `DXYN`, so a sprite past the right edge continues on the
  next row and a sprite past the bottom writes outside the display buffer.
  Three, two of them in C++ where that is memory corruption.
- `8XY5` and `8XY7` using a strict comparison, so equal values report a
  borrow. Three.
- Key indices not masked to a nibble, so `EX9E` with a register above 15
  reads past the key array, asserts, or throws. Three.
- One-offs: a collision flag tested after the xor (so inverted), `BNNN`'s
  address kept in a byte, `FX0A` advancing the PC twice and skipping the
  next instruction, timers ticking per instruction rather than at 60 Hz, the
  sound timer stepped twice a frame.

Two things about the method. The harness must mirror the front end's
contract, not the core alone: rsc8 looked wrong on `FX0A` until the harness
honoured the release flag its terminal front end honours. And a menu key
that goes nowhere makes a test look passed; the quirks test needs `2` then
`1` for SUPER-CHIP, and pressing `4` shows a screen that proves nothing.

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

