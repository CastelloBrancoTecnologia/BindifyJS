export class BindingGroupBinder {
    #binder;
    #states = new WeakMap();

    constructor(binder) {
        this.#binder = binder;
    }

    bindElement(group) {
        const state = this.ensureGroup(group);
        if (state.bound) return;
        state.bound = true;
        this.#binder.storeCleanup(group, "binding-group", [() => {
            group.removeEventListener("click", state.onClick, true);
            delete group.bindingGroup;
            this.#states.delete(group);
        }]);
    }

    register(element, source, commit, cancel, viewModel = null) {
        const group = element.closest("[data-binding-group]");
        if (!group || group.getRootNode() !== element.getRootNode()) {
            throw new Error(
                `when: groupcommit exige um ancestral com data-binding-group para '${source}'.`
            );
        }

        const state = this.ensureGroup(group);
        if ([...state.registrations].some(item =>
            item.source === source && item.element !== element
        )) {
            throw new Error(
                `O campo '${source}' possui mais de um binding editável no ` +
                `grupo '${group.dataset.bindingGroup ?? ""}'.`
            );
        }
        const registration = {
            element,
            source,
            commit,
            cancel,
            viewModel
        };
        state.registrations.add(registration);
        const unregisterFieldGroup = viewModel?.registerFieldGroup?.(
            source,
            group.dataset.bindingGroup
        );
        return () => {
            state.registrations.delete(registration);
            unregisterFieldGroup?.();
        };
    }

    ensureGroup(group) {
        let state = this.#states.get(group);
        if (state) return state;

        state = {
            bound: false,
            registrations: new Set(),
            onClick: null,
            revision: 0
        };
        state.onClick = event => {
            const action = event.composedPath().find(node =>
                node instanceof Element &&
                (node.hasAttribute("data-binding-commit") ||
                    node.hasAttribute("data-binding-cancel"))
            );
            if (!action || action.closest("[data-binding-group]") !== group) {
                return;
            }

            event.preventDefault();
            if (action.hasAttribute("data-binding-cancel")) {
                group.bindingGroup.cancel();
            } else {
                const fields = action.dataset.bindingFields
                    ?.split(/[\s,]+/)
                    .map(value => value.trim())
                    .filter(Boolean) ?? null;
                group.bindingGroup.commit({
                    action: action.getAttribute("data-binding-commit") || null,
                    fields
                }).catch(error => {
                    const viewModel = [...state.registrations]
                        .find(item => item.viewModel)?.viewModel;
                    if (typeof viewModel?.handleError === "function") {
                        return viewModel.handleError(error, {
                            phase: "binding-group",
                            group: group.dataset.bindingGroup ?? "",
                            element: action
                        });
                    }
                    console.error("[BindifyJS/binding-group]", error);
                });
            }
        };

        const commit = options => this.commit(group, state, options);
        const cancel = () => this.cancel(group, state);
        Object.defineProperty(group, "bindingGroup", {
            configurable: true,
            enumerable: false,
            value: Object.freeze({ commit, cancel })
        });
        group.addEventListener("click", state.onClick, true);
        this.#states.set(group, state);
        return state;
    }

    async commit(group, state, options = {}) {
        const revision = ++state.revision;
        const selectedFields = options?.fields?.length
            ? new Set(options.fields)
            : null;
        const registrations = [...state.registrations].filter(item =>
            !selectedFields || selectedFields.has(item.source)
        );
        if (selectedFields) {
            for (const field of selectedFields) {
                if (!registrations.some(item => item.source === field)) {
                    throw new Error(
                        `O campo '${field}' não pertence ao binding group '${group.dataset.bindingGroup ?? ""}'.`
                    );
                }
            }
        }
        if (registrations.length === 0) {
            throw new Error(
                `O binding group '${group.dataset.bindingGroup ?? ""}' ` +
                "não possui Fields para confirmar."
            );
        }

        const prepareContext = Object.freeze({
            group: group.dataset.bindingGroup || null,
            action: options?.action ?? null,
            fields: Object.freeze(
                selectedFields ? [...selectedFields] : []
            ),
            phase: "prepare"
        });
        const prepared = await Promise.all(
            registrations.map(item => item.commit(prepareContext))
        );
        if (state.revision !== revision) return false;

        const candidateValues = Object.create(null);
        for (const candidate of prepared) {
            candidateValues[candidate.source] = candidate.value;
        }
        const validationContext = Object.freeze({
            group: prepareContext.group,
            action: prepareContext.action,
            fields: prepareContext.fields,
            phase: "validate",
            values: Object.freeze(candidateValues)
        });
        const results = await Promise.all(
            prepared.map(candidate =>
                typeof candidate.validate === "function"
                    ? candidate.validate(validationContext)
                    : candidate
            )
        );
        if (state.revision !== revision) return false;
        const detail = this.createDetail(
            group,
            results,
            options?.action ?? null
        );
        if (detail.valid) {
            for (const result of results) result.apply();
        }
        const eventName = detail.valid
            ? "bindingscommit"
            : "bindingsinvalid";
        group.dispatchEvent(new CustomEvent(eventName, {
            detail,
            bubbles: true,
            composed: true
        }));
        return detail.valid;
    }

    cancel(group, state) {
        state.revision++;
        const fields = [];
        for (const registration of state.registrations) {
            registration.cancel();
            if (!fields.includes(registration.source)) {
                fields.push(registration.source);
            }
        }
        const detail = Object.freeze({
            group: group.dataset.bindingGroup || null,
            fields: Object.freeze(fields)
        });
        group.dispatchEvent(new CustomEvent("bindingscancel", {
            detail,
            bubbles: true,
            composed: true
        }));
        return true;
    }

    createDetail(group, results, action = null) {
        const fields = [];
        const values = Object.create(null);
        const errors = Object.create(null);
        let valid = true;

        for (const result of results) {
            if (!fields.includes(result.source)) fields.push(result.source);
            values[result.source] = result.value;
            if (!result.valid || result.status === "cancelled") {
                valid = false;
                if (result.errors.length > 0) {
                    errors[result.source] = Object.freeze([...result.errors]);
                }
            }
        }

        return Object.freeze({
            group: group.dataset.bindingGroup || null,
            action,
            fields: Object.freeze(fields),
            values: Object.freeze(values),
            errors: Object.freeze(errors),
            valid
        });
    }
}
