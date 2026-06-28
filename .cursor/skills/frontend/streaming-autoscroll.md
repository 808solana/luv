---
name: streaming-autoscroll
description: Use when building any UI that auto-scrolls during streaming output (chat, agent chain, logs). The default "scrollIntoView on every message change" pattern breaks the moment streaming mutates state per-token.
created: 2026-06-23
updated: 2026-06-23
tags: [frontend, ux, streaming, scroll, react]
---

# Streaming Auto-Scroll — Don't Hijack the User's Scroll Position

## When to Use
- Any chat-like UI where streaming tokens mutate the message array on every chunk
- Agent chains where each step streams into a separate card
- Log viewers that append lines

Don't use when:
- Static content (no streaming) — plain `scrollIntoView` is fine
- The user can't scroll (e.g. fixed viewport)

## The Bug

The naive pattern:

```tsx
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

This fires on every `messages` change. During streaming, `messages` mutates **on every single token** (because `appendToMessage` / `appendToAgentStep` update the Zustand store, which re-renders). Result: the page yanks to the bottom on every token, making it impossible for the user to scroll up and read prior output while the agent is thinking.

## The Fix — "Stick to Bottom" Pattern

Track whether the user is currently pinned to the bottom of the scroll container. Only auto-scroll if they are. If they've scrolled up to read, stop auto-scrolling until they scroll back down or submit a new message.

### Implementation

```tsx
interface ChatAreaProps {
  messages: Message[];
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export function ChatArea({ messages, scrollContainerRef }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isPinnedRef = useRef(true);
  const prevMessageCountRef = useRef(messages.length);

  // Track pin state via scroll listener
  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isPinnedRef.current = distanceFromBottom < 80; // 80px threshold
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [scrollContainerRef]);

  useEffect(() => {
    const messageCountChanged =
      messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    // New message added (user submitted) → force scroll to bottom
    if (messageCountChanged) {
      isPinnedRef.current = true;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Streaming chunk → only scroll if user is still pinned to the bottom.
    // Use behavior: "auto" (instant) — "smooth" creates laggy animation on every token.
    if (isPinnedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  return (
    <div>
      {messages.map((m) => <MessageRow key={m.id} message={m} />)}
      <div ref={bottomRef} />
    </div>
  );
}
```

### Parent Wiring

The scroll container ref is owned by the parent (usually `page.tsx`) and passed down:

```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);

<div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
  <ChatArea messages={messages} scrollContainerRef={scrollContainerRef} />
</div>
```

## Key Design Decisions

- **80px threshold**: if the user is within 80px of the bottom, treat them as "pinned." Generous enough that minor layout shifts don't unpin them; tight enough that scrolling up to read actually unpins.
- **`behavior: "auto"` for streaming chunks**: `"smooth"` animates on every token, which looks laggy and janky. Instant scroll on token arrival is invisible because the new content is right at the bottom anyway.
- **`behavior: "smooth"` for new messages**: when the user submits, a smooth scroll to the new message feels natural.
- **Message count tracking**: distinguish "new message added" (force-scroll) from "existing message mutated by streaming" (only scroll if pinned).
- **Refs, not state**: `isPinnedRef` and `prevMessageCountRef` are refs because they don't need to trigger re-renders — they're only read inside the `messages` effect.

## Pitfalls

- **Don't put `isPinned` in `useState`** — it would trigger re-renders and fight with the streaming re-renders. Use a ref.
- **Don't use `behavior: "smooth"` for streaming chunks** — it queues up animations on every token and looks terrible. Use `"auto"` (instant) for streaming, `"smooth"` only for discrete events like new message added.
- **Don't forget the `{ passive: true }`** on the scroll listener — scroll listeners without it can jank the main thread.
- **The scroll container must be the actual scrolling element** — pass the ref from the parent `<div className="overflow-y-auto">`, not from inside `ChatArea`. The scroll position lives on that outer element.

## Verification

- [ ] Submit a prompt in Agent mode → page scrolls to bottom and stays there as steps stream
- [ ] While steps are streaming, scroll up → page stays where you scrolled; new tokens don't yank you back down
- [ ] While scrolled up during streaming, scroll back down to within ~80px of bottom → auto-scroll resumes
- [ ] Submit a new prompt while scrolled up → page smooth-scrolls to the new message at the bottom
- [ ] Switch conversations → page scrolls to the bottom of the new conversation
