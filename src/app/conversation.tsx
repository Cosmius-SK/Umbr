"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  loadConversationSession,
  MAX_HISTORY_LENGTH,
  MAX_MESSAGE_LENGTH,
  saveConversationSession,
  type ConversationState,
  type Message,
} from "@/lib/conversation-session.mjs";
import {
  ConversationStreamError,
  readConversationStream,
} from "@/lib/conversation/stream-reader.mjs";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "em",
  text: "I'm Em.\n\nSo, this is where we begin. I don't know much about you yet, and I suppose you don't know much about me either.\n\nI'd like to change that, one conversation at a time.\n\nWhat's on your mind?",
};

type Availability = {
  availability: "checking" | "hosted_disabled" | "production_disabled" | "disabled" | "misconfigured" | "needs_model" | "local_enabled";
  message: string;
};

export default function Conversation() {
  const [session, setSession] = useState<ConversationState>({
    status: "loading",
    messages: [WELCOME_MESSAGE],
  });
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [responseStatus, setResponseStatus] = useState("");
  const [availability, setAvailability] = useState<Availability>({
    availability: "checking",
    message: "Checking local inference availability…",
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const messageSequence = useRef(0);
  const bottomRef = useRef<HTMLLIElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const messages = session.messages;

  useEffect(() => {
    const restored = loadConversationSession(() => window.sessionStorage, [WELCOME_MESSAGE]);
    setSession({ status: restored.status, messages: restored.messages });
    setStorageUnavailable(!restored.storageAvailable);
  }, []);

  useEffect(() => {
    if (saveConversationSession(() => window.sessionStorage, session) === false) {
      setStorageUnavailable(true);
    }
  }, [session]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/conversation", { method: "GET", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Conversation status is unavailable.");
        const status = (await response.json()) as Availability;
        setAvailability({ availability: status.availability, message: status.message });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailability({ availability: "disabled", message: "AI availability could not be checked. The conversation is still available." });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, isSending]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function newMessage(role: Message["role"], text: string): Message {
    messageSequence.current += 1;
    return {
      id: `message-${Date.now()}-${messageSequence.current}`,
      role,
      text,
    };
  }

  function removePendingMessage(id: string) {
    setSession((current) => ({
      ...current,
      messages: current.messages.filter((message) => message.id !== id),
    }));
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending || session.status !== "ready") return;

    const creatorMessage = newMessage("creator", text);
    const pendingReply = newMessage("em", "");
    const requestMessages = [...messages, creatorMessage].slice(-MAX_HISTORY_LENGTH);
    setSession((current) => ({
      ...current,
      messages: [...current.messages, creatorMessage].slice(-MAX_HISTORY_LENGTH),
    }));
    setDraft("");
    setResponseStatus("");

    if (availability.availability !== "local_enabled") {
      setResponseStatus(availability.message);
      return;
    }

    setIsSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: requestMessages }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new ConversationStreamError(
          payload?.error?.message || "Em could not generate a response.",
        );
      }
      if (!response.body) throw new ConversationStreamError("The response stream was unavailable.");

      let receivedText = false;
      for await (const event of readConversationStream(response.body)) {
        if (event.type !== "delta") continue;
        receivedText = true;
        setSession((current) => ({
          ...current,
          messages: current.messages.some((message) => message.id === pendingReply.id)
            ? current.messages.map((message) =>
                message.id === pendingReply.id
                  ? { ...message, text: message.text + event.text }
                  : message,
              )
            : [...current.messages, { ...pendingReply, text: event.text }].slice(-MAX_HISTORY_LENGTH),
        }));
      }
      if (!receivedText) {
        removePendingMessage(pendingReply.id);
        setResponseStatus("The local model returned an empty response. You can try again.");
      }
    } catch (error) {
      removePendingMessage(pendingReply.id);
      if (controller.signal.aborted) {
        setResponseStatus("Response cancelled. Your message remains in this tab's session.");
      } else if (error instanceof ConversationStreamError) {
        setResponseStatus(error.message);
      } else {
        setResponseStatus("The conversation request failed. Check the local service and try again.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="ember brand-ember" aria-hidden="true" />
          <span className="brand-copy">
            <span className="brand-project">Project Umbr</span>
            <span className="brand-name">Em</span>
          </span>
        </div>
        <span className="prototype-badge">
          <span className="status-dot" aria-hidden="true" />
          Local-first conversation
        </span>
      </header>

      <main className="conversation-shell">
        <section className="conversation-panel" aria-labelledby="conversation-title">
          <div className="conversation-heading">
            <div>
              <p className="eyebrow">A first conversation</p>
              <h1 id="conversation-title">Em</h1>
              <p className="formal-line">Embr · first AI identity in Umbr</p>
            </div>
            <span
              className="ember heading-ember"
              role="img"
              aria-label="A small glowing ember"
            />
          </div>

          <p className="prototype-notice" role="note">
            {availability.message} Conversation history stays in this browser tab. When enabled locally, prompts are sent to this application server and its local Ollama process.
          </p>

          <ol className="message-list" aria-label="Conversation" aria-live="polite">
            {messages.map((message) => (
              <li className={`message-row message-row-${message.role}`} key={message.id}>
                <article
                  className={`message message-${message.role}`}
                  aria-label={message.role === "em" ? "Em" : "You"}
                >
                  <p className="message-author">
                    {message.role === "em" ? "Em" : "You"}
                    {isSending && message.id === messages[messages.length - 1]?.id ? " · responding" : ""}
                  </p>
                  <p className="message-text">{message.text || (isSending && message.role === "em" ? "…" : "")}</p>
                </article>
              </li>
            ))}
            {isSending && (
              <li className="message-row message-row-em">
                <div className="prototype-check" role="status">
                  <span className="checking-dots" aria-hidden="true"><i /><i /><i /></span>
                  Waiting for the configured local model. No hosted AI service is used.
                </div>
              </li>
            )}
            <li className="scroll-anchor" aria-hidden="true" ref={bottomRef} />
          </ol>

          {responseStatus && <p className="notice-line" role="status">{responseStatus}</p>}
          {storageUnavailable && (
            <p className="notice-line notice-storage" role="status">
              This browser couldn't save the session history. Messages will remain
              visible only until you leave or reload this page.
            </p>
          )}

          <form className="composer" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="message-composer">
              Write a message to Em
            </label>
            <textarea
              id="message-composer"
              name="message"
              rows={1}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="What's on your mind?"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isSending || session.status !== "ready"}
              aria-describedby="composer-help"
            />
            {isSending ? (
              <button className="send-button" type="button" onClick={() => abortRef.current?.abort()}>
                <span>Cancel</span>
                <span aria-hidden="true">×</span>
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!draft.trim() || session.status !== "ready"}
                aria-label="Send message"
              >
                <span>Send</span>
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </form>
          <p className="composer-help" id="composer-help">
            Enter to send <span aria-hidden="true">·</span> Shift+Enter for a new line
          </p>
        </section>
      </main>
    </div>
  );
}
