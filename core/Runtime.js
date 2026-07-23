import { ViewModel } from "./ViewModel.js";

export class Runtime {
    #binder;
    #eventBinder;
    #templateBinder;
    #validationBinder;
    #itemsBinder;
    #bindingGroupBinder;
    #elementRefBinder;
    #commandBinder;
    #classBinder;
    #cssVarBinder;
    #observable;
    #componentLoader = null;
    #application;
    #sessions = new WeakMap();
    #starts = new WeakMap();
    constructor({ binder, eventBinder, templateBinder, validationBinder, itemsBinder, bindingGroupBinder, elementRefBinder = { bindElement() {}, unbindElement() {} }, commandBinder = { bindElement() {} }, classBinder = { bindElement() {} }, cssVarBinder = { bindElement() {} }, observable, application = null }) { this.#binder = binder; this.#eventBinder = eventBinder; this.#templateBinder = templateBinder; this.#validationBinder = validationBinder; this.#itemsBinder = itemsBinder; this.#bindingGroupBinder = bindingGroupBinder; this.#elementRefBinder = elementRefBinder; this.#commandBinder = commandBinder; this.#classBinder = classBinder; this.#cssVarBinder = cssVarBinder; this.#observable = observable; this.#application = application; }
    setComponentLoader(componentLoader) { this.#componentLoader = componentLoader; }
    get configuration() {
        return this.#application?.configuration ?? {
            development: true,
            exposeViewModel: true,
            detailedErrors: true
        };
    }
    prepareViewModel(viewModel) {
        viewModel.configureErrorBoundary?.({
            detailedErrors: this.configuration.detailedErrors,
            reporter: (error, context) =>
                this.#application?.reportError(error, context) ?? false
        });
    }

    bindDocument(viewModel, root = document) {
        this.#templateBinder.bindTree(root, viewModel);
        const bind = element => {
            if (element.hasAttribute("data-element-ref")) this.#elementRefBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-binding-group")) this.#bindingGroupBinder.bindElement(element);
            if (element.hasAttribute("data-bind-items")) this.#itemsBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-bind")) this.#binder.bindElement(element, viewModel);
            if (element.hasAttribute("data-event")) this.#eventBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-command")) this.#commandBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-class")) this.#classBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-css-var")) this.#cssVarBinder.bindElement(element, viewModel);
            if (element.hasAttribute("data-validation-for")) this.#validationBinder.bindElement(element, viewModel);
        };
        if (root instanceof Element && root.matches("[data-element-ref], [data-binding-group], [data-bind], [data-bind-items], [data-event], [data-command], [data-class], [data-css-var], [data-validation-for]")) bind(root);
        for (const element of root.querySelectorAll("[data-element-ref], [data-binding-group], [data-bind], [data-bind-items], [data-event], [data-command], [data-class], [data-css-var], [data-validation-for]")) bind(element);
    }

    unbindDocument(root = document) {
        this.#templateBinder.unbindTree(root);

        if (
            root instanceof Element &&
            root.matches("[data-element-ref], [data-binding-group], [data-bind], [data-bind-items], [data-event], [data-command], [data-class], [data-css-var], [data-validation-for]")
        ) {
            this.#elementRefBinder.unbindElement(root);
            this.#binder.unbindElement(root);
        }

        for (const element of root.querySelectorAll?.(
            "[data-element-ref], [data-binding-group], [data-bind], [data-bind-items], [data-event], [data-command], [data-class], [data-css-var], [data-validation-for]"
        ) ?? []) {
            this.#elementRefBinder.unbindElement(element);
            this.#binder.unbindElement(element);
        }
    }

    observeBindings(viewModel, root = document.body) {
        if (!root) throw new Error("Não há raiz disponível para observar bindings.");
        const observer = new MutationObserver(records => {
            for (const record of records) {
                if (record.type === "attributes") {
                    const element = record.target;
                    const kind = record.attributeName === "data-bind"
                        ? "binding"
                        : record.attributeName === "data-element-ref"
                            ? "element-ref"
                        : record.attributeName === "data-binding-group"
                            ? "binding-group"
                        : record.attributeName === "data-bind-items"
                            ? "items"
                        : record.attributeName === "data-event"
                            ? "event"
                        : record.attributeName === "data-class"
                            ? "class"
                        : record.attributeName === "data-css-var"
                            ? "css-var"
                        : record.attributeName === "data-command" ||
                            record.attributeName === "data-command-event" ||
                            record.attributeName === "data-command-parameter"
                            ? "command"
                            : "validation";
                    const bindingPresent = kind === "command"
                        ? element.hasAttribute("data-command")
                        : element.hasAttribute(record.attributeName);
                    if (bindingPresent) {
                        if (kind === "element-ref") this.#elementRefBinder.bindElement(element, viewModel);
                        else if (kind === "binding") this.#binder.bindElement(element, viewModel);
                        else if (kind === "binding-group") this.#bindingGroupBinder.bindElement(element);
                        else if (kind === "items") this.#itemsBinder.bindElement(element, viewModel);
                        else if (kind === "event") this.#eventBinder.bindElement(element, viewModel);
                        else if (kind === "command") this.#commandBinder.bindElement(element, viewModel);
                        else if (kind === "class") this.#classBinder.bindElement(element, viewModel);
                        else if (kind === "css-var") this.#cssVarBinder.bindElement(element, viewModel);
                        else this.#validationBinder.bindElement(element, viewModel);
                    } else if (kind === "element-ref") {
                        this.#elementRefBinder.unbindElement(element);
                    } else this.#binder.unbindElement(element, kind);
                    continue;
                }
                for (const node of record.removedNodes) {
                    if (!(node instanceof Element)) continue;
                    this.#templateBinder.unbindTree(node);
                    this.#elementRefBinder.unbindElement(node);
                    this.#binder.unbindElement(node);
                    for (const element of node.querySelectorAll("[data-element-ref], [data-binding-group], [data-bind], [data-bind-items], [data-event], [data-command], [data-class], [data-css-var], [data-validation-for]")) {
                        this.#elementRefBinder.unbindElement(element);
                        this.#binder.unbindElement(element);
                    }
                }
                for (const node of record.addedNodes) if (node instanceof Element) this.bindDocument(viewModel, node);
            }
        });
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-element-ref", "data-binding-group", "data-bind", "data-bind-items", "data-event", "data-command", "data-command-event", "data-command-parameter", "data-class", "data-css-var", "data-validation-for"] });
        return observer;
    }

    async start(root = document) {
        const existing = this.#sessions.get(root);
        if (existing) return existing.viewModel;
        const pending = this.#starts.get(root);
        if (pending) return pending;

        const startPromise = this.startCore(root);
        this.#starts.set(root, startPromise);
        try {
            return await startPromise;
        } finally {
            if (this.#starts.get(root) === startPromise) {
                this.#starts.delete(root);
            }
        }
    }

    async startCore(root) {
        let host = null;
        let viewModel = null;
        let observer = null;
        let bound = false;

        try {
            await this.#application?.run("beforeStart", {
                root,
                runtime: this,
                configuration: this.configuration
            });
            await this.#componentLoader?.loadAll(root);
            host = root.documentElement ?? root.host ?? root;
            const viewModelName = host.getAttribute?.("viewmodel");
            if (!viewModelName) {
                throw new Error(
                    'A tag <html> precisa declarar viewmodel="NomeDaClasse".'
                );
            }
            const ViewModelType = globalThis[viewModelName];
            if (typeof ViewModelType !== "function") {
                throw new Error(
                    `O ViewModel '${viewModelName}' não foi encontrado em globalThis.`
                );
            }
            if (!(ViewModelType.prototype instanceof ViewModel)) {
                throw new TypeError(
                    `${viewModelName} precisa herdar de BindifyJS.ViewModel.`
                );
            }

            viewModel = this.#observable.create(new ViewModelType());
            this.prepareViewModel(viewModel);
            viewModel.assertFields();
            bound = true;
            this.bindDocument(viewModel, root);
            observer = this.observeBindings(
                viewModel,
                root.body ?? root
            );
            if (this.configuration.exposeViewModel) {
                host.viewModel = viewModel;
            }
            host.bindifyObserver = observer;
            this.#sessions.set(root, {
                host,
                viewModel,
                observer
            });

            await viewModel.initialize();
            if (this.#sessions.get(root)?.viewModel === viewModel) {
                viewModel.acceptChanges();
            }
            await this.#application?.run("afterStart", {
                root,
                runtime: this,
                viewModel,
                configuration: this.configuration
            });
            return viewModel;
        } catch (error) {
            if (viewModel) {
                await viewModel.handleError(error, {
                    phase: "start",
                    root
                });
            } else {
                await this.#application?.reportError(error, {
                    phase: "start",
                    root,
                    runtime: this
                });
            }
            this.#sessions.delete(root);
            observer?.disconnect();
            if (bound) {
                try {
                    this.unbindDocument(root);
                } catch (cleanupError) {
                    await viewModel?.handleError?.(cleanupError, {
                        phase: "unbind",
                        root
                    });
                }
            }
            viewModel?.cancelPending();
            if (viewModel) {
                try {
                    await viewModel.dispose();
                } catch (disposeError) {
                    await viewModel.handleError(disposeError, {
                        phase: "dispose",
                        root
                    });
                } finally {
                    await viewModel.releaseResources();
                }
            }
            if (host?.viewModel === viewModel) delete host.viewModel;
            if (host?.bindifyObserver === observer) delete host.bindifyObserver;
            throw error;
        }
    }

    async stop(root = document) {
        const session = this.#sessions.get(root);
        if (!session) return false;

        try {
            await this.#application?.run("beforeStop", {
                root,
                runtime: this,
                viewModel: session.viewModel,
                configuration: this.configuration
            });
        } catch (error) {
            await session.viewModel.handleError(error, {
                phase: "plugin-before-stop",
                root
            });
        }
        this.#sessions.delete(root);
        session.observer.disconnect();
        try {
            this.unbindDocument(root);
        } catch (error) {
            await session.viewModel.handleError(error, {
                phase: "unbind",
                root
            });
        }
        session.viewModel.cancelPending();
        try {
            await session.viewModel.dispose();
        } catch (error) {
            await session.viewModel.handleError(error, {
                phase: "dispose",
                root
            });
        } finally {
            await session.viewModel.releaseResources();
            if (session.host.viewModel === session.viewModel) {
                delete session.host.viewModel;
            }
            if (session.host.bindifyObserver === session.observer) {
                delete session.host.bindifyObserver;
            }
        }
        try {
            await this.#application?.run("afterStop", {
                root,
                runtime: this,
                viewModel: session.viewModel,
                configuration: this.configuration
            });
        } catch (error) {
            await session.viewModel.handleError(error, {
                phase: "plugin-after-stop",
                root
            });
        }
        return true;
    }
}
