export type MaybePromise<T> = T | PromiseLike<T>;
export type Synchronous<T> =
    T extends PromiseLike<unknown> ? never : T;
export type Cleanup = () => void | PromiseLike<void>;
export type BindingMode =
    | "oneway"
    | "twoway"
    | "onetime"
    | "onewaytosource";
export type BindingWhen =
    | "contentchanged"
    | "lostfocus"
    | "groupcommit";
export type ValidationStatus = "valid" | "invalid" | "cancelled";
export type BindifyRoot = Document | ShadowRoot | Element;

export interface Binding {
    readonly target: string;
    readonly source: string;
    readonly mode: BindingMode | null;
    readonly when: BindingWhen | null;
    readonly converter: string | null;
    readonly converterParameter: string | null;
}

export interface EventBinding {
    readonly event: string;
    readonly method: string;
}

export interface ItemsBinding {
    readonly source: string;
    readonly text: string | null;
    readonly value: string | null;
    readonly key: string | null;
    readonly emptyText: string | null;
    readonly emptyValue: string;
}

export interface ClassBinding {
    readonly className: string;
    readonly source: string;
}

export interface CssVarBinding {
    readonly name: string;
    readonly source: string;
}

export interface ValidationResult {
    readonly status: ValidationStatus;
    readonly valid: boolean;
    readonly errors: readonly string[];
}

export interface FieldState {
    valid: boolean | null;
    validated: boolean;
    changed: boolean;
    dirty: boolean;
    pending: boolean;
    error: string;
}

export interface ErrorContext {
    readonly phase?: string;
    readonly property?: string;
    readonly method?: string;
    readonly event?: string;
    readonly component?: string;
    readonly rule?: string;
    readonly group?: string;
    readonly element?: Element;
    readonly host?: Element;
    readonly root?: BindifyRoot;
    readonly resource?: unknown;
    readonly signal?: AbortSignal;
    readonly viewModel?: ViewModel;
    readonly [key: string]: unknown;
}

export interface ErrorState {
    hasError: boolean;
    error: Error | null;
    context: ErrorContext | null;
}

export interface ApplicationConfiguration {
    readonly development: boolean;
    readonly exposeViewModel: boolean;
    readonly detailedErrors: boolean;
}

export interface ApplicationOptions {
    development?: boolean;
    exposeViewModel?: boolean;
    detailedErrors?: boolean;
}

export interface PluginContext {
    readonly root?: BindifyRoot;
    readonly runtime?: Runtime;
    readonly viewModel?: ViewModel;
    readonly configuration: ApplicationConfiguration;
    readonly [key: string]: unknown;
}

export interface BindifyPlugin {
    beforeStart?(context: PluginContext): MaybePromise<void>;
    afterStart?(context: PluginContext): MaybePromise<void>;
    beforeStop?(context: PluginContext): MaybePromise<void>;
    afterStop?(context: PluginContext): MaybePromise<void>;
    onError?(
        error: Error,
        context: ErrorContext
    ): MaybePromise<boolean | void>;
}

export interface ConverterContext {
    readonly direction: "target" | "source";
    readonly parameter: string | null;
    readonly source: string;
    readonly target: string;
    readonly element: Element;
    readonly viewModel: ViewModel;
    readonly field: Field<any> | null;
}

export interface Converter<TSource = unknown, TTarget = unknown> {
    convert(
        value: TSource,
        context: ConverterContext
    ): TTarget;
    convertBack?(
        value: TTarget,
        context: ConverterContext
    ): TSource;
}

export interface RegisteredConverter<
    TSource = unknown,
    TTarget = unknown
> {
    readonly convert: (
        value: TSource,
        context: ConverterContext
    ) => TTarget;
    readonly convertBack: ((
        value: TTarget,
        context: ConverterContext
    ) => TSource) | null;
}

export interface ChangeContext extends ErrorContext {
    readonly phase: "changing" | "changed";
    readonly property: string;
    readonly viewModel: ViewModel;
    readonly signal?: AbortSignal;
}

export interface ValidationContext {
    readonly signal?: AbortSignal;
    readonly values?: Readonly<Record<string, unknown>>;
    readonly [key: string]: unknown;
}

export type ValidationMessage<T = unknown> =
    | string
    | ((value: T, viewModel: ViewModel, property: string) => string);

