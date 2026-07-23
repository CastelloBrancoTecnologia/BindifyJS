import test from "node:test";
import assert from "node:assert/strict";

import { Field } from "../core/Field.js";
import { Observable } from "../core/Observable.js";
import { ViewModel } from "../core/ViewModel.js";
import { Path } from "../core/Path.js";
import { TemplateBinder } from "../core/TemplateBinder.js";
import { EventBinder } from "../core/EventBinder.js";
import { Runtime } from "../core/Runtime.js";
import { ComponentLoader } from "../core/ComponentLoader.js";
import { ElementRefBinder } from "../core/ElementRefBinder.js";
import { Binder } from "../core/Binder.js";
import { BindingParser } from "../core/BindingParser.js";
import { ConverterRegistry } from "../core/ConverterRegistry.js";
import { Command } from "../core/Command.js";
import { CommandBinder } from "../core/CommandBinder.js";
import { ClassBinder } from "../core/ClassBinder.js";
import { CssVarBinder } from "../core/CssVarBinder.js";
import { Application } from "../core/Application.js";
import { CadastroPageViewModel } from "../CadastroPageViewModel.js";

function observable(Type) {
    const value = new Observable().create(new Type());
    value.assertFields();
    return value;
}

test("Field.normalize preserva arrays, objetos e enums tipados", () => {
    const array = [1, 2];
    const object = { id: 1 };

    assert.strictEqual(Field.array().normalize(array), array);
    assert.strictEqual(Field.object().normalize(object), object);
    assert.strictEqual(Field.enum([1, 2]).normalize(1), 1);
    assert.equal(Field.integer().normalize(12.8), 12);
});

test("fieldState distingue não validado, válido e inválido", () => {
    class Example extends ViewModel {
        static fields = {
            name: Field.string().required("Informe o nome.")
        };
        name = "";
    }

    const vm = observable(Example);
    assert.deepEqual({ ...vm.fieldState.name }, {
        valid: null,
        validated: false,
        changed: false,
        dirty: false,
        pending: false,
        error: ""
    });

    assert.equal(vm.validateField("name"), false);
    assert.equal(vm.fieldState.name.validated, true);
    assert.equal(vm.fieldState.name.valid, false);
    assert.equal(vm.fieldState.name.error, "Informe o nome.");

    vm.clearErrors("name");
    assert.equal(vm.fieldState.name.validated, false);
    assert.equal(vm.fieldState.name.valid, null);
});

test("acceptChanges atualiza o baseline usado por reset", () => {
    class Example extends ViewModel {
        static fields = { name: Field.string() };
        name = "inicial";
    }

    const vm = observable(Example);
    vm.name = "aceito";
    assert.equal(vm.fieldState.name.dirty, true);

    vm.acceptChanges("name");
    assert.equal(vm.fieldState.name.dirty, false);

    vm.name = "temporário";
    vm.reset("name");
    assert.equal(vm.name, "aceito");
    assert.equal(vm.fieldState.name.changed, false);
    assert.equal(vm.fieldState.name.dirty, false);
});

test("validação assíncrona cancelada tem status explícito", async () => {
    class Example extends ViewModel {
        static fields = {
            name: Field.string().customAsync(
                "available",
                "Indisponível."
            )
        };
        name = "";

        async available(value, property, context) {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, value === "old" ? 50 : 5);
                context.signal.addEventListener("abort", () => {
                    clearTimeout(timeout);
                    reject(new DOMException("Cancelado.", "AbortError"));
                }, { once: true });
            });
            return value !== "old";
        }
    }

    const vm = observable(Example);
    const old = vm.validateValueResultAsync("name", "old");
    await new Promise(resolve => setTimeout(resolve, 1));
    const current = vm.validateValueResultAsync("name", "current");

    assert.deepEqual({ ...(await old) }, {
        status: "cancelled",
        valid: false,
        errors: []
    });
    assert.equal((await current).status, "valid");
});

test("cancelPending impede publicação posterior do resultado", async () => {
    class Example extends ViewModel {
        static fields = {
            name: Field.string().customAsync("slow", "Erro tardio.")
        };
        name = "";

        async slow() {
            await new Promise(resolve => setTimeout(resolve, 15));
            return false;
        }
    }

    const vm = observable(Example);
    const pending = vm.validateValueResultAsync("name", "value");
    assert.equal(vm.fieldState.name.pending, true);

    vm.cancelPending("name");
    assert.equal(vm.fieldState.name.pending, false);
    assert.equal((await pending).status, "cancelled");
    assert.deepEqual([...vm.errors.name], []);
});

test("operações por grupo afetam somente Fields registrados", () => {
    class Example extends ViewModel {
        static fields = {
            name: Field.string(),
            age: Field.integer()
        };
        name = "A";
        age = 10;
    }

    const vm = observable(Example);
    vm.registerFieldGroup("name", "identity");
    vm.name = "B";
    vm.age = 20;

    vm.reset("", "identity");
    assert.equal(vm.name, "A");
    assert.equal(vm.age, 20);
});

