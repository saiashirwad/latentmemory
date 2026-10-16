# Cards to make

Things worth remembering, kept until the app can hold them. Each one becomes a Card.

## Open set vs closed union

**Front:** When should a type be a closed union, and when should it be an open set?

**Back:** Ask who owns the vocabulary. If our domain owns it (card status, Rating), use a closed union so the compiler checks every case. If an outside party owns it (MCP client names, grader dimensions), use an open set, such as a non-empty string, and handle unknown values where the data comes in.

**Tags:** type-design, domain-modeling

## Upcasting

**Front:** What is upcasting in an event log?

**Back:** A pure function that turns an event stored in an old shape into the current shape when it's read. The stored rows never change, so the log stays append-only and old events stay valid.

**Tags:** event-sourcing, schema-evolution
