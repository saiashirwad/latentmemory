# Goals in reviews (Prospective memory for ADHD)

Spaced repetition is traditionally built for **retrospective memory** (remembering facts you learned in the past). But with ADHD, the hardest failure mode often isn't forgetting facts—it's **prospective memory and intention drift** ("out of sight, out of mind"): you care deeply about a goal on Monday, and by Thursday it has completely evaporated from working memory because 40 urgent or shiny things displaced it.

## Why traditional goal trackers fail ADHD brains

1. **Pull-based dashboards die immediately.** Notion pages, OKR docs, and habit trackers require you to remember to open a separate place. Once the novelty wears off, you never open them.
2. **Streaks and binary checkboxes create shame spirals.** Missing three days turns the app into a wall of red X's. To avoid the guilt, the ADHD brain avoids the app entirely.
3. **Goals are multi-dimensional, not flat strings.** A real goal isn't just `"get fit"` or `"ship flashcards"`. It has **facets** (dimensions/aspects): *why it matters*, *what good looks like*, *the trap I usually fall into*, *the smallest concrete motion*, etc. You don't just forget the title of the goal—you forget its texture and facets.

## Why this architecture is uniquely suited for Goals

You already have:
- **A daily push loop** (the review queue).
- **Voice capture + transcription (`nova-3`)** (talking out loud is externalized working memory—for ADHD, speaking for 15 seconds has 10x lower initiation friction than typing a journal entry).
- **Multi-aspect structure (`KeyConcept`s / Facets)** and **`Jev`**.

## How a Goal works vs. a Card

A Goal is not a trivia question with a "right answer", and it isn't a parked Rabbit Hole either. It is an **Active Intention with Facets**.

### 1. Two ways a Goal shows up in practice

- **Facet Salience (keeping the multi-dimensional shape alive in your head):**
  - Instead of asking you to recite a textbook definition, the prompt asks you to recall the **facets/dimensions** of your goal (e.g., *"What are the 3 pillars of how I'm approaching X right now?"* or *"What is the main trap I promised myself to watch out for on X?"*).
  - This keeps the full multi-dimensional shape of the goal loaded in your mental RAM, so one facet doesn't quietly drop off.
- **Spoken Check-in (externalized reflection):**
  - Prompt: *"How are you moving toward [Goal] lately? Touch on its facets: [Facet A, Facet B, Facet C]."*
  - You hold the mic button and talk for 15–20 seconds like a voice note to an advisor.

### 2. What the 2D Grid means for a Goal check-in

You don't grade a Goal on `Understanding` vs. `Effort`. If you use a 2D space (or a Goal-specific reflection), the axes shift naturally to:
- **Alignment / Traction** (y-axis): *Am I actually moving toward this, or has it drifted?*
- **Clarity / Energy** (x-axis): *Does the next step feel clear and light, or murky and heavy?*

And here is the magic of the **inverted scheduler** for Goals:
- For a **Card**, when `Understanding` is low (`Again`), it comes back **sooner** because you forgot it.
- For a **Goal**, when **Traction / Clarity is low** (you've drifted from it, or you forgot one of its facets), it should *also* resurface **sooner**—not as a punishment, but to keep the intention warm in working memory when it's most at risk of evaporating. When Traction is high and steady, it can back off to a wider interval.

### 3. How `Jev` + Facets act as a Blind-Spot Mirror

When a goal has multiple dimensions (facets)—say, a health goal with *(1) sleep boundary, (2) lifting, (3) protein*—the ADHD brain naturally hyperfocuses on the one facet that's currently exciting and completely forgets the other two.

When you speak a 20-second check-in about your goal:
- `Jev` checks which **Facets** you talked about (`Decision.probability` per facet, the exact same mechanism as `KeyConcept`s!).
- Over 3 or 4 check-ins, the app can notice: *"You've talked about facet #1 four times in a row, and haven't mentioned facet #3 in three weeks."*
- That turns the grader from a "test scorer" into a **blind-spot mirror** for multi-dimensional goals.

### 4. Protecting against ADHD Guilt ("No-Shame Resurfacing")

For this to survive contact with ADHD:
- **Drifting is a valid, expected state.** Saying *"Honestly I completely forgot about this all week"* is a successful check-in, not a failure. Simply having the goal surface and speaking that sentence out loud *already succeeded* at reloading the goal into your working memory for the next 48 hours.
- **Goals can evolve or hibernate.** Unlike a fact (where `2 + 2 = 4` forever), a Goal can go into **Hibernating** (not relevant this month, wake me up in 6 weeks) or **Retired** without polluting your card stats.