test("cancelamento invalida uma transação de binding group em andamento", async () => {
    const PreviousElement = globalThis.Element;
    const PreviousCustomEvent = globalThis.CustomEvent;

    class FakeElement {
        constructor(group = null) {
            this.group = group ?? this;
            this.dataset = Object.create(null);
            this.events = [];
        }
        closest() { return this.group; }
        getRootNode() { return this.group; }
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent(event) {
            this.events.push(event.type);
            return true;
        }
    }
    class FakeCustomEvent {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
        }
    }

    globalThis.Element = FakeElement;
    globalThis.CustomEvent = FakeCustomEvent;
    try {
        const { BindingGroupBinder } = await import(
            "../core/BindingGroupBinder.js"
        );
        const binder = {
            storeCleanup() {}
        };
        const groups = new BindingGroupBinder(binder);
        const group = new FakeElement();
        group.dataset.bindingGroup = "form";
        groups.ensureGroup(group);

        const input = new FakeElement(group);
        let applied = 0;
        groups.register(
            input,
            "name",
            async () => {
                await new Promise(resolve => setTimeout(resolve, 15));
                return {
                    source: "name",
                    value: "late",
                    status: "valid",
                    valid: true,
                    errors: [],
                    apply: () => applied++
                };
            },
            () => {}
        );

        const commit = group.bindingGroup.commit();
        group.bindingGroup.cancel();

        assert.equal(await commit, false);
        assert.equal(applied, 0);
        assert.equal(group.events.includes("bindingscommit"), false);
        assert.equal(group.events.includes("bindingscancel"), true);
    } finally {
        globalThis.Element = PreviousElement;
        globalThis.CustomEvent = PreviousCustomEvent;
    }
});

test("array e object não usam atributos por padrão", () => {
    assert.equal(Field.array().usesAttribute, false);
    assert.equal(Field.array().usesReflection, false);
    assert.equal(Field.object().usesAttribute, false);
    assert.equal(Field.string().usesAttribute, true);
});

test("custom recebe valores candidatos preparados pelo grupo", () => {
    const confirmation = Field.string().custom(
        (value, viewModel, property, context) =>
            value === context.values.password,
        "As senhas não coincidem."
    );

    assert.deepEqual(
        confirmation.validate(
            "segredo123",
            {},
            "confirmation",
            { values: { password: "segredo123" } }
        ),
        []
    );
    assert.deepEqual(
        confirmation.validate(
            "outra",
            {},
            "confirmation",
            { values: { password: "segredo123" } }
        ),
        ["As senhas não coincidem."]
    );
});

test("isEqualTo compara valores candidatos do grupo", () => {
    const field = Field.string().isEqualTo(
        "password",
        "As senhas não coincidem."
    );

    assert.deepEqual(
        field.validate("12345678", { password: "outra" }, "confirmation", {
            values: { password: "12345678" }
        }),
        []
    );
    assert.deepEqual(
        field.validate("diferente", { password: "12345678" }, "confirmation"),
        ["As senhas não coincidem."]
    );
});

test("comparações cruzadas suportam números e strings", () => {
    assert.deepEqual(
        Field.number()
            .isLessThan("maximum", "Muito alto.")
            .validate(5, { maximum: 10 }, "value"),
        []
    );
    assert.deepEqual(
        Field.integer()
            .isGreaterThanOrEqualTo("minimum", "Muito baixo.")
            .validate(4, { minimum: 5 }, "value"),
        ["Muito baixo."]
    );
    assert.deepEqual(
        Field.string()
            .isLessThan("last", "Fora da ordem.")
            .validate("Ana", { last: "Bruno" }, "first"),
        []
    );
    assert.deepEqual(
        Field.string()
            .isNotEqualTo("reserved", "Nome reservado.")
            .validate("admin", { reserved: "admin" }, "name"),
        ["Nome reservado."]
    );
});

test("comparações cruzadas suportam datas, horários e datetimes", () => {
    assert.deepEqual(
        Field.date()
            .isLessThanOrEqualTo("end")
            .validate(
                "2026-07-23",
                { end: "2026-07-24" },
                "start"
            ),
        []
    );
    assert.deepEqual(
        Field.time()
            .isGreaterThan("opening", "Horário inválido.")
            .validate("08:29", { opening: "08:30" }, "time"),
        ["Horário inválido."]
    );
    assert.deepEqual(
        Field.dateTime()
            .isGreaterThanOrEqualTo("created")
            .validate(
                "2026-07-23T12:00:00Z",
                { created: "2026-07-23T11:00:00Z" },
                "updated"
            ),
        []
    );
});

test("API não expõe aliases removidos", () => {
    const field = Field.string();
    class Example extends ViewModel {
        static fields = { value: Field.string() };
        value = "";
    }
    const vm = observable(Example);

    assert.equal(field["MaxLen"], undefined);
    assert.equal(Field["String"], undefined);
    assert.equal(vm.validationState, undefined);
    assert.equal(vm["ClearFieldsErrors"], undefined);
    assert.equal(vm["CancelPending"], undefined);
    assert.equal(vm["Reset"], undefined);
    assert.equal(vm["AcceptChanges"], undefined);
    assert.equal(vm.clearValidation, undefined);
});