export type Validator<T = unknown> = (
    value: T,
    viewModel: ViewModel,
    property: string,
    context: ValidationContext
) => boolean;

export type AsyncValidator<T = unknown> = (
    value: T,
    viewModel: ViewModel,
    property: string,
    context: ValidationContext & { readonly signal: AbortSignal }
) => MaybePromise<boolean>;

export interface FieldOptions {
    locale?: string;
    currency?: string;
    values?: readonly unknown[];
    country?: string;
    type?: string;
    [key: string]: unknown;
}

export interface PhoneFieldOptions extends FieldOptions {
    minDigits?: number;
    maxDigits?: number;
    requireCountryCode?: boolean;
    countryCode?: boolean;
    requireAreaCode?: boolean;
    extension?: boolean;
}

export interface MaskOptions {
    placeholder?: string | null;
}

export class Field<T = unknown> {
    constructor(type: string, options?: FieldOptions);

    static string(options?: FieldOptions): Field<string>;
    static number(options?: FieldOptions): Field<number>;
    static integer(options?: FieldOptions): Field<number>;
    static money(currency?: string, options?: FieldOptions): Field<number>;
    static boolean(options?: FieldOptions): Field<boolean>;
    static array<T = unknown>(options?: FieldOptions): Field<T[]>;
    static object<T extends object = Record<string, unknown>>(
        options?: FieldOptions
    ): Field<T>;
    static blob(options?: FieldOptions): Field<Blob | null>;
    static enum<T>(
        values: readonly T[],
        options?: FieldOptions
    ): Field<T>;
    static date(options?: FieldOptions): Field<string | Date>;
    static time(options?: FieldOptions): Field<string>;
    static dateTime(options?: FieldOptions): Field<string | Date>;
    static email(options?: FieldOptions): Field<string>;
    static url(options?: FieldOptions): Field<string>;
    static uuid(options?: FieldOptions): Field<string>;
    static phone(options?: PhoneFieldOptions): Field<string>;
    static postalCode(
        country?: string,
        options?: FieldOptions
    ): Field<string>;
    static cpf(options?: FieldOptions): Field<string>;
    static cnpj(options?: FieldOptions): Field<string>;
    static document(
        type: string,
        country: string,
        options?: FieldOptions
    ): Field<string>;
    static alsoChanges(...properties: (string | readonly string[])[]): Field<string>;
    static registerPostalCode(country: string, pattern: RegExp): void;
    static registerDocument(
        country: string,
        type: string,
        validator: (value: unknown) => boolean
    ): void;
    static isEmpty(value: unknown): boolean;
    static parseNumber(value: unknown, locale?: string): number;
    static validDate(value: unknown): boolean;
    static age(value: unknown): number;
    static validCPF(value: unknown): boolean;
    static validCNPJ(value: unknown): boolean;
    static assertFiniteNumber(value: unknown, method: string): void;
    static assertNonNegativeInteger(value: unknown, method: string): void;
    static readPath<T = unknown>(root: unknown, path: string): T;

    readonly type: string;
    readonly options: Readonly<FieldOptions>;
    readonly hasMask: boolean;
    readonly changedDependencies: readonly string[];
    readonly comparedFields: readonly string[];
    readonly usesAttribute: boolean;
    readonly usesReflection: boolean;
    readonly configuredAttributeName: string | null;
    readonly hasValueIfEmpty: boolean;
    readonly emptyValue: unknown;
    readonly hasTrueValue: boolean;
    readonly mappedTrueValue: unknown;
    readonly hasFalseValue: boolean;
    readonly mappedFalseValue: unknown;
    readonly hasAsyncRules: boolean;
    readonly asyncHandlerNames: readonly string[];

