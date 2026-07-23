import { Command } from "./Command.js";
import { Path } from "./Path.js";

export class CommandBinder {
    #binder;

    constructor(binder) {
        this.#binder = binder;
    }

    bindElement(element, viewModel) {
        this.#binder.unbindElement(element, "command");
        const source = String(element.dataset.command ?? "").trim();
        if (!source || !Path.has(viewModel, source)) {
            throw new Error(
                `O Command '${source}' não existe no ViewModel.`
            );
        }
        const command = Path.get(viewModel, source);
        if (!(command instanceof Command)) {
            throw new TypeError(
                `'${source}' precisa ser uma instância de Command.`
            );
        }
        const eventName =
            String(element.dataset.commandEvent ?? "click").trim();
        if (!eventName) {
            throw new TypeError("data-command-event não pode estar vazio.");
        }
        const parameterSource =
            String(element.dataset.commandParameter ?? "").trim();
        if (
            parameterSource &&
            !Path.has(viewModel, parameterSource)
        ) {
            throw new Error(
                `O parâmetro '${parameterSource}' não existe no ViewModel.`
            );
        }
        const readParameter = () => parameterSource
            ? Path.get(viewModel, parameterSource)
            : undefined;
        const context = () => Object.freeze({
            viewModel,
            element,
            source,
            event: eventName
        });
        for (const path of command.observes) {
            if (!Path.has(viewModel, path)) {
                throw new Error(
                    `Command '${source}' observa o caminho inexistente '${path}'.`
                );
            }
        }
        const updateCanExecute = () => {
            const enabled = command.canExecute(
                readParameter(),
                context()
            );
            if ("disabled" in element) {
                element.disabled = !enabled;
            }
            element.setAttribute("aria-disabled", String(!enabled));
            element.toggleAttribute("data-command-pending", command.pending);
        };
        const listener = event => {
            event.preventDefault();
            if (!command.canExecute(readParameter(), context())) {
                return;
            }
            Promise.resolve(command.execute(
                readParameter(),
                Object.freeze({
                    ...context(),
                    domEvent: event
                })
            )).catch(error => {
                viewModel.handleError?.(error, {
                    phase: "command",
                    command: source,
                    event: eventName,
                    element
                });
            });
        };

        element.addEventListener(eventName, listener);
        const cleanup = [
            () => element.removeEventListener(eventName, listener),
            command.subscribe(updateCanExecute)
        ];
        for (const path of command.observes) {
            cleanup.push(viewModel.subscribe(path, () => {
                command.notifyCanExecuteChanged();
            }));
        }
        if (parameterSource) {
            cleanup.push(viewModel.subscribe(
                parameterSource,
                updateCanExecute
            ));
        }
        this.#binder.storeCleanup(element, "command", cleanup);
        updateCanExecute();
    }
}