test("Observable preserva Date e classes com campos privados", () => {
    class PrivateExample {
        #secret = 42;
        when = new Date("2026-01-01T00:00:00Z");
        readSecret() { return this.#secret; }
    }

    const value = new Observable().create(new PrivateExample());

    assert.equal(value.readSecret(), 42);
    assert.equal(value.when.getTime(), 1767225600000);
});

test("Observable notifica todos os caminhos de uma referência compartilhada", () => {
    const shared = { value: 0 };
    const value = new Observable().create({
        left: shared,
        right: shared
    });
    const notifications = [];
    value.subscribe("left.value", (_, changed) =>
        notifications.push(changed));
    value.subscribe("right.value", (_, changed) =>
        notifications.push(changed));

    value.right.value = 1;

    assert.deepEqual(
        new Set(notifications),
        new Set(["left.value", "right.value"])
    );
});

test("update agrupa notificações e publica os valores finais", () => {
    class PersonViewModel extends ViewModel {
        static fields = {
            firstName: Field.string().alsoChanges("fullName"),
            lastName: Field.string().alsoChanges("fullName"),
            balance: Field.number()
        };

        firstName = "";
        lastName = "";
        balance = 0;

        get fullName() {
            return `${this.firstName} ${this.lastName}`.trim();
        }
    }

    const vm = observable(PersonViewModel);
    const notifications = [];
    vm.subscribe("fullName", value => {
        notifications.push(`fullName:${value}`);
    });
    vm.subscribe("balance", value => {
        notifications.push(`balance:${value}`);
    });

    vm.update(() => {
        vm.firstName = "Cesar";
        vm.lastName = "Augusto";
        vm.balance = 100;
        assert.equal(vm.fullName, "Cesar Augusto");
        assert.deepEqual(notifications, []);
    });

    assert.deepEqual(notifications.sort(), [
        "balance:100",
        "fullName:Cesar Augusto",
    ]);
});

test("updates aninhados fazem somente o flush da transação externa", () => {
    class CounterViewModel extends ViewModel {
        static fields = {
            value: Field.integer()
        };
        value = 0;
    }
    const vm = observable(CounterViewModel);
    const values = [];
    vm.subscribe("value", value => values.push(value));

    vm.update(() => {
        vm.value = 1;
        vm.update(() => {
            vm.value = 2;
        });
        assert.deepEqual(values, []);
        vm.value = 3;
    });

    assert.deepEqual(values, [3]);
});

test("update publica alterações antes de propagar um erro", () => {
    class CounterViewModel extends ViewModel {
        static fields = {
            value: Field.integer()
        };
        value = 0;
    }
    const vm = observable(CounterViewModel);
    let published = null;
    vm.subscribe("value", value => {
        published = value;
    });

    assert.throws(() => {
        vm.update(() => {
            vm.value = 10;
            throw new Error("falhou");
        });
    }, /falhou/);

    assert.equal(published, 10);
});

test("update rejeita callbacks assíncronos antes de executá-los", () => {
    class CounterViewModel extends ViewModel {
        static fields = {
            value: Field.integer()
        };
        value = 0;
    }
    const vm = observable(CounterViewModel);

    assert.throws(
        () => vm.update(async () => {
            vm.value = 10;
        }),
        /precisa ser síncrono/
    );
    assert.equal(vm.value, 0);
});

test("onXChanging transforma ou cancela uma alteração síncrona", () => {
    class Example extends ViewModel {
        static fields = {
            cidade: Field.string(),
            bloqueada: Field.string()
        };
        cidade = "";
        bloqueada = "original";

        onCidadeChanging(newValue, oldValue, context) {
            assert.equal(oldValue, "");
            assert.equal(context.property, "cidade");
            assert.equal(context.phase, "changing");
            return newValue.trim();
        }

        onBloqueadaChanging() {
            return ViewModel.cancelChange;
        }
    }
    const vm = observable(Example);

    vm.cidade = "  Curitiba  ";
    vm.bloqueada = "novo valor";

    assert.equal(vm.cidade, "Curitiba");
    assert.equal(vm.bloqueada, "original");
});

test("onXChanging rejeita handlers assíncronos", () => {
    class Example extends ViewModel {
        static fields = { cidade: Field.string() };
        cidade = "";
        async onCidadeChanging(value) {
            return value.trim();
        }
    }
    const vm = observable(Example);

    assert.throws(
        () => {
            vm.cidade = "Curitiba";
        },
        /precisa ser síncrono/
    );
    assert.equal(vm.cidade, "");
});

test("onXChanged recebe valores e cancela a execução anterior", async () => {
    class Example extends ViewModel {
        static fields = { cidade: Field.string() };
        cidade = "";
        completed = [];
        aborted = [];

        async onCidadeChanged(newValue, oldValue, context) {
            assert.equal(context.property, "cidade");
            assert.equal(context.phase, "changed");
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(resolve, 20);
                context.signal.addEventListener("abort", () => {
                    clearTimeout(timeout);
                    this.aborted.push(newValue);
                    reject(new DOMException("Cancelado.", "AbortError"));
                }, { once: true });
            });
            this.completed.push({ newValue, oldValue });
        }
    }
    const vm = observable(Example);

    vm.cidade = "Curitiba";
    vm.cidade = "São Paulo";
    await new Promise(resolve => setTimeout(resolve, 30));

    assert.deepEqual(vm.aborted, ["Curitiba"]);
    assert.deepEqual(vm.completed, [{
        newValue: "São Paulo",
        oldValue: "Curitiba"
    }]);
});

test("erros de onXChanged são encaminhados para onError", async () => {
    class Example extends ViewModel {
        static fields = { cidade: Field.string() };
        cidade = "";
        captured = null;

        async onCidadeChanged() {
            throw new Error("Falha no frete.");
        }

        onError(error, context) {
            this.captured = {
                message: error.message,
                property: context.property,
                phase: context.phase
            };
        }
    }
    const vm = observable(Example);

    vm.cidade = "Recife";
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(vm.captured, {
        message: "Falha no frete.",
        property: "cidade",
        phase: "changed"
    });
});