    useAttribute(value?: boolean): this;
    useReflection(value?: boolean): this;
    attributeName(name: string): this;
    valueIfEmpty(value: T): this;
    trueValue(value: unknown): this;
    falseValue(value: unknown): this;
    alsoChanges(...properties: (string | readonly string[])[]): this;
    required(message?: ValidationMessage<T>): this;
    minLength(length: number, message?: ValidationMessage<T>): this;
    maxLength(length: number, message?: ValidationMessage<T>): this;
    min(minimum: number, message?: ValidationMessage<T>): this;
    max(maximum: number, message?: ValidationMessage<T>): this;
    range(
        minimum: number,
        maximum: number,
        message?: ValidationMessage<T>
    ): this;
    minAge(age: number, message?: ValidationMessage<T>): this;
    maxAge(age: number, message?: ValidationMessage<T>): this;
    pattern(pattern: string | RegExp, message?: ValidationMessage<T>): this;
    custom(
        validator: Validator<T>,
        message?: ValidationMessage<T>
    ): this;
    customAsync(
        handler: string | AsyncValidator<T>,
        message?: ValidationMessage<T>
    ): this;
    isEqualTo(otherField: string, message?: ValidationMessage<T>): this;
    isNotEqualTo(otherField: string, message?: ValidationMessage<T>): this;
    isLessThan(otherField: string, message?: ValidationMessage<T>): this;
    isLessThanOrEqualTo(
        otherField: string,
        message?: ValidationMessage<T>
    ): this;
    isGreaterThan(otherField: string, message?: ValidationMessage<T>): this;
    isGreaterThanOrEqualTo(
        otherField: string,
        message?: ValidationMessage<T>
    ): this;
    mask(pattern: string, options?: MaskOptions): this;
    rule(
        name: string,
        validate: Validator<T>,
        message: ValidationMessage<T>
    ): this;
    normalize(value: unknown): T;
    format(value: unknown): unknown;
    applyMask(value: unknown): string;
    validate(
        value: T,
        viewModel: ViewModel,
        property: string,
        context?: ValidationContext
    ): string[];
    validateAsync(
        value: T,
        viewModel: ViewModel,
        property: string,
        context?: ValidationContext
    ): Promise<string[]>;
    validateType(value: unknown): string | null;
    validatePhone(value: string): boolean;
    validatePostal(value: string): boolean;
    validateDocument(value: string): boolean;
}

export class ViewModel {
    static fields: Record<string, Field<any>>;
    static readonly cancelChange: symbol;

    errors: Record<string, string[]>;
    fieldState: Record<string, FieldState>;
    errorState: ErrorState;

    use<T>(
        resource: T,
        cleanup?: (resource: T) => void | PromiseLike<void>
    ): T;
    resolveResourceDisposer<T>(
        resource: T,
        cleanup?: (resource: T) => void | PromiseLike<void>
    ): Cleanup;
    releaseResources(): Promise<readonly Error[]>;
    handleError(error: unknown, context?: ErrorContext): Promise<boolean>;
    clearError(): void;
    configureErrorBoundary(options?: {
        reporter?: (
            error: Error,
            context: ErrorContext
        ) => MaybePromise<boolean>;
        detailedErrors?: boolean;
    }): void;
    update<T>(callback: () => Synchronous<T>): T;
    field(path: string): Field<any> | null;
    assertFields(): void;
    updateFieldValidationState(name: string, errors?: string[]): void;
    acceptChanges(...names: string[]): void;
    registerFieldGroup(name: string, groupName: string): Cleanup;
    resolveFieldSelection(
        fieldName?: string,
        groupName?: string
    ): string[];
    clearErrors(fieldName?: string, groupName?: string): void;
    cancelPending(fieldName?: string, groupName?: string): void;
    reset(fieldName?: string, groupName?: string): void;
    cloneFieldValue<T>(value: T): T;
    fieldValuesEqual(left: unknown, right: unknown): boolean;
    markFieldUnvalidated(name: string): void;
    hasPropertyPath(path: string): boolean;
    assertNoChangeCycles(fields: Record<string, Field<any>>): void;
    validateField(name: string): boolean;
    validate(...names: string[]): boolean;
    validateValueResultAsync(
        name: string,
        value: unknown,
        context?: ValidationContext
    ): Promise<ValidationResult>;
    validateValueAsync(
        name: string,
        value: unknown,
        context?: ValidationContext
    ): Promise<boolean>;
    validateFieldAsync(name: string): Promise<boolean>;
    validateAsync(...names: string[]): Promise<boolean>;
    cancelValidation(name: string): void;
    subscribe(
        path: string,
        callback: (value: unknown, path: string) => void
    ): Cleanup;
    cancelPropertyChange(property?: string): void;
    initialize(): MaybePromise<void>;
    onError(
        error: Error,
        context: ErrorContext
    ): MaybePromise<boolean | void>;
    dispose(): MaybePromise<void>;
}

