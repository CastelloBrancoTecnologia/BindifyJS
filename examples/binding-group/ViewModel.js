import { Field, ViewModel } from "../../BindifyJS.js";

class BindingGroupExampleViewModel extends ViewModel {
    static fields = {
        nome: Field.string().required("Informe o nome."),
        mensagem: Field.string()
    };

    nome = "Cesar";
    mensagem = "Edite e confirme ou cancele.";

    salvo() {
        this.mensagem = `Valor confirmado: ${this.nome}`;
    }
}

globalThis.BindingGroupExampleViewModel = BindingGroupExampleViewModel;