test("use libera recursos automaticamente em ordem inversa e uma única vez", async () => {
    const calls = [];
    const vm = new ViewModel();
    const controller = {
        abort() {
            calls.push("abort");
        }
    };

    assert.strictEqual(vm.use(controller), controller);
    vm.use(() => {
        calls.push("function");
    });
    vm.use("connection", resource => {
        calls.push(`custom:${resource}`);
    });

    assert.deepEqual(await vm.releaseResources(), []);
    assert.deepEqual(calls, [
        "custom:connection",
        "function",
        "abort"
    ]);

    await vm.releaseResources();
    assert.equal(calls.length, 3);
});

test("cleanup com erro não impede a liberação dos demais recursos", async () => {
    const calls = [];
    class ResourceViewModel extends ViewModel {
        async onError(error, context) {
            calls.push(`${context.phase}:${error.message}`);
            return true;
        }
    }
    const vm = new ResourceViewModel();
    vm.use(() => calls.push("first"));
    vm.use(() => {
        throw new Error("cleanup falhou");
    });
    vm.use({
        async dispose() {
            calls.push("last");
        }
    });

    const errors = await vm.releaseResources();
    assert.equal(errors.length, 1);
    assert.deepEqual(calls, [
        "last",
        "resource-cleanup:cleanup falhou",
        "first"
    ]);
});

test("error boundary mantém estado observável e pode ser limpo", async () => {
    let captured;
    class BoundaryViewModel extends ViewModel {
        onError(error, context) {
            captured = { error, context };
            return true;
        }
    }
    const vm = new Observable().create(new BoundaryViewModel());
    let notifications = 0;
    vm.subscribe("errorState", () => notifications++);

    const error = new Error("indisponível");
    const handled = await vm.handleError(error, {
        phase: "event",
        method: "salvar"
    });

    assert.equal(handled, true);
    assert.equal(vm.errorState.hasError, true);
    assert.strictEqual(vm.errorState.error, error);
    assert.equal(vm.errorState.context.method, "salvar");
    assert.strictEqual(vm.errorState.context.viewModel, vm);
    assert.strictEqual(captured.error, error);

    vm.clearError();
    assert.equal(vm.errorState.hasError, false);
    assert.equal(notifications, 2);
});

test("EventBinder encaminha falhas para o error boundary", async () => {
    const PreviousCustomEvent = globalThis.CustomEvent;
    globalThis.CustomEvent = class {
        constructor(type, options) {
            this.type = type;
            this.detail = options.detail;
        }
    };
    let listener;
    let captured;
    const element = {
        dataset: { event: "" },
        addEventListener(_name, callback) {
            listener = callback;
        },
        removeEventListener() {},
        dispatchEvent() {}
    };
    const viewModel = {
        fail() {
            throw new Error("evento falhou");
        },
        async handleError(error, context) {
            captured = { error, context };
            return true;
        }
    };
    const binder = new EventBinder(
        {
            parseEvents: () => [{
                event: "click",
                method: "fail"
            }]
        },
        {
            unbindElement() {},
            storeCleanup() {}
        }
    );

    try {
        binder.bindElement(element, viewModel);
        listener({ type: "click" });
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.match(captured.error.message, /evento falhou/);
        assert.equal(captured.context.phase, "event");
        assert.equal(captured.context.method, "fail");
    } finally {
        globalThis.CustomEvent = PreviousCustomEvent;
    }
});

test("Application executa plugins na ordem e permite removê-los", async () => {
    const application = new Application();
    const calls = [];
    const removeFirst = application.use({
        beforeStart(context) {
            calls.push(`first:${context.value}`);
        },
        onError() {
            calls.push("first:error");
            return true;
        }
    });
    application.use({
        async beforeStart() {
            calls.push("second");
        }
    });

    await application.run("beforeStart", { value: 10 });
    assert.equal(
        await application.reportError(new Error("x"), {}),
        true
    );
    removeFirst();
    await application.run("beforeStart", { value: 20 });

    assert.deepEqual(calls, [
        "first:10",
        "second",
        "first:error",
        "second"
    ]);
});

test("converters aplicam convert e convertBack em binding twoway", () => {
    const PreviousInput = globalThis.HTMLInputElement;
    const PreviousTextArea = globalThis.HTMLTextAreaElement;
    class FakeInput {
        constructor() {
            this.dataset = {
                bind: [
                    "target: value",
                    "source: name",
                    "mode: twoway",
                    "converter: upper"
                ].join(";")
            };
            this.localName = "input";
            this.type = "text";
            this.value = "";
            this.listeners = new Map();
        }
        addEventListener(name, callback) {
            this.listeners.set(name, callback);
        }
        removeEventListener(name) {
            this.listeners.delete(name);
        }
    }
    globalThis.HTMLInputElement = FakeInput;
    globalThis.HTMLTextAreaElement = class {};

    class ConverterViewModel extends ViewModel {
        static fields = {
            name: Field.string()
        };
        name = "Cesar";
    }

    try {
        const converters = new ConverterRegistry();
        converters.register("upper", {
            convert: value => String(value).toUpperCase(),
            convertBack: value => String(value).toLowerCase()
        });
        const binder = new Binder(
            new BindingParser(),
            converters
        );
        const vm = observable(ConverterViewModel);
        const element = new FakeInput();

        binder.bindElement(element, vm);
        assert.equal(element.value, "CESAR");

        element.value = "AUGUSTO";
        element.listeners.get("input")();
        assert.equal(vm.name, "augusto");
    } finally {
        globalThis.HTMLInputElement = PreviousInput;
        globalThis.HTMLTextAreaElement = PreviousTextArea;
    }
});

