
import { createOpenAI } from "@ai-sdk/openai";
import { StreamData, StreamingTextResponse, streamText } from "ai";

export const openai = createOpenAI({
    baseURL: "https://openkey.cloud/v1",
    apiKey: process.env.OPENAI_API_KEY,
})

export const POST = async (req: Request) => {
    const { messages } = await req.json();

    const result = await streamText({
        model: openai('gpt-3.5-turbo'),
        messages,
    });

    const data = new StreamData();
    data.append({ test: "value" });

    const stream = result.toAIStream({
        onFinal(_) {
            data.close();
        }
    });

    return new StreamingTextResponse(stream, {}, data);
}
