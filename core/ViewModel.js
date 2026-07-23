const validationControllersByViewModel = new WeakMap();
const fieldStateSubscriptionsByViewModel = new WeakMap();
const initialFieldValuesByViewModel = new WeakMap();
const fieldGroupsByViewModel = new WeakMap();
const resourcesByViewModel = new WeakMap();
const errorConfigurationByViewModel = new WeakMap();

export class ViewModel {
    static fields = {};
    static cancelChange = Symbol("mvvm.cancelChange");

    errors = Object.create(null);
    fieldState = Object.create(null);
    errorState = {
        hasError: false,
        error: null,
        context: null
    };

    use(resource, cleanup = undefined) {
        if (resource == null) {
            throw new TypeError("O recurso não pode ser nulo.");
        }

        const disposer = this.resolveResourceDisposer(resource, cleanup);
        const resources = resourcesByViewModel.get(this) ?? [];
        resourcesByViewModel.set(this, resources);
        resources.push({
            resource,
            disposer,
            released: false
        });
        return resource;
    }

    resolveResourceDisposer(resource, cleanup) {
        if (cleanup !== undefined) {
            if (typeof cleanup !== "function") {
                throw new TypeError("O cleanup do recurso precisa ser uma função.");
            }
            return () => cleanup(resource);
        }
        if (typeof resource === "function") return resource;

        const candidates = [
            Symbol.asyncDispose,
            Symbol.dispose,
            "dispose",
            "unsubscribe",
            "abort",
            "close",
            "destroy"
        ].filter(candidate => candidate !== undefined);

        for (const candidate of candidates) {
            if (typeof resource[candidate] === "function") {
                return () => resource[candidate]();
            }
        }
        throw new TypeError(
            "O recurso precisa ser uma função de cleanup ou expor dispose, unsubscribe, abort, close ou destroy."
        );
    }

    async releaseResources() {
        const resources = resourcesByViewModel.get(this) ?? [];
        resourcesByViewModel.delete(this);
        const errors = [];

        for (const entry of [...resources].reverse()) {
            if (entry.released) continue;
            entry.released = true;
            try {
                await entry.disposer();
            } catch (error) {
                errors.push(error);
                await this.handleError(error, {
                    phase: "resource-cleanup",
                    resource: entry.resource
                });
            }
        }
        return Object.freeze(errors);
    }

    async handleError(error, context = {}) {
        const normalizedError = error instanceof Error
            ? error
            : new Error(String(error));
        const errorContext = Object.freeze({
            ...context,
            viewModel: this
        });
        const errorConfiguration =
            errorConfigurationByViewModel.get(this) ?? {};
        const publicError = errorConfiguration.detailedErrors === false
            ? new Error("Ocorreu um erro inesperado.")
            : normalizedError;
        const publicContext =
            errorConfiguration.detailedErrors === false
                ? { phase: errorContext.phase, viewModel: this }
                : { ...errorContext };
        this.errorState = {
            hasError: true,
            error: publicError,
            context: publicContext
        };

        try {
            const externallyHandled = await errorConfiguration.reporter?.(
                normalizedError,
                errorContext
            ) === true;
            const locallyHandled = externallyHandled
                ? false
                : (await this.onError(
                    normalizedError,
                    errorContext
                )) === true;
            return externallyHandled || locallyHandled;
        } catch (boundaryError) {
            console.error("[BindifyJS/error-boundary]", boundaryError);
            return false;
        }
    }

    clearError() {
        this.errorState = {
            hasError: false,
            error: null,
            context: null
        };
    }

    configureErrorBoundary(options = {}) {
        errorConfigurationByViewModel.set(this, {
            reporter: options.reporter,
            detailedErrors: options.detailedErrors !== false
        });
    }

