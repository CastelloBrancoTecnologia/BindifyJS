import { Path } from "./Path.js";

const observableMarker = Symbol("mvvm.observable");

export class Observable {
    create(target) {
        if (target == null || typeof target !== "object") {
            throw new TypeError("O ViewModel precisa ser um objeto.");
        }
        if (target[observableMarker]) return target;

        const subscriptions = new Map();
        const proxyMetadata = new WeakMap();
        const changeControllers = new Map();
        let updateDepth = 0;
        const pendingChanges = new Set();

        const lifecycleMethod = (property, suffix) =>
            `on${property.charAt(0).toUpperCase()}${property.slice(1)}${suffix}`;

        const cancelChanged = property => {
            const controller = changeControllers.get(property);
            if (!controller) return;
            controller.abort();
            changeControllers.delete(property);
        };

        const runChanging = (property, newValue, oldValue) => {
            const methodName = lifecycleMethod(property, "Changing");
            const method = target[methodName];
            if (typeof method !== "function") return newValue;

            const context = Object.freeze({
                property,
                phase: "changing",
                viewModel: target
            });
            const result = method.call(
                target,
                newValue,
                oldValue,
                context
            );
            if (
                result != null &&
                typeof result.then === "function"
            ) {
                Promise.resolve(result).catch(() => {});
                throw new TypeError(
                    `${methodName} precisa ser síncrono.`
                );
            }
            if (result === target.constructor?.cancelChange) {
                return target.constructor.cancelChange;
            }
            return result === undefined ? newValue : result;
        };

        const runChanged = (property, newValue, oldValue) => {
            const methodName = lifecycleMethod(property, "Changed");
            const method = target[methodName];
            if (typeof method !== "function") return;

            cancelChanged(property);
            const controller = new AbortController();
            changeControllers.set(property, controller);
            const context = Object.freeze({
                property,
                phase: "changed",
                signal: controller.signal,
                viewModel: target
            });

            let result;
            try {
                result = method.call(
                    target,
                    newValue,
                    oldValue,
                    context
                );
            } catch (error) {
                this.reportChangeError(target, error, context);
                changeControllers.delete(property);
                return;
            }

            Promise.resolve(result).catch(error => {
                if (!controller.signal.aborted) {
                    this.reportChangeError(target, error, context);
                }
            }).finally(() => {
                if (changeControllers.get(property) === controller) {
                    changeControllers.delete(property);
                }
            });
        };

        const changedPaths = initialPath => {
            const paths = new Set([initialPath]);
            const queue = [initialPath];
            const fields = target.constructor?.fields ?? {};

            while (queue.length > 0) {
                const current = queue.shift();
                const root = String(current).split(".")[0];
                const descriptor = fields[root];

                for (const dependent of
                    descriptor?.changedDependencies ?? []) {
                    if (paths.has(dependent)) continue;
                    paths.add(dependent);
                    queue.push(dependent);
                }
            }

            return paths;
        };

        const publish = changes => {
            const notifiedPaths = new Set();
            for (const changedPath of changes) {
                for (const notifiedPath of changedPaths(changedPath)) {
                    notifiedPaths.add(notifiedPath);
                }
            }

            for (const [subscribedPath, callbacks] of subscriptions) {
                const relevantPaths = [...notifiedPaths].filter(
                    notifiedPath =>
                        subscribedPath === notifiedPath ||
                        subscribedPath.startsWith(`${notifiedPath}.`) ||
                        notifiedPath.startsWith(`${subscribedPath}.`)
                );
                if (relevantPaths.length === 0) continue;

                const value = Path.get(target, subscribedPath);
                const notifiedPath =
                    relevantPaths[relevantPaths.length - 1];
                for (const callback of [...callbacks]) {
                    callback(value, notifiedPath);
                }
            }
        };

        const notify = changedPath => {
            if (updateDepth > 0) {
                pendingChanges.add(changedPath);
                return;
            }
            publish([changedPath]);
        };

        const flushChanges = () => {
            if (updateDepth > 0 || pendingChanges.size === 0) return;
            const changes = [...pendingChanges];
            pendingChanges.clear();
            publish(changes);
        };

        const isObservableContainer = value => {
            if (Array.isArray(value)) return true;
            if (value == null || typeof value !== "object") return false;
            const prototype = Object.getPrototypeOf(value);
            return prototype === Object.prototype || prototype === null;
        };

        const wrap = (object, paths) => {
            if (!isObservableContainer(object)) return object;

            const existing = proxyMetadata.get(object);
            if (existing) {
                for (const path of paths) existing.paths.add(path);
                return existing.proxy;
            }

            const metadata = {
                paths: new Set(paths),
                proxy: null
            };
            const proxy = new Proxy(object, {
                get(current, property, receiver) {
                    const value = Reflect.get(current, property, receiver);
                    if (typeof property === "symbol") return value;
                    const childPaths = [...metadata.paths].map(path =>
                        path ? `${path}.${String(property)}` : String(property)
                    );
                    return wrap(value, childPaths);
                },
                set(current, property, value, receiver) {
                    const oldValue = Reflect.get(current, property, receiver);
                    if (Object.is(oldValue, value)) return true;
                    const success = Reflect.set(
                        current,
                        property,
                        value,
                        receiver
                    );
                    if (success && typeof property !== "symbol") {
                        for (const path of metadata.paths) {
                            notify(path
                                ? `${path}.${String(property)}`
                                : String(property));
                        }
                    }
                    return success;
                },
                deleteProperty(current, property) {
                    const existed = Reflect.has(current, property);
                    const success = Reflect.deleteProperty(current, property);
                    if (
                        success &&
                        existed &&
                        typeof property !== "symbol"
                    ) {
                        for (const path of metadata.paths) {
                            notify(path
                                ? `${path}.${String(property)}`
                                : String(property));
                        }
                    }
                    return success;
                }
            });
            metadata.proxy = proxy;
            proxyMetadata.set(object, metadata);
            proxyMetadata.set(proxy, metadata);
            for (const property of Object.keys(object)) {
                wrap(
                    object[property],
                    [...metadata.paths].map(path =>
                        path
                            ? `${path}.${property}`
                            : String(property))
                );
            }
            return proxy;
        };

        const values = new Map();
        for (const property of Object.keys(target)) {
            const descriptor = Object.getOwnPropertyDescriptor(
                target,
                property
            );
            if (
                !descriptor ||
                !("value" in descriptor) ||
                descriptor.configurable === false
            ) {
                continue;
            }

            values.set(property, wrap(descriptor.value, [property]));
            Object.defineProperty(target, property, {
                configurable: descriptor.configurable,
                enumerable: descriptor.enumerable,
                get() {
                    return values.get(property);
                },
                set(value) {
                    const oldValue = values.get(property);
                    const candidate = runChanging(
                        property,
                        value,
                        oldValue
                    );
                    if (candidate === target.constructor?.cancelChange) {
                        return;
                    }
                    const wrapped = wrap(candidate, [property]);
                    if (Object.is(oldValue, wrapped)) return;
                    values.set(property, wrapped);
                    notify(property);
                    runChanged(property, wrapped, oldValue);
                }
            });
        }

        Object.defineProperty(target, observableMarker, {
            configurable: false,
            enumerable: false,
            value: true
        });
        Object.defineProperty(target, "subscribe", {
            enumerable: false,
            configurable: false,
            value(path, callback) {
                Path.parts(path);
                if (typeof callback !== "function") {
                    throw new TypeError("O callback precisa ser uma função.");
                }
                let callbacks = subscriptions.get(path);
                if (!callbacks) {
                    callbacks = new Set();
                    subscriptions.set(path, callbacks);
                }
                callbacks.add(callback);
                return () => {
                    callbacks.delete(callback);
                    if (callbacks.size === 0) subscriptions.delete(path);
                };
            }
        });
        Object.defineProperty(target, "cancelPropertyChange", {
            enumerable: false,
            configurable: false,
            value(property = "") {
                const name = String(property ?? "").trim();
                if (name) cancelChanged(name);
                else {
                    for (const current of [...changeControllers.keys()]) {
                        cancelChanged(current);
                    }
                }
            }
        });
        Object.defineProperty(target, "runUpdate", {
            enumerable: false,
            configurable: false,
            value(callback) {
                if (typeof callback !== "function") {
                    throw new TypeError(
                        "update exige uma função."
                    );
                }
                if (
                    callback.constructor?.name === "AsyncFunction"
                ) {
                    throw new TypeError(
                        "update precisa ser síncrono."
                    );
                }

                updateDepth++;
                try {
                    const result = callback.call(target);
                    if (
                        result != null &&
                        typeof result.then === "function"
                    ) {
                        Promise.resolve(result).catch(() => {});
                        throw new TypeError(
                            "update precisa ser síncrono."
                        );
                    }
                    return result;
                } finally {
                    updateDepth--;
                    flushChanges();
                }
            }
        });
        return target;
    }

    reportChangeError(target, error, context) {
        if (typeof target.handleError === "function") {
            Promise.resolve(target.handleError(error, context)).catch(
                handlerError => {
                    console.error("[BindifyJS/error-boundary]", handlerError);
                }
            );
            return;
        }
        console.error(
            `[BindifyJS/change/${context.property}/${context.phase}]`,
            error
        );
    }
}
