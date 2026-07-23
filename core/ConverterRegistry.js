export class ConverterRegistry {
    #converters = new Map();

    register(name, converter) {
        const key = String(name ?? "").trim().toLowerCase();
        if (!key) {
            throw new TypeError("O converter precisa possuir um nome.");
        }
        const normalized = typeof converter === "function"
            ? { convert: converter }
            : converter;
        if (
            normalized == null ||
            typeof normalized !== "object" ||
            typeof normalized.convert !== "function"
        ) {
            throw new TypeError(
                "O converter precisa ser função ou implementar convert()."
            );
        }
        if (
            normalized.convertBack !== undefined &&
            typeof normalized.convertBack !== "function"
        ) {
            throw new TypeError("convertBack precisa ser uma função.");
        }
        this.#converters.set(key, Object.freeze({
            convert: normalized.convert,
            convertBack: normalized.convertBack ?? null
        }));
        return () => this.#converters.delete(key);
    }

    get(name) {
        const key = String(name ?? "").trim().toLowerCase();
        const converter = this.#converters.get(key);
        if (!converter) {
            throw new Error(`O converter '${name}' não foi registrado.`);
        }
        return converter;
    }

    has(name) {
        return this.#converters.has(
            String(name ?? "").trim().toLowerCase()
        );
    }
}
