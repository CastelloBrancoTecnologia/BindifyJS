import { Component } from "../core/Component.js";
import { Field } from "../core/Field.js";

export default class Card extends Component {
    static properties = ["texto"];
    static methods = ["mostrar", "esconder"];
    static fields = {
        texto: Field.string()
    };

    texto = "";

    mostrar() {
        this.show();
        return this;
    }

    esconder() {
        this.hide();
        return this;
    }
}
