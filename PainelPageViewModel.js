import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";

class PainelPageViewModel extends ViewModel {
    static fields = {
        nome: Field.string().alsoChanges("primeiroNome", "iniciais"),
        email: Field.email(),
        telefone: Field.phone(),
        projetosAtivos: Field.integer(),
        tarefasAbertas: Field.integer(),
        percentualConclusao: Field.string(),
        atividades: Field.array()
    };

    nome = "Novo usuário";
    email = "usuario@exemplo.com";
    telefone = "Não informado";
    projetosAtivos = 4;
    tarefasAbertas = 7;
    percentualConclusao = "75%";
    atividades = [];
    proximoId = 4;

    get primeiroNome() {
        return this.nome.trim().split(/\s+/)[0] || "usuário";
    }

    get iniciais() {
        return this.nome
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(parte => parte[0]?.toUpperCase() ?? "")
            .join("") || "NU";
    }

    initialize() {
        const raw = sessionStorage.getItem("bindifyjs.usuario");
        if (raw) {
            try {
                const perfil = JSON.parse(raw);
                this.nome = String(perfil.nome ?? this.nome);
                this.email = String(perfil.email ?? this.email);
                this.telefone = String(perfil.telefone ?? this.telefone);
            } catch {
                sessionStorage.removeItem("bindifyjs.usuario");
            }
        }

        this.atividades = [
            {
                id: 1,
                titulo: "Conta criada",
                descricao: "Seu cadastro foi concluído com sucesso.",
                horario: "Agora"
            },
            {
                id: 2,
                titulo: "Perfil configurado",
                descricao: "Nome, e-mail e telefone foram adicionados.",
                horario: "Agora"
            },
            {
                id: 3,
                titulo: "Painel liberado",
                descricao: "Os recursos iniciais já estão disponíveis.",
                horario: "Agora"
            }
        ];
    }

    adicionarAtividade() {
        this.atividades = [
            {
                id: this.proximoId++,
                titulo: "Nova atividade",
                descricao: "Atualização simulada pelo BindifyJS.",
                horario: new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })
            },
            ...this.atividades
        ].slice(0, 6);
        this.tarefasAbertas++;
    }

    sair() {
        sessionStorage.removeItem("bindifyjs.usuario");
        location.href = "./LoginPage.html";
    }
}

globalThis.PainelPageViewModel = PainelPageViewModel;
