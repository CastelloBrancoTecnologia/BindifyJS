import { Path } from "./Path.js";

export class TemplateBinder {
    #states = new WeakMap();
    #conditionStates = new WeakMap();

    bindTree(root, viewModel) {
        const templates = [];

        if (
            root instanceof HTMLTemplateElement &&
            root.hasAttribute("data-for")
        ) {
            templates.push(root);
        }

        templates.push(...root.querySelectorAll("template[data-for]"));

        for (const template of templates) {
            this.bind(template, viewModel);
        }

        const conditions = [];
        if (
            root instanceof Element &&
            root.matches("[data-if], [data-else]")
        ) {
            conditions.push(root);
        }
        conditions.push(...root.querySelectorAll(
            "[data-if], [data-else]"
        ));

        for (const element of conditions) {
            this.bindCondition(element, viewModel);
        }
    }

    bindCondition(element, viewModel) {
        this.unbindCondition(element);

        const isElse = element.hasAttribute("data-else");
        const source = element.getAttribute(
            isElse ? "data-else" : "data-if"
        )?.trim();

        if (!source || !Path.has(viewModel, source)) {
            throw new Error(
                `A condição '${source ?? ""}' não existe no ViewModel.`
            );
        }

        const update = value => {
            const visible = isElse ? !Boolean(value) : Boolean(value);
            element.hidden = !visible;
        };

        const unsubscribe = viewModel.subscribe(source, update);
        this.#conditionStates.set(element, unsubscribe);
        update(Path.get(viewModel, source));
    }

    bind(template, viewModel) {
        this.unbind(template);

        const expression = template.dataset.for?.trim() ?? "";
        const match = expression.match(
            /^([A-Za-z_$][\w$]*)\s+(?:in|of)\s+(.+)$/
        );

        const alias = match?.[1] ?? "item";
        const source = (match?.[2] ?? expression).trim();

        if (!source) {
            throw new Error(
                `data-for inválido: '${expression}'. ` +
                "Use: caminho.do.viewModel"
            );
        }
        if (!Path.has(viewModel, source)) {
            throw new Error(
                `A coleção '${source}' não existe no ViewModel.`
            );
        }

        const renderedNodes = [];
        const viewsByKey = new Map();
        const render = value => {
            if (value == null) {
                for (const view of viewsByKey.values()) {
                    for (const node of view.nodes) {
                        node.remove();
                    }
                }
                viewsByKey.clear();
                renderedNodes.splice(0);
                return;
            }

            if (!Array.isArray(value)) {
                throw new TypeError(
                    `data-for exige um array em '${source}'.`
                );
            }

            const increment = this.parseIntegerOption(
                template.dataset.forIncrement,
                1,
                "data-for-increment",
                { disallowZero: true }
            );
            const startIndex = this.parseIntegerOption(
                template.dataset.forStartIndex,
                increment < 0 ? value.length - 1 : 0,
                "data-for-start-index",
                { minimum: 0 }
            );
            const limit = this.parseIntegerOption(
                template.dataset.forLimit,
                value.length,
                "data-for-limit",
                { minimum: 0 }
            );
            const keyPath = template.dataset.forKey?.trim() || null;

            let renderedIndex = 0;
            const nextKeys = new Set();
            const orderedViews = [];
            for (
                let index = startIndex;
                index >= 0 &&
                index < value.length &&
                renderedIndex < limit;
                index += increment
            ) {
                const item = value[index];
                const context = {
                    item,
                    [alias]: item,
                    $index: index,
                    $number: renderedIndex + 1
                };
                const key = this.resolveKey(
                    item,
                    alias,
                    keyPath,
                    context,
                    index
                );

                if (nextKeys.has(key)) {
                    throw new Error(
                        `data-for-key produziu a chave duplicada ` +
                        `'${String(key)}'.`
                    );
                }

                nextKeys.add(key);

                let view = viewsByKey.get(key);
                if (!view) {
                    view = this.createView(template, context);
                    viewsByKey.set(key, view);
                } else {
                    view.update(context);
                }

                orderedViews.push(view);
                renderedIndex++;
            }

            for (const [key, view] of [...viewsByKey]) {
                if (nextKeys.has(key)) {
                    continue;
                }

                for (const node of view.nodes) {
                    node.remove();
                }
                viewsByKey.delete(key);
            }

            renderedNodes.splice(0);
            for (const view of orderedViews) {
                for (const node of view.nodes) {
                    template.before(node);
                    renderedNodes.push(node);
                }
            }
        };

        const unsubscribe = viewModel.subscribe(source, render);
        this.#states.set(template, { renderedNodes, unsubscribe });
        render(Path.get(viewModel, source));
    }

    resolveKey(item, alias, keyPath, context, index) {
        if (!keyPath) {
            return index;
        }

        if (Path.has(context, keyPath)) {
            const key = Path.get(context, keyPath);
            if (key != null) {
                return key;
            }
        }

        if (
            item != null &&
            (typeof item === "object" || typeof item === "function") &&
            Path.has(item, keyPath)
        ) {
            const key = Path.get(item, keyPath);
            if (key != null) {
                return key;
            }
        }

        throw new Error(
            `data-for-key '${keyPath}' não existe no item '${alias}' ` +
            `do índice ${index}.`
        );
    }