export interface ObservableMembers {
    subscribe(
        path: string,
        callback: (value: unknown, changedPath: string) => void
    ): Cleanup;
    cancelPropertyChange(property?: string): void;
    runUpdate<T>(callback: () => Synchronous<T>): T;
}

export interface EmitOptions {
    bubbles?: boolean;
    composed?: boolean;
    cancelable?: boolean;
}

export class Component extends ViewModel {
    static properties: string[];
    static methods?: string[];
    host: HTMLElement | null;
    shadowRoot: ShadowRoot | null;
    emit<T = unknown>(
        eventName: string,
        detail?: T,
        options?: EmitOptions
    ): boolean;
    hide(): void;
    show(): void;
    connected(): MaybePromise<void>;
    disconnected(): MaybePromise<void>;
}

export class Path {
    static parts(path: string): string[];
    static has(root: unknown, path: string): boolean;
    static get<T = unknown>(root: unknown, path: string): T;
    static set(root: unknown, path: string, value: unknown): void;
}

export class BindingParser {
    parseMany<T>(
        text: string,
        parser: (text: string) => T,
        attributeName: string
    ): T[];
    parse(text: string, attributeName: string): Record<string, string>;
    parseBinding(text: string): Binding;
    parseBindings(text: string): readonly Binding[];
    parseEvent(text: string): EventBinding;
    parseEvents(text: string): readonly EventBinding[];
    parseItems(text: string): ItemsBinding;
    parseClasses(text: string): readonly ClassBinding[];
    parseCssVars(text: string): readonly CssVarBinding[];
}

export class Application {
    readonly configuration: ApplicationConfiguration;
    configure(options?: ApplicationOptions): ApplicationConfiguration;
    use(plugin: BindifyPlugin): Cleanup;
    run(hook: keyof BindifyPlugin, context: PluginContext): Promise<void>;
    reportError(
        error: Error,
        context: ErrorContext
    ): Promise<boolean>;
}

export class ConverterRegistry {
    register<TSource = unknown, TTarget = unknown>(
        name: string,
        converter:
            | Converter<TSource, TTarget>
            | ((
                value: TSource,
                context: ConverterContext
            ) => TTarget)
    ): Cleanup;
    get(name: string): RegisteredConverter;
    has(name: string): boolean;
}

export interface CommandContext {
    readonly viewModel?: ViewModel;
    readonly element?: Element;
    readonly source?: string;
    readonly event?: string;
    readonly domEvent?: Event;
    readonly [key: string]: unknown;
}

export interface CommandOptions<TParameter = unknown> {
    canExecute?: (
        parameter: TParameter,
        context: CommandContext
    ) => boolean;
    allowConcurrent?: boolean;
    observes?: readonly string[];
}

export class Command<TParameter = unknown, TResult = unknown> {
    constructor(
        execute: (
            parameter: TParameter,
            context: CommandContext
        ) => MaybePromise<TResult>,
        options?: CommandOptions<TParameter>
    );
    readonly pending: boolean;
    readonly allowConcurrent: boolean;
    readonly observes: readonly string[];
    canExecute(
        parameter?: TParameter,
        context?: CommandContext
    ): boolean;
    execute(
        parameter?: TParameter,
        context?: CommandContext
    ): Promise<TResult | undefined>;
    notifyCanExecuteChanged(): void;
    subscribe(callback: (command: this) => void): Cleanup;
}

export class Observable {
    create<T extends object>(target: T): T & ObservableMembers;
    reportChangeError(
        target: object,
        error: unknown,
        context: ErrorContext
    ): void;
}

