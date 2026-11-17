"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { getPrototypeReply } from "@/lib/prototype-responder";

type Message = {
  id: string;
  role: "em" | "creator";
  text: string;
};

const STORAGE_KEY = "umbr:em:conversation:v1";
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 100;
const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "em",
  text: "I'm Em.\n\nSo, this is where we begin. I don't know much about you yet, and I suppose you don't know much about me either.\n\nI'd like to change that, one conversation at a time.\n\nWhat's on your mind?",
};

function isMessageList(value: unknown): value is Message[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_HISTORY_LENGTH &&
    value.every(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        typeof message.id === "string" &&
        (message.role === "em" || message.role === "creator") &&
        typeof message.text === "string" &&
        message.text.length <= MAX_MESSAGE_LENGTH * 2,
    )
  );
}

export default function Conversation() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [checkingPrompt, setCheckingPrompt] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messageSequence = useRef(0);
  const bottomRef = useRef<HTMLLIElement>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (isMessageList(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      setStorageUnavailable(true);
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;

    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      setStorageUnavailable(true);
    }
  }, [historyLoaded, messages]);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, checkingPrompt]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  function addMessage(role: Message["role"], text: string) {
    messageSequence.current += 1;
    const message: Message = {
      id: `message-${Date.now()}-${messageSequence.current}`,
      role,
      text,
    };
    setMessages((current) => [...current, message].slice(-MAX_HISTORY_LENGTH));
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || checkingPrompt) return;

    addMessage("creator", text);
    setDraft("");
    setNotice("");
    setCheckingPrompt(true);

    timeoutRef.current = window.setTimeout(() => {
      const result = getPrototypeReply(text);

      if (result.kind === "reply") {
        addMessage("em", result.text);
      } else {
        if (messages.some((message) => message.id === "prototype-unavailable")) {
          setNotice("No new reply is available: the conversation engine isn't connected.");
        } else {
          const unavailableMessage: Message = {
            id: "prototype-unavailable",
            role: "em",
            text: result.text,
          };
          setMessages((current) =>
            [...current, unavailableMessage].slice(-MAX_HISTORY_LENGTH),
          );
        }
      }

      setCheckingPrompt(false);
      timeoutRef.current = null;
    }, 350);
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
          Local prototype
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
            This local prototype has no connected AI model. Messages stay in this
            browser tab for this session.
          </p>

          <ol className="message-list" aria-label="Conversation" aria-live="polite">
            {messages.map((message) => (
              <li className={`message-row message-row-${message.role}`} key={message.id}>
                <article
                  className={`message message-${message.role}`}
                  aria-label={message.role === "em" ? "Em" : "You"}
                >
                  <p className="message-author">{message.role === "em" ? "Em" : "You"}</p>
                  <p className="message-text">{message.text}</p>
                </article>
              </li>
            ))}
            {checkingPrompt && (
              <li className="message-row message-row-em">
                <div className="prototype-check" role="status">
                  <span className="checking-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  Checking supported local responses…
                </div>
              </li>
            )}
            <li className="scroll-anchor" aria-hidden="true" ref={bottomRef} />
          </ol>

          {notice && (
            <p className="notice-line" role="status">
              {notice}
            </p>
          )}
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
              disabled={checkingPrompt}
              aria-describedby="composer-help"
            />
            <button
              className="send-button"
              type="submit"
              disabled={!draft.trim() || checkingPrompt}
              aria-label="Send message"
            >
              <span>Send</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="composer-help" id="composer-help">
            Enter to send <span aria-hidden="true">·</span> Shift+Enter for a new line
          </p>
        </section>
      </main>
    </div>
  );
}