    createView(template, initialContext) {
        const fragment = template.content.cloneNode(true);
        const bindings = [];
        const walker = document.createTreeWalker(
            fragment,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
        );

        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.includes("${")) {
                    bindings.push({
                        kind: "text",
                        node,
                        template: node.textContent
                    });
                }
                continue;
            }

            if (
                node.hasAttribute("data-if") ||
                node.hasAttribute("data-else")
            ) {
                const isElse = node.hasAttribute("data-else");
                const source = node.getAttribute(
                    isElse ? "data-else" : "data-if"
                )?.trim();

                if (!source) {
                    throw new Error(
                        "A condição local do data-for não pode estar vazia."
                    );
                }

                bindings.push({
                    kind: "condition",
                    node,
                    source,
                    isElse
                });
                node.removeAttribute(isElse ? "data-else" : "data-if");
            }

            for (const attribute of [...node.attributes]) {
                if (!attribute.value.includes("${")) {
                    continue;
                }
                this.assertSafeInterpolatedAttribute(attribute.name);
                bindings.push({
                    kind: "attribute",
                    attribute,
                    template: attribute.value
                });
            }
        }

        const update = context => {
            for (const binding of bindings) {
                if (binding.kind === "text") {
                    binding.node.textContent = this.interpolateValue(
                        binding.template,
                        context
                    );
                } else if (binding.kind === "attribute") {
                    const value = this.interpolateValue(
                        binding.template,
                        context
                    );
                    this.assertSafeAttributeValue(
                        binding.attribute.name,
                        value
                    );
                    binding.attribute.value = value;
                } else {
                    if (!Path.has(context, binding.source)) {
                        throw new Error(
                            `A condição local '${binding.source}' ` +
                            "não existe no item do data-for."
                        );
                    }
                    const condition = Boolean(
                        Path.get(context, binding.source)
                    );
                    const visible = binding.isElse
                        ? !condition
                        : condition;
                    binding.node.hidden = !visible;
                }
            }
        };

        update(initialContext);
        return { nodes: [...fragment.childNodes], update };
    }

    parseIntegerOption(
        rawValue,
        defaultValue,
        attributeName,
        { minimum = null, disallowZero = false }
    ) {
        if (rawValue == null || rawValue.trim() === "") {
            return defaultValue;
        }

        const value = Number(rawValue);
        if (!Number.isInteger(value)) {
            throw new Error(
                `${attributeName} precisa ser um inteiro.`
            );
        }

        if (minimum != null && value < minimum) {
            throw new Error(
                `${attributeName} precisa ser maior ou igual a ${minimum}.`
            );
        }

        if (disallowZero && value === 0) {
            throw new Error(`${attributeName} não pode ser zero.`);
        }

        return value;
    }

    interpolateValue(value, context) {
        const pattern = /\$\{\s*([^{}]+?)\s*\}/g;
        return String(value).replace(
            pattern,
            (_, path) => Path.get(context, path.trim()) ?? ""
        );
    }

    assertSafeInterpolatedAttribute(name) {
        const normalized = String(name).toLowerCase();
        if (
            normalized.startsWith("on") ||
            normalized === "srcdoc" ||
            normalized === "style"
        ) {
            throw new Error(
                `Interpolação não permitida no atributo '${name}'.`
            );
        }
    }

    assertSafeAttributeValue(name, value) {
        this.assertSafeInterpolatedAttribute(name);
        const normalized = String(name).toLowerCase();
        const urlAttributes = new Set([
            "action",
            "formaction",
            "href",
            "poster",
            "src",
            "xlink:href"
        ]);
        if (!urlAttributes.has(normalized)) return;

        const protocol = String(value).trim()
            .match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
        if (protocol && !["http", "https", "mailto", "tel"].includes(protocol)) {
            throw new Error(
                `Protocolo '${protocol}:' não permitido em '${name}'.`
            );
        }
    }

    unbind(template) {
        const state = this.#states.get(template);
        if (!state) {
            return;
        }

        state.unsubscribe();
        for (const node of state.renderedNodes) {
            node.remove();
        }
        this.#states.delete(template);
    }

    unbindCondition(element) {
        const unsubscribe = this.#conditionStates.get(element);
        if (!unsubscribe) {
            return;
        }

        unsubscribe();
        this.#conditionStates.delete(element);
    }

    unbindTree(root) {
        if (root instanceof HTMLTemplateElement) {
            this.unbind(root);
        }

        for (const template of root.querySelectorAll?.(
            "template[data-for]"
        ) ?? []) {
            this.unbind(template);
        }

        if (root instanceof Element) {
            this.unbindCondition(root);
        }
        for (const element of root.querySelectorAll?.(
            "[data-if], [data-else]"
        ) ?? []) {
            this.unbindCondition(element);
        }
    }
}
