export class ValidationBinder {
    #parser;
    #binder;

    constructor(parser, binder) {
        this.#parser = parser;
        this.#binder = binder;
    }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "validation");
        const source = element.dataset.validationFor?.trim();
        const descriptor = viewModel.field?.(source);

        if (!source || !descriptor) {
            throw new Error(
                `data-validation-for exige um campo declarado em static fields: '${source ?? ""}'.`
            );
        }

        element.setAttribute("role", "alert");
        element.setAttribute("aria-live", "polite");

        const update = errors => {
            const messages = Array.isArray(errors) ? errors : [];
            element.textContent = messages.join(" ");
            element.hidden = messages.length === 0;
            this.updateInputs(element, viewModel, source, messages.length > 0);
        };

        const unsubscribe = viewModel.subscribe(`errors.${source}`, update);
        this.#binder.storeCleanup(element, "validation", [unsubscribe]);
        update(viewModel.errors[source]);
    }

    updateInputs(output, viewModel, source, invalid) {
        const root = output.getRootNode();
        const elements = root.querySelectorAll?.("[data-bind]") ?? [];
        if (!output.id) {
            output.id = this.createOutputId(
                root,
                `validation-${source.replace(/[^\w-]/g, "-")}`
            );
        }

        for (const element of elements) {
            let bindings;
            try { bindings = this.#parser.parseBindings(element.dataset.bind); }
            catch { continue; }
            if (!bindings.some(binding => binding.source === source)) continue;
            element.setAttribute("aria-invalid", String(invalid));
            const describedBy = new Set(
                (element.getAttribute("aria-describedby") ?? "")
                    .split(/\s+/)
                    .filter(Boolean)
            );
            if (invalid) describedBy.add(output.id);
            else describedBy.delete(output.id);
            if (describedBy.size > 0) {
                element.setAttribute(
                    "aria-describedby",
                    [...describedBy].join(" ")
                );
            } else {
                element.removeAttribute("aria-describedby");
            }
        }
    }

    createOutputId(root, base) {
        let id = base;
        let suffix = 2;
        while (root.querySelector?.(`#${id}`)) {
            id = `${base}-${suffix++}`;
        }
        return id;
    }
}
