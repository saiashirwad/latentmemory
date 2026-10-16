import { Schema } from "effect";
import { CardId, UserId } from "./ids.ts";

export const Markdown = Schema.NonEmptyString.pipe(Schema.brand("Markdown"));
export type Markdown = typeof Markdown.Type;

export const Tag = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)),
  Schema.brand("Tag"),
);
export type Tag = typeof Tag.Type;

export const KeyConcept = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isTrimmed()),
  Schema.brand("KeyConcept"),
);
export type KeyConcept = typeof KeyConcept.Type;

export const CardContent = Schema.TaggedUnion({
  Basic: { front: Markdown, back: Markdown },
});
export type CardContent = typeof CardContent.Type;

export const Source = Schema.TaggedUnion({
  Conversation: {
    client: Schema.NonEmptyString,
    title: Schema.optionalKey(Schema.NonEmptyString),
    excerpt: Markdown,
  },
  WebPage: {
    url: Schema.String,
    title: Schema.optionalKey(Schema.NonEmptyString),
    excerpt: Schema.optionalKey(Markdown),
  },
  Manual: {},
});
export type Source = typeof Source.Type;

export const CardStatus = Schema.Literals(["Active", "Suspended", "Deleted"]);
export type CardStatus = typeof CardStatus.Type;

export class Card extends Schema.Opaque<Card>()(
  Schema.Struct({
    id: CardId,
    userId: UserId,
    content: CardContent,
    keyConcepts: Schema.Array(KeyConcept),
    tags: Schema.UniqueArray(Tag),
    source: Source,
    status: CardStatus,
    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.DateTimeUtc,
  }),
) {}
