const errorMessages = {
  configuration_invalid: "Local AI configuration is invalid. Check the development environment settings.",
  inference_disabled: "AI replies are unavailable in this deployment. Em's conversation interface remains available without inference.",
  model_not_configured: "No local model is configured. Set OLLAMA_MODEL to an already-installed model.",
  model_not_found: "The configured local model is not installed in Ollama. Choose a model that is already installed.",
  provider_unavailable: "The local AI service could not be reached. Check that Ollama is running on this computer.",
  provider_timeout: "The local AI service took too long to respond. Try again later.",
  provider_malformed_response: "The local AI service returned an unreadable response. Try again later.",
  provider_error: "The local AI service could not complete this response.",
  request_cancelled: "The response was cancelled.",
};

export class AIProviderError extends Error {
  constructor(code) {
    super(code);
    this.name = "AIProviderError";
    this.code = code;
  }
}

export function publicError(error) {
  const code = error instanceof AIProviderError ? error.code : "provider_unavailable";
  return { code, message: errorMessages[code] || errorMessages.provider_unavailable };
}
