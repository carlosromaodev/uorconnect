import type { ReactNode } from "react";
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import {
  ToastContainer,
  toast as toastifyToast,
  type ToastContent,
  type ToastOptions,
  type TypeOptions,
} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { cn } from "@/lib/utils";

type NotifyKind = "success" | "error" | "warning" | "info" | "neutral";
type NotifyOptions = Omit<ToastOptions, "type" | "render"> & {
  description?: ReactNode;
};

const notifyDefaults: Record<NotifyKind, { duration: number; type: TypeOptions; icon: ReactNode }> = {
  success: {
    duration: 4200,
    type: "success",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  error: {
    duration: 6500,
    type: "error",
    icon: <XCircle className="h-4 w-4" />,
  },
  warning: {
    duration: 7000,
    type: "warning",
    icon: <TriangleAlert className="h-4 w-4" />,
  },
  info: {
    duration: 5200,
    type: "info",
    icon: <Info className="h-4 w-4" />,
  },
  neutral: {
    duration: 5200,
    type: "default",
    icon: <Info className="h-4 w-4" />,
  },
};

function ToastBody({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="uor-toast-body">
      <p className="uor-toast-title">{title}</p>
      {description ? <p className="uor-toast-description">{description}</p> : null}
    </div>
  );
}

function createToast(
  kind: NotifyKind,
  title: ReactNode,
  options?: NotifyOptions,
) {
  const defaults = notifyDefaults[kind];
  const content: ToastContent = (
    <ToastBody title={title} description={options?.description} />
  );

  return toastifyToast(content, {
    type: defaults.type,
    autoClose: options?.autoClose ?? defaults.duration,
    closeButton: true,
    icon: options?.icon ?? defaults.icon,
    className: cn("uor-toast", options?.className as string | undefined),
    ...options,
  });
}

const toast = Object.assign(
  (message: ReactNode, options?: NotifyOptions) => createToast("neutral", message, options),
  toastifyToast,
  {
    success: (title: ReactNode, options?: NotifyOptions) => createToast("success", title, options),
    error: (title: ReactNode, options?: NotifyOptions) => createToast("error", title, options),
    warning: (title: ReactNode, options?: NotifyOptions) => createToast("warning", title, options),
    info: (title: ReactNode, options?: NotifyOptions) => createToast("info", title, options),
    message: (title: ReactNode, options?: NotifyOptions) => createToast("neutral", title, options),
  },
);

const notify = {
  success: (title: ReactNode, description?: ReactNode, options?: NotifyOptions) =>
    toast.success(title, { ...options, description }),
  error: (title: ReactNode, description?: ReactNode, options?: NotifyOptions) =>
    toast.error(title, { ...options, description }),
  warning: (title: ReactNode, description?: ReactNode, options?: NotifyOptions) =>
    toast.warning(title, { ...options, description }),
  info: (title: ReactNode, description?: ReactNode, options?: NotifyOptions) =>
    toast.info(title, { ...options, description }),
  neutral: (title: ReactNode, description?: ReactNode, options?: NotifyOptions) =>
    toast.message(title, { ...options, description }),
};

function Toaster() {
  return (
    <ToastContainer
      position="top-center"
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      hideProgressBar
      limit={4}
      role="alert"
      className="uor-toast-container"
      toastClassName={(context) => {
        const type = context?.type ?? "default";
        return cn("uor-toast", `uor-toast--${type}`);
      }}
      bodyClassName="uor-toast-inner"
      closeButton={({ closeToast }) => (
        <button
          type="button"
          onClick={closeToast}
          className="uor-toast-close"
          aria-label="Fechar notificação"
        >
          ×
        </button>
      )}
    />
  );
}

export { Toaster, toast, notify };
