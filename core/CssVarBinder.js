import { Path } from "./Path.js";

export class CssVarBinder {
    #parser;
    #binder;

    constructor(parser, binder) {
        this.#parser = parser;
        this.#binder = binder;
    }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "css-var");
        const bindings = this.#parser.parseCssVars(
            element.dataset.cssVar
        );
        const cleanup = [];

        for (const binding of bindings) {
            if (!Path.has(viewModel, binding.source)) {
                throw new Error(
                    `A source '${binding.source}' de data-css-var não existe no ViewModel.`
                );
            }
        }

        for (const binding of bindings) {
            const property = `--${binding.name}`;
            const initialValue = element.style.getPropertyValue(property);
            const initialPriority = element.style.getPropertyPriority(property);
            const update = () => {
                const value = Path.get(viewModel, binding.source);
                const resolved = typeof value === "function"
                    ? value.call(viewModel)
                    : value;

                if (resolved === null || resolved === undefined) {
                    element.style.removeProperty(property);
                } else {
                    element.style.setProperty(property, String(resolved));
                }
            };

            cleanup.push(
                viewModel.subscribe(binding.source, update),
                () => {
                    if (initialValue === "") {
                        element.style.removeProperty(property);
                    } else {
                        element.style.setProperty(
                            property,
                            initialValue,
                            initialPriority
                        );
                    }
                }
            );
            update();
        }

        this.#binder.storeCleanup(element, "css-var", cleanup);
    }
}
