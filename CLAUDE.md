# latentmemory

A cognitive prosthesis for the AI era — an antidote to the biggest failure mode of working with LLMs: _epistemic illusion_ (the feeling that because an agent explained something clearly in the moment, you now own that knowledge).

## Temporary testing resources

Isolated temporary Cloudflare/Alchemy resources may be created for bounded synthetic tests. Do not change production resources or use real user data. Track created resource IDs, clean up even on failure, verify deletion, and report any leftovers. This does not authorize deploying the application stack.

## Modeling

If our domain owns a vocabulary, model it as a closed union so the compiler checks we've handled every case. If an outside party owns it, model it as an open set (a non-empty string) and deal with unknown values where the data comes in.
