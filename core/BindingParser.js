import { Path } from "./Path.js";

export class BindingParser {
    parseMany(text, parser, attributeName) {
        const source = String(text ?? "").trim();
        const blocks = [...source.matchAll(/\{([^{}]+)\}/g)]
            .map(match => match[1]);

        if (blocks.length === 0) {
            return [parser.call(this, source)];
        }

        const remainder = source.replace(/\{[^{}]+\}/g, "").trim();
        if (remainder) {
            throw new Error(
                `${attributeName} contém texto fora dos blocos { ... }.`
            );
        }

        return blocks.map(block => parser.call(this, block));
    }

    parse(text, attributeName) {
        if (typeof text !== "string" || text.trim() === "") throw new Error(`${attributeName} não pode estar vazio.`);
        const result = Object.create(null);
        for (const part of text.split(";")) {
            const item = part.trim();
            if (!item) continue;
            const separator = item.indexOf(":");
            if (separator < 1) throw new Error(`Trecho inválido em ${attributeName}: '${item}'. Use chave: valor;.`);
            const key = item.slice(0, separator).trim().toLowerCase();
            const value = item.slice(separator + 1).trim();
            if (!value) throw new Error(`O valor de '${key}' está vazio.`);
            result[key] = value;
        }
        return result;
    }

    parseBinding(text) {
        const values = this.parse(text, "data-bind");
        const target = values.target;
        const source = values.source;
        const mode = values.mode?.toLowerCase() ?? null;
        const when = values.when?.toLowerCase() ?? null;
        const converter = values.converter?.trim() ?? null;
        const converterParameter =
            values.converterparameter ?? null;
        if (!target) throw new Error("data-bind exige 'target'.");
        if (!source) throw new Error("data-bind exige 'source'.");
        const validModes = new Set(["oneway", "twoway", "onetime", "onewaytosource"]);
        if (mode && !validModes.has(mode)) throw new Error(`Modo de binding desconhecido: '${mode}'.`);
        const validWhen = new Set(["contentchanged", "lostfocus", "groupcommit"]);
        if (when && !validWhen.has(when)) {
            throw new Error(`Momento de binding desconhecido: '${values.when}'.`);
        }
        return Object.freeze({
            target,
            source,
            mode,
            when,
            converter,
            converterParameter
        });
    }

    parseBindings(text) {
        return Object.freeze(
            this.parseMany(text, this.parseBinding, "data-bind")
        );
    }

    parseEvent(text) {
        const values = this.parse(text, "data-event");
        const event = values.event?.replace(/^on/i, "");
        const method = values.method;
        if (!event) throw new Error("data-event exige 'event'.");
        if (!method) throw new Error("data-event exige 'method'.");
        return Object.freeze({ event, method });
    }

    parseEvents(text) {
        return Object.freeze(
            this.parseMany(text, this.parseEvent, "data-event")
        );
    }

    parseItems(text) {
        const values = this.parse(text, "data-bind-items");
        if (!values.source) {
            throw new Error("data-bind-items exige 'source'.");
        }

        const supported = new Set([
            "source", "text", "value", "key", "emptytext", "emptyvalue"
        ]);
        for (const key of Object.keys(values)) {
            if (!supported.has(key)) {
                throw new Error(
                    `Opção desconhecida em data-bind-items: '${key}'.`
                );
            }
        }

        return Object.freeze({
            source: values.source,
            text: values.text ?? null,
            value: values.value ?? null,
            key: values.key ?? null,
            emptyText: values.emptytext ?? null,
            emptyValue: values.emptyvalue ?? ""
        });
    }

    parseClasses(text) {
        if (typeof text !== "string" || text.trim() === "") {
            throw new Error("data-class não pode estar vazio.");
        }
        const bindings = [];
        const classes = new Set();

        for (const declaration of text.split(/[;,]/)) {
            const item = declaration.trim();
            if (!item) continue;
            const separator = item.indexOf(":");
            if (separator < 1) {
                throw new Error(
                    `Trecho inválido em data-class: '${item}'. Use classe: source;.`
                );
            }
            const className = item.slice(0, separator).trim();
            const source = item.slice(separator + 1).trim();
            if (!/^[^\s:;,]+$/.test(className)) {
                throw new TypeError(
                    `Nome de classe inválido em data-class: '${className}'.`
                );
            }
            if (!source) {
                throw new Error(
                    `A source da classe '${className}' está vazia.`
                );
            }
            if (classes.has(className)) {
                throw new Error(
                    `A classe '${className}' foi declarada mais de uma vez em data-class.`
                );
            }
            Path.parts(source);
            classes.add(className);
            bindings.push(Object.freeze({
                className,
                source
            }));
        }
        if (bindings.length === 0) {
            throw new Error("data-class não possui declarações.");
        }
        return Object.freeze(bindings);
    }

    parseCssVars(text) {
        if (typeof text !== "string" || text.trim() === "") {
            throw new Error("data-css-var não pode estar vazio.");
        }
        const bindings = [];
        const names = new Set();

        for (const declaration of text.split(/[;,]/)) {
            const item = declaration.trim();
            if (!item) continue;
            const separator = item.indexOf(":");
            if (separator < 1) {
                throw new Error(
                    `Trecho inválido em data-css-var: '${item}'. Use nome: source;.`
                );
            }
            const rawName = item.slice(0, separator).trim();
            const name = rawName.replace(/^--/, "");
            const source = item.slice(separator + 1).trim();
            if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name)) {
                throw new TypeError(
                    `Nome inválido em data-css-var: '${rawName}'.`
                );
            }
            if (!source) {
                throw new Error(
                    `A source da variável '${rawName}' está vazia.`
                );
            }
            if (names.has(name)) {
                throw new Error(
                    `A variável '--${name}' foi declarada mais de uma vez em data-css-var.`
                );
            }
            Path.parts(source);
            names.add(name);
            bindings.push(Object.freeze({ name, source }));
        }
        if (bindings.length === 0) {
            throw new Error("data-css-var não possui declarações.");
        }
        return Object.freeze(bindings);
    }
}
