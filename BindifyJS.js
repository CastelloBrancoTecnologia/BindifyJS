import { Path } from "./core/Path.js";
import { BindingParser } from "./core/BindingParser.js";
import { Observable } from "./core/Observable.js";
import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";
import { Component } from "./core/Component.js";
import { Binder } from "./core/Binder.js";
import { EventBinder } from "./core/EventBinder.js";
import { TemplateBinder } from "./core/TemplateBinder.js";
import { ValidationBinder } from "./core/ValidationBinder.js";
import { ItemsBinder } from "./core/ItemsBinder.js";
import { BindingGroupBinder } from "./core/BindingGroupBinder.js";
import { ElementRefBinder } from "./core/ElementRefBinder.js";
import { ComponentLoader } from "./core/ComponentLoader.js";
import { Runtime } from "./core/Runtime.js";
import { Application } from "./core/Application.js";
import { ConverterRegistry } from "./core/ConverterRegistry.js";
import { Command } from "./core/Command.js";
import { CommandBinder } from "./core/CommandBinder.js";
import { ClassBinder } from "./core/ClassBinder.js";
import { CssVarBinder } from "./core/CssVarBinder.js";

export class Bindify {
    #parser;
    #observable;
    #binder;
    #eventBinder;
    #templateBinder;
    #validationBinder;
    #itemsBinder;
    #bindingGroupBinder;
    #elementRefBinder;
    #componentLoader;
    #runtime;
    #application;
    #converters;
    #commandBinder;
    #classBinder;
    #cssVarBinder;

    constructor() {
        this.#application = new Application();
        this.#converters = new ConverterRegistry();
        this.#parser = new BindingParser();
        this.#observable = new Observable();
        this.#binder = new Binder(this.#parser, this.#converters);
        this.#eventBinder = new EventBinder(this.#parser, this.#binder);
        this.#templateBinder = new TemplateBinder();
        this.#validationBinder = new ValidationBinder(this.#parser, this.#binder);
        this.#itemsBinder = new ItemsBinder(this.#parser, this.#binder);
        this.#bindingGroupBinder = new BindingGroupBinder(this.#binder);
        this.#elementRefBinder = new ElementRefBinder();
        this.#commandBinder = new CommandBinder(this.#binder);
        this.#classBinder = new ClassBinder(this.#parser, this.#binder);
        this.#cssVarBinder = new CssVarBinder(this.#parser, this.#binder);
        this.#binder.setBindingGroupBinder(this.#bindingGroupBinder);
        this.#runtime = new Runtime({ binder: this.#binder, eventBinder: this.#eventBinder, templateBinder: this.#templateBinder, validationBinder: this.#validationBinder, itemsBinder: this.#itemsBinder, bindingGroupBinder: this.#bindingGroupBinder, elementRefBinder: this.#elementRefBinder, commandBinder: this.#commandBinder, classBinder: this.#classBinder, cssVarBinder: this.#cssVarBinder, observable: this.#observable, application: this.#application });
        this.#componentLoader = new ComponentLoader(() => this.#runtime, this.#observable);
        this.#runtime.setComponentLoader(this.#componentLoader);
    }

    start(root = document) { return this.#runtime.start(root); }
    stop(root = document) { return this.#runtime.stop(root); }
    bindDocument(viewModel, root = document) { return this.#runtime.bindDocument(viewModel, root); }
    unbindDocument(root = document) { return this.#runtime.unbindDocument(root); }
    observeBindings(viewModel, root = document.body) { return this.#runtime.observeBindings(viewModel, root); }
    makeObservable(value) { return this.#observable.create(value); }
    parseBinding(text) { return this.#parser.parseBinding(text); }
    parseEvent(text) { return this.#parser.parseEvent(text); }
    parseItems(text) { return this.#parser.parseItems(text); }
    loadComponents(root = document) { return this.#componentLoader.loadAll(root); }
    use(plugin) { return this.#application.use(plugin); }
    configure(options) { return this.#application.configure(options); }
    get configuration() { return this.#application.configuration; }
    registerConverter(name, converter) {
        return this.#converters.register(name, converter);
    }
}

const app = new Bindify();
const api = Object.freeze({
    Bindify, Path, BindingParser, Observable, ViewModel, Field, Component, Binder, EventBinder, TemplateBinder, ValidationBinder, ItemsBinder, BindingGroupBinder, ElementRefBinder, ComponentLoader, Runtime, Application, ConverterRegistry, Command, CommandBinder, ClassBinder, CssVarBinder,
    start: app.start.bind(app),
    stop: app.stop.bind(app),
    bindDocument: app.bindDocument.bind(app),
    unbindDocument: app.unbindDocument.bind(app),
    observeBindings: app.observeBindings.bind(app),
    makeObservable: app.makeObservable.bind(app),
    parseBinding: app.parseBinding.bind(app),
    parseEvent: app.parseEvent.bind(app),
    parseItems: app.parseItems.bind(app),
    loadComponents: app.loadComponents.bind(app),
    use: app.use.bind(app),
    configure: app.configure.bind(app),
    registerConverter: app.registerConverter.bind(app),
    get configuration() { return app.configuration; }
});

globalThis.BindifyJS = api;
export {
    Path,
    BindingParser,
    Observable,
    ViewModel,
    Field,
    Component,
    Binder,
    EventBinder,
    TemplateBinder,
    ValidationBinder,
    ItemsBinder,
    BindingGroupBinder,
    ElementRefBinder,
    ComponentLoader,
    Runtime,
    Application,
    ConverterRegistry,
    Command,
    CommandBinder,
    ClassBinder,
    CssVarBinder
};
export default api;
