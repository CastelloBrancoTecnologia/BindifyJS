export class Application {
    #plugins = [];
    #configuration = Object.freeze({
        development: true,
        exposeViewModel: true,
        detailedErrors: true
    });

    get configuration() {
        return this.#configuration;
    }

    configure(options = {}) {
        if (options == null || typeof options !== "object") {
            throw new TypeError("configure exige um objeto.");
        }
        const development =
            options.development ?? this.#configuration.development;
        if (typeof development !== "boolean") {
            throw new TypeError("development precisa ser booleano.");
        }
        const productionDefault = development ? true : false;
        const exposeViewModel = options.exposeViewModel ??
            (options.development === undefined
                ? this.#configuration.exposeViewModel
                : productionDefault);
        const detailedErrors = options.detailedErrors ??
            (options.development === undefined
                ? this.#configuration.detailedErrors
                : productionDefault);
        if (
            typeof exposeViewModel !== "boolean" ||
            typeof detailedErrors !== "boolean"
        ) {
            throw new TypeError(
                "exposeViewModel e detailedErrors precisam ser booleanos."
            );
        }
        this.#configuration = Object.freeze({
            development,
            exposeViewModel,
            detailedErrors
        });
        return this.#configuration;
    }

    use(plugin) {
        if (plugin == null || typeof plugin !== "object") {
            throw new TypeError("use exige um plugin.");
        }
        const hooks = [
            "beforeStart",
            "afterStart",
            "beforeStop",
            "afterStop",
            "onError"
        ];
        if (!hooks.some(hook => typeof plugin[hook] === "function")) {
            throw new TypeError(
                "O plugin precisa implementar ao menos um hook conhecido."
            );
        }
        this.#plugins.push(plugin);
        return () => {
            const index = this.#plugins.indexOf(plugin);
            if (index >= 0) this.#plugins.splice(index, 1);
        };
    }

    async run(hook, context) {
        for (const plugin of [...this.#plugins]) {
            const handler = plugin[hook];
            if (typeof handler === "function") {
                await handler.call(plugin, context);
            }
        }
    }

    async reportError(error, context) {
        let handled = false;
        for (const plugin of [...this.#plugins]) {
            if (typeof plugin.onError !== "function") continue;
            try {
                if (
                    await plugin.onError.call(
                        plugin,
                        error,
                        context
                    ) === true
                ) {
                    handled = true;
                }
            } catch (pluginError) {
                console.error(
                    "[BindifyJS/plugin/onError]",
                    pluginError
                );
            }
        }
        return handled;
    }
}