export class Binder {
    constructor(
        parser: BindingParser,
        converters?: ConverterRegistry | null
    );
    setBindingGroupBinder(bindingGroupBinder: BindingGroupBinder): void;
    bindElement(element: Element, viewModel: ViewModel): void;
    reportError(
        viewModel: ViewModel,
        error: unknown,
        context: ErrorContext
    ): void;
    getDefaultMode(target: string): BindingMode;
    readSourceValue(viewModel: ViewModel, source: string): unknown;
    getPropertyDescriptor(
        root: unknown,
        path: string
    ): PropertyDescriptor | null;
    isWritablePath(root: unknown, path: string): boolean;
    getChangeEvents(element: Element, target: string): string[];
    readElementValue(element: Element, target: string): unknown;
    normalizeTargetValue(
        target: string,
        value: unknown,
        field?: Field<any> | null,
        booleanTarget?: boolean
    ): unknown;
    unbindElement(element: Element, kind?: string | null): void;
    storeCleanup(
        element: Element,
        kind: string,
        callbacks: Cleanup[]
    ): void;
}

export class EventBinder {
    constructor(parser: BindingParser, binder: Binder);
    bindElement(element: Element, viewModel: ViewModel): void;
    reportError(
        element: Element,
        binding: EventBinding,
        error: unknown,
        viewModel: ViewModel
    ): void;
}

export class CommandBinder {
    constructor(binder: Binder);
    bindElement(element: HTMLElement, viewModel: ViewModel): void;
}

export class ClassBinder {
    constructor(parser: BindingParser, binder: Binder);
    bindElement(element: HTMLElement, viewModel: ViewModel): void;
}

export class CssVarBinder {
    constructor(parser: BindingParser, binder: Binder);
    bindElement(element: HTMLElement, viewModel: ViewModel): void;
}

export class TemplateBinder {
    bindTree(root: ParentNode, viewModel: ViewModel): void;
    bindCondition(element: Element, viewModel: ViewModel): void;
    bind(template: HTMLTemplateElement, viewModel: ViewModel): void;
    resolveKey(
        item: unknown,
        alias: string,
        keyPath: string | null,
        context: Record<string, unknown>,
        index: number
    ): unknown;
    createView(
        template: HTMLTemplateElement,
        initialContext: Record<string, unknown>
    ): unknown;
    parseIntegerOption(
        rawValue: string | null | undefined,
        defaultValue: number | null,
        attributeName: string,
        options: {
            minimum?: number | null;
            disallowZero?: boolean;
        }
    ): number | null;
    interpolateValue(
        value: string,
        context: Record<string, unknown>
    ): string;
    assertSafeInterpolatedAttribute(name: string): void;
    assertSafeAttributeValue(name: string, value: string): void;
    unbind(template: HTMLTemplateElement): void;
    unbindCondition(element: Element): void;
    unbindTree(root: ParentNode): void;
}

export class ValidationBinder {
    constructor(parser: BindingParser, binder: Binder);
    bindElement(element: HTMLElement, viewModel: ViewModel): void;
    updateInputs(
        output: HTMLElement,
        viewModel: ViewModel,
        source: string,
        invalid: boolean
    ): void;
    createOutputId(root: ParentNode, base: string): string;
}

export class ItemsBinder {
    constructor(parser: BindingParser, binder: Binder);
    bindElement(
        element: HTMLSelectElement | HTMLDataListElement,
        viewModel: ViewModel
    ): void;
    readItem(
        item: unknown,
        path: string,
        index: number,
        option: string
    ): unknown;
}

export interface BindingGroupCommitOptions {
    action?: string | null;
    fields?: readonly string[] | null;
}

export class BindingGroupBinder {
    constructor(binder: Binder);
    bindElement(group: Element): void;
    register(
        element: Element,
        source: string,
        commit: (context?: Record<string, unknown>) => MaybePromise<unknown>,
        cancel: () => void,
        viewModel?: ViewModel | null
    ): Cleanup;
    ensureGroup(group: Element): unknown;
    commit(
        group: Element,
        state: unknown,
        options?: BindingGroupCommitOptions
    ): Promise<unknown>;
    cancel(group: Element, state: unknown): boolean;
    createDetail(
        group: Element,
        results: readonly unknown[],
        action?: string | null
    ): Readonly<Record<string, unknown>>;
}

export class ElementRefBinder {
    bindElement(element: Element, viewModel: ViewModel): void;
    unbindElement(element: Element): void;
}

export class ComponentLoader {
    constructor(
        runtimeProvider: () => Runtime,
        observable: Observable
    );
    loadAll(root?: ParentNode): Promise<void>;
    load(link: HTMLLinkElement): Promise<void>;
}