    update(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("update exige uma função.");
        }
        if (callback.constructor?.name === "AsyncFunction") {
            throw new TypeError("update precisa ser síncrono.");
        }
        if (typeof this.runUpdate === "function") {
            return this.runUpdate(callback);
        }
        const result = callback.call(this);
        if (
            result != null &&
            typeof result.then === "function"
        ) {
            Promise.resolve(result).catch(() => {});
            throw new TypeError("update precisa ser síncrono.");
        }
        return result;
    }

    field(path) {
        const root = String(path ?? "").split(".")[0];
        return this.constructor.fields?.[root] ?? null;
    }

    assertFields() {
        const fields = this.constructor.fields ?? {};
        const subscriptions = fieldStateSubscriptionsByViewModel.get(this) ??
            new Map();
        fieldStateSubscriptionsByViewModel.set(this, subscriptions);
        const initialValues = initialFieldValuesByViewModel.get(this) ??
            new Map();
        initialFieldValuesByViewModel.set(this, initialValues);

        for (const [name, descriptor] of Object.entries(fields)) {
            if (!(name in this)) {
                throw new Error(
                    `static fields declara '${name}', mas a propriedade não existe em ${this.constructor.name}.`
                );
            }
            if (!descriptor || typeof descriptor.validate !== "function") {
                throw new TypeError(
                    `O campo '${name}' precisa ser criado por Field.`
                );
            }
            const lifecycleName = name.charAt(0).toUpperCase() +
                name.slice(1);
            for (const suffix of ["Changing", "Changed"]) {
                const methodName = `on${lifecycleName}${suffix}`;
                if (
                    methodName in this &&
                    typeof this[methodName] !== "function"
                ) {
                    throw new TypeError(
                        `${methodName} precisa ser um método.`
                    );
                }
            }
            this.errors[name] ??= [];
            this.fieldState[name] ??= {
                valid: null,
                validated: false,
                changed: false,
                dirty: false,
                pending: false,
                error: this.errors[name][0] ?? ""
            };
            if (!initialValues.has(name)) {
                initialValues.set(name, this.cloneFieldValue(this[name]));
            }

            if (!subscriptions.has(name)) {
                const unsubscribeValue = this.subscribe(name, value => {
                    const state = this.fieldState[name];
                    state.changed = true;
                    state.dirty = !this.fieldValuesEqual(
                        value,
                        initialValues.get(name)
                    );
                });
                const unsubscribeErrors = this.subscribe(
                    `errors.${name}`,
                    errors => this.updateFieldValidationState(name, errors)
                );
                subscriptions.set(name, () => {
                    unsubscribeValue();
                    unsubscribeErrors();
                });
            }

            for (const method of descriptor.asyncHandlerNames ?? []) {
                if (typeof this[method] !== "function") {
                    throw new Error(
                        `O campo '${name}' usa customAsync('${method}'), ` +
                        `mas esse método não existe em ${this.constructor.name}.`
                    );
                }
            }

            for (const dependent of descriptor.changedDependencies ?? []) {
                if (!this.hasPropertyPath(dependent)) {
                    throw new Error(
                        `O campo '${name}' declara alsoChanges('${dependent}'), ` +
                        `mas essa propriedade ou método não existe em ${this.constructor.name}.`
                    );
                }
            }

            for (const compared of descriptor.comparedFields ?? []) {
                if (!this.hasPropertyPath(compared) ||
                    !this.field(compared)) {
                    throw new Error(
                        `O campo '${name}' usa uma comparação com '${compared}', ` +
                        "mas o Field comparado não existe."
                    );
                }
            }
        }

        this.assertNoChangeCycles(fields);
    }

    updateFieldValidationState(name, errors = this.errors[name]) {
        const messages = Array.isArray(errors) ? errors : [];
        const state = this.fieldState[name];
        if (!state) return;
        state.validated = true;
        state.valid = messages.length === 0;
        state.error = messages[0] ?? "";
    }

    acceptChanges(...names) {
        const fields = names.length > 0
            ? names
            : Object.keys(this.constructor.fields ?? {});
        for (const name of fields) {
            if (!this.field(name)) {
                throw new Error(
                    `O campo '${name}' não foi declarado em static fields.`
                );
            }
            initialFieldValuesByViewModel.get(this).set(
                name,
                this.cloneFieldValue(this[name])
            );
            this.fieldState[name].changed = false;
            this.fieldState[name].dirty = false;
        }
    }

    registerFieldGroup(name, groupName) {
        if (!this.field(name)) {
            throw new Error(
                `O campo '${name}' não foi declarado em static fields.`
            );
        }
        const group = String(groupName ?? "").trim();
        if (!group) {
            throw new Error("data-binding-group precisa possuir um nome.");
        }

        const groups = fieldGroupsByViewModel.get(this) ?? new Map();
        fieldGroupsByViewModel.set(this, groups);
        const fields = groups.get(group) ?? new Map();
        groups.set(group, fields);
        fields.set(name, (fields.get(name) ?? 0) + 1);

        return () => {
            const count = fields.get(name) ?? 0;
            if (count <= 1) fields.delete(name);
            else fields.set(name, count - 1);
            if (fields.size === 0) groups.delete(group);
        };
    }

    resolveFieldSelection(fieldName = "", groupName = "") {
        const field = String(fieldName ?? "").trim();
        const group = String(groupName ?? "").trim();
        const allFields = Object.keys(this.constructor.fields ?? {});

        if (field && !this.field(field)) {
            throw new Error(
                `O campo '${field}' não foi declarado em static fields.`
            );
        }
        if (!group) return field ? [field] : allFields;

        const groupFields = fieldGroupsByViewModel.get(this)?.get(group);
        if (!groupFields) {
            throw new Error(
                `O binding group '${group}' não foi registrado neste ViewModel.`
            );
        }
        if (field && !groupFields.has(field)) {
            throw new Error(
                `O campo '${field}' não pertence ao binding group '${group}'.`
            );
        }
        return field ? [field] : [...groupFields.keys()];
    }

    clearErrors(fieldName = "", groupName = "") {
        for (const name of this.resolveFieldSelection(
            fieldName,
            groupName
        )) {
            this.errors[name] = [];
            this.markFieldUnvalidated(name);
        }
    }

    cancelPending(fieldName = "", groupName = "") {
        const fields = this.resolveFieldSelection(
            fieldName,
            groupName
        );
        for (const name of fields) {
            this.cancelValidation(name);
            this.cancelPropertyChange?.(name);
        }
        if (!String(fieldName ?? "").trim() &&
            !String(groupName ?? "").trim()) {
            this.cancelPropertyChange?.();
        }
    }

    reset(fieldName = "", groupName = "") {
        const initialValues = initialFieldValuesByViewModel.get(this);
        for (const name of this.resolveFieldSelection(
            fieldName,
            groupName
        )) {
            this.cancelValidation(name);
            this[name] = this.cloneFieldValue(initialValues.get(name));
            this.errors[name] = [];
            this.markFieldUnvalidated(name);
            this.fieldState[name].changed = false;
            this.fieldState[name].dirty = false;
        }
    }

    cloneFieldValue(value) {
        if (value == null || typeof value !== "object") return value;
        try {
            return structuredClone(value);
        } catch {
            if (Array.isArray(value)) {
                return value.map(item => this.cloneFieldValue(item));
            }
            if (Object.getPrototypeOf(value) === Object.prototype ||
                Object.getPrototypeOf(value) === null) {
                return Object.fromEntries(
                    Object.entries(value).map(([key, item]) => [
                        key,
                        this.cloneFieldValue(item)
                    ])
                );
            }
            return value;
        }
    }

    fieldValuesEqual(left, right) {
        if (Object.is(left, right)) return true;
        if (left == null || right == null ||
            typeof left !== "object" || typeof right !== "object") {
            return false;
        }
        if (left instanceof Date || right instanceof Date) {
            return left instanceof Date && right instanceof Date &&
                left.getTime() === right.getTime();
        }
        if (Array.isArray(left) || Array.isArray(right)) {
            return Array.isArray(left) && Array.isArray(right) &&
                left.length === right.length &&
                left.every((item, index) =>
                    this.fieldValuesEqual(item, right[index]));
        }
        const leftKeys = Object.keys(left);
        const rightKeys = Object.keys(right);
        return leftKeys.length === rightKeys.length &&
            leftKeys.every(key =>
                Object.prototype.hasOwnProperty.call(right, key) &&
                this.fieldValuesEqual(left[key], right[key]));
    }

    markFieldUnvalidated(name) {
        const state = this.fieldState[name];
        if (!state) return;
        state.validated = false;
        state.valid = null;
        state.error = "";
    }

    hasPropertyPath(path) {
        const parts = String(path).split(".").filter(Boolean);
        let current = this;
        for (const part of parts) {
            if (current == null || !(part in Object(current))) return false;
            current = current[part];
        }
        return true;
    }

    assertNoChangeCycles(fields) {
        const visiting = new Set();
        const visited = new Set();

        const visit = name => {
            if (visiting.has(name)) {
                throw new Error(
                    `Ciclo detectado nas dependências alsoChanges envolvendo '${name}'.`
                );
            }
            if (visited.has(name) || !fields[name]) return;

            visiting.add(name);
            for (const dependent of
                fields[name].changedDependencies ?? []) {
                visit(String(dependent).split(".")[0]);
            }
            visiting.delete(name);
            visited.add(name);
        };

        for (const name of Object.keys(fields)) visit(name);
    }

    validateField(name) {
        const descriptor = this.field(name);
        if (!descriptor) {
            throw new Error(`O campo '${name}' não foi declarado em static fields.`);
        }
        this.cancelValidation(name);
        const errors = descriptor.validate(this[name], this, name);
        this.errors[name] = errors;
        return errors.length === 0;
    }

    validate(...names) {
        const fields = names.length > 0
            ? names
            : Object.keys(this.constructor.fields ?? {});
        return fields.map(name => this.validateField(name)).every(Boolean);
    }

    async validateValueResultAsync(name, value, context = {}) {
        const descriptor = this.field(name);
        if (!descriptor) {
            throw new Error(`O campo '${name}' não foi declarado em static fields.`);
        }

        this.cancelValidation(name);
        const controller = new AbortController();
        const controllers = validationControllersByViewModel.get(this) ?? new Map();
        validationControllersByViewModel.set(this, controllers);
        controllers.set(name, controller);
        this.fieldState[name].pending = true;

        try {
            const errors = await descriptor.validateAsync(
                value,
                this,
                name,
                { ...context, signal: controller.signal }
            );
            if (controllers.get(name) !== controller) {
                return Object.freeze({
                    status: "cancelled",
                    valid: false,
                    errors: Object.freeze([])
                });
            }
            this.errors[name] = errors;
            return Object.freeze({
                status: errors.length === 0 ? "valid" : "invalid",
                valid: errors.length === 0,
                errors: Object.freeze([...errors])
            });
        } catch (error) {
            if (error?.name === "AbortError") {
                return Object.freeze({
                    status: "cancelled",
                    valid: false,
                    errors: Object.freeze([])
                });
            }
            throw error;
        } finally {
            if (controllers.get(name) === controller) {
                controllers.delete(name);
                this.fieldState[name].pending = false;
            }
        }
    }

    async validateValueAsync(name, value, context = {}) {
        const result = await this.validateValueResultAsync(
            name,
            value,
            context
        );
        return result.valid;
    }

    async validateFieldAsync(name) {
        return this.validateValueAsync(name, this[name]);
    }

    async validateAsync(...names) {
        const fields = names.length > 0
            ? names
            : Object.keys(this.constructor.fields ?? {});
        const results = await Promise.all(
            fields.map(name => this.validateFieldAsync(name))
        );
        return results.every(Boolean);
    }

    cancelValidation(name) {
        const controllers = validationControllersByViewModel.get(this);
        const controller = controllers?.get(name);
        if (!controller) return;
        controller.abort();
        controllers.delete(name);
        if (this.fieldState[name]) {
            this.fieldState[name].pending = false;
        }
    }

    async initialize() {}
    onError(error, context) {
        const detailed =
            errorConfigurationByViewModel.get(this)?.detailedErrors !== false;
        if (detailed) {
            console.error(
                `[BindifyJS/${context?.phase ?? "viewmodel"}/${context?.property ?? "unknown"}]`,
                error
            );
        } else {
            console.error(
                `[BindifyJS/${context?.phase ?? "viewmodel"}] Ocorreu um erro inesperado.`
            );
        }
        return false;
    }
    dispose() {}
}
