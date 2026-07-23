import { Field, ViewModel } from "../../BindifyJS.js";

class ValidationExampleViewModel extends ViewModel {
    static fields = {
        email: Field.email().required("Informe o e-mail."),
        resultado: Field.string()
    };

    email = "";
    resultado = "";

    validar() {
        this.resultado = this.validate("email")
            ? "E-mail válido."
            : "Corrija o campo.";
    }
}

globalThis.ValidationExampleViewModel = ValidationExampleViewModel;