test("data-command reflete canExecute, pending e executa a ação", async () => {
    let listener;
    let cleanup;
    const attributes = new Map();
    const element = {
        dataset: { command: "saveCommand" },
        disabled: false,
        addEventListener(_name, callback) {
            listener = callback;
        },
        removeEventListener() {},
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        toggleAttribute(name, active) {
            if (active) attributes.set(name, "");
            else attributes.delete(name);
        }
    };
    class CommandViewModel extends ViewModel {
        allowed = false;
        executions = 0;
        saveCommand = new Command(
            async () => {
                this.executions++;
            },
            {
                canExecute: () => this.allowed,
                observes: ["allowed"]
            }
        );
    }
    const vm = new Observable().create(new CommandViewModel());
    const commandBinder = new CommandBinder({
        unbindElement() {},
        storeCleanup(_element, _kind, callbacks) {
            cleanup = callbacks;
        }
    });

    commandBinder.bindElement(element, vm);
    assert.equal(element.disabled, true);
    assert.equal(attributes.get("aria-disabled"), "true");

    vm.allowed = true;
    assert.equal(element.disabled, false);
    listener({ preventDefault() {} });
    assert.equal(element.disabled, true);
    assert.equal(attributes.has("data-command-pending"), true);

    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(vm.executions, 1);
    assert.equal(element.disabled, false);
    assert.equal(attributes.has("data-command-pending"), false);
    for (const release of cleanup) release();
});

test("modo de produção sanitiza erros no estado", async () => {
    const application = new Application();
    application.configure({ development: false });
    assert.deepEqual(application.configuration, {
        development: false,
        exposeViewModel: false,
        detailedErrors: false
    });

    let localErrors = 0;
    class ProductionViewModel extends ViewModel {
        onError() {
            localErrors++;
            return true;
        }
    }
    const vm = new Observable().create(new ProductionViewModel());
    let pluginError;
    application.use({
        onError(error) {
            pluginError = error;
            return true;
        }
    });
    vm.configureErrorBoundary({
        detailedErrors: application.configuration.detailedErrors,
        reporter: (error, context) =>
            application.reportError(error, context)
    });

    const original = new Error("segredo interno");
    await vm.handleError(original, {
        phase: "event",
        element: {}
    });

    assert.strictEqual(pluginError, original);
    assert.equal(localErrors, 0);
    assert.equal(vm.errorState.error.message, "Ocorreu um erro inesperado.");
    assert.deepEqual(
        Object.keys(vm.errorState.context).sort(),
        ["phase", "viewModel"]
    );
});

test("Path rejeita segmentos capazes de acessar prototypes", () => {
    for (const path of [
        "__proto__.value",
        "constructor.prototype",
        "safe.prototype.value"
    ]) {
        assert.throws(
            () => Path.get({ safe: {} }, path),
            /não é permitido/
        );
    }
});

test("TemplateBinder bloqueia atributos executáveis e protocolos perigosos", () => {
    const binder = new TemplateBinder();

    for (const name of ["onclick", "srcdoc", "style"]) {
        assert.throws(
            () => binder.assertSafeInterpolatedAttribute(name),
            /não permitida/
        );
    }
    for (const value of [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)"
    ]) {
        assert.throws(
            () => binder.assertSafeAttributeValue("href", value),
            /não permitido/
        );
    }
    assert.doesNotThrow(() =>
        binder.assertSafeAttributeValue("href", "/conta/1"));
    assert.doesNotThrow(() =>
        binder.assertSafeAttributeValue("href", "https://example.com"));
});

test("Field rejeita configurações incoerentes", () => {
    assert.throws(() => Field.string().minLength(-1), /inteiro/);
    assert.throws(() => Field.string().maxLength(1.5), /inteiro/);
    assert.throws(() => Field.number().min(Number.NaN), /finito/);
    assert.throws(() => Field.number().range(10, 1), /mínimo/);
    assert.throws(() => Field.date().minAge(-1), /inteiro/);
});

