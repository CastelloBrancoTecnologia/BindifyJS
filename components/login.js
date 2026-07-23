import { Component } from "../core/Component.js";
import { Field } from "../core/Field.js";

export default class Login extends Component {
    static properties = ["usuario", "senha"];
    static fields = {
        usuario: Field.string()
            .required("Informe o usuário.")
            .maxLength(100)
            .customAsync(
                "validarUsuarioParaCadastro",
                "O usuário cesar já está cadastrado."
            ),
        senha: Field.string()
            .useAttribute(false)
            .required("Informe a senha.")
            .maxLength(200)
    };

    usuario = "";
    senha = "";

    confirmarAcao(event) {
        if (event.detail.action === "cadastrar") {
            this.emit("cadastrar", {
                usuario: this.usuario
            });
            return;
        }
        if (event.detail.action === "recuperar-senha") {
            this.emit("recuperarsenha", {
                usuario: this.usuario
            });
            return;
        }
        this.emit("entrar");
    }

    async validarUsuarioParaCadastro(value, property, context) {
        if (context.action !== "cadastrar") return true;

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 700);
            context.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                reject(new DOMException("Validação cancelada.", "AbortError"));
            }, { once: true });
        });

        return String(value ?? "").trim().toLocaleLowerCase("pt-BR") !==
            "cesar";
    }

    limpar() {
        this.reset("", "login");
        this.emit("limpar");
    }
}
