import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";

export class CadastroPageViewModel extends ViewModel {
    static fields = {
        nome: Field.string()
            .required("Informe seu nome.")
            .minLength(3)
            .maxLength(120),
        email: Field.email()
            .required("Informe seu e-mail.")
            .maxLength(160)
            .customAsync(
                "validarEmailDisponivel",
                "Este e-mail já está cadastrado."
            ),
        telefone: Field.phone({
            minDigits: 10,
            maxDigits: 11
        })
            .required("Informe seu telefone.")
            .mask("(##) #####-####"),
        cpf: Field.cpf()
            .required("Informe seu CPF.")
            .mask("###.###.###-##"),
        dataNascimento: Field.date()
            .required("Informe sua data de nascimento.")
            .minAge(
                13,
                "Você precisa ter pelo menos 13 anos para criar uma conta."
            )
            .maxAge(120, "Confira a data de nascimento informada."),
        fotoBiometrica: Field.blob()
            .alsoChanges("temBiometria"),
        fotoPreview: Field.string(),
        biometriaConfirmada: Field.boolean()
            .custom(
                value => value === true,
                "Cadastre sua biometria facial."
            ),
        consentimentoBiometria: Field.boolean()
            .custom(
                value => value === true,
                "Autorize o uso da biometria facial para continuar."
            ),
        cameraAberta: Field.boolean(),
        cameraCarregando: Field.boolean()
            .alsoChanges("cameraIndisponivel"),
        cameraPronta: Field.boolean()
            .alsoChanges("cameraIndisponivel"),
        cameraErro: Field.string(),
        cameraFallbackDisponivel: Field.boolean(),
        senha: Field.string()
            .required("Crie uma senha.")
            .minLength(8, "A senha precisa ter pelo menos 8 caracteres.")
            .maxLength(200),
        confirmacaoSenha: Field.string()
            .required("Confirme sua senha.")
            .isEqualTo(
                "senha",
                "As senhas não coincidem."
            ),
        mensagem: Field.string(),
        segundosRestantes: Field.integer()
    };

    nome = "";
    email = "";
    telefone = "";
    cpf = "";
    dataNascimento = "";
    fotoBiometrica = null;
    fotoPreview = "";
    biometriaConfirmada = false;
    consentimentoBiometria = false;
    cameraAberta = false;
    cameraCarregando = false;
    cameraPronta = false;
    cameraErro = "";
    cameraFallbackDisponivel = false;
    senha = "";
    confirmacaoSenha = "";
    mensagem = "";
    segundosRestantes = 30;
    countdownTimer = null;
    cameraStream = null;
    camera = null;
    cameraCanvas = null;
    cadastroCard = null;
    endpointCadastro = null;

    get temBiometria() {
        return Boolean(this.fotoBiometrica);
    }

    get cameraIndisponivel() {
        return !this.cameraPronta || this.cameraCarregando;
    }

    initialize() {
        const usuario = new URLSearchParams(location.search).get("usuario");
        if (usuario?.includes("@")) this.email = usuario;
    }