test("Runtime.start agrupa chamadas concorrentes", async () => {
    const PreviousElement = globalThis.Element;
    const PreviousMutationObserver = globalThis.MutationObserver;
    class FakeElement {}
    class FakeObserver {
        observe() {}
        disconnect() {}
    }
    globalThis.Element = FakeElement;
    globalThis.MutationObserver = FakeObserver;

    class ConcurrentViewModel extends ViewModel {}
    globalThis.ConcurrentViewModel = ConcurrentViewModel;
    let loads = 0;
    let binds = 0;
    const hooks = [];
    const application = new Application();
    application.configure({ development: false });
    application.use({
        beforeStart: () => hooks.push("beforeStart"),
        afterStart: () => hooks.push("afterStart"),
        beforeStop: () => hooks.push("beforeStop"),
        afterStop: () => hooks.push("afterStop")
    });
    const host = {
        getAttribute: name =>
            name === "viewmodel" ? "ConcurrentViewModel" : null
    };
    const root = {
        documentElement: host,
        body: null,
        querySelectorAll: () => []
    };
    root.body = root;
    const runtime = new Runtime({
        binder: { unbindElement() {} },
        eventBinder: {},
        templateBinder: {
            bindTree() { binds++; },
            unbindTree() {}
        },
        validationBinder: {},
        itemsBinder: {},
        bindingGroupBinder: {},
        observable: new Observable(),
        application
    });
    runtime.setComponentLoader({
        async loadAll() {
            loads++;
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    });

    try {
        const [first, second] = await Promise.all([
            runtime.start(root),
            runtime.start(root)
        ]);
        assert.strictEqual(first, second);
        assert.equal(loads, 1);
        assert.equal(binds, 1);
        assert.equal(host.viewModel, undefined);
        assert.deepEqual(hooks, ["beforeStart", "afterStart"]);
        await runtime.stop(root);
        assert.deepEqual(hooks, [
            "beforeStart",
            "afterStart",
            "beforeStop",
            "afterStop"
        ]);
    } finally {
        delete globalThis.ConcurrentViewModel;
        globalThis.Element = PreviousElement;
        globalThis.MutationObserver = PreviousMutationObserver;
    }
});

test("Runtime desfaz bindings quando a inicialização falha", async () => {
    const PreviousElement = globalThis.Element;
    class FakeElement {}
    globalThis.Element = FakeElement;
    class BrokenViewModel extends ViewModel {
        onError() {
            return true;
        }
    }
    globalThis.BrokenViewModel = BrokenViewModel;
    let unbound = 0;
    const root = {
        documentElement: {
            getAttribute: () => "BrokenViewModel"
        },
        querySelectorAll: () => []
    };
    const runtime = new Runtime({
        binder: { unbindElement() {} },
        eventBinder: {},
        templateBinder: {
            bindTree() { throw new Error("binding quebrado"); },
            unbindTree() { unbound++; }
        },
        validationBinder: {},
        itemsBinder: {},
        bindingGroupBinder: {},
        observable: new Observable()
    });

    try {
        await assert.rejects(
            runtime.start(root),
            /binding quebrado/
        );
        assert.equal(unbound, 1);
        assert.equal(root.documentElement.viewModel, undefined);
    } finally {
        delete globalThis.BrokenViewModel;
        globalThis.Element = PreviousElement;
    }
});

test("EventBinder captura rejeições de handlers assíncronos", async () => {
    const PreviousCustomEvent = globalThis.CustomEvent;
    class FakeCustomEvent {
        constructor(type, options) {
            this.type = type;
            this.detail = options.detail;
        }
    }
    globalThis.CustomEvent = FakeCustomEvent;
    let listener;
    let reported;
    const element = {
        dataset: { event: "" },
        addEventListener(_name, callback) { listener = callback; },
        removeEventListener() {},
        dispatchEvent(event) { reported = event; }
    };
    const binder = new EventBinder(
        {
            parseEvents: () => [{
                event: "click",
                method: "fail"
            }]
        },
        {
            unbindElement() {},
            storeCleanup() {}
        }
    );
    const previousError = console.error;
    console.error = () => {};

    try {
        binder.bindElement(element, {
            async fail() { throw new Error("falhou"); }
        });
        listener({ type: "click" });
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(reported.type, "bindifyeventerror");
        assert.equal(reported.detail.method, "fail");
        assert.match(reported.detail.error.message, /falhou/);
    } finally {
        console.error = previousError;
        globalThis.CustomEvent = PreviousCustomEvent;
    }
});

test("ComponentLoader serializa definições concorrentes do mesmo componente", async () => {
    const PreviousFetch = globalThis.fetch;
    const PreviousDOMParser = globalThis.DOMParser;
    const PreviousHTMLElement = globalThis.HTMLElement;
    const PreviousCustomElements = globalThis.customElements;

    const template = {
        getAttribute: name =>
            name === "data-component" ? "test-widget" : null
    };
    class FakeDOMParser {
        parseFromString() {
            return {
                querySelector: selector =>
                    selector === "template" ? template : null,
                querySelectorAll: () => []
            };
        }
    }
    class FakeHTMLElement {}
    const registry = new Map();
    let definitions = 0;
    globalThis.fetch = async () => ({
        ok: true,
        text: async () => "<template></template>"
    });
    globalThis.DOMParser = FakeDOMParser;
    globalThis.HTMLElement = FakeHTMLElement;
    globalThis.customElements = {
        get: name => registry.get(name),
        define(name, type) {
            definitions++;
            registry.set(name, type);
        },
        whenDefined: async () => {}
    };
    const link = {
        href: "http://localhost/test-widget.html",
        ownerDocument: { baseURI: "http://localhost/" },
        getAttribute(name) {
            if (name === "name") return "test-widget";
            return null;
        }
    };
    const loader = new ComponentLoader(
        () => ({}),
        new Observable()
    );

    try {
        await Promise.all([loader.load(link), loader.load(link)]);
        assert.equal(definitions, 1);
    } finally {
        globalThis.fetch = PreviousFetch;
        globalThis.DOMParser = PreviousDOMParser;
        globalThis.HTMLElement = PreviousHTMLElement;
        globalThis.customElements = PreviousCustomElements;
    }
});

test("cadastro exige CPF, nascimento, captura e consentimento biométrico", () => {
    const vm = new Observable().create(new CadastroPageViewModel());
    vm.assertFields();

    assert.equal(vm.validate(
        "cpf",
        "dataNascimento",
        "biometriaConfirmada",
        "consentimentoBiometria"
    ), false);

    vm.cpf = "529.982.247-25";
    vm.dataNascimento = "1990-05-20";
    vm.fotoBiometrica = new Blob(["imagem"], {
        type: "image/jpeg"
    });
    vm.biometriaConfirmada = true;
    vm.consentimentoBiometria = true;

    assert.equal(vm.validate(
        "cpf",
        "dataNascimento",
        "biometriaConfirmada",
        "consentimentoBiometria"
    ), true);
});

test("cadastro exige idade mínima de 13 anos completos", () => {
    const field = CadastroPageViewModel.fields.dataNascimento;
    const today = new Date();
    const format = date => [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
    const twelveYearsOld = new Date(
        today.getFullYear() - 13,
        today.getMonth(),
        today.getDate() + 1
    );
    const thirteenYearsOld = new Date(
        today.getFullYear() - 13,
        today.getMonth(),
        today.getDate()
    );

    assert.match(
        field.validate(
            format(twelveYearsOld),
            {},
            "dataNascimento"
        ).join(" "),
        /pelo menos 13 anos/
    );
    assert.deepEqual(
        field.validate(
            format(thirteenYearsOld),
            {},
            "dataNascimento"
        ),
        []
    );
});

test("cadastro biométrico inicia, captura em quadrado e encerra a câmera", async () => {
    const PreviousNavigator = globalThis.navigator;
    const PreviousURL = globalThis.URL;
    let stopped = false;
    let drawArguments = null;
    class FakeStream {
        getTracks() {
            return [{
                stop() { stopped = true; }
            }];
        }
    }
    const stream = new FakeStream();
    const video = {
        videoWidth: 1280,
        videoHeight: 720,
        srcObject: null,
        async play() {}
    };
    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
            clearRect() {},
            drawImage(...args) { drawArguments = args; }
        }),
        toBlob(callback) {
            callback(new Blob(["biometria"], {
                type: "image/jpeg"
            }));
        }
    };
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
            mediaDevices: {
                getUserMedia: async () => stream
            }
        }
    });
    globalThis.URL = {
        createObjectURL: () => "blob:biometria-preview",
        revokeObjectURL() {}
    };
    const vm = new Observable().create(new CadastroPageViewModel());
    vm.assertFields();
    vm.camera = video;
    vm.cameraCanvas = canvas;

    try {
        await vm.abrirCamera();
        assert.equal(vm.cameraAberta, true);
        assert.equal(vm.cameraPronta, true);
        assert.strictEqual(video.srcObject, stream);

        await vm.capturarFoto();

        assert.ok(vm.fotoBiometrica instanceof Blob);
        assert.equal(vm.fotoBiometrica.type, "image/jpeg");
        assert.equal(vm.fotoPreview, "blob:biometria-preview");
        assert.equal(vm.biometriaConfirmada, true);
        assert.deepEqual(
            drawArguments.slice(1),
            [280, 0, 720, 720, 0, 0, 512, 512]
        );
        assert.equal(canvas.width, 512);
        assert.equal(canvas.height, 512);
        assert.equal(vm.cameraAberta, false);
        assert.equal(stopped, true);
        assert.equal(video.srcObject, null);
    } finally {
        if (PreviousNavigator === undefined) {
            delete globalThis.navigator;
        } else {
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: PreviousNavigator
            });
        }
        globalThis.URL = PreviousURL;
    }
});

