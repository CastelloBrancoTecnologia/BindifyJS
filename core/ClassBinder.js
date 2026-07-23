import { Path } from "./Path.js";

export class ClassBinder {
    #parser;
    #binder;

    constructor(parser, binder) {
        this.#parser = parser;
        this.#binder = binder;
    }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "class");
        const cleanup = [];
        const bindings = this.#parser.parseClasses(
            element.dataset.class
        );

        for (const binding of bindings) {
            if (!Path.has(viewModel, binding.source)) {
                throw new Error(
                    `A source '${binding.source}' de data-class não existe no ViewModel.`
                );
            }
        }

        for (const binding of bindings) {
            const initialState = element.classList.contains(
                binding.className
            );
            const update = () => {
                const value = Path.get(viewModel, binding.source);
                const active = typeof value === "function"
                    ? value.call(viewModel)
                    : value;
                element.classList.toggle(
                    binding.className,
                    Boolean(active)
                );
            };

            cleanup.push(
                viewModel.subscribe(binding.source, update),
                () => element.classList.toggle(
                    binding.className,
                    initialState
                )
            );
            update();
        }

        this.#binder.storeCleanup(element, "class", cleanup);
    }
}
