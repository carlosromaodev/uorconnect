import type { Env } from "../../../config/env";
import type { SecretariaApplication } from "./secretaria.application";
import { DisabledSecretariaApplication, LiveSecretariaApplication } from "./secretaria.application";
import { NetpaSecretariaGateway } from "../infra/netpa-secretaria.gateway";
import { SecretariaCryptoKeyring } from "../infra/secretaria-crypto";

export function createSecretariaApplication(env: Env, override?: SecretariaApplication): SecretariaApplication {
  if (override) return override;
  if (!env.SECRETARIA_INTEGRATION_ENABLED) return new DisabledSecretariaApplication();
  const gateway = new NetpaSecretariaGateway({
    baseUrl: env.SECRETARIA_BASE_URL,
    timeoutMs: env.SECRETARIA_FETCH_TIMEOUT_MS,
    maxResponseBytes: env.SECRETARIA_MAX_RESPONSE_BYTES,
  });
  const keyring = SecretariaCryptoKeyring.fromConfig(env.SECRETARIA_ACTIVE_ENCRYPTION_KEY_ID, env.SECRETARIA_ENCRYPTION_KEYS);
  return new LiveSecretariaApplication(gateway, keyring);
}