test("Field.blob preserva Blob e é sempre property-only", () => {
    const blob = new Blob(["arquivo"], {
        type: "application/octet-stream"
    });
    const field = Field.blob();

    assert.strictEqual(field.normalize(blob), blob);
    assert.deepEqual(field.validate(blob, {}, "arquivo"), []);
    assert.equal(field.normalize(null), null);
    assert.equal(field.usesAttribute, false);
    assert.equal(field.usesReflection, false);
    assert.throws(() => field.useAttribute(true), /property-only/);
    assert.match(
        field.validate("não é blob", {}, "arquivo").join(" "),
        /binário/
    );
});

test("data-element-ref atribui, impede duplicidade e restaura o valor", () => {
    const binder = new ElementRefBinder();
    const viewModel = { camera: null };
    const camera = {
        dataset: { elementRef: "camera" }
    };
    const duplicate = {
        dataset: { elementRef: "camera" }
    };

    binder.bindElement(camera, viewModel);
    assert.strictEqual(viewModel.camera, camera);
    assert.throws(
        () => binder.bindElement(duplicate, viewModel),
        /mais de um elemento/
    );
    binder.unbindElement(camera);
    assert.equal(viewModel.camera, null);
});

test("cadastro cria FormData com Blob biométrico pronto para fetch", () => {
    const vm = new CadastroPageViewModel();
    vm.nome = "Pessoa Teste";
    vm.email = "PESSOA@EXEMPLO.COM";
    vm.telefone = "(11) 99999-9999";
    vm.cpf = "529.982.247-25";
    vm.dataNascimento = "1990-05-20";
    vm.senha = "senha-segura";
    vm.fotoBiometrica = new Blob(["biometria"], {
        type: "image/jpeg"
    });

    const data = vm.criarDadosCadastro();

    assert.equal(data.get("nome"), "Pessoa Teste");
    assert.equal(data.get("email"), "pessoa@exemplo.com");
    assert.equal(data.get("cpf"), "529.982.247-25");
    assert.ok(data.get("fotoBiometrica") instanceof Blob);
    assert.equal(
        data.get("fotoBiometrica").name,
        "biometria-facial.jpg"
    );
});

test("cadastro oferece captura do dispositivo quando não há webcam", async () => {
    const PreviousNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
            mediaDevices: {
                getUserMedia: async () => {
                    const error = new Error("Requested device not found");
                    error.name = "NotFoundError";
                    throw error;
                }
            }
        }
    });
    const vm = new Observable().create(new CadastroPageViewModel());
    vm.assertFields();

    try {
        await vm.abrirCamera();
        assert.equal(vm.cameraAberta, false);
        assert.equal(vm.cameraFallbackDisponivel, true);
        assert.equal(
            vm.cameraErro,
            "Nenhuma webcam foi encontrada neste navegador."
        );
    } finally {
        if (PreviousNavigator === undefined) {
            delete globalThis.navigator;
        } else {
            Object.defineProperty(globalThis, "navigator", {
                configurable: true,
                value: PreviousNavigator
            });
        }
    }
});

