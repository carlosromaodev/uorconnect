import { createRoot } from "react-dom/client";
import "./shims/process";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

async function bootstrap() {
  const { default: App } = await import("./App");
  root.render(<App />);
}

void bootstrap();
