import { Field, ViewModel } from "../../BindifyJS.js";

class ListExampleViewModel extends ViewModel {
    static fields = {
        itens: Field.array()
    };

    itens = [
        { id: 1, nome: "Primeiro item" }
    ];

    adicionar() {
        const id = this.itens.length + 1;
        this.itens = [
            ...this.itens,
            { id, nome: `Item ${id}` }
        ];
    }
}

globalThis.ListExampleViewModel = ListExampleViewModel;
