import { Component } from "./Component.js";

export class ComponentLoader {
    #runtimeProvider;
    #observable;
    #loadingNames = new Map();

    constructor(runtimeProvider, observable) {
        this.#runtimeProvider = runtimeProvider;
        this.#observable = observable;
    }

    async loadAll(root = document) {
        const links = [...root.querySelectorAll('link[rel="component"][href]')];
        await Promise.all(links.map(link => this.load(link)));
    }

    async load(link) {
        const response = await fetch(link.href);
        if (!response.ok) {
            throw new Error(`Falha ao carregar componente: ${link.href}`);
        }

        const text = await response.text();
        const componentDocument = new DOMParser().parseFromString(text, "text/html");
        const template = componentDocument.querySelector("template");

        if (!template) {
            throw new Error(`O componente '${link.href}' não possui <template>.`);
        }

        const name =
            link.getAttribute("name") ||
            template.getAttribute("data-component") ||
            new URL(link.href).pathname.split("/").pop().replace(/\.html$/i, "");

        if (!name.includes("-")) {
            throw new Error(`O nome '${name}' precisa conter hífen.`);
        }

        while (this.#loadingNames.has(name)) {
            await this.#loadingNames.get(name);
        }
        if (customElements.get(name)) return;

        let releaseName;
        const nameLock = new Promise(resolve => {
            releaseName = resolve;
        });
        this.#loadingNames.set(name, nameLock);

        try {
            if (customElements.get(name)) return;

            const inlineStyles = [...componentDocument.querySelectorAll("style")]
            .map(style => style.textContent)
            .join("\n");

        const externalStyles = await Promise.all(
            [...componentDocument.querySelectorAll(
                'link[rel="stylesheet"][href]'
            )].map(async styleLink => {
                const styleUrl = new URL(
                    styleLink.getAttribute("href"),
                    link.href
                );
                const styleResponse = await fetch(styleUrl);

                if (!styleResponse.ok) {
                    throw new Error(
                        `Falha ao carregar o CSS do componente: ${styleUrl}`
                    );
                }

                return styleResponse.text();
            })
        );

        const styles = [inlineStyles, ...externalStyles]
            .filter(Boolean)
            .join("\n");

        const scriptPath = link.getAttribute("script");
        const scriptUrl = scriptPath
            ? new URL(scriptPath, link.ownerDocument?.baseURI ?? document.baseURI)
            : null;
        const module = scriptUrl
            ? await import(scriptUrl.href)
            : null;

        const ComponentType = module?.default ?? Component;

        if (
            !(ComponentType.prototype instanceof Component) &&
            ComponentType !== Component
        ) {
            throw new TypeError(
                `${name}: a classe precisa herdar de BindifyJS.Component.`
            );
        }

        const publicProperties = Array.isArray(ComponentType.properties)
            ? [...new Set(ComponentType.properties)]
            : [];

        const propertyConfigurations = new Map();
        const attributeProperties = new Map();
        for (const property of publicProperties) {
            const field = ComponentType.fields?.[property] ?? null;
            const useAttribute = field?.usesAttribute ?? true;
            const useReflection = field?.usesReflection ?? useAttribute;
            const attribute = field?.configuredAttributeName ?? property.replace(
                /([a-z0-9])([A-Z])/g,
                "$1-$2"
            ).toLowerCase();

            if (useReflection && !useAttribute) {
                throw new Error(
                    `${name}: '${property}' não pode refletir sem usar atributo.`
                );
            }
            if (useAttribute && attributeProperties.has(attribute)) {
                throw new Error(
                    `${name}: mais de uma propriedade pública usa o atributo '${attribute}'.`
                );
            }

            propertyConfigurations.set(property, {
                attribute,
                field,
                useAttribute,
                useReflection
            });
            if (useAttribute) attributeProperties.set(attribute, property);
        }

        const publicMethods = Array.isArray(ComponentType.methods)
            ? [...new Set(ComponentType.methods)]
            : [];

        const observable = this.#observable;
        const runtimeProvider = this.#runtimeProvider;

        class DeclarativeElement extends HTMLElement {
            static get observedAttributes() {
                return [...attributeProperties.keys()];
            }

            connectedCallback() {
                if (this.__mvvmConnected) {
                    return;
                }

                this.__mvvmConnected = true;

                if (!this.__mvvmViewModel) {
                    const shadow = this.attachShadow({ mode: "open" });

                    if (styles) {
                        const style = document.createElement("style");
                        style.textContent = styles;
                        shadow.append(style);
                    }

                    shadow.append(template.content.cloneNode(true));

                    const raw = new ComponentType();
                    raw.host = this;
                    raw.shadowRoot = shadow;
                    this.__mvvmViewModel = observable.create(raw);
                    runtimeProvider().prepareViewModel(
                        this.__mvvmViewModel
                    );
                    if (runtimeProvider().configuration.exposeViewModel) {
                        this.viewModel = this.__mvvmViewModel;
                    }
                    this.__mvvmViewModel.assertFields();
                    this.__mvvmPropertyDefaults = new Map();

                    for (const property of publicProperties) {
                        if (!(property in this.__mvvmViewModel)) {
                            throw new Error(
                                `${name}: a propriedade pública '${property}' não existe no componente.`
                            );
                        }

                        const configuration = propertyConfigurations.get(property);
                        this.__mvvmPropertyDefaults.set(
                            property,
                            this.__mvvmViewModel[property]
                        );
                        if (this.__mvvmPendingProperties?.has(property)) {
                            this.__mvvmViewModel[property] = this.normalizeProperty(
                                property,
                                this.__mvvmPendingProperties.get(property)
                            );
                        } else if (
                            configuration.useAttribute &&
                            this.hasAttribute(configuration.attribute)
                        ) {
                            this.__mvvmViewModel[property] = this.readAttribute(
                                property,
                                this.getAttribute(configuration.attribute)
                            );
                        } else if (
                            configuration.field?.hasValueIfEmpty &&
                            configuration.field.constructor.isEmpty(
                                this.__mvvmViewModel[property]
                            )
                        ) {
                            this.__mvvmViewModel[property] =
                                configuration.field.emptyValue;
                        }
                    }

                    this.__mvvmPendingProperties?.clear();

                    for (const method of publicMethods) {
                        if (typeof this.__mvvmViewModel[method] !== "function") {
                            throw new Error(
                                `${name}: o método público '${method}' não existe no componente.`
                            );
                        }
                    }
                }

                const runtime = runtimeProvider();
                try {
                    runtime.bindDocument(this.__mvvmViewModel, this.shadowRoot);
                    this.__bindifyObserver = runtime.observeBindings(
                        this.__mvvmViewModel,
                        this.shadowRoot
                    );
                    this.bindAttributeReflection();
                } catch (error) {
                    this.cleanupBindifyConnection();
                    throw error;
                }

                const connection = (this.__mvvmConnection ?? 0) + 1;
                this.__mvvmConnection = connection;
                this.__mvvmReady ??= Promise.resolve(
                    this.__mvvmViewModel.initialize()
                ).then(() => {
                    this.__mvvmViewModel.acceptChanges();
                });
                this.ready = this.__mvvmReady.then(() => {
                    if (
                        this.__mvvmConnected &&
                        this.__mvvmConnection === connection
                    ) {
                        return this.__mvvmViewModel.connected();
                    }
                }).catch(async error => {
                    this.cleanupBindifyConnection();
                    await this.__mvvmViewModel?.handleError?.(error, {
                        phase: "component-connect",
                        component: name,
                        host: this
                    });
                    await this.__mvvmViewModel?.releaseResources?.();
                    throw error;
                });
            }

            cleanupBindifyConnection() {
                this.__bindifyObserver?.disconnect();
                this.__bindifyObserver = null;
                runtimeProvider().unbindDocument(this.shadowRoot);
                for (const unsubscribe of this.__mvvmAttributeCleanup ?? []) {
                    unsubscribe();
                }
                this.__mvvmAttributeCleanup = [];
                this.__mvvmViewModel?.cancelPending?.();
                this.__mvvmConnected = false;
            }

            disconnectedCallback() {
                this.cleanupBindifyConnection();
                Promise.resolve(
                    this.__mvvmViewModel?.disconnected?.()
                ).catch(error => {
                    return this.__mvvmViewModel?.handleError?.(error, {
                        phase: "component-disconnect",
                        component: name,
                        host: this
                    });
                }).then(() => {
                    return this.__mvvmViewModel?.releaseResources?.();
                }).catch(error => {
                    console.error(
                        `[BindifyJS/component/${name}/cleanup]`,
                        error
                    );
                });
            }

            attributeChangedCallback(attribute, oldValue, newValue) {
                if (oldValue === newValue || this.__mvvmReflectingAttribute) {
                    return;
                }

                const property = attributeProperties.get(attribute);
                if (!property || !this.__mvvmViewModel) {
                    return;
                }

                const field = propertyConfigurations.get(property).field;
                const value = newValue == null
                    ? field?.type === "boolean"
                        ? false
                        : this.defaultPropertyValue(property)
                    : this.readAttribute(property, newValue);
                if (!Object.is(this.__mvvmViewModel[property], value)) {
                    this.__mvvmApplyingAttribute = true;
                    try {
                        this.__mvvmViewModel[property] = value;
                    } finally {
                        this.__mvvmApplyingAttribute = false;
                    }
                    this.notifyPropertyChange(property, value);
                }
            }

            bindAttributeReflection() {
                for (const unsubscribe of this.__mvvmAttributeCleanup ?? []) {
                    unsubscribe();
                }

                this.__mvvmAttributeCleanup = publicProperties.map(property => {
                    const configuration = propertyConfigurations.get(property);
                    const update = value => {
                        this.reflectProperty(property, value);
                        if (
                            !this.__mvvmSettingProperty &&
                            !this.__mvvmApplyingAttribute
                        ) {
                            this.notifyPropertyChange(property, value);
                        }
                    };
                    const unsubscribe = this.__mvvmViewModel.subscribe(property, update);
                    this.__mvvmSettingProperty = true;
                    try {
                        this.reflectProperty(
                            property,
                            this.__mvvmViewModel[property]
                        );
                    } finally {
                        this.__mvvmSettingProperty = false;
                    }
                    return unsubscribe;
                });
            }

            notifyPropertyChange(property, value) {
                if (!this.__mvvmConnected) return;
                this.dispatchEvent(new CustomEvent(
                    "bindify-property-change",
                    {
                        detail: Object.freeze({ property, value }),
                        bubbles: true,
                        composed: true
                    }
                ));
            }

            readAttribute(property, value) {
                const field = propertyConfigurations.get(property).field;
                if (!field) return value;

                if (field.type === "boolean") {
                    return value === "" || value.toLowerCase() === "true";
                }
                if (
                    field.hasValueIfEmpty &&
                    field.constructor.isEmpty(value)
                ) {
                    return field.emptyValue;
                }
                if (field.type === "array" || field.type === "object") {
                    try {
                        return JSON.parse(value);
                    } catch {
                        throw new TypeError(
                            `${name}: o atributo '${propertyConfigurations.get(property).attribute}' precisa conter JSON válido.`
                        );
                    }
                }
                return field.normalize(value);
            }

            defaultPropertyValue(property) {
                const field = propertyConfigurations.get(property).field;
                if (field?.hasValueIfEmpty) return field.emptyValue;
                return this.__mvvmPropertyDefaults?.get(property);
            }

            normalizeProperty(property, value) {
                const field = propertyConfigurations.get(property).field;
                return field ? field.normalize(value) : value;
            }

            reflectProperty(property, value) {
                const configuration = propertyConfigurations.get(property);
                if (!configuration.useReflection) return;
                const attribute = configuration.attribute;
                let serialized;
                if (value == null) serialized = null;
                else if (
                    configuration.field?.type === "boolean"
                ) {
                    serialized = value ? "" : null;
                }
                else if (typeof value === "object") serialized = JSON.stringify(value);
                else serialized = String(value);

                if (
                    serialized == null
                        ? !this.hasAttribute(attribute)
                        : this.getAttribute(attribute) === serialized
                ) return;

                this.__mvvmReflectingAttribute = true;
                try {
                    if (serialized == null) this.removeAttribute(attribute);
                    else this.setAttribute(attribute, serialized);
                } finally {
                    this.__mvvmReflectingAttribute = false;
                }
            }
        }

        for (const property of publicProperties) {
            Object.defineProperty(DeclarativeElement.prototype, property, {
                configurable: true,
                enumerable: true,
                get() {
                    return this.__mvvmViewModel?.[property] ??
                        this.__mvvmPendingProperties?.get(property);
                },
                set(value) {
                    if (this.__mvvmViewModel) {
                        this.__mvvmSettingProperty = true;
                        try {
                            this.__mvvmViewModel[property] = this.normalizeProperty(
                                property,
                                value
                            );
                        } finally {
                            this.__mvvmSettingProperty = false;
                        }
                        return;
                    }

                    this.__mvvmPendingProperties ??= new Map();
                    this.__mvvmPendingProperties.set(property, value);
                }
            });
        }

        for (const method of publicMethods) {
            Object.defineProperty(DeclarativeElement.prototype, method, {
                configurable: true,
                enumerable: false,
                value(...args) {
                    if (!this.__mvvmViewModel) {
                        throw new Error(
                            `${name}: o componente ainda não está conectado.`
                        );
                    }

                    return this.__mvvmViewModel[method](...args);
                }
            });
        }

            customElements.define(name, DeclarativeElement);
            await customElements.whenDefined(name);
        } finally {
            if (this.#loadingNames.get(name) === nameLock) {
                this.#loadingNames.delete(name);
                releaseName();
            }
        }
    }
}
