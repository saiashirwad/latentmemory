import { Schema } from "effect";
import { Assessment } from "./assessment.ts";
import { CardContent, CardStatus, KeyConcepts, Source, Tag } from "./card.ts";
import { CardId, EventId, ReviewId } from "./ids.ts";

export const Transcript = Schema.NonEmptyString.pipe(Schema.brand("Transcript"));
export type Transcript = typeof Transcript.Type;

export const Hesitation = Schema.DurationFromMillis;
export type Hesitation = typeof Hesitation.Type;

export const TimeZone = Schema.NonEmptyString.pipe(Schema.brand("TimeZone"));
export type TimeZone = typeof TimeZone.Type;

export const Recall = Schema.Literals(["Spoken", "Unspoken"]);
export type Recall = typeof Recall.Type;

export const Event = Schema.TaggedUnion({
  CardCreated: {
    cardId: CardId,
    content: CardContent,
    keyConcepts: KeyConcepts,
    tags: Schema.UniqueArray(Tag),
    source: Source,
  },
  CardEdited: { cardId: CardId, content: CardContent, keyConcepts: KeyConcepts },
  CardRetagged: { cardId: CardId, tags: Schema.UniqueArray(Tag) },
  CardStatusChanged: { cardId: CardId, status: CardStatus },
  ReviewRecorded: {
    reviewId: ReviewId,
    cardId: CardId,
    assessment: Assessment,
    hesitation: Hesitation,
    recall: Recall,
    timeZone: TimeZone,
  },
  TranscriptRecorded: { reviewId: ReviewId, transcript: Transcript },
  ReviewUndone: { reviewId: ReviewId },
  CardReset: { cardId: CardId },
});
export type Event = typeof Event.Type;

export const Entry = Schema.Struct({ id: EventId, at: Schema.DateTimeUtcFromString, event: Event });
export type Entry = typeof Entry.Type;
