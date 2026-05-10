import { Node, mergeAttributes } from "@tiptap/core";

export const QuoteContainer = Node.create({
  name: "quoteContainer",
  group: "block",
  content: "block+",
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: "div.nexidesk-quote" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "nexidesk-quote" }),
      0,
    ];
  },
});
