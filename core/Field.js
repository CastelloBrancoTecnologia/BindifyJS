const postalPatterns = new Map([
    ["BR", /^\d{5}-?\d{3}$/],
    ["US", /^\d{5}(?:-\d{4})?$/],
    ["CA", /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/i],
    ["GB", /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i],
    ["PT", /^\d{4}-?\d{3}$/],
    ["DE", /^\d{5}$/],
    ["FR", /^\d{5}$/]
]);

const documentValidators = new Map();

export class Field {
    #type;
    #options;
    #rules = [];
    #asyncRules = [];
    #required = false;
    #mask = null;
    #alsoChanges = new Set();
    #comparedFields = new Set();
    #useAttribute = null;
    #reflection = null;
    #attributeName = null;
    #hasValueIfEmpty = false;
    #valueIfEmpty;
    #hasTrueValue = false;
    #trueValue;
    #hasFalseValue = false;
    #falseValue;

    constructor(type, options = {}) {
        this.#type = type;
        this.#options = { ...options };
    }

    static string(options) { return new Field("string", options); }
    static number(options) { return new Field("number", options); }
    static integer(options) { return new Field("integer", options); }
    static money(currency = "BRL", options = {}) {
        return new Field("money", { currency, ...options });
    }
    static boolean(options) { return new Field("boolean", options); }
    static array(options) { return new Field("array", options); }
    static object(options) { return new Field("object", options); }
    static blob(options) { return new Field("blob", options); }
    static enum(values, options = {}) {
        return new Field("enum", { values: [...values], ...options });
    }
    static date(options) { return new Field("date", options); }
    static time(options) { return new Field("time", options); }
    static dateTime(options) { return new Field("datetime", options); }
    static email(options) { return new Field("email", options); }
    static url(options) { return new Field("url", options); }
    static uuid(options) { return new Field("uuid", options); }
    static phone(options = {}) { return new Field("phone", options); }
    static postalCode(country = "BR", options = {}) {
        return new Field("postal", { country, ...options });
    }
    static cpf(options) { return new Field("cpf", options); }
    static cnpj(options) { return new Field("cnpj", options); }
    static document(type, country, options = {}) {
        return new Field("document", { type, country, ...options });
    }
    static alsoChanges(...properties) {
        return Field.string().alsoChanges(...properties);
    }

    static registerPostalCode(country, pattern) {
        if (!(pattern instanceof RegExp)) {
            throw new TypeError("O padrão postal precisa ser RegExp.");
        }
        postalPatterns.set(String(country).toUpperCase(), pattern);
    }

    static registerDocument(country, type, validator) {
        if (typeof validator !== "function") {
            throw new TypeError("O validador de documento precisa ser função.");
        }
        documentValidators.set(
            `${String(country).toUpperCase()}:${String(type).toUpperCase()}`,
            validator
        );
    }

