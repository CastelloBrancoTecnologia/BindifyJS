import { Path } from "./Path.js";

export class ItemsBinder {
    #parser;
    #binder;

    constructor(parser, binder) {
        this.#parser = parser;
        this.#binder = binder;
    }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "items");

        if (!(element instanceof HTMLSelectElement) &&
            !(element instanceof HTMLDataListElement)) {
            throw new TypeError(
                "data-bind-items só pode ser usado em <select> ou <datalist>."
            );
        }

        const binding = this.#parser.parseItems(
            element.dataset.bindItems
        );
        if (!Path.has(viewModel, binding.source)) {
            throw new Error(
                `A coleção '${binding.source}' não existe no ViewModel.`
            );
        }

        const optionsByKey = new Map();
        let emptyOption = null;

        const render = items => {
            if (!Array.isArray(items)) {
                throw new TypeError(
                    `data-bind-items exige um array em '${binding.source}'.`
                );
            }

            if (binding.emptyText != null) {
                emptyOption ??= document.createElement("option");
                emptyOption.textContent = binding.emptyText;
                emptyOption.value = binding.emptyValue;
                emptyOption.dataset.mvvmItem = "empty";
                element.prepend(emptyOption);
            } else if (emptyOption) {
                emptyOption.remove();
                emptyOption = null;
            }

            const nextKeys = new Set();
            const ordered = [];
            items.forEach((item, index) => {
                const key = binding.key
                    ? this.readItem(item, binding.key, index, "key")
                    : index;
                if (key == null) {
                    throw new Error(
                        `data-bind-items produziu uma chave vazia no índice ${index}.`
                    );
                }
                if (nextKeys.has(key)) {
                    throw new Error(
                        `data-bind-items produziu a chave duplicada '${String(key)}'.`
                    );
                }
                nextKeys.add(key);

                let option = optionsByKey.get(key);
                if (!option) {
                    option = document.createElement("option");
                    option.dataset.mvvmItem = "true";
                    optionsByKey.set(key, option);
                }

                const text = binding.text
                    ? this.readItem(item, binding.text, index, "text")
                    : item;
                const value = binding.value
                    ? this.readItem(item, binding.value, index, "value")
                    : item;
                option.textContent = text == null ? "" : String(text);
                option.value = value == null ? "" : String(value);
                ordered.push(option);
            });

            for (const [key, option] of [...optionsByKey]) {
                if (nextKeys.has(key)) continue;
                option.remove();
                optionsByKey.delete(key);
            }

            for (const option of ordered) element.append(option);
        };

        const unsubscribe = viewModel.subscribe(binding.source, render);
        this.#binder.storeCleanup(element, "items", [
            unsubscribe,
            () => {
                emptyOption?.remove();
                for (const option of optionsByKey.values()) option.remove();
                optionsByKey.clear();
            }
        ]);
        render(Path.get(viewModel, binding.source));
    }

    readItem(item, path, index, option) {
        if (item == null ||
            (typeof item !== "object" && typeof item !== "function") ||
            !Path.has(item, path)) {
            throw new Error(
                `O caminho '${path}' de '${option}' não existe no item do índice ${index}.`
            );
        }
        return Path.get(item, path);
    }
}
