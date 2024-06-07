'use client';

import { CoreMessage } from "ai";
import { useState } from "react";
import { continueConversation } from "./action";
import { readStreamableValue } from "ai/rsc";

// RSCs
// + server action
export default function Chat() {

    const [messages, setMessages] = useState<CoreMessage[]>([]);
    const [input, setInput] = useState("");
    const [data, setData] = useState<any>();

    return (
        <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
            {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
            {messages.map((m, i) => (
                <div key={i} className="whitespace-pre-wrap">
                    {m.role === "user" ? "User: " : "AI: "}
                    {m.content as string}
                </div>
            ))}
            <form onSubmit={async () => {
                const newMessages: CoreMessage[] = [
                    ...messages,
                    { role: "user", content: input },
                ];

                setMessages(newMessages);
                setInput("");

                const result = await continueConversation(newMessages);
                setData(result.data);

                for await (const content of readStreamableValue(result)) {
                    setMessages([
                        ...newMessages,
                        { role: "assistant", content: content as string }
                    ]);
                }
            }}>
                <input
                    className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
                    value={input}
                    placeholder="enter sth..."
                    onChange={(e) => setInput(e.target.value)}
                />
            </form>
        </div >
    );
}