import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import * as library from "../BindifyJS.js";

const declarationUrl = new URL("../BindifyJS.d.ts", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("BindifyJS.d.ts declara todas as exportações JavaScript", async () => {
    const declaration = await readFile(declarationUrl, "utf8");
    const exports = Object.keys(library)
        .filter(name => name !== "default");

    for (const name of exports) {
        assert.match(
            declaration,
            new RegExp(`export class ${name}\\b`),
            `A exportação '${name}' não está declarada.`
        );
    }
    assert.match(declaration, /export default api;/);
});

test("BindifyJS.d.ts acompanha a superfície principal da API", async () => {
    const declaration = await readFile(declarationUrl, "utf8");
    const expectedMethods = {
        Field: [
            "string", "number", "boolean", "array", "object", "blob",
            "required", "custom", "customAsync", "alsoChanges",
            "isEqualTo", "isNotEqualTo", "isLessThan",
            "isLessThanOrEqualTo", "isGreaterThan",
            "isGreaterThanOrEqualTo", "useAttribute", "useReflection",
            "attributeName", "valueIfEmpty", "trueValue", "falseValue"
        ],
        ViewModel: [
            "use", "releaseResources", "handleError", "clearError",
            "update",
            "clearErrors", "cancelPending", "reset", "acceptChanges",
            "validate", "validateAsync", "initialize", "onError", "dispose"
        ],
        Component: [
            "emit", "hide", "show", "connected", "disconnected"
        ],
        Bindify: [
            "start", "stop", "bindDocument", "unbindDocument",
            "observeBindings", "makeObservable", "loadComponents",
            "use", "configure", "registerConverter"
        ],
        Command: [
            "canExecute", "execute", "notifyCanExecuteChanged",
            "subscribe"
        ],
        ClassBinder: ["bindElement"],
        CssVarBinder: ["bindElement"],
        BindingParser: ["parseClasses", "parseCssVars"],
        Application: [
            "configure", "use", "run", "reportError"
        ],
        ConverterRegistry: [
            "register", "get", "has"
        ]
    };

    for (const [className, methods] of Object.entries(expectedMethods)) {
        const classBody = declaration.slice(
            declaration.indexOf(`export class ${className}`)
        );
        for (const method of methods) {
            assert.match(
                classBody,
                new RegExp(`\\b${method}(?:<[^;{]+>)?\\s*\\(`),
                `${className}.${method} não está declarado.`
            );
        }
    }
});

test("package.json publica BindifyJS.d.ts como types", async () => {
    const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
    assert.equal(packageJson.types, "./BindifyJS.d.ts");
    assert.equal(packageJson.exports["."].types, "./BindifyJS.d.ts");
    assert.equal(packageJson.exports["."].import, "./BindifyJS.js");
});
