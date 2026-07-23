import BindifyJS from "./BindifyJS.js";

let startPromise = null;

function showStartupError(error) {
    console.error("[BindifyJS] Inicialização falhou:", error);

    const output = document.createElement("pre");
    output.id = "bindify-startup-error";
    output.setAttribute("role", "alert");
    output.style.cssText = [
        "white-space: pre-wrap",
        "padding: 1rem",
        "border: 1px solid #b42318",
        "border-radius: .5rem",
        "color: #b42318",
        "background: #fef3f2"
    ].join(";");
    output.textContent = BindifyJS.configuration.detailedErrors
        ? `[BindifyJS] ${error?.stack ?? error}`
        : "[BindifyJS] Não foi possível iniciar a aplicação.";

    document.body?.prepend(output);
}

export function startApplication() {
    startPromise ??= BindifyJS.start()
        .then(viewModel => {
            document.documentElement.dataset.bindifyReady = "true";
            return viewModel;
        })
        .catch(error => {
            showStartupError(error);
            throw error;
        });

    return startPromise;
}

export async function stopApplication() {
    const stopped = await BindifyJS.stop();
    startPromise = null;
    delete document.documentElement.dataset.bindifyReady;
    return stopped;
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startApplication, {
        once: true
    });
} else {
    setTimeout(startApplication, 0);
}
