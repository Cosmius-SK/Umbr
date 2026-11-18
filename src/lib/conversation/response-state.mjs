export function removeIncompleteResponse(messages, responseId) {
  const response = messages.find((message) => message.id === responseId);
  return {
    messages: messages.filter((message) => message.id !== responseId),
    hadPartialText: Boolean(response?.text),
  };
}

export function incompleteResponseStatus({ cancelled, hadPartialText, errorMessage }) {
  if (cancelled) {
    return hadPartialText
      ? "Response cancelled. The partial response was discarded. Your message remains in this tab's session."
      : "Response cancelled. Your message remains in this tab's session.";
  }
  return hadPartialText
    ? `${errorMessage} The incomplete response was discarded.`
    : errorMessage;
}
