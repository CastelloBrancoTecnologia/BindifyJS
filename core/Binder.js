import { Path } from "./Path.js";

export class Binder {
    #parser;
    #states = new WeakMap();
    #bindingGroupBinder = null;
    #converters;

    constructor(parser, converters = null) {
        this.#parser = parser;
        this.#converters = converters;
    }
    setBindingGroupBinder(bindingGroupBinder) {
        this.#bindingGroupBinder = bindingGroupBinder;
    }

    bindElement(element, viewModel) {
        this.unbindElement(element, "binding");
        const cleanup = [];

        for (const binding of this.#parser.parseBindings(
            element.dataset.bind
        )) {
            const mode =
                binding.mode ?? this.getDefaultMode(binding.target);
            if (!Path.has(element, binding.target)) throw new Error(`Target '${binding.target}' não existe em <${element.localName}>.`);
            if (!Path.has(viewModel, binding.source)) throw new Error(`Source '${binding.source}' não existe no ViewModel.`);
            const field = viewModel.field?.(binding.source);
            const sourceValue = Path.get(viewModel, binding.source);
            const booleanTarget =
                typeof Path.get(element, binding.target) === "boolean";
            const readsSource = ["oneway", "twoway", "onetime"].includes(mode);
            const writesSource = ["twoway", "onewaytosource"].includes(mode);
            const when = binding.when ?? "contentchanged";
            const converter = binding.converter
                ? this.#converters?.get(binding.converter)
                : null;

            if (binding.when && !writesSource) {
                throw new Error(
                    `when só pode ser usado em binding twoway ou onewaytosource.`
                );
            }

            if (typeof sourceValue === "function" && mode !== "oneway" && mode !== "onetime") {
                throw new Error(
                    `O método source '${binding.source}' só pode ser usado em binding oneway ou onetime.`
                );
            }
            if (writesSource && !this.isWritablePath(viewModel, binding.source)) {
                throw new Error(
                    `Source '${binding.source}' precisa ser uma propriedade gravável no modo ${mode}.`
                );
            }
            if (binding.converter && !converter) {
                throw new Error(
                    `ConverterRegistry não foi configurado para '${binding.converter}'.`
                );
            }
            if (writesSource && converter && !converter.convertBack) {
                throw new Error(
                    `O converter '${binding.converter}' precisa implementar convertBack no modo ${mode}.`
                );
            }
            const writeTarget = () => {
                let value = this.readSourceValue(
                    viewModel,
                    binding.source
                );
                if (converter) {
                    value = converter.convert(value, Object.freeze({
                        direction: "target",
                        parameter: binding.converterParameter,
                        source: binding.source,
                        target: binding.target,
                        element,
                        viewModel,
                        field
                    }));
                    if (
                        value != null &&
                        typeof value.then === "function"
                    ) {
                        Promise.resolve(value).catch(() => {});
                        throw new TypeError(
                            `O converter '${binding.converter}' precisa ser síncrono.`
                        );
                    }
                }
                const normalized = this.normalizeTargetValue(
                    binding.target,
                    value,
                    field,
                    booleanTarget
                );
                const formatted =
                    field?.hasMask && binding.target === "value"
                        ? field.format(normalized)
                        : normalized;
                if (!Object.is(Path.get(element, binding.target), formatted)) Path.set(element, binding.target, formatted);
            };

            if (readsSource) writeTarget(sourceValue);
            if (["oneway", "twoway"].includes(mode)) cleanup.push(viewModel.subscribe(binding.source, writeTarget));

            if (["twoway", "onewaytosource"].includes(mode)) {
                const readTarget = () => {
                    let value = this.readElementValue(element, binding.target);
                    if (converter) {
                        value = converter.convertBack(
                            value,
                            Object.freeze({
                                direction: "source",
                                parameter: binding.converterParameter,
                                source: binding.source,
                                target: binding.target,
                                element,
                                viewModel,
                                field
                            })
                        );
                        if (
                            value != null &&
                            typeof value.then === "function"
                        ) {
                            Promise.resolve(value).catch(() => {});
                            throw new TypeError(
                                `O converter '${binding.converter}' precisa ser síncrono.`
                            );
                        }
                    }
                    if (booleanTarget && field) {
                        if (value && field.hasTrueValue) {
                            value = field.mappedTrueValue;
                        } else if (!value && field.hasFalseValue) {
                            value = field.mappedFalseValue;
                        }
                    }
                    if (field) value = field.normalize(value);
                    if (
                        field?.hasMask &&
                        binding.target === "value" &&
                        !Object.is(element.value, value)
                    ) element.value = value;
                    return value;
                };

                const validateCandidate = async (value, context = {}) => {
                    if (!field) {
                        return {
                            status: "valid",
                            valid: true,
                            errors: []
                        };
                    }
                    return viewModel.validateValueResultAsync(
                        binding.source,
                        value,
                        context
                    );
                };

                const listener = async () => {
                    const value = readTarget();
                    if (!Object.is(Path.get(viewModel, binding.source), value)) {
                        Path.set(viewModel, binding.source, value);
                    }
                    const validation = await validateCandidate(value);
                    return {
                        source: binding.source,
                        value,
                        status: validation.status,
                        valid: validation.valid,
                        errors: [...validation.errors]
                    };
                };

                if (when === "groupcommit") {
                    if (!this.#bindingGroupBinder) {
                        throw new Error("BindingGroupBinder não foi configurado.");
                    }
                    cleanup.push(this.#bindingGroupBinder.register(
                        element,
                        binding.source,
                        async context => {
                            const value = readTarget();
                            const prepare = validation => ({
                                source: binding.source,
                                value,
                                status: validation.status,
                                valid: validation.valid,
                                errors: [...validation.errors],
                                apply: () => {
                                    if (!Object.is(
                                        Path.get(viewModel, binding.source),
                                        value
                                    )) {
                                        Path.set(
                                            viewModel,
                                            binding.source,
                                            value
                                        );
                                    }
                                }
                            });
                            if (context?.phase === "prepare") {
                                return {
                                    source: binding.source,
                                    value,
                                    validate: async validationContext =>
                                        prepare(await validateCandidate(
                                            value,
                                            validationContext
                                        ))
                                };
                            }
                            return prepare(await validateCandidate(
                                value,
                                context
                            ));
                        },
                        () => {
                            writeTarget();
                            if (field) {
                                viewModel.cancelValidation(binding.source);
                                viewModel.clearErrors(binding.source);
                            }
                        },
                        viewModel
                    ));
                } else {
                    const eventNames = when === "lostfocus"
                        ? ["blur"]
                        : this.getChangeEvents(element, binding.target);
                    for (const eventName of eventNames) {
                        const eventListener = event => {
                            if (
                                eventName === "bindify-property-change" &&
                                event.detail?.property !== binding.target
                            ) {
                                return;
                            }
                            listener().catch(error => {
                                this.reportError(viewModel, error, {
                                    phase: "validation",
                                    property: binding.source,
                                    element
                                });
                            });
                        };
                        element.addEventListener(eventName, eventListener);
                        cleanup.push(() =>
                            element.removeEventListener(eventName, eventListener));
                    }
                }

                if (
                    mode === "onewaytosource" &&
                    when === "contentchanged"
                ) listener().catch(error => {
                    this.reportError(viewModel, error, {
                        phase: "validation",
                        property: binding.source,
                        element
                    });
                });
            }
        }

        this.storeCleanup(element, "binding", cleanup);
    }

    reportError(viewModel, error, context) {
        if (typeof viewModel?.handleError === "function") {
            Promise.resolve(
                viewModel.handleError(error, context)
            ).catch(boundaryError => {
                console.error(
                    "[BindifyJS/error-boundary]",
                    boundaryError
                );
            });
            return;
        }
        console.error(
            `[BindifyJS/${context.phase}/${context.property ?? "unknown"}]`,
            error
        );
    }

    getDefaultMode(target) { return ["value", "checked", "selectedIndex"].includes(target) ? "twoway" : "oneway"; }
    readSourceValue(viewModel, source) {
        const value = Path.get(viewModel, source);
        return typeof value === "function"
            ? value.call(viewModel)
            : value;
    }
    getPropertyDescriptor(root, path) {
        const parts = Path.parts(path);
        const property = parts.pop();
        let owner = root;
        for (const part of parts) {
            if (owner == null) return null;
            owner = owner[part];
        }
        if (owner == null) return null;

        let current = owner;
        while (current) {
            const descriptor = Object.getOwnPropertyDescriptor(current, property);
            if (descriptor) return descriptor;
            current = Object.getPrototypeOf(current);
        }
        return null;
    }
    isWritablePath(root, path) {
        const descriptor = this.getPropertyDescriptor(root, path);
        if (!descriptor) return false;
        if ("value" in descriptor) return descriptor.writable !== false;
        return typeof descriptor.set === "function";
    }
    getChangeEvents(element, target) {
        if (element?.viewModel && target in element) {
            return ["bindify-property-change"];
        }
        if (
            target === "value" &&
            (element instanceof HTMLInputElement ||
                element instanceof HTMLTextAreaElement)
        ) {
            return ["input", "change"];
        }

        return ["change"];
    }
    readElementValue(element, target) {
        if (target === "value" && element instanceof HTMLInputElement && element.type === "number") return element.value === "" ? null : element.valueAsNumber;
        return Path.get(element, target);
    }
    normalizeTargetValue(
        target,
        value,
        field = null,
        booleanTarget = false
    ) {
        if (target === "value" && value == null) return "";
        if (booleanTarget) {
            if (field?.hasTrueValue) {
                return Object.is(value, field.mappedTrueValue);
            }
            if (field?.hasFalseValue) {
                return !Object.is(value, field.mappedFalseValue);
            }
            return Boolean(value);
        }
        return value;
    }
    storeCleanup(element, kind, callbacks) {
        const state = this.#states.get(element) ?? Object.create(null);
        state[kind] = callbacks;
        this.#states.set(element, state);
    }
    unbindElement(element, kind = null) {
        const state = this.#states.get(element);
        if (!state) return;
        for (const currentKind of kind ? [kind] : Object.keys(state)) {
            for (const cleanup of state[currentKind] ?? []) cleanup();
            delete state[currentKind];
        }
        if (Object.keys(state).length === 0) this.#states.delete(element);
    }
}
