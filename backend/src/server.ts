import "dotenv/config";
import { buildApp } from "./app";
import { loadEnv } from "./config/env";

async function bootstrap() {
  const env = loadEnv();
  const app = buildApp(env);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
