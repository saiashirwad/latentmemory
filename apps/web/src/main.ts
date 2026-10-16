import { Schema } from "effect";
import type { Runtime } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";

export const Model = Schema.Struct({});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({});
export type Message = typeof Message.Type;

export const init: Runtime.ApplicationInit<Model, Message> = () => ({ model: {} });

export const update = (model: Model, _message: Message) => ({ model });

export const view = (_model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "Flashcards",
  body: h.main([], [h.h1([], ["Flashcards"])]),
});
