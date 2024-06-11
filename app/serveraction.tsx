'use server';

import { createStreamableValue } from "ai/rsc";



export const runThread = async () => {

    const streamableStatus = createStreamableValue({});

    streamableStatus.update({ type: "userMessage" });
    streamableStatus.update({ xxx: "how are you" });

    setTimeout(() => {
        streamableStatus.update({ content: "this is content" });
    }, 1000);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setTimeout(() => {
        streamableStatus.update({ id: 3 });
    }, 2000);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    streamableStatus.done();

    return { status: streamableStatus.value };
}