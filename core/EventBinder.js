import { Path } from "./Path.js";

export class EventBinder {
    #parser;
    #binder;
    constructor(parser, binder) { this.#parser = parser; this.#binder = binder; }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "event");
        const cleanup = [];

        for (const binding of this.#parser.parseEvents(
            element.dataset.event
        )) {
            const method = Path.get(viewModel, binding.method);
            if (typeof method !== "function") throw new Error(`O método '${binding.method}' não existe no ViewModel.`);
            const listener = event => {
                try {
                    Promise.resolve(
                        method.call(viewModel, event, element)
                    ).catch(error => {
                        this.reportError(
                            element,
                            binding,
                            error,
                            viewModel
                        );
                    });
                } catch (error) {
                    this.reportError(
                        element,
                        binding,
                        error,
                        viewModel
                    );
                }
            };
            element.addEventListener(binding.event, listener);
            cleanup.push(() =>
                element.removeEventListener(binding.event, listener));
        }

        this.#binder.storeCleanup(element, "event", cleanup);
    }

    reportError(element, binding, error, viewModel) {
        const context = Object.freeze({
            phase: "event",
            event: binding.event,
            method: binding.method,
            element
        });
        if (typeof viewModel?.handleError === "function") {
            Promise.resolve(
                viewModel.handleError(error, context)
            ).catch(boundaryError => {
                console.error(
                    "[BindifyJS/error-boundary]",
                    boundaryError
                );
            });
        } else {
            console.error(
                `[BindifyJS/event/${binding.event}/${binding.method}]`,
                error
            );
        }
        element.dispatchEvent(new CustomEvent("bindifyeventerror", {
            detail: Object.freeze({
                event: binding.event,
                method: binding.method,
                error,
                context
            }),
            bubbles: true,
            composed: true
        }));
    }
}
