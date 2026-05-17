import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type ApiErrorLike = FastifyError & {
  validation?: unknown;
  validationContext?: string;
};

const RESPONSE_SCHEMA_MESSAGE =
  "O servidor devolveu uma resposta inesperada. A equipa técnica já foi notificada. Tenta novamente.";

function hasPortugueseSignal(message: string) {
  return /[áàâãéêíóôõúç]|não|está|já|ação|ções|convite|membro|estudante|credencial|presença|equipa|projeto|curso|telefone|senha|palavra-passe/i.test(message);
}

export function translateApiErrorMessage(error: ApiErrorLike) {
  const message = typeof error.message === "string" ? error.message.trim() : "";
  const statusCode = Number.isInteger(error.statusCode) ? Number(error.statusCode) : 500;

  if (
    error.code === "FST_ERR_RESPONSE_SERIALIZATION" ||
    /response doesn't match the schema/i.test(message)
  ) {
    return RESPONSE_SCHEMA_MESSAGE;
  }

  if (error.code === "FST_ERR_VALIDATION" || error.validation) {
    return "Dados inválidos. Revê os campos e tenta novamente.";
  }

  if (/missing or invalid token|unauthorized|invalid token/i.test(message)) {
    return "Sessão inválida ou expirada. Inicia sessão novamente.";
  }

  if (/forbidden|access denied/i.test(message)) {
    return "Não tens permissão para realizar esta ação.";
  }

  if (/not found/i.test(message)) {
    return "Registo não encontrado.";
  }

  if (statusCode >= 500) {
    return "Não foi possível concluir o pedido agora. Tenta novamente em instantes.";
  }

  if (!message) {
    return "Não foi possível concluir o pedido.";
  }

  if (hasPortugueseSignal(message)) {
    return message;
  }

  return "Não foi possível concluir o pedido. Revê os dados e tenta novamente.";
}

export function registerPortugueseErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: ApiErrorLike, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = Number.isInteger(error.statusCode) && Number(error.statusCode) >= 400
      ? Number(error.statusCode)
      : 500;
    const message = translateApiErrorMessage(error);

    if (statusCode >= 500) {
      request.log.error({ err: error }, message);
    } else {
      request.log.warn({ err: error }, message);
    }

    return reply.code(statusCode).send({ message });
  });
}
