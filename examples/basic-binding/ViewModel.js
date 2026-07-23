import { Field, ViewModel } from "../../BindifyJS.js";

class BasicBindingViewModel extends ViewModel {
    static fields = {
        nome: Field.string().alsoChanges("nomeCompleto"),
        sobrenome: Field.string().alsoChanges("nomeCompleto")
    };

    nome = "Cesar";
    sobrenome = "Castello Branco";

    get nomeCompleto() {
        return `${this.nome} ${this.sobrenome}`.trim();
    }
}

globalThis.BasicBindingViewModel = BasicBindingViewModel;