    get type() { return this.#type; }
    get options() { return Object.freeze({ ...this.#options }); }
    get hasMask() { return this.#mask != null; }
    get changedDependencies() {
        return Object.freeze([...this.#alsoChanges]);
    }
    get comparedFields() {
        return Object.freeze([...this.#comparedFields]);
    }
    get usesAttribute() {
        return this.#useAttribute ??
            !["array", "object", "blob"].includes(this.#type);
    }
    get usesReflection() {
        return this.#reflection ?? this.usesAttribute;
    }
    get configuredAttributeName() { return this.#attributeName; }
    get hasValueIfEmpty() { return this.#hasValueIfEmpty; }
    get emptyValue() { return this.#valueIfEmpty; }
    get hasTrueValue() { return this.#hasTrueValue; }
    get mappedTrueValue() { return this.#trueValue; }
    get hasFalseValue() { return this.#hasFalseValue; }
    get mappedFalseValue() { return this.#falseValue; }
    get hasAsyncRules() { return this.#asyncRules.length > 0; }
    get asyncHandlerNames() {
        return Object.freeze(
            this.#asyncRules
                .map(rule => typeof rule.handler === "string"
                    ? rule.handler
                    : null)
                .filter(Boolean)
        );
    }

    useAttribute(value = true) {
        if (typeof value !== "boolean") {
            throw new TypeError("useAttribute exige true ou false.");
        }
        if (value && this.#type === "blob") {
            throw new Error(
                "Fields blob são property-only e não aceitam atributos."
            );
        }
        if (!value && this.#reflection === true) {
            throw new Error(
                "useAttribute(false) é incompatível com useReflection(true)."
            );
        }
        if (!value && this.#attributeName != null) {
            throw new Error(
                "useAttribute(false) é incompatível com attributeName()."
            );
        }
        this.#useAttribute = value;
        return this;
    }

    useReflection(value = true) {
        if (typeof value !== "boolean") {
            throw new TypeError("useReflection exige true ou false.");
        }
        if (value && !this.usesAttribute) {
            throw new Error(
                "useReflection(true) exige useAttribute(true)."
            );
        }
        this.#reflection = value;
        return this;
    }

    attributeName(name) {
        const value = String(name ?? "").trim().toLowerCase();
        if (!this.usesAttribute) {
            throw new Error(
                "attributeName() exige useAttribute(true)."
            );
        }
        if (!value || !/^[a-z_][a-z0-9_.:-]*$/.test(value)) {
            throw new TypeError(
                `Nome de atributo inválido: '${String(name ?? "")}'.`
            );
        }
        this.#attributeName = value;
        return this;
    }

    valueIfEmpty(value) {
        this.#hasValueIfEmpty = true;
        this.#valueIfEmpty = value;
        return this;
    }

    trueValue(value) {
        this.#hasTrueValue = true;
        this.#trueValue = value;
        return this;
    }

    falseValue(value) {
        this.#hasFalseValue = true;
        this.#falseValue = value;
        return this;
    }

    alsoChanges(...properties) {
        const paths = properties.flat();
        if (paths.length === 0) {
            throw new TypeError("alsoChanges exige ao menos uma propriedade.");
        }

        for (const property of paths) {
            const path = String(property ?? "").trim();
            if (!path) {
                throw new TypeError(
                    "alsoChanges exige nomes de propriedades não vazios."
                );
            }
            this.#alsoChanges.add(path);
        }
        return this;
    }

    required(message = "Campo obrigatório.") {
        this.#required = true;
        this.#rules.unshift({
            name: "required",
            validate: value => !Field.isEmpty(value),
            message
        });
        return this;
    }

    minLength(length, message = `Informe pelo menos ${length} caracteres.`) {
        Field.assertNonNegativeInteger(length, "minLength");
        return this.rule("minLength", value => String(value).length >= length, message);
    }

    maxLength(length, message = `Informe no máximo ${length} caracteres.`) {
        Field.assertNonNegativeInteger(length, "maxLength");
        return this.rule("maxLength", value => String(value).length <= length, message);
    }

    min(minimum, message = `O valor mínimo é ${minimum}.`) {
        Field.assertFiniteNumber(minimum, "min");
        return this.rule("min", value => Number(value) >= minimum, message);
    }

    max(maximum, message = `O valor máximo é ${maximum}.`) {
        Field.assertFiniteNumber(maximum, "max");
        return this.rule("max", value => Number(value) <= maximum, message);
    }

    range(minimum, maximum, message = `Informe um valor entre ${minimum} e ${maximum}.`) {
        Field.assertFiniteNumber(minimum, "range");
        Field.assertFiniteNumber(maximum, "range");
        if (minimum > maximum) {
            throw new RangeError(
                "range exige mínimo menor ou igual ao máximo."
            );
        }
        return this.rule(
            "range",
            value => Number(value) >= minimum && Number(value) <= maximum,
            message
        );
    }

    minAge(age, message = `A idade mínima é ${age} anos.`) {
        Field.assertNonNegativeInteger(age, "minAge");
        return this.rule("minAge", value => Field.age(value) >= age, message);
    }

    maxAge(age, message = `A idade máxima é ${age} anos.`) {
        Field.assertNonNegativeInteger(age, "maxAge");
        return this.rule("maxAge", value => Field.age(value) <= age, message);
    }

    pattern(pattern, message = "Formato inválido.") {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        return this.rule("pattern", value => {
            regex.lastIndex = 0;
            return regex.test(String(value));
        }, message);
    }

    custom(validator, message = "Valor inválido.") {
        if (typeof validator !== "function") {
            throw new TypeError("Custom exige uma função de validação.");
        }
        return this.rule("custom", validator, message);
    }

    isEqualTo(
        otherField,
        message = "Os valores não coincidem."
    ) {
        return this.#fieldComparison(
            "isEqualTo",
            otherField,
            comparison => comparison === 0,
            message
        );
    }

    isNotEqualTo(
        otherField,
        message = "Os valores precisam ser diferentes."
    ) {
        return this.#fieldComparison(
            "isNotEqualTo",
            otherField,
            comparison => comparison !== 0,
            message
        );
    }

    isLessThan(
        otherField,
        message = "O valor precisa ser menor."
    ) {
        return this.#fieldComparison(
            "isLessThan",
            otherField,
            comparison => comparison != null && comparison < 0,
            message,
            true
        );
    }

    isLessThanOrEqualTo(
        otherField,
        message = "O valor precisa ser menor ou igual."
    ) {
        return this.#fieldComparison(
            "isLessThanOrEqualTo",
            otherField,
            comparison => comparison != null && comparison <= 0,
            message,
            true
        );
    }

    isGreaterThan(
        otherField,
        message = "O valor precisa ser maior."
    ) {
        return this.#fieldComparison(
            "isGreaterThan",
            otherField,
            comparison => comparison != null && comparison > 0,
            message,
            true
        );
    }

    isGreaterThanOrEqualTo(
        otherField,
        message = "O valor precisa ser maior ou igual."
    ) {
        return this.#fieldComparison(
            "isGreaterThanOrEqualTo",
            otherField,
            comparison => comparison != null && comparison >= 0,
            message,
            true
        );
    }

    #fieldComparison(
        ruleName,
        otherField,
        predicate,
        message,
        ordered = false
    ) {
        const path = String(otherField ?? "").trim();
        const apiName = ruleName[0].toUpperCase() + ruleName.slice(1);
        if (!path) {
            throw new TypeError(
                `${apiName} exige o nome de outro Field.`
            );
        }
        if (
            ordered &&
            ["boolean", "array", "object"].includes(this.#type)
        ) {
            throw new TypeError(
                `${apiName} não aceita Fields do tipo '${this.#type}'.`
            );
        }
        this.#comparedFields.add(path);
        return this.rule(
            ruleName,
            (value, viewModel, property, context) => {
                const candidates = context?.values;
                const otherValue = candidates != null &&
                    Object.prototype.hasOwnProperty.call(candidates, path)
                    ? candidates[path]
                    : Field.readPath(viewModel, path);
                return predicate(this.#compareValues(value, otherValue));
            },
            message
        );
    }

    #compareValues(left, right) {
        const normalize = value => {
            if (value == null) return value;
            switch (this.#type) {
                case "number":
                case "integer":
                case "money":
                    return Number(value);
                case "date": {
                    if (value instanceof Date) return value.getTime();
                    return Date.parse(`${String(value)}T00:00:00Z`);
                }
                case "datetime":
                    return value instanceof Date
                        ? value.getTime()
                        : Date.parse(String(value));
                case "time": {
                    const match = String(value).match(
                        /^(\d{2}):(\d{2})(?::(\d{2}))?$/
                    );
                    return match
                        ? Number(match[1]) * 3600 +
                            Number(match[2]) * 60 +
                            Number(match[3] ?? 0)
                        : Number.NaN;
                }
                case "array":
                case "object":
                case "boolean":
                    return value;
                default:
                    return String(value);
            }
        };

        const normalizedLeft = normalize(left);
        const normalizedRight = normalize(right);
        if (
            typeof normalizedLeft === "number" &&
            (!Number.isFinite(normalizedLeft) ||
                !Number.isFinite(normalizedRight))
        ) {
            return null;
        }
        if (Object.is(normalizedLeft, normalizedRight)) return 0;
        if (
            normalizedLeft == null || normalizedRight == null ||
            typeof normalizedLeft === "object" ||
            typeof normalizedRight === "object" ||
            typeof normalizedLeft === "boolean" ||
            typeof normalizedRight === "boolean"
        ) {
            return null;
        }
        return normalizedLeft < normalizedRight ? -1 : 1;
    }

    customAsync(handler, message = "Valor inválido.") {
        if (
            (typeof handler !== "string" || handler.trim() === "") &&
            typeof handler !== "function"
        ) {
            throw new TypeError(
                "customAsync exige o nome de um método do ViewModel ou uma função."
            );
        }
        this.#asyncRules.push({
            name: "customAsync",
            handler: typeof handler === "string"
                ? handler.trim()
                : handler,
            message
        });
        return this;
    }

    mask(pattern, options = {}) {
        if (typeof pattern !== "string" || pattern.length === 0) {
            throw new TypeError("mask exige um padrão não vazio.");
        }
        this.#mask = { pattern, placeholder: options.placeholder ?? null };
        return this;
    }

    rule(name, validate, message) {
        this.#rules.push({ name, validate, message });
        return this;
    }

    normalize(value) {
        if (Field.isEmpty(value)) {
            if (this.#type === "blob") {
                return this.#hasValueIfEmpty ? this.#valueIfEmpty : null;
            }
            return this.#hasValueIfEmpty ? this.#valueIfEmpty : "";
        }
        switch (this.#type) {
            case "number":
            case "integer":
            case "money": {
                const number = Field.parseNumber(
                    value,
                    this.#options.locale
                );
                return this.#type === "integer" &&
                    Number.isFinite(number)
                    ? Math.trunc(number)
                    : number;
            }
            case "boolean":
                return value === true || value === "true" ||
                    value === 1 || value === "1";
            case "array":
            case "object":
            case "blob":
            case "enum":
                return value;
            default:
                return this.applyMask(String(value));
        }
    }

    format(value) {
        if (Field.isEmpty(value)) return "";
        if (this.#type === "money" && Number.isFinite(Number(value))) {
            return new Intl.NumberFormat(this.#options.locale, {
                style: "currency",
                currency: this.#options.currency
            }).format(Number(value));
        }
        return this.applyMask(String(value));
    }

    applyMask(value) {
        if (!this.#mask || Field.isEmpty(value)) return value;
        const tokens = { "#": /\d/, "A": /[A-Za-zÀ-ÿ]/, "*": /[A-Za-zÀ-ÿ\d]/ };
        const input = String(value);
        let sourceIndex = 0;
        let output = "";

        for (const maskCharacter of this.#mask.pattern) {
            const token = tokens[maskCharacter];
            if (!token) {
                if (sourceIndex < input.length) output += maskCharacter;
                if (input[sourceIndex] === maskCharacter) sourceIndex++;
                continue;
            }

            while (sourceIndex < input.length && !token.test(input[sourceIndex])) {
                sourceIndex++;
            }
            if (sourceIndex >= input.length) break;
            output += input[sourceIndex++];
        }
        return output;
    }

    validate(value, viewModel, property, context = {}) {
        if (Field.isEmpty(value)) {
            if (!this.#required) return [];
            const required = this.#rules.find(rule => rule.name === "required");
            return [typeof required?.message === "function"
                ? required.message(value, viewModel, property)
                : required?.message ?? "Campo obrigatório."];
        }
        const errors = [];
        const typeError = this.validateType(value);
        if (typeError) errors.push(typeError);

        if (!typeError) {
            for (const rule of this.#rules) {
                let valid;
                try {
                    valid = rule.validate(
                        value,
                        viewModel,
                        property,
                        context
                    );
                } catch (error) {
                    valid = false;
                    if (typeof viewModel?.handleError === "function") {
                        Promise.resolve(viewModel.handleError(error, {
                            phase: "validation",
                            property,
                            rule: rule.name
                        })).catch(boundaryError => {
                            console.error(
                                "[BindifyJS/error-boundary]",
                                boundaryError
                            );
                        });
                    } else {
                        console.error(
                            `[BindifyJS/validation/${property}]`,
                            error
                        );
                    }
                }
                if (valid instanceof Promise) {
                    throw new TypeError("Validadores assíncronos devem usar customAsync.");
                }
                if (!valid) errors.push(
                    typeof rule.message === "function"
                        ? rule.message(value, viewModel, property)
                        : rule.message
                );
            }
        }
        return [...new Set(errors.filter(Boolean))];
    }

    async validateAsync(value, viewModel, property, context = {}) {
        const errors = this.validate(value, viewModel, property, context);
        if (errors.length > 0 || Field.isEmpty(value)) return errors;

        for (const rule of this.#asyncRules) {
            context.signal?.throwIfAborted?.();
            let validator;
            if (typeof rule.handler === "string") {
                validator = viewModel[rule.handler];
                if (typeof validator !== "function") {
                    throw new Error(
                        `O método assíncrono '${rule.handler}' não existe no ViewModel.`
                    );
                }
            } else {
                validator = rule.handler;
            }

            const valid = typeof rule.handler === "string"
                ? await validator.call(
                    viewModel,
                    value,
                    property,
                    context
                )
                : await validator(
                    value,
                    viewModel,
                    property,
                    context
                );
            context.signal?.throwIfAborted?.();
            if (!valid) {
                errors.push(
                    typeof rule.message === "function"
                        ? rule.message(value, viewModel, property)
                        : rule.message
                );
            }
        }

        return [...new Set(errors.filter(Boolean))];
    }

    validateType(value) {
        if (Field.isEmpty(value)) return null;
        const text = String(value).trim();
        const number = Number(value);
        switch (this.#type) {
            case "string": return typeof value === "string" ? null : "Informe um texto válido.";
            case "number":
            case "money": return Number.isFinite(number) ? null : "Informe um número válido.";
            case "integer": return Number.isInteger(number) ? null : "Informe um número inteiro.";
            case "boolean": return typeof value === "boolean" ? null : "Informe um valor lógico.";
            case "array": return Array.isArray(value) ? null : "Informe uma lista válida.";
            case "object": return value != null && typeof value === "object" && !Array.isArray(value) ? null : "Informe um objeto válido.";
            case "blob": return typeof Blob !== "undefined" && value instanceof Blob ? null : "Informe um arquivo binário válido.";
            case "enum": return this.#options.values.includes(value) ? null : "Selecione uma opção válida.";
            case "date": return /^\d{4}-\d{2}-\d{2}$/.test(text) && Field.validDate(text) ? null : "Informe uma data válida.";
            case "time": return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text) ? null : "Informe um horário válido.";
            case "datetime": return !Number.isNaN(Date.parse(text)) ? null : "Informe data e horário válidos.";
            case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? null : "Informe um e-mail válido.";
            case "url": { try { new URL(text); return null; } catch { return "Informe uma URL válida."; } }
            case "uuid": return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? null : "Informe um UUID válido.";
            case "phone": return this.validatePhone(text) ? null : "Informe um telefone válido.";
            case "postal": return this.validatePostal(text) ? null : "Informe um código postal válido.";
            case "cpf": return Field.validCPF(text) ? null : "Informe um CPF válido.";
            case "cnpj": return Field.validCNPJ(text) ? null : "Informe um CNPJ válido.";
            case "document": return this.validateDocument(text) ? null : "Informe um documento válido.";
            default: return null;
        }
    }

    validatePhone(value) {
        const extension = value.match(/(?:\s*(?:x|ext\.?|ramal)\s*(\d{1,8}))$/i);
        const main = extension ? value.slice(0, extension.index).trim() : value;
        if (extension && this.#options.extension === false) return false;
        if (!/^[+\d\s().-]+$/.test(main)) return false;
        const digits = main.replace(/\D/g, "");
        const minimum = this.#options.minDigits ?? 7;
        const maximum = this.#options.maxDigits ?? 15;
        if (digits.length < minimum || digits.length > maximum) return false;
        if (this.#options.requireCountryCode && !main.startsWith("+")) return false;
        if (this.#options.countryCode === false && main.startsWith("+")) return false;
        if (this.#options.requireAreaCode && digits.length < 10) return false;
        return true;
    }

    validatePostal(value) {
        const country = String(this.#options.country ?? "BR").toUpperCase();
        const pattern = postalPatterns.get(country);
        if (!pattern) return false;
        pattern.lastIndex = 0;
        return pattern.test(value.trim());
    }

    validateDocument(value) {
        const key = `${String(this.#options.country).toUpperCase()}:${String(this.#options.type).toUpperCase()}`;
        const validator = documentValidators.get(key);
        return validator ? Boolean(validator(value)) : false;
    }

    static isEmpty(value) {
        return value == null || (typeof value === "string" && value.trim() === "");
    }

    static assertFiniteNumber(value, method) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new TypeError(`${method} exige um número finito.`);
        }
    }

    static assertNonNegativeInteger(value, method) {
        if (!Number.isInteger(value) || value < 0) {
            throw new TypeError(
                `${method} exige um inteiro maior ou igual a zero.`
            );
        }
    }

    static readPath(root, path) {
        let current = root;
        for (const part of String(path).split(".").filter(Boolean)) {
            if (current == null || !(part in Object(current))) {
                return undefined;
            }
            current = current[part];
        }
        return current;
    }

    static parseNumber(value, locale) {
        if (typeof value === "number") return value;
        const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
        const group = parts.find(part => part.type === "group")?.value ?? ",";
        const decimal = parts.find(part => part.type === "decimal")?.value ?? ".";
        const normalized = String(value)
            .replace(new RegExp(`\\${group}`, "g"), "")
            .replace(decimal, ".")
            .replace(/[^\d+\-.]/g, "");
        return Number(normalized);
    }

    static validDate(value) {
        const [year, month, day] = String(value).split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }

    static age(value) {
        const birth = new Date(`${value}T00:00:00`);
        if (Number.isNaN(birth.getTime())) return Number.NaN;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (
            today.getMonth() < birth.getMonth() ||
            (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
        ) age--;
        return age;
    }

    static validCPF(value) {
        const digits = String(value).replace(/\D/g, "");
        if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
        const check = size => {
            let sum = 0;
            for (let index = 0; index < size; index++) sum += Number(digits[index]) * (size + 1 - index);
            const result = (sum * 10) % 11;
            return (result === 10 ? 0 : result) === Number(digits[size]);
        };
        return check(9) && check(10);
    }

    static validCNPJ(value) {
        const digits = String(value).replace(/\D/g, "");
        if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
        const calculate = length => {
            let position = length - 7;
            let sum = 0;
            for (let index = 0; index < length; index++) {
                sum += Number(digits[index]) * position--;
                if (position < 2) position = 9;
            }
            const result = sum % 11;
            return result < 2 ? 0 : 11 - result;
        };
        return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
    }
}

Field.registerDocument("BR", "CPF", Field.validCPF);
Field.registerDocument("BR", "CNPJ", Field.validCNPJ);
