import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const collectionPath = join(root, "hoppscotch", "uor-connect.collection.json");
const localEnvPath = join(root, "hoppscotch", "environments", "local.example.json");
const vpsEnvPath = join(root, "hoppscotch", "environments", "vps.example.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function flattenRequests(node, parent = []) {
  const folders = Array.isArray(node.folders) ? node.folders : [];
  const requests = Array.isArray(node.requests) ? node.requests : [];

  return [
    ...requests.map((request) => ({
      ...request,
      folderPath: parent.join(" / "),
    })),
    ...folders.flatMap((folder) => flattenRequests(folder, [...parent, folder.name])),
  ];
}

function headerValue(request, key) {
  const header = (request.headers ?? []).find(
    (item) => item.key?.toLowerCase() === key.toLowerCase() && item.active !== false,
  );
  return header?.value ?? "";
}

function bodyText(request) {
  return request.body?.body ?? "";
}

function assertRequest(requests, name, { method, endpointIncludes, tokenVariable, bodyIncludes } = {}) {
  const request = requests.find((item) => item.name === name);
  assert.ok(request, `Missing Hoppscotch request: ${name}`);

  if (method) assert.equal(request.method, method, `${name} should use ${method}`);
  if (endpointIncludes) {
    assert.ok(
      request.endpoint.includes(endpointIncludes),
      `${name} endpoint should include ${endpointIncludes}`,
    );
  }
  if (tokenVariable) {
    assert.equal(
      headerValue(request, "Authorization"),
      `Bearer <<${tokenVariable}>>`,
      `${name} should use Bearer <<${tokenVariable}>>`,
    );
  }
  if (bodyIncludes) {
    const body = bodyText(request);
    for (const fragment of bodyIncludes) {
      assert.ok(body.includes(fragment), `${name} body should include ${fragment}`);
    }
  }

  assert.ok(
    typeof request.testScript === "string" && request.testScript.includes("pw.test"),
    `${name} should include Hoppscotch testScript assertions`,
  );

  return request;
}

function envKeys(env) {
  return new Set((env.variables ?? []).map((item) => item.key));
}

const collection = readJson(collectionPath);
const localEnv = readJson(localEnvPath);
const vpsEnv = readJson(vpsEnvPath);

assert.ok(Number.isInteger(collection.v), "Collection should include a numeric Hoppscotch version");
assert.equal(collection.name, "UOR Connect - Fluxos Criticos");

const requests = flattenRequests(collection);
assert.ok(requests.length >= 20, "Collection should cover at least 20 API requests");

assertRequest(requests, "Health check", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/health",
});
assertRequest(requests, "Login estudante UOR", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/auth/login",
  bodyIncludes: ["<<studentNumber>>", "<<studentPassword>>", "\"provider\": \"uor\""],
});
assertRequest(requests, "Login expositor UOR", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/auth/login",
  bodyIncludes: ["<<exhibitorNumber>>", "<<exhibitorPassword>>", "\"provider\": \"uor\""],
});
assertRequest(requests, "Login estudante ISPTEC", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/auth/login",
  bodyIncludes: ["<<isptecStudentNumber>>", "<<isptecPassword>>", "\"provider\": \"isptec\""],
});
assertRequest(requests, "Login admin", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/auth/login",
  bodyIncludes: ["<<adminStudentNumber>>", "<<adminPassword>>"],
});
assertRequest(requests, "Perfil autenticado", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/auth/me",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Minha Area - submissoes", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/submissions/mine",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Desafio expositor - meu mapa", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/submissions/exhibitor-passport/mine",
  tokenVariable: "exhibitorToken",
});
assertRequest(requests, "Votacao por QR do expositor", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/interactions/vote",
  tokenVariable: "studentToken",
  bodyIncludes: ["<<submissionId>>"],
});
assertRequest(requests, "Passaporte Digital - resumo", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/passport/me",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Passaporte Digital - entrar", {
  method: "POST",
  endpointIncludes: "<<apiBase>>/passport/join",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Passaporte Digital - leaderboard", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/passport/leaderboard",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Passaporte Admin - overview", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/passport/admin/overview",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Expositor Admin - configuracao de pontos", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/interactions/admin/votes/scoring/config",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Expositor Admin - ranking de pontos", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/interactions/admin/votes/scoring/export",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Expositor Admin - alertas", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/interactions/admin/votes/scoring/alerts",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Certificados - meus", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/certificates/mine",
  tokenVariable: "studentToken",
});
assertRequest(requests, "Certificados Admin - templates", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/certificates/admin/templates",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Certificados Admin - listar", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/certificates/admin/list",
  tokenVariable: "adminToken",
});
assertRequest(requests, "Certificados - PDF", {
  method: "GET",
  endpointIncludes: "<<apiBase>>/certificates/<<certificateId>>/pdf",
  tokenVariable: "studentToken",
});

const requiredVariables = [
  "apiBase",
  "appBase",
  "studentNumber",
  "studentPassword",
  "exhibitorNumber",
  "exhibitorPassword",
  "isptecStudentNumber",
  "isptecPassword",
  "adminStudentNumber",
  "adminPassword",
  "submissionId",
  "certificateId",
  "passportChallengeId",
  "studentToken",
  "exhibitorToken",
  "isptecToken",
  "adminToken",
];

for (const env of [localEnv, vpsEnv]) {
  const keys = envKeys(env);
  for (const key of requiredVariables) {
    assert.ok(keys.has(key), `${env.name} missing variable: ${key}`);
  }
}

console.log(`Hoppscotch collection ok: ${requests.length} requests validated.`);
