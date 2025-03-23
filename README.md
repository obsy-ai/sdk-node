# Obsy

Obsy is an open-source observability platform for AI. _See what your AI is really doing with just a few lines of code._

## Node SDK

```bash
npm install @obsy-ai/sdk
```

### Example

With express and OpenAI responses API. View full code at [examples/src/openai-responses.ts](examples/src/openai-responses.ts).

```ts
import { ObsyClient, obsyExpress } from "@obsy-ai/sdk";

// view full code at examples/src/openai-responses.ts

// 1. create Obsy client
const obsy = new ObsyClient({
  apiKey: "<your-obsy-api-key>",
  projectId: "<your-obsy-project-id>",
});

// 2. instrument OpenAI and Pinecone clients
obsy.instrument(openai);

// 3. enable tracing for each request
app.use(obsyExpress({ client: obsy }));

// JUST 3 SIMPLE STEPS... THAT's IT!

app.post("/chat", async (req, res) => {
  // view full code at examples/src/openai-responses.ts
});

const PORT = 6969;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```