export interface RuntimeDependencies {
    binder: Binder;
    eventBinder: EventBinder;
    templateBinder: TemplateBinder;
    validationBinder: ValidationBinder;
    itemsBinder: ItemsBinder;
    bindingGroupBinder: BindingGroupBinder;
    elementRefBinder?: ElementRefBinder;
    commandBinder?: CommandBinder;
    classBinder?: ClassBinder;
    cssVarBinder?: CssVarBinder;
    observable: Observable;
    application?: Application | null;
}

export class Runtime {
    constructor(dependencies: RuntimeDependencies);
    setComponentLoader(componentLoader: ComponentLoader): void;
    readonly configuration: ApplicationConfiguration;
    prepareViewModel(viewModel: ViewModel): void;
    bindDocument(viewModel: ViewModel, root?: BindifyRoot): void;
    unbindDocument(root?: BindifyRoot): void;
    observeBindings(
        viewModel: ViewModel,
        root?: Element
    ): MutationObserver;
    start(root?: Document | ShadowRoot): Promise<ViewModel>;
    startCore(root: Document | ShadowRoot): Promise<ViewModel>;
    stop(root?: Document | ShadowRoot): Promise<boolean>;
}

export class Bindify {
    readonly configuration: ApplicationConfiguration;
    use(plugin: BindifyPlugin): Cleanup;
    configure(options?: ApplicationOptions): ApplicationConfiguration;
    registerConverter<TSource = unknown, TTarget = unknown>(
        name: string,
        converter:
            | Converter<TSource, TTarget>
            | ((
                value: TSource,
                context: ConverterContext
            ) => TTarget)
    ): Cleanup;
    start(root?: Document | ShadowRoot): Promise<ViewModel>;
    stop(root?: Document | ShadowRoot): Promise<boolean>;
    bindDocument(viewModel: ViewModel, root?: BindifyRoot): void;
    unbindDocument(root?: BindifyRoot): void;
    observeBindings(
        viewModel: ViewModel,
        root?: Element
    ): MutationObserver;
    makeObservable<T extends object>(value: T): T & ObservableMembers;
    parseBinding(text: string): Binding;
    parseEvent(text: string): EventBinding;
    parseItems(text: string): ItemsBinding;
    loadComponents(root?: ParentNode): Promise<void>;
}

export interface BindifyApi {
    readonly Bindify: typeof Bindify;
    readonly Path: typeof Path;
    readonly BindingParser: typeof BindingParser;
    readonly Observable: typeof Observable;
    readonly ViewModel: typeof ViewModel;
    readonly Field: typeof Field;
    readonly Component: typeof Component;
    readonly Binder: typeof Binder;
    readonly EventBinder: typeof EventBinder;
    readonly TemplateBinder: typeof TemplateBinder;
    readonly ValidationBinder: typeof ValidationBinder;
    readonly ItemsBinder: typeof ItemsBinder;
    readonly BindingGroupBinder: typeof BindingGroupBinder;
    readonly ElementRefBinder: typeof ElementRefBinder;
    readonly ComponentLoader: typeof ComponentLoader;
    readonly Runtime: typeof Runtime;
    readonly Application: typeof Application;
    readonly ConverterRegistry: typeof ConverterRegistry;
    readonly Command: typeof Command;
    readonly CommandBinder: typeof CommandBinder;
    readonly ClassBinder: typeof ClassBinder;
    readonly CssVarBinder: typeof CssVarBinder;
    readonly configuration: ApplicationConfiguration;
    start: Bindify["start"];
    stop: Bindify["stop"];
    bindDocument: Bindify["bindDocument"];
    unbindDocument: Bindify["unbindDocument"];
    observeBindings: Bindify["observeBindings"];
    makeObservable: Bindify["makeObservable"];
    parseBinding: Bindify["parseBinding"];
    parseEvent: Bindify["parseEvent"];
    parseItems: Bindify["parseItems"];
    loadComponents: Bindify["loadComponents"];
    use: Bindify["use"];
    configure: Bindify["configure"];
    registerConverter: Bindify["registerConverter"];
}

declare const api: BindifyApi;
export default api;

declare global {
    const BindifyJS: BindifyApi;

    interface HTMLElement {
        viewModel?: ViewModel;
        bindifyObserver?: MutationObserver;
    }
}