test("data-class aceita vírgulas, ponto e vírgula e caminhos aninhados", () => {
    const bindings = new BindingParser().parseClasses(`
        loading: loading,
        error: hasErrors;
        pending: fieldState.email.pending;
    `);

    assert.deepEqual(bindings, [
        { className: "loading", source: "loading" },
        { className: "error", source: "hasErrors" },
        {
            className: "pending",
            source: "fieldState.email.pending"
        }
    ]);
    assert.throws(
        () => new BindingParser().parseClasses(
            "error: hasErrors; error: other"
        ),
        /mais de uma vez/
    );
});

test("data-class reage ao ViewModel, preserva classes estáticas e faz cleanup", () => {
    class ClassViewModel extends ViewModel {
        loading = false;
        hasErrors = false;
        fieldState = { email: { pending: false } };
    }

    const classes = new Set(["field", "error"]);
    const cleanup = [];
    const binder = {
        unbindElement() {},
        storeCleanup(_element, kind, callbacks) {
            assert.equal(kind, "class");
            cleanup.push(...callbacks);
        }
    };
    const element = {
        dataset: {
            class: `
                loading: loading;
                error: hasErrors;
                pending: fieldState.email.pending;
            `
        },
        classList: {
            contains(name) {
                return classes.has(name);
            },
            toggle(name, force) {
                if (force) classes.add(name);
                else classes.delete(name);
            }
        }
    };
    const viewModel = new Observable().create(new ClassViewModel());
    new ClassBinder(new BindingParser(), binder)
        .bindElement(element, viewModel);

    assert.deepEqual([...classes], ["field"]);
    viewModel.hasErrors = true;
    viewModel.fieldState.email.pending = true;
    assert.equal(classes.has("error"), true);
    assert.equal(classes.has("pending"), true);

    for (const dispose of cleanup) dispose();
    assert.deepEqual(new Set(classes), new Set(["field", "error"]));
});

test("data-class valida todas as sources antes de alterar o elemento", () => {
    const classes = new Set(["field"]);
    const element = {
        dataset: {
            class: "loading: loading; error: sourceInexistente"
        },
        classList: {
            contains: name => classes.has(name),
            toggle(name, force) {
                if (force) classes.add(name);
                else classes.delete(name);
            }
        }
    };
    const viewModel = new Observable().create({ loading: true });
    const classBinder = new ClassBinder(new BindingParser(), {
        unbindElement() {},
        storeCleanup() {}
    });

    assert.throws(
        () => classBinder.bindElement(element, viewModel),
        /sourceInexistente/
    );
    assert.deepEqual([...classes], ["field"]);
});

test("data-css-var publica custom properties reativas e restaura o estilo", () => {
    const values = new Map([
        ["--accent-color", { value: "#000", priority: "important" }]
    ]);
    const style = {
        getPropertyValue(name) {
            return values.get(name)?.value ?? "";
        },
        getPropertyPriority(name) {
            return values.get(name)?.priority ?? "";
        },
        setProperty(name, value, priority = "") {
            values.set(name, { value, priority });
        },
        removeProperty(name) {
            values.delete(name);
        }
    };
    const cleanup = [];
    const element = {
        dataset: {
            cssVar: `
                progress: progress;
                --accent-color: theme.accent;
                optional: optional;
            `
        },
        style
    };
    const viewModel = new Observable().create({
        progress: 25,
        theme: { accent: "#19734a" },
        optional: null
    });
    const binder = new CssVarBinder(new BindingParser(), {
        unbindElement() {},
        storeCleanup(_element, kind, callbacks) {
            assert.equal(kind, "css-var");
            cleanup.push(...callbacks);
        }
    });

    binder.bindElement(element, viewModel);
    assert.equal(style.getPropertyValue("--progress"), "25");
    assert.equal(style.getPropertyValue("--accent-color"), "#19734a");
    assert.equal(style.getPropertyValue("--optional"), "");

    viewModel.progress = 70;
    viewModel.theme.accent = "#b42318";
    assert.equal(style.getPropertyValue("--progress"), "70");
    assert.equal(style.getPropertyValue("--accent-color"), "#b42318");

    for (const dispose of cleanup) dispose();
    assert.equal(style.getPropertyValue("--progress"), "");
    assert.equal(style.getPropertyValue("--accent-color"), "#000");
    assert.equal(
        style.getPropertyPriority("--accent-color"),
        "important"
    );
});

test("data-css-var rejeita duplicidade e valida sources atomicamente", () => {
    const parser = new BindingParser();
    assert.throws(
        () => parser.parseCssVars(
            "progress: progress; --progress: other"
        ),
        /mais de uma vez/
    );

    let writes = 0;
    const element = {
        dataset: {
            cssVar: "progress: progress; missing: missing"
        },
        style: {
            getPropertyValue: () => "",
            getPropertyPriority: () => "",
            setProperty() { writes += 1; },
            removeProperty() { writes += 1; }
        }
    };
    const viewModel = new Observable().create({ progress: 10 });
    const binder = new CssVarBinder(parser, {
        unbindElement() {},
        storeCleanup() {}
    });

    assert.throws(
        () => binder.bindElement(element, viewModel),
        /missing/
    );
    assert.equal(writes, 0);
});
