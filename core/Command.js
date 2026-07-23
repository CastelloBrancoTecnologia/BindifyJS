export class Command {
    #execute;
    #canExecute;
    #subscribers = new Set();
    #executions = 0;

    constructor(execute, options = {}) {
        if (typeof execute !== "function") {
            throw new TypeError("Command exige uma função execute.");
        }
        if (
            options.canExecute !== undefined &&
            typeof options.canExecute !== "function"
        ) {
            throw new TypeError("canExecute precisa ser uma função.");
        }
        this.#execute = execute;
        this.#canExecute = options.canExecute ?? (() => true);
        this.allowConcurrent = options.allowConcurrent === true;
        this.observes = Object.freeze(
            [...new Set(options.observes ?? [])].map(path => {
                const value = String(path ?? "").trim();
                if (!value) {
                    throw new TypeError(
                        "Command.observes exige caminhos não vazios."
                    );
                }
                return value;
            })
        );
    }

    get pending() {
        return this.#executions > 0;
    }

    canExecute(parameter = undefined, context = {}) {
        if (this.pending && !this.allowConcurrent) return false;
        return this.#canExecute(parameter, context) === true;
    }

    async execute(parameter = undefined, context = {}) {
        if (!this.canExecute(parameter, context)) return undefined;
        this.#executions++;
        this.notifyCanExecuteChanged();
        try {
            return await this.#execute(parameter, context);
        } finally {
            this.#executions--;
            this.notifyCanExecuteChanged();
        }
    }

    notifyCanExecuteChanged() {
        for (const subscriber of [...this.#subscribers]) {
            subscriber(this);
        }
    }

    subscribe(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("O subscriber do Command precisa ser função.");
        }
        this.#subscribers.add(callback);
        return () => this.#subscribers.delete(callback);
    }
}
