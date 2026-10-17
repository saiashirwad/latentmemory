import { Schema } from "effect";
import { CardId } from "./ids.ts";

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

export const KeyConcepts = Schema.Array(KeyConcept).pipe(
  Schema.check(Schema.isMaxLength(3)),
  Schema.annotate({ description: "One to three ideas a good answer must include. Keeps Cards atomic." }),
);
export type KeyConcepts = typeof KeyConcepts.Type;

export const Motive = Schema.NonEmptyString.pipe(
  Schema.check(Schema.isTrimmed()),
  Schema.brand("Motive"),
);
export type Motive = typeof Motive.Type;

export const CardContent = Schema.TaggedUnion({
  Basic: { front: Markdown, back: Markdown },
});
export type CardContent = typeof CardContent.Type;

export const Page = Schema.Struct({ url: Schema.String, title: Schema.NonEmptyString });
export type Page = typeof Page.Type;

export const Source = Schema.TaggedUnion({
  Conversation: {
    client: Schema.NonEmptyString,
    title: Schema.NonEmptyString,
    excerpt: Markdown,
    motive: Motive,
    pages: Schema.Array(Page),
  },
  WebPage: { ...Page.fields, excerpt: Markdown },
  Manual: {},
});
export type Source = typeof Source.Type;

export const CardStatus = Schema.Literals(["Active", "Suspended", "Deleted"]);
export type CardStatus = typeof CardStatus.Type;

export class Card extends Schema.Opaque<Card>()(
  Schema.Struct({
    id: CardId,
    content: CardContent,
    keyConcepts: KeyConcepts,
    tags: Schema.UniqueArray(Tag),
    source: Source,
    status: CardStatus,
    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.DateTimeUtc,
  }),
) {}
