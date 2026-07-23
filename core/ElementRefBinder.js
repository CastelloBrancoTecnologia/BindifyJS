import { Path } from "./Path.js";

export class ElementRefBinder {
    #states = new WeakMap();
    #referencesByViewModel = new WeakMap();

    bindElement(element, viewModel) {
        this.unbindElement(element);
        const reference = element.dataset.elementRef?.trim();
        if (!reference) {
            throw new Error("data-element-ref não pode estar vazio.");
        }
        if (!Path.has(viewModel, reference)) {
            throw new Error(
                `A referência '${reference}' não existe no ViewModel.`
            );
        }

        const references = this.#referencesByViewModel.get(viewModel) ??
            new Map();
        this.#referencesByViewModel.set(viewModel, references);
        const existing = references.get(reference);
        if (existing && existing !== element) {
            throw new Error(
                `data-element-ref '${reference}' foi usado em mais de um elemento.`
            );
        }

        const previousValue = Path.get(viewModel, reference);
        references.set(reference, element);
        Path.set(viewModel, reference, element);
        this.#states.set(element, {
            viewModel,
            reference,
            previousValue
        });
    }

    unbindElement(element) {
        const state = this.#states.get(element);
        if (!state) return;
        this.#states.delete(element);

        const references = this.#referencesByViewModel.get(
            state.viewModel
        );
        if (references?.get(state.reference) === element) {
            references.delete(state.reference);
            if (references.size === 0) {
                this.#referencesByViewModel.delete(state.viewModel);
            }
        }
        if (Path.get(state.viewModel, state.reference) === element) {
            Path.set(
                state.viewModel,
                state.reference,
                state.previousValue
            );
        }
    }
}
