import {
  ConversationAgent,
  JokeAgent,
} from "./../../../src/examples/conversation-agent";

describe.skip("ConversationAgent", () => {
  let conversationAgent: ConversationAgent;

  beforeEach(() => {
    // Initialize the agent before each test
    conversationAgent = new ConversationAgent();
  });

  it("should return a conversation response", async () => {
    // Simulate the behavior of `run` method
    const result = await conversationAgent.run("Who was Thomas Edison?");
    expect(typeof result).toBe("string");
    expect(conversationAgent.run).toHaveBeenCalledWith(
      "Who was Thomas Edison?"
    );
  });
});

describe.skip("JokeAgent", () => {
  let jokeAgent: JokeAgent;

  beforeEach(() => {
    // Initialize the agent before each test
    jokeAgent = new JokeAgent();
  });

  it("should return a joke response", async () => {
    // Simulate the behavior of `run` method

    const result = await jokeAgent.run("Tell me a joke");
    expect(typeof result).toBe("string");
    expect(jokeAgent.run).toHaveBeenCalledWith("Tell me a joke");
  });
});
