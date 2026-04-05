import {
  AnalisadorSemanticoVisuAlg,
  AvaliadorSintaticoVisuAlg,
  InterpretadorVisuAlg,
  LexadorVisuAlg,
} from "@designliquido/visualg";

export type ArenaDiagnostic = {
  stage: "lexico" | "sintatico" | "semantico" | "execucao";
  line?: number;
  message: string;
};

export type ArenaExecutionResult = {
  success: boolean;
  stdout: string;
  diagnostics: ArenaDiagnostic[];
};

type RuntimeErrorLike = {
  linha?: number;
  message?: string;
  mensagem?: string;
};

function formatMessage(error: RuntimeErrorLike) {
  return error.mensagem || error.message || "Erro desconhecido no runtime.";
}

function toDiagnostic(
  stage: ArenaDiagnostic["stage"],
  error: RuntimeErrorLike,
): ArenaDiagnostic {
  return {
    stage,
    line: error.linha,
    message: formatMessage(error),
  };
}

export async function runVisualgProgram(
  code: string,
  stdin = "",
): Promise<ArenaExecutionResult> {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const outputs: string[] = [];
  const inputs = stdin.replace(/\r\n/g, "\n").split("\n");
  let inputIndex = 0;

  const lexador = new LexadorVisuAlg();
  const lexed = lexador.mapear(lines, -1);

  if (lexed.erros?.length) {
    return {
      success: false,
      stdout: "",
      diagnostics: lexed.erros.map((error) => toDiagnostic("lexico", error)),
    };
  }

  const avaliador = new AvaliadorSintaticoVisuAlg();
  let parsed: Awaited<ReturnType<AvaliadorSintaticoVisuAlg["analisar"]>>;

  try {
    parsed = await avaliador.analisar(lexed, -1);
  } catch (error) {
    return {
      success: false,
      stdout: outputs.join("\n"),
      diagnostics: [toDiagnostic("sintatico", error as RuntimeErrorLike)],
    };
  }

  if (parsed.erros?.length) {
    return {
      success: false,
      stdout: outputs.join("\n"),
      diagnostics: parsed.erros.map((error) => toDiagnostic("sintatico", error)),
    };
  }

  const analisador = new AnalisadorSemanticoVisuAlg();
  const semantic = await analisador.analisar(parsed.declaracoes);

  if (semantic.diagnosticos?.length) {
    return {
      success: false,
      stdout: outputs.join("\n"),
      diagnostics: semantic.diagnosticos.map((diagnostic) => ({
        stage: "semantico",
        line: diagnostic.linha,
        message: diagnostic.mensagem,
      })),
    };
  }

  const interpretador = new InterpretadorVisuAlg(
    ".",
    false,
    (text: unknown) => outputs.push(String(text ?? "")),
    (text: unknown) => {
      const value = String(text ?? "");
      if (outputs.length === 0) {
        outputs.push(value);
        return;
      }

      outputs[outputs.length - 1] = `${outputs[outputs.length - 1]}${value}`;
    },
    () => undefined,
  );

  interpretador.deveEscreverPrompt = true;
  interpretador.interfaceEntradaSaida = {
    question: (_prompt: string, callback: (value: string) => void) => {
      const nextValue = inputs[inputIndex] ?? "";
      inputIndex += 1;
      callback(nextValue);
    },
  };

  try {
    const result = await interpretador.interpretar(parsed.declaracoes);
    if (result.erros?.length) {
      return {
        success: false,
        stdout: outputs.join("\n"),
        diagnostics: result.erros.map((error) => toDiagnostic("execucao", error)),
      };
    }

    return {
      success: true,
      stdout: outputs.join("\n"),
      diagnostics: [],
    };
  } catch (error) {
    return {
      success: false,
      stdout: outputs.join("\n"),
      diagnostics: [toDiagnostic("execucao", error as RuntimeErrorLike)],
    };
  }
}
