import { ViewModel } from "./ViewModel.js";

export class Component extends ViewModel {
    static properties = [];

    host = null;
    shadowRoot = null;

    emit(eventName, detail = undefined, options = {}) {
        if (!this.host) {
            throw new Error("O componente ainda não foi conectado ao host.");
        }

        return this.host.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: options.bubbles ?? true,
            composed: options.composed ?? true,
            cancelable: options.cancelable ?? false
        }));
    }

    hide() {
        if (!this.host) {
            throw new Error("O componente ainda não foi conectado ao host.");
        }

        this.host.setAttribute("hidden", "");
    }

    show() {
        if (!this.host) {
            throw new Error("O componente ainda não foi conectado ao host.");
        }

        this.host.removeAttribute("hidden");
    }

    connected() {}
    disconnected() {}
}
