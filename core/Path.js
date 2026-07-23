export class Path {
    static parts(path) {
        const parts = String(path).split(".").map(part => part.trim()).filter(Boolean);
        if (parts.length === 0) throw new Error("O caminho de propriedade não pode estar vazio.");
        const forbidden = new Set(["__proto__", "prototype", "constructor"]);
        const dangerous = parts.find(part => forbidden.has(part));
        if (dangerous) {
            throw new Error(
                `O segmento de caminho '${dangerous}' não é permitido.`
            );
        }
        return parts;
    }

    static has(root, path) {
        let current = root;
        for (const part of this.parts(path)) {
            if (current == null || !(part in Object(current))) return false;
            current = current[part];
        }
        return true;
    }

    static get(root, path) {
        let current = root;
        for (const part of this.parts(path)) {
            if (current == null) return undefined;
            current = current[part];
        }
        return current;
    }

    static set(root, path, value) {
        const parts = this.parts(path);
        const property = parts.pop();
        let owner = root;
        for (const part of parts) {
            if (owner == null || !(part in Object(owner))) throw new Error(`O caminho '${path}' não existe.`);
            owner = owner[part];
        }
        if (owner == null || !(property in Object(owner))) throw new Error(`A propriedade '${path}' não existe.`);
        owner[property] = value;
    }
}