    async validarEmailDisponivel(value, property, context) {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, 600);
            context.signal.addEventListener("abort", () => {
                clearTimeout(timeout);
                reject(new DOMException("Validação cancelada.", "AbortError"));
            }, { once: true });
        });

        const email = String(value ?? "").trim().toLocaleLowerCase("pt-BR");
        return email !== "cesar" && !email.startsWith("cesar@");
    }

    async abrirCamera() {
        this.fecharStreamCamera();
        this.cameraErro = "";
        this.cameraFallbackDisponivel = false;
        this.cameraPronta = false;
        this.cameraCarregando = true;
        this.cameraAberta = true;

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error(
                    "A câmera não está disponível neste navegador."
                );
            }
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: "user",
                    width: { ideal: 1280 },
                    height: { ideal: 1280 }
                }
            });
            if (!this.cameraAberta) {
                this.fecharStreamCamera();
                return;
            }
            this.camera.srcObject = this.cameraStream;
            await this.camera.play();
            this.cameraPronta = true;
        } catch (error) {
            this.tratarErroCamera(error);
            this.cameraAberta = false;
            this.fecharStreamCamera();
        } finally {
            this.cameraCarregando = false;
        }
    }

    tratarErroCamera(error) {
        switch (error?.name) {
            case "NotFoundError":
            case "DevicesNotFoundError":
                this.cameraErro =
                    "Nenhuma webcam foi encontrada neste navegador.";
                this.cameraFallbackDisponivel = true;
                break;
            case "NotReadableError":
            case "TrackStartError":
                this.cameraErro =
                    "A câmera está indisponível ou sendo usada por outro aplicativo.";
                this.cameraFallbackDisponivel = true;
                break;
            case "NotAllowedError":
            case "SecurityError":
                this.cameraErro =
                    "Permissão da câmera negada. Autorize a câmera nas configurações do navegador.";
                break;
            default:
                this.cameraErro =
                    error?.message ?? "Não foi possível iniciar a câmera.";
                this.cameraFallbackDisponivel = true;
        }
    }

    async selecionarCapturaDispositivo(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            this.cameraErro = "A captura precisa ser uma imagem.";
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            this.cameraErro = "A captura deve ter no máximo 8 MB.";
            return;
        }

        try {
            const image = await this.carregarImagem(file);
            const blob = await this.criarFotoQuadrada(
                image,
                image.naturalWidth,
                image.naturalHeight
            );
            this.aplicarFotoBiometrica(blob);
            this.cameraErro = "";
            this.cameraFallbackDisponivel = false;
        } catch {
            this.cameraErro = "Não foi possível processar esta captura.";
        }
    }

    carregarImagem(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };
            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Captura inválida."));
            };
            image.src = url;
        });
    }

    async capturarFoto() {
        if (!this.cameraPronta || !this.camera?.videoWidth) return;
        const blob = await this.criarFotoQuadrada(
            this.camera,
            this.camera.videoWidth,
            this.camera.videoHeight
        );
        this.aplicarFotoBiometrica(blob);
        this.fecharCamera();
    }

    aplicarFotoBiometrica(blob) {
        this.revogarFotoPreview();
        this.fotoBiometrica = blob;
        this.fotoPreview = URL.createObjectURL(blob);
        this.biometriaConfirmada = true;
    }

    criarFotoQuadrada(source, width, height) {
        const canvas = this.cameraCanvas;
        const size = Math.min(width, height);
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, 512, 512);
        context.drawImage(
            source,
            (width - size) / 2,
            (height - size) / 2,
            size,
            size,
            0,
            0,
            512,
            512
        );
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(
                    new Error("Não foi possível gerar a captura biométrica.")
                );
            }, "image/jpeg", 0.88);
        });
    }

    removerFoto() {
        this.revogarFotoPreview();
        this.fotoBiometrica = null;
        this.fotoPreview = "";
        this.biometriaConfirmada = false;
        this.cameraErro = "";
        this.cameraFallbackDisponivel = false;
    }

    revogarFotoPreview() {
        if (this.fotoPreview.startsWith("blob:")) {
            URL.revokeObjectURL(this.fotoPreview);
        }
    }

    fecharCamera() {
        this.cameraAberta = false;
        this.cameraCarregando = false;
        this.cameraPronta = false;
        this.fecharStreamCamera();
    }

    fecharStreamCamera() {
        for (const track of this.cameraStream?.getTracks?.() ?? []) {
            track.stop();
        }
        this.cameraStream = null;
        if (this.camera) this.camera.srcObject = null;
    }

    criarDadosCadastro() {
        if (!(this.fotoBiometrica instanceof Blob)) {
            throw new Error("A biometria facial ainda não foi capturada.");
        }
        const data = new FormData();
        data.append("nome", this.nome.trim());
        data.append(
            "email",
            this.email.trim().toLocaleLowerCase("pt-BR")
        );
        data.append("telefone", this.telefone);
        data.append("cpf", this.cpf);
        data.append("dataNascimento", this.dataNascimento);
        data.append("senha", this.senha);
        data.append(
            "fotoBiometrica",
            this.fotoBiometrica,
            "biometria-facial.jpg"
        );
        return data;
    }

    async salvarCadastro(endpoint = this.endpointCadastro, options = {}) {
        if (!endpoint) {
            throw new Error("Defina o endpoint de cadastro.");
        }
        const response = await fetch(endpoint, {
            method: "POST",
            body: this.criarDadosCadastro(),
            signal: options.signal
        });
        if (!response.ok) {
            throw new Error(
                `Não foi possível salvar o cadastro (${response.status}).`
            );
        }
        const contentType = response.headers.get("content-type") ?? "";
        return contentType.includes("application/json")
            ? response.json()
            : response.text();
    }

    cadastrar() {
        if (!(this.fotoBiometrica instanceof Blob)) {
            this.biometriaConfirmada = false;
            this.validateField("biometriaConfirmada");
            this.cadastroInvalido();
            return;
        }
        const perfil = {
            nome: this.nome.trim(),
            email: this.email.trim().toLocaleLowerCase("pt-BR"),
            telefone: this.telefone,
            dataNascimento: this.dataNascimento,
            biometriaFacial: true
        };
        sessionStorage.setItem("bindifyjs.usuario", JSON.stringify(perfil));

        this.mensagem = `Bem-vindo, ${perfil.nome}. Sua conta está pronta.`;
        this.segundosRestantes = 30;
        this.acceptChanges(
            "nome",
            "email",
            "telefone",
            "cpf",
            "dataNascimento",
            "fotoBiometrica",
            "biometriaConfirmada",
            "consentimentoBiometria",
            "senha",
            "confirmacaoSenha"
        );
        this.cadastroCard?.mostrar();
        this.iniciarContagemRegressiva();
    }

    cadastroInvalido() {
        this.cadastroCard?.esconder();
    }

    iniciarContagemRegressiva() {
        this.pararContagemRegressiva();
        this.fecharCamera();
        this.countdownTimer = setInterval(() => {
            this.segundosRestantes--;
            if (this.segundosRestantes <= 0) {
                this.pararContagemRegressiva();
                location.href = "./PainelPage.html";
            }
        }, 1000);
    }

    pararContagemRegressiva() {
        if (this.countdownTimer == null) return;
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
    }

    limpar() {
        this.pararContagemRegressiva();
        this.reset("", "cadastro");
        this.removerFoto();
        this.mensagem = "";
        this.segundosRestantes = 30;
        this.cadastroCard?.esconder();
    }

    dispose() {
        this.pararContagemRegressiva();
        this.fecharCamera();
        this.revogarFotoPreview();
    }
}

globalThis.CadastroPageViewModel = CadastroPageViewModel;
