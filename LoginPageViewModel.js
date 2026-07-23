import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";

class LoginPageViewModel extends ViewModel {
    static fields = {
        usuario: Field.string().required("Informe o usuário."),
        senha: Field.string().required("Informe a senha."),
        cardTexto: Field.string(),
        ultimosLogins: Field.array()
    };

    usuario = "";
    senha = "";
    cardTexto = "";
    ultimosLogins = [];

    async initialize() {
        await new Promise(resolve => setTimeout(resolve, 300));

        const response = await fetch("./mocks/logins.json");
        if (!response.ok) {
            throw new Error(
                `Falha ao carregar o mock de logins: ${response.status}`
            );
        }

        const logins = await response.json();
        if (!Array.isArray(logins)) {
            throw new TypeError(
                "O mock de logins precisa retornar um array."
            );
        }

        this.ultimosLogins = logins.slice(0, 10);
    }

    continuar() {
        this.usuario = String(this.usuario ?? "").trim();
        this.senha = String(this.senha ?? "");

        const card = document.querySelector("#login-success-card");

        if (!card) {
            throw new Error("O card de confirmação não foi encontrado.");
        }

        if (!this.validate("usuario", "senha")) {
            this.cardTexto = this.errors.usuario[0] ?? this.errors.senha[0];
            card.mostrar();
            return;
        }

        if (this.usuario.length === 0) {
            this.cardTexto = "Informe o usuário para entrar.";
        } else {
            const falha = this.senha !== "1234";
            const ultimaTentativa = this.ultimosLogins[0];
            const tentativas = falha
                ? (ultimaTentativa?.falha
                    ? Number(ultimaTentativa.tentativas ?? 0)
                    : 0) + 1
                : 0;

            this.cardTexto = falha
                ? "Senha incorreta."
                : `Olá ${this.usuario}, você logou com sucesso.`;
            this.ultimosLogins = [
                {
                    horario: new Date().toLocaleString("pt-BR"),
                    falha,
                    tentativas
                },
                ...this.ultimosLogins
            ].slice(0, 10);
        }

        card.mostrar();
    }

    limpar() {
        this.usuario = "";
        this.senha = "";
        this.cardTexto = "";

        const card = document.querySelector("#login-success-card");
        card?.esconder();
    }

    recuperarSenha(event) {
        const usuario = String(
            event.detail?.usuario ?? this.usuario ?? ""
        ).trim();
        this.cardTexto =
            `Recuperação de senha solicitada para ${usuario}.`;

        const card = document.querySelector("#login-success-card");
        card?.mostrar();
    }

    cadastrar(event) {
        const usuario = String(
            event.detail?.usuario ?? this.usuario ?? ""
        ).trim();
        window.location.href =
            `./CadastroPage.html?usuario=${encodeURIComponent(usuario)}`;
    }
}

globalThis.LoginPageViewModel = LoginPageViewModel;
