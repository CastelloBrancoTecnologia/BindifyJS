import { Command, Field, ViewModel } from "../../BindifyJS.js";

class CommandExampleViewModel extends ViewModel {
    static fields = {
        texto: Field.string(),
        mensagem: Field.string()
    };

    texto = "";
    mensagem = "";

    saveCommand = new Command(
        async () => {
            await new Promise(resolve => setTimeout(resolve, 500));
            this.mensagem = `Salvo: ${this.texto}`;
        },
        {
            canExecute: () => this.texto.trim().length > 0,
            observes: ["texto"]
        }
    );
}

globalThis.CommandExampleViewModel = CommandExampleViewModel;
