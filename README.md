[![BindifyJS — Declarative Web Engine](./assets/bindifyjs-logo.svg)](#bindifyjs)

# BindifyJS

> **Status:** versão `0.1.0-alpha.0`. API experimental, sujeita a mudanças
> antes da primeira versão estável.

BindifyJS é um motor declarativo para aplicações web escritas com JavaScript
nativo. Ele conecta ViewModels ao DOM e reúne bindings, validação, commands,
templates, plugins e Web Components com Shadow DOM.

Sua principal proposta é resolver a mesma classe de problemas atendida por
Angular e Vue, mas sem exigir pré-compiladores, TypeScript ou uma cadeia de
build. A aplicação continua sendo HTML declarativo, CSS e JavaScript puro.

A sintaxe segue KISS: o HTML descreve o comportamento e o programador escreve
JavaScript principalmente no ViewModel. A complexidade de sincronização,
eventos, validação, lifecycle, atualização do DOM e cleanup fica concentrada
no motor da biblioteca. Assim, quem desenvolve pode dedicar mais código às
regras e aos casos de uso do negócio, em vez de reconstruir infraestrutura de
interface.

Não há dependências de runtime. A aplicação é formada por módulos ES nativos,
HTML e CSS.

O arquivo `BindifyJS.d.ts` fornece autocomplete, navegação e verificação de tipos
nos editores, sem alterar o JavaScript enviado ao navegador e sem exigir
pré-compilação.

## Funcionalidades

- ViewModels observáveis por meio de Proxy.
- Getters e métodos calculados com dependências explícitas.
- Binding declarativo em um ou dois sentidos.
- Classes CSS condicionais e reativas com data-class.
- Custom properties CSS reativas com data-css-var.
- Converters com transformação de ida e volta.
- Commands com canExecute, pending e prevenção de concorrência.
- Plugins para lifecycle, telemetria e tratamento de erros.
- Vários bindings e eventos no mesmo elemento.
- Valores personalizados para qualquer target booleano.
- Coleções em select e datalist com data-bind-items.
- Eventos ligados a métodos do ViewModel.
- Condições com data-if e data-else.
- Listas reativas e keyed rendering com data-for.
- Campos tipados e regras de validação encadeáveis.
- Mensagens de validação declarativas e acessíveis.
- Máscaras de entrada.
- Web Components com Shadow DOM, slots, CSS encapsulado e métodos públicos.
- Sincronização bidirecional entre propriedades públicas e atributos.
- Ciclo de vida seguro para remoção e reinserção de componentes.
- Observação de elementos adicionados ou alterados dinamicamente.
- Verificação imediata de bindings, campos, métodos e targets inválidos.

## Estrutura do projeto

~~~text
BindifyJS/
├── BindifyJS.js
├── BindifyJS.d.ts
├── BindifyJS.auto.js
├── assets/
│   └── bindifyjs-logo.svg
├── package.json
├── LoginPage.html
├── LoginPageViewModel.js
├── CadastroPage.html
├── CadastroPageViewModel.js
├── PainelPage.html
├── PainelPageViewModel.js
├── core/
│   ├── Binder.js
│   ├── BindingParser.js
│   ├── Command.js
│   ├── CommandBinder.js
│   ├── ClassBinder.js
│   ├── CssVarBinder.js
│   ├── Component.js
│   ├── ComponentLoader.js
│   ├── ConverterRegistry.js
│   ├── EventBinder.js
│   ├── Field.js
│   ├── Observable.js
│   ├── Path.js
│   ├── Runtime.js
│   ├── TemplateBinder.js
│   ├── ValidationBinder.js
│   └── ViewModel.js
├── components/
│   ├── card.html
│   ├── card.js
│   ├── card.css
│   ├── login.html
│   ├── login.js
│   └── login.css
├── mocks/
│   └── logins.json
└── tests/
    ├── core.test.js
    └── types.test.js
~~~

## Tipagem sem build

`BindifyJS.d.ts` descreve toda a API pública. Ao importar `BindifyJS.js`, editores
compatíveis encontram automaticamente o arquivo de declarações com o mesmo
nome:

~~~javascript
import BindifyJS, {
    Field,
    ViewModel
} from "./BindifyJS.js";
~~~

Projetos JavaScript podem habilitar verificação adicional sem gerar nenhum
arquivo:

~~~javascript
// @ts-check

import { Field, ViewModel } from "./BindifyJS.js";

class LoginViewModel extends ViewModel {
    static fields = {
        email: Field.email().required(),
        password: Field.string().minLength(4)
    };

    /** @type {string} */
    email = "";

    /** @type {string} */
    password = "";

    async login() {
        await fetch("/api/login", {
            method: "POST",
            body: JSON.stringify({
                email: this.email,
                password: this.password
            })
        });
    }
}
~~~

`// @ts-check` é entendido pelo editor; o navegador continua recebendo
JavaScript normal. As declarações incluem tipos genéricos para arrays, objetos
e enums:

~~~javascript
/** @typedef {{ id: number, name: string }} Product */

class ProductsViewModel extends ViewModel {
    static fields = {
        products: Field.array()
    };

    /** @type {Product[]} */
    products = [];
}
~~~

O `package.json` também publica `BindifyJS.d.ts` em `types` e no mapa de
`exports`. A suíte automatizada compara as exportações JavaScript e a
superfície principal da API com as declarações para detectar esquecimento
durante futuras alterações.

O arquivo `.d.ts` não torna arquivos `.ts` executáveis no navegador.
Aplicações BindifyJS permanecem em JavaScript nativo; TypeScript continua sendo
opcional para consumidores que já utilizem uma etapa de build.

## Executando o exemplo

Módulos ES e componentes carregados com fetch exigem que a pasta seja servida
por HTTP. Não abra o HTML diretamente pelo sistema de arquivos.

~~~powershell
cd C:\caminho\para\BindifyJS
python -m http.server 8000
~~~

Abra:

~~~text
http://localhost:8000/LoginPage.html
~~~

No exemplo, qualquer usuário é aceito e a senha válida é 1234.

O fluxo “Não sou cadastrado” abre CadastroPage.html. O cadastro demonstra:

- BindingGroup transacional;
- validação assíncrona de disponibilidade do e-mail;
- `isEqualTo` para confirmação da senha;
- máscara e validação de telefone;
- `Field.cpf()` e `Field.date()` para CPF e nascimento;
- captura biométrica pela webcam com estado reativo, computed bindings e
  encerramento do stream no ciclo de vida;
- validação obrigatória da captura e do consentimento biométrico;
- fieldState.pending;
- card de sucesso;
- contagem regressiva reativa de 30 segundos;
- navegação para PainelPage.html;
- persistência temporária apenas dos dados demonstrativos do perfil, sem
  armazenar senha, CPF ou a imagem biométrica.

O painel demonstra getters calculados com `alsoChanges`, data-for com chave,
eventos, métricas reativas e atualização dinâmica da linha do tempo.

## Aplicação mínima

### 1. Crie o ViewModel

~~~javascript
// HomePageViewModel.js
import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";

class HomePageViewModel extends ViewModel {
    static fields = {
        nome: Field.string(),
        contador: Field.integer()
    };

    nome = "Mundo";
    contador = 0;

    incrementar() {
        this.contador++;
    }
}

globalThis.HomePageViewModel = HomePageViewModel;
~~~

A classe precisa ser publicada em globalThis com o mesmo nome usado no
atributo viewmodel do elemento html.

### 2. Crie a página

~~~html
<!doctype html>
<html lang="pt-BR" viewmodel="HomePageViewModel">
<head>
    <meta charset="utf-8">
    <title>Minha aplicação</title>
    <script type="module" src="BindifyJS.auto.js"></script>
    <script type="module" src="HomePageViewModel.js"></script>
</head>
<body>
    <input data-bind="target: value; source: nome; mode: twoway;">
    <h1 data-bind="target: textContent; source: nome; mode: oneway;"></h1>

    <button data-event="event: click; method: incrementar;">
        Incrementar
    </button>
    <output data-bind="target: textContent; source: contador;"></output>
</body>
</html>
~~~

BindifyJS inicia automaticamente após DOMContentLoaded. Quando a inicialização
termina, o elemento html recebe data-bindify-ready="true". O ViewModel observável
fica disponível em document.documentElement.viewModel.

## ViewModels

Todo ViewModel de página herda de ViewModel.

~~~javascript
import { ViewModel } from "./core/ViewModel.js";
import { Field } from "./core/Field.js";

class ProdutoPageViewModel extends ViewModel {
    static fields = {
        descricao: Field.string(),
        preco: Field.money("BRL", { locale: "pt-BR" }),
        disponivel: Field.boolean()
    };

    descricao = "";
    preco = 0;
    disponivel = true;
}
~~~

Cada campo declarado também precisa existir como propriedade da instância.
Bindings podem usar campos, propriedades comuns, getters e, nos modos somente
de leitura, métodos.

### Inicialização assíncrona

Use initialize para carregar dados antes de considerar a aplicação pronta.

~~~javascript
class ClientesViewModel extends ViewModel {
    static fields = {
        clientes: Field.array()
    };

    clientes = [];

    async initialize() {
        const response = await fetch("./api/clientes.json");
        if (!response.ok) {
            throw new Error(`Falha ao carregar clientes: ${response.status}`);
        }
        this.clientes = await response.json();
    }
}
~~~

Se a inicialização falhar, BindifyJS encaminha a falha ao error boundary,
desfaz os bindings e adiciona à página um bloco bindify-startup-error com a
mensagem.

### Recursos com cleanup automático

Registre em `use()` qualquer recurso que precise ser encerrado. O runtime o
libera automaticamente ao executar `stop()`, mesmo quando `dispose()` falha:

~~~javascript
class CotacoesViewModel extends ViewModel {
    async initialize() {
        const controller = this.use(new AbortController());
        const socket = this.use(new WebSocket("/cotacoes"));

        this.use(
            window.setInterval(() => this.atualizarRelogio(), 1000),
            timer => window.clearInterval(timer)
        );

        await fetch("/api/cotacoes", {
            signal: controller.signal
        });
    }
}
~~~

`use(resource)` reconhece funções de cleanup e objetos que exponham
`dispose`, `unsubscribe`, `abort`, `close` ou `destroy`, além dos protocolos
`Symbol.dispose` e `Symbol.asyncDispose`. Para outro formato, passe
`use(resource, cleanup)`.

Os recursos são liberados uma única vez, em ordem inversa ao registro. Assim,
um recurso dependente é encerrado antes daquele do qual depende. O cleanup
pode ser assíncrono; uma falha é enviada ao error boundary e não impede a
liberação dos recursos restantes.

Em componentes, recursos registrados durante `connected()` são liberados
automaticamente em `disconnectedCallback()`.

### Error boundary

Todo ViewModel possui uma fronteira central para erros operacionais. Para
personalizá-la, implemente `onError(error, context)`:

~~~javascript
class CheckoutViewModel extends ViewModel {
    mensagemErro = "";

    onError(error, context) {
        this.mensagemErro = "Não foi possível concluir a operação.";

        observabilidade.registrar(error, {
            phase: context.phase,
            property: context.property,
            method: context.method
        });

        return true;
    }
}
~~~

A fronteira recebe erros de eventos, `onXChanged`, validações assíncronas,
inicialização, componentes, `dispose()` e cleanup de recursos. O contexto
identifica a origem em `phase` e acrescenta informações relevantes, como
`property`, `method`, `event`, `component` ou `resource`.

O estado mais recente fica disponível para binding:

~~~html
<dialog data-bind="target: open; source: errorState.hasError;">
    <p data-bind="target: textContent; source: mensagemErro;"></p>
    <button data-event="event: click; method: clearError;">
        Fechar
    </button>
</dialog>
~~~

`errorState` contém `hasError`, `error` e `context`. `clearError()` limpa esse
estado. A implementação padrão de `onError` registra no console e retorna
`false`; retornar `true` indica que a aplicação tratou a falha. Erros
estruturais durante a inicialização ainda encerram e desfazem aquela sessão,
mesmo quando foram apresentados ao usuário pela fronteira.

### Observação de alterações

O runtime converte o ViewModel em um Proxy. Atribuições comuns notificam os
bindings:

~~~javascript
this.nome = "Ana";
this.endereco.cidade = "Recife";
this.itens = [...this.itens, novoItem];
~~~

Para arrays, prefira atribuir um novo array quando a lista inteira deve ser
renderizada novamente.

### Atualizações agrupadas

Use `update()` quando várias propriedades formarem uma única alteração lógica:

~~~javascript
this.update(() => {
    this.nome = "Cesar";
    this.sobrenome = "Augusto";
    this.saldo = 100;
});
~~~

As atribuições acontecem imediatamente, portanto getters e o próprio código
dentro do callback já enxergam os novos valores. As notificações para
bindings e `subscribe()` ficam pendentes até o final e cada assinatura é
executada somente uma vez com o estado definitivo.

Chamadas aninhadas são permitidas; somente o `update()` mais externo publica
as mudanças:

~~~javascript
this.update(() => {
    this.nome = "Cesar";

    this.update(() => {
        this.sobrenome = "Augusto";
    });
});
~~~

O callback precisa ser síncrono. Efeitos assíncronos devem ocorrer antes ou
depois da transação:

~~~javascript
const profile = await api.loadProfile();

this.update(() => {
    this.nome = profile.firstName;
    this.sobrenome = profile.lastName;
    this.saldo = profile.balance;
});
~~~

Se o callback lançar um erro, as alterações já realizadas são mantidas e
publicadas antes que o erro seja propagado. `update()` agrupa notificações;
ele não implementa rollback. `onXChanging` e `onXChanged` continuam sendo
executados para cada atribuição, preservando seus contratos.

## Binding de propriedades

Use data-bind para ligar um target do elemento a uma source do ViewModel.

~~~html
<input
    data-bind="
        target: value;
        source: usuario;
        mode: twoway;
    ">
~~~

- target é uma propriedade ou caminho existente no elemento.
- source é uma propriedade ou caminho existente no ViewModel.
- mode define a direção da sincronização.

### Modos de binding

| Modo | Direção | Comportamento |
|---|---|---|
| oneway | ViewModel → elemento | Atualiza o elemento sempre que a source muda. |
| twoway | ViewModel ↔ elemento | Atualiza nos dois sentidos. |
| onetime | ViewModel → elemento | Copia somente o valor inicial. |
| onewaytosource | elemento → ViewModel | Lê o elemento e mantém apenas a source atualizada. |

Se mode for omitido, value, checked e selectedIndex usam twoway. Outros
targets usam oneway.

~~~html
<p data-bind="target: textContent; source: mensagem;"></p>

<input type="checkbox"
       data-bind="target: checked; source: ativo;">

<button data-bind="target: disabled; source: processando;">
    Salvar
</button>
~~~

Inputs e textareas ligados a value são lidos nos eventos input e change.
Outros targets são lidos no evento change.

### Quando atualizar a source

Bindings twoway e onewaytosource aceitam when para controlar quando o valor
do elemento será enviado ao ViewModel:

| When | Comportamento |
|---|---|
| ContentChanged | Atualiza durante input/change. É o default. |
| LostFocus | Atualiza quando o elemento perde o foco. |
| groupcommit | Mantém a edição pendente até o commit do grupo. |

~~~html
<input data-bind="
    target: value;
    source: pesquisa;
    mode: twoway;
    when: ContentChanged;
">

<input data-bind="
    target: value;
    source: email;
    mode: twoway;
    when: LostFocus;
">
~~~

ViewModel → elemento continua reativo em twoway. when controla somente a
direção elemento → ViewModel. Usar when em oneway ou onetime gera erro.

## Grupos transacionais de binding

data-binding-group agrupa bindings cujo `when` é `groupcommit`. As edições ficam
nos controles até que o grupo seja confirmado:

~~~html
<form
    data-binding-group="cadastro"
    data-event="
        { event: bindingscommit; method: salvar; }
        { event: bindingsinvalid; method: mostrarErros; }
        { event: bindingscancel; method: cancelar; }
    ">

    <label for="nome">Nome</label>
    <input id="nome" data-bind="
        target: value;
        source: nome;
        mode: twoway;
        when: groupcommit;
    ">
    <small data-validation-for="nome"></small>

    <label for="email">E-mail</label>
    <input id="email" data-bind="
        target: value;
        source: email;
        mode: twoway;
        when: groupcommit;
    ">
    <small data-validation-for="email"></small>

    <button type="button" data-binding-commit>
        Salvar
    </button>

    <button type="button" data-binding-cancel>
        Cancelar
    </button>
</form>
~~~

No commit, o runtime trabalha em duas fases:

1. lê e normaliza todos os valores candidatos;
2. valida somente os Fields associados aos bindings daquele grupo;
3. grava os erros em ViewModel.errors;
4. se todos forem válidos, aplica todos os valores ao ViewModel;
5. emite bindingscommit ou bindingsinvalid.

Um commit inválido não altera as propriedades do ViewModel. Os valores
digitados permanecem nos controles para correção e as mensagens continuam
sendo apresentadas por data-validation-for.

O grupo não cria regras, mensagens ou armazenamento de erros. Field continua
sendo a única definição de validação, ViewModel.errors continua sendo o único
estado de erros e ValidationBinder continua sendo o único responsável pela
apresentação declarativa. O grupo define apenas o escopo e o momento da
validação.

Sem grupo, validate() mantém seu comportamento e valida todos os Fields
declarados. validate("nome", "email") continua permitindo seleção explícita.

### Eventos do grupo

Commit válido:

~~~javascript
salvar(event) {
    console.log(event.detail);
}
~~~

~~~javascript
{
    group: "cadastro",
    fields: ["nome", "email"],
    values: {
        nome: "Ana",
        email: "ana@example.com"
    },
    errors: {},
    valid: true
}
~~~

Commit inválido emite bindingsinvalid com errors contendo somente os Fields
inválidos do grupo. As mensagens nesse snapshot são as mesmas presentes em
ViewModel.errors; não são uma segunda fonte de estado.

### Cancelamento

data-binding-cancel descarta as edições pendentes, restaura nos controles os
valores atuais do ViewModel, limpa a validação dos Fields do grupo e emite
bindingscancel. Nenhuma propriedade do ViewModel é alterada.

### API programática

O elemento do grupo publica uma API pequena:

~~~javascript
const grupo = document.querySelector(
    '[data-binding-group="cadastro"]'
);

grupo.bindingGroup.commit();
grupo.bindingGroup.cancel();
~~~

Grupos aninhados são isolados. Um botão atua somente sobre o ancestral com
data-binding-group mais próximo.

### Ações e commits parciais

O valor de data-binding-commit identifica a ação no detail do evento. O
atributo data-binding-fields limita o commit e a validação aos Fields
informados:

~~~html
<button
    type="button"
    data-binding-commit="recuperar-senha"
    data-binding-fields="usuario">
    Esqueci minha senha
</button>
~~~

~~~javascript
confirmarAcao(event) {
    if (event.detail.action === "recuperar-senha") {
        // Somente usuario foi preparado, validado e aplicado.
    }
}
~~~

Os nomes podem ser separados por espaço ou vírgula. Um nome que não pertença
ao grupo produz erro. Sem data-binding-fields, o botão confirma todos os
bindings `groupcommit` do grupo.

Um botão comum, sem data-binding-commit, não confirma nem valida o grupo e
pode emitir outra ação normalmente:

~~~html
<button data-event="event: click; method: cadastrar;">
    Quero me cadastrar
</button>
~~~

### Getters e valores calculados

Getters podem ser usados como source em bindings oneway e onetime. Declare em
cada campo de origem quais valores calculados também mudam:

~~~javascript
class PessoaViewModel extends ViewModel {
    static fields = {
        nome: Field.string().alsoChanges(
            "nomeCompleto",
            "nomeEmMaiusculas"
        ),
        sobrenome: Field.string().alsoChanges("nomeCompleto")
    };

    nome = "Ana";
    sobrenome = "Silva";

    get nomeCompleto() {
        return `${this.nome} ${this.sobrenome}`;
    }

    nomeEmMaiusculas() {
        return this.nome.toUpperCase();
    }
}
~~~

~~~html
<p data-bind="
    target: textContent;
    source: nomeCompleto;
    mode: oneway;
"></p>

<p data-bind="
    target: textContent;
    source: nomeEmMaiusculas;
    mode: oneway;
"></p>
~~~

Quando nome muda, BindifyJS notifica nomeCompleto e nomeEmMaiusculas. Quando
sobrenome muda, também notifica nomeCompleto. Dependências podem ser passadas
separadamente, em uma lista ou em chamadas encadeadas:

~~~javascript
nome: Field.string()
    .alsoChanges("nomeCompleto")
    .alsoChanges("iniciais", "nomeEmMaiusculas")
~~~

Field.alsoChanges também está disponível como atalho para um campo String:

~~~javascript
nome: Field.alsoChanges("nomeCompleto")
~~~

Dependências inexistentes e ciclos entre campos produzem erro na
inicialização.

Métodos podem ser source somente em oneway e onetime, pois não existe um
destino gravável para receber atualizações do elemento. Getters sem setter
seguem a mesma restrição. twoway e onewaytosource exigem uma propriedade
gravável.

### Ciclo de alteração: onXChanging e onXChanged

Uma ViewModel pode reagir automaticamente à alteração de uma propriedade
implementando métodos com o nome da propriedade em PascalCase:

~~~javascript
class FreteViewModel extends ViewModel {
    static fields = {
        cidade: Field.string(),
        frete: Field.number()
    };

    cidade = "";
    frete = 0;

    onCidadeChanging(newValue, oldValue, context) {
        // Executado antes da atribuição. Precisa ser síncrono.
        return newValue.trim();
    }

    async onCidadeChanged(newValue, oldValue, context) {
        // Executado após a atribuição e pode ser assíncrono.
        const response = await fetch(
            `/api/frete?cidade=${encodeURIComponent(newValue)}`,
            { signal: context.signal }
        );
        const result = await response.json();
        context.signal.throwIfAborted();
        this.frete = result.valor;
    }
}
~~~

`onXChanging` pode validar ou normalizar o valor antes que ele seja gravado:

- retornar `undefined` mantém o valor proposto;
- retornar outro valor substitui o valor proposto;
- retornar `ViewModel.cancelChange` cancela a alteração;
- retornar uma Promise produz erro, pois essa etapa precisa terminar antes da
  atribuição.

~~~javascript
onSaldoChanging(newValue) {
    if (newValue < 0) {
        return ViewModel.cancelChange;
    }

    return Number(newValue);
}
~~~

`onXChanged` recebe o valor já aplicado e pode executar efeitos colaterais
assíncronos. Quando a mesma propriedade muda novamente, o handler anterior é
cancelado por `AbortSignal`; isso evita que uma resposta antiga sobrescreva a
mais recente. Use `context.signal` nas APIs que aceitam cancelamento e
verifique o sinal antes de aplicar resultados.

Ambos recebem `(newValue, oldValue, context)`. O contexto contém `property`,
`phase` e `viewModel`; em `onXChanged`, também contém `signal`. Erros do
handler assíncrono são enviados a `onError(error, context)`, que pode ser
sobrescrito na ViewModel.

Alterações vindas de bindings, atribuições diretas e `reset()` passam pelo
mesmo ciclo. A inicialização dos campos da classe não dispara os handlers.
O ciclo observa a propriedade raiz: alterar `endereco.cidade` diretamente
não chama `onEnderecoChanged`.

Use `alsoChanges` para notificar getters e métodos calculados. Use
`onXChanging` e `onXChanged` para normalização, veto e efeitos colaterais.

### Caminhos aninhados

~~~html
<input data-bind="target: value; source: endereco.cidade;">
~~~

Todos os segmentos do caminho precisam existir no momento do binding.

### Vários bindings no mesmo elemento

Coloque cada binding dentro de um bloco entre chaves:

~~~html
<input data-bind="
    { target: value; source: email; mode: twoway; }
    { target: disabled; source: processando; mode: oneway; }
">
~~~

Texto fora dos blocos é considerado erro.

### Classes CSS condicionais

Use `data-class` para adicionar ou remover classes conforme valores do
ViewModel:

~~~html
<div
    class="field"
    data-class="
        loading: loading;
        error: hasErrors;
        saved: saved;
        pending: fieldState.email.pending;
        changed: fieldState.email.changed;
    ">
    ...
</div>
~~~

Cada declaração usa `classe: source`. Ponto e vírgula ou vírgula podem
separar declarações. Valores truthy adicionam a classe; valores falsy a
removem. Caminhos aninhados, getters e métodos oneway também são aceitos.
Classes estáticas, como `field`, são preservadas e o cleanup restaura o
estado original do elemento.

As transições e animações continuam no CSS:

~~~css
.field.error {
    color: #b42318;
    font-weight: 700;
    animation: shake .22s ease-out;
}

.field.pending {
    opacity: .7;
}
~~~

BindifyJS não possui `data-state`: para aparência, `data-class` já representa
o estado sem duplicar APIs. Para comportamento ou semântica, faça binding
diretamente no target HTML apropriado, como `disabled`, `hidden` ou um
atributo ARIA.

### Variáveis CSS reativas

Use `data-css-var` para expor valores do ViewModel como custom properties
CSS sem substituir o atributo `style` inteiro:

~~~html
<div
    class="progress"
    data-css-var="
        progress: progress;
        accent-color: theme.accentColor;
        scale: animationScale;
    ">
</div>
~~~

O motor cria `--progress`, `--accent-color` e `--scale`. O prefixo `--`
também pode ser informado explicitamente. Ponto e vírgula ou vírgula podem
separar as declarações.

~~~css
.progress {
    width: calc(var(--progress) * 1%);
    background: var(--accent-color);
    transform: scale(var(--scale));
    transition: width 180ms ease, transform 180ms ease;
}
~~~

Valores `null` ou `undefined` removem a custom property. Os demais valores são
convertidas em texto. Caminhos aninhados, getters e métodos oneway são
aceitos. Ao remover o binding ou o elemento, BindifyJS restaura o valor e a
prioridade inline originais.

Prefira `data-css-var` a binding do target `style`: cada variável é atualizada
isoladamente, estilos inline não relacionados são preservados e o CSS
continua responsável por `calc()`, transições, animações e apresentação.

### Converters

Registre um converter uma vez na inicialização:

~~~javascript
BindifyJS.registerConverter("currency", {
    convert(value, context) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: context.parameter ?? "BRL"
        }).format(value);
    },

    convertBack(value) {
        return Number(
            String(value)
                .replace(/[^\d,-]/g, "")
                .replace(/\./g, "")
                .replace(",", ".")
        );
    }
});
~~~

Use-o no binding:

~~~html
<input data-bind="
    target: value;
    source: saldo;
    mode: twoway;
    converter: currency;
    converterParameter: BRL;
">
~~~

`convert(value, context)` transforma ViewModel → elemento. Em `twoway` ou
`onewaytosource`, o converter também precisa implementar `convertBack`, que
transforma elemento → ViewModel. O contexto informa `direction`, `parameter`,
`source`, `target`, `element`, `viewModel` e `field`.

Um converter somente de leitura pode ser registrado diretamente como função:

~~~javascript
BindifyJS.registerConverter("upper", value =>
    String(value).toUpperCase()
);
~~~

O registro devolve uma função que remove o converter.

### Valores personalizados para targets booleanos

Por padrão, propriedades booleanas leem e escrevem booleanos. TrueValue e
FalseValue permitem mapear os dois estados para valores de qualquer Field:

~~~javascript
static fields = {
    perfil: Field.enum(["admin", "usuario"])
        .trueValue("admin")
        .falseValue("usuario")
};

perfil = "usuario";
~~~

~~~html
<label>
    <input type="checkbox"
           data-bind="target: checked; source: perfil; mode: twoway;">
    Administrador
</label>
~~~

Quando perfil é admin, o controle fica marcado. Marcar escreve admin e
desmarcar escreve usuario no ViewModel.

~~~javascript
estado: Field.string()
    .trueValue("ligado")
    .falseValue("desligado")
~~~

Os mapeamentos são aplicados a qualquer target cuja propriedade no elemento
seja booleana. Isso inclui checked, disabled, hidden, required, readOnly,
open, multiple e propriedades booleanas de Web Components:

~~~javascript
estado: Field.string()
    .trueValue("bloqueado")
    .falseValue("ativo")
~~~

~~~html
<button data-bind="
    target: disabled;
    source: estado;
    mode: oneway;
">
    Salvar
</button>
~~~

Quando estado é bloqueado, disabled recebe true. Quando é ativo, recebe
false. A detecção usa o tipo real da propriedade target, não uma lista fixa de
nomes.

## Eventos

Use data-event para chamar um método do ViewModel:

~~~html
<button data-event="event: click; method: salvar;">
    Salvar
</button>
~~~

~~~javascript
salvar(event, element) {
    event.preventDefault();
    element.disabled = true;
}
~~~

O método recebe o evento e o elemento que declarou data-event. O nome pode ser
escrito como click ou onclick.

### Vários eventos no mesmo elemento

~~~html
<input data-event="
    { event: input; method: pesquisar; }
    { event: focus; method: iniciarPesquisa; }
    { event: blur; method: encerrarPesquisa; }
">
~~~

O método precisa existir na inicialização. Erros de digitação falham
imediatamente.

## Commands

Use `Command` para representar uma ação com disponibilidade, execução
assíncrona e estado pending:

~~~javascript
import { Command, Field, ViewModel } from "./BindifyJS.js";

class EditorViewModel extends ViewModel {
    static fields = {
        nome: Field.string()
    };

    nome = "";

    saveCommand = new Command(
        async () => {
            await api.save({ nome: this.nome });
        },
        {
            canExecute: () => this.nome.trim().length > 0,
            observes: ["nome"]
        }
    );
}
~~~

~~~html
<button data-command="saveCommand">
    Salvar
</button>
~~~

`data-command` liga automaticamente o `canExecute` à propriedade `disabled` e
a `aria-disabled`. Enquanto um command assíncrono executa, ele recebe
`data-command-pending` e fica indisponível. Por padrão, uma segunda execução
concorrente é impedida.

`observes` declara os caminhos do ViewModel que podem alterar `canExecute`.
Quando a regra depende de estado externo, notifique manualmente:

~~~javascript
this.saveCommand.notifyCanExecuteChanged();
~~~

Parâmetros podem vir de uma propriedade:

~~~html
<button
    data-command="removeCommand"
    data-command-parameter="selectedId">
    Remover
</button>
~~~

Para outro evento:

~~~html
<form data-command="submitCommand" data-command-event="submit">
~~~

Erros de execução seguem para o error boundary com `phase: "command"`.
`allowConcurrent: true` permite concorrência explicitamente.

## Condições

data-if mostra o elemento quando a source é truthy. data-else faz o inverso.
Os elementos continuam no DOM; a biblioteca controla a propriedade hidden.

~~~html
<section data-if="usuarioAutenticado">
    Área autenticada
</section>

<section data-else="usuarioAutenticado">
    Faça login para continuar.
</section>
~~~

Caminhos aninhados são aceitos:

~~~html
<p data-if="pedido.pago">Pagamento confirmado.</p>
~~~

## Listas e templates

Use template com data-for para renderizar arrays.

~~~html
<ul>
    <template data-for="produto in produtos">
        <li>
            <strong>${produto.nome}</strong>
            <span>R$ ${produto.preco}</span>
        </li>
    </template>
</ul>
~~~

Também é possível informar apenas o caminho. Nesse caso, o alias padrão é
item:

~~~html
<template data-for="produtos">
    <p>${item.nome}</p>
</template>
~~~

O contexto de cada item contém:

- item: item atual, independentemente do alias.
- alias: nome definido antes de in ou of.
- $index: índice real do item no array.
- $number: posição exibida, começando em 1.

~~~html
<template data-for="cliente of clientes">
    <p>${$number}. ${cliente.nome} — índice ${$index}</p>
</template>
~~~

A interpolação funciona em nós de texto e atributos:

~~~html
<template data-for="produto in produtos">
    <a href="/produto/${produto.id}" title="Abrir ${produto.nome}">
        ${produto.nome}
    </a>
</template>
~~~

### Condições dentro de listas

Dentro de data-for, data-if e data-else usam o contexto do item:

~~~html
<template data-for="item in pedidos">
    <span data-if="item.pago">Pago</span>
    <span data-else="item.pago">Pendente</span>
</template>
~~~

### Keyed rendering

Use data-for-key para preservar a identidade dos nós quando itens forem
reordenados ou atualizados.

~~~html
<template
    data-for="produto in produtos"
    data-for-key="id">
    <article>${produto.nome}</article>
</template>
~~~

A chave pode ser relativa ao item, como id, ou usar o alias, como produto.id.
Chaves ausentes, nulas ou duplicadas geram erro. Sem data-for-key, o índice
real do array é usado como chave.

### Paginação e direção

~~~html
<template
    data-for="item in itens"
    data-for-start-index="0"
    data-for-limit="10"
    data-for-increment="1">
    <p>${$number}: ${item.nome}</p>
</template>
~~~

- data-for-start-index: primeiro índice real.
- data-for-limit: quantidade máxima renderizada.
- data-for-increment: passo da iteração; não pode ser zero.

Para percorrer de trás para frente:

~~~html
<template
    data-for="item in itens"
    data-for-increment="-1">
    <p>${item.nome}</p>
</template>
~~~

Quando o incremento é negativo e o início é omitido, a iteração começa no
último item.

## Coleções de controles com data-bind-items

data-bind-items é um equivalente simples ao ItemsSource do XAML. Ele cria e
atualiza options de select e datalist a partir de um array. A coleção e a
seleção continuam sendo responsabilidades separadas:

~~~javascript
static fields = {
    estados: Field.array(),
    estadoSelecionado: Field.string()
};

estados = [
    { id: 1, sigla: "SP", nome: "São Paulo" },
    { id: 2, sigla: "RJ", nome: "Rio de Janeiro" }
];

estadoSelecionado = "RJ";
~~~

~~~html
<select
    data-bind-items="
        source: estados;
        text: nome;
        value: sigla;
        key: id;
        emptyText: Selecione um estado;
    "
    data-bind="
        target: value;
        source: estadoSelecionado;
        mode: twoway;
    ">
</select>
~~~

Opções:

| Opção | Finalidade | Default |
|---|---|---|
| source | Array no ViewModel | Obrigatória |
| text | Caminho exibido no option | O próprio item |
| value | Caminho usado como value | O próprio item |
| key | Identidade estável do option | Índice |
| emptyText | Texto de uma opção vazia | Não cria opção |
| emptyValue | Valor da opção vazia | String vazia |

Arrays primitivos não precisam de text, value ou key:

~~~javascript
cores = ["Azul", "Verde", "Vermelho"];
~~~

~~~html
<label for="cor">Cor</label>
<input id="cor" list="cores">
<datalist id="cores" data-bind-items="source: cores;"></datalist>
~~~

Quando a coleção é substituída, options com a mesma key são reutilizados,
atualizados e reordenados. Chaves ausentes, nulas ou duplicadas geram erro.
O binding da coleção é executado antes do data-bind do mesmo elemento, de
modo que o valor selecionado possa ser aplicado depois que as options existam.

data-bind-items atualmente aceita somente select e datalist. Para qualquer
estrutura HTML livre, continue usando template com data-for.

## Campos tipados

Field descreve o tipo, a normalização, a máscara e as regras de validação de
uma propriedade.

~~~javascript
static fields = {
    nome: Field.string(),
    quantidade: Field.integer(),
    preco: Field.money("BRL", { locale: "pt-BR" })
};
~~~

### Tipos disponíveis

| Tipo | Exemplo |
|---|---|
| String | Field.string() |
| Number | Field.number() |
| Integer | Field.integer() |
| Money | Field.money("BRL", { locale: "pt-BR" }) |
| Boolean | Field.boolean() |
| Array | Field.array() |
| Object | Field.object() |
| Blob | Field.blob() |
| Enum | Field.enum(["admin", "user"]) |
| Date | Field.date() |
| Time | Field.time() |
| DateTime | Field.dateTime() |
| Email | Field.email() |
| Url | Field.url() |
| UUID | Field.uuid() |
| Phone | Field.phone() |
| PostalCode | Field.postalCode("BR") |
| CPF | Field.cpf() |
| CNPJ | Field.cnpj() |
| Document | Field.document("CPF", "BR") |

Campos vazios são válidos, exceto quando `required` é usado.

`Field.blob()` representa conteúdo binário como imagens, PDFs e arquivos
gerados no navegador. É sempre property-only: não usa atributos nem reflexão.

~~~javascript
fotoBiometrica: Field.blob()
~~~

~~~javascript
const data = new FormData();
data.append("nome", this.nome);
data.append(
    "fotoBiometrica",
    this.fotoBiometrica,
    "biometria-facial.jpg"
);

await fetch("/api/cadastros", {
    method: "POST",
    body: data
});
~~~

Não defina manualmente o header `Content-Type` ao enviar `FormData`; o
navegador adiciona o boundary correto.

### Exemplo completo

~~~javascript
static fields = {
    nome: Field.string()
        .required("Informe o nome.")
        .minLength(3)
        .maxLength(100),

    idade: Field.integer()
        .required()
        .range(18, 120),

    nascimento: Field.date()
        .minAge(18)
        .maxAge(120),

    saldo: Field.money("BRL", { locale: "pt-BR" }),
    email: Field.email(),
    site: Field.url(),
    perfil: Field.enum(["admin", "user"]),
    identificador: Field.uuid(),

    telefone: Field.phone({
        requireCountryCode: true,
        requireAreaCode: true,
        extension: true
    }),

    cep: Field.postalCode("BR").mask("#####-###"),
    cpf: Field.cpf().mask("###.###.###-##"),
    cnpj: Field.cnpj().mask("##.###.###/####-##")
};
~~~

### Regras de validação

~~~javascript
Field.string()
    .required("Campo obrigatório.")
    .minLength(3, "Use ao menos 3 caracteres.")
    .maxLength(80, "Use no máximo 80 caracteres.")
    .pattern(/^[A-Z]/, "Comece com letra maiúscula.");
~~~

Regras disponíveis:

- `required(message)`
- `minLength(length, message)`
- `maxLength(length, message)`
- `min(minimum, message)`
- `max(maximum, message)`
- `range(minimum, maximum, message)`
- `minAge(age, message)`
- `maxAge(age, message)`
- `pattern(pattern, message)`
- `custom(validator, message)`
- `isEqualTo(otherField, message)`
- `isNotEqualTo(otherField, message)`
- `isLessThan(otherField, message)`
- `isLessThanOrEqualTo(otherField, message)`
- `isGreaterThan(otherField, message)`
- `isGreaterThanOrEqualTo(otherField, message)`

### Validação personalizada

~~~javascript
static fields = {
    codigo: Field.string().custom(
        (value, viewModel, property) => value.startsWith("BIND-"),
        "O código precisa começar com BIND-."
    )
};
~~~

A mensagem também pode ser uma função:

~~~javascript
Field.integer().min(
    18,
    value => `A idade ${value} não é permitida.`
);
~~~

`custom` é exclusivo para validação síncrona. Para operações assíncronas, use
`customAsync`.

### Comparações entre Fields

As comparações recebem o nome do outro Field e uma mensagem opcional. Em um
BindingGroup, usam os valores candidatos preparados na mesma transação:

~~~javascript
senha: Field.string().required().minLength(8),
confirmacaoSenha: Field.string()
    .required()
    .isEqualTo("senha", "As senhas não coincidem.")
~~~

Intervalos numéricos:

~~~javascript
valorMinimo: Field.number(),
valorMaximo: Field.number()
    .isGreaterThanOrEqualTo(
        "valorMinimo",
        "O máximo não pode ser menor que o mínimo."
    )
~~~

Períodos:

~~~javascript
inicio: Field.date(),
fim: Field.date()
    .isGreaterThanOrEqualTo(
        "inicio",
        "A data final deve ser igual ou posterior à inicial."
    ),

abertura: Field.time(),
fechamento: Field.time()
    .isGreaterThan("abertura", "O fechamento deve ser posterior.")
~~~

Regras:

- `number`, `integer` e `money` são comparados numericamente;
- `date` e `dateTime` são comparados cronologicamente;
- `time` é convertido em segundos desde 00:00;
- strings são comparadas em ordem lexical determinística;
- `enum` preserva e compara o tipo do valor;
- ordenação não aceita `boolean`, `array` ou `object`;
- igualdade de Array e Object usa identidade da referência;
- o Field comparado precisa existir, ou a inicialização falha;
- se o outro Field também for inválido, o grupo inteiro permanece inválido.

#### Nomes canônicos

A API não mantém aliases. Os nomes de comparação adotados são:

| Intenção | API |
|---|---|
| Igual | isEqualTo |
| Diferente | isNotEqualTo |
| Menor | isLessThan |
| Menor ou igual | isLessThanOrEqualTo |
| Maior | isGreaterThan |
| Maior ou igual | isGreaterThanOrEqualTo |

`isLowerOf`, `isHigherOf`, `isLowerOrEqualOf`, `isHigerOrEqualOf` e
`isDeferentOf` não são publicados. `lessThan`, `greaterThan` e `notEqual` são as formas usuais e evitam
grafias ambíguas.

### Validação assíncrona personalizada

Prefira declarar no Field somente o nome do handler e implementar a operação
no ViewModel. Isso mantém regras, serviços e efeitos assíncronos fora do
descritor:

~~~javascript
class CadastroViewModel extends ViewModel {
    static fields = {
        email: Field.email()
            .required("Informe o e-mail.")
            .customAsync(
                "validarEmailDisponivel",
                "Este e-mail já está cadastrado."
            )
    };

    email = "";

    async validarEmailDisponivel(value, property, context) {
        return api.emailDisponivel(value, {
            signal: context.signal
        });
    }
}
~~~

O handler recebe:

- value: valor candidato normalizado;
- property: nome do Field;
- context.signal: AbortSignal da execução atual.
- context.action: valor de data-binding-commit quando a validação partiu de
  um binding group;
- context.group: nome de data-binding-group;
- context.fields: campos selecionados para o commit parcial.

O contexto permite reutilizar o mesmo Field em ações diferentes sem espalhar
regras pelos botões. Por exemplo, uma verificação de disponibilidade pode ser
executada somente no cadastro:

~~~javascript
async validarUsuario(value, property, context) {
    if (context.action !== "cadastrar") return true;
    return api.usuarioDisponivel(value, { signal: context.signal });
}
~~~

Em commits de grupo, context.values contém todos os candidatos preparados antes
da validação. Isso permite regras cruzadas como `isEqualTo` sem aplicar valores
parcialmente no ViewModel.

Quando uma nova validação do mesmo campo começa, a anterior é cancelada. O
handler deve encaminhar context.signal para fetch ou para a API usada:

~~~javascript
async validarEmailDisponivel(value, property, context) {
    const response = await fetch(
        `/api/email-disponivel?email=${encodeURIComponent(value)}`,
        { signal: context.signal }
    );
    const result = await response.json();
    return result.disponivel;
}
~~~

O nome do handler é verificado durante a inicialização. Métodos ausentes
falham imediatamente.

Uma função inline continua aceita para integrações pequenas, mas não é a forma
recomendada:

~~~javascript
email: Field.email().customAsync(
    async (value, viewModel, property, context) => {
        return api.emailDisponivel(value, context.signal);
    },
    "Este e-mail já está cadastrado."
)
~~~

O retorno pode ser síncrono ou Promise e deve resultar em true ou false.
Regras síncronas e validação de tipo executam primeiro; se falharem, handlers
assíncronos não são chamados.

## Validação no ViewModel

### Validar campos específicos

~~~javascript
salvar() {
    if (!this.validate("nome", "email")) {
        return;
    }

    // dados válidos
}
~~~

### Validar todos os campos

~~~javascript
const valido = this.validate();
~~~

### Validar um único campo

~~~javascript
const valido = this.validateField("email");
~~~

### Validar assincronamente

~~~javascript
const emailValido = await this.validateFieldAsync("email");
const formularioValido = await this.validateAsync();
const algunsValidos = await this.validateAsync("nome", "email");
~~~

validateAsync sem argumentos valida todos os Fields, como validate. Erros
assíncronos usam o mesmo ViewModel.errors e o mesmo data-validation-for das
regras síncronas.

Bindings e infraestrutura que precisam distinguir cancelamento de erro podem
usar o resultado detalhado:

~~~javascript
const result = await this.validateValueResultAsync("email", candidato);

// result.status: "valid", "invalid" ou "cancelled"
// result.valid: boolean
// result.errors: mensagens desta execução
~~~

Uma execução cancelled nunca é tratada como válida. Binding groups também
possuem revisão transacional: iniciar outro commit ou cancelar o grupo impede
que uma operação anterior aplique valores ou emita bindingscommit atrasado.

### Estado de cada Field

fieldState expõe um estado reativo e leve para cada Field declarado:

~~~javascript
this.fieldState.email.valid     // null, true ou false
this.fieldState.email.validated // já passou por validação
this.fieldState.email.changed   // foi alterado desde o último aceite
this.fieldState.email.dirty     // difere do baseline aceito
this.fieldState.email.pending  // validação assíncrona em andamento
this.fieldState.email.error    // primeira mensagem, ou ""

// Acesso dinâmico usa o mesmo objeto:
this.fieldState[nomeDoField].error
~~~

Não é necessário um GetFieldState: a notação de colchetes já resolve nomes
dinâmicos. Todos os campos começam com valid null, validated false, changed
false, dirty false, pending false e error vazio. valid só se torna booleano
depois de uma validação. Uma tentativa inválida de `groupcommit` não marca
changed nem dirty, pois o valor candidato não chegou ao ViewModel.

Depois de persistir ou aceitar os valores atuais, acceptChanges grava um novo
baseline e redefine changed e dirty:

~~~javascript
this.acceptChanges("email");
this.acceptChanges(); // todos os Fields
~~~

~~~html
<span data-if="fieldState.email.pending">
    Verificando e-mail...
</span>
~~~

Regras e mensagens continuam definidas exclusivamente em Field; fieldState
apenas projeta seu estado atual.

### Limpar, cancelar ou restaurar Fields

clearErrors, cancelPending e reset usam a mesma assinatura:

~~~javascript
operacao(fieldName = "", groupName = "")
~~~

O nome vazio significa “todos” naquela dimensão:

~~~javascript
this.clearErrors("email");        // somente email
this.clearErrors("", "cadastro"); // Fields do grupo cadastro
this.clearErrors();               // todos os Fields

this.cancelPending("email");
this.cancelPending("", "cadastro");
this.cancelPending();

this.reset("email");
this.reset("", "cadastro");
this.reset();
~~~

clearErrors remove somente as mensagens selecionadas. cancelPending cancela
`customAsync` sem alterar valor ou erros já publicados. `reset` cancela validações
pendentes, restaura uma cópia do baseline aceito, limpa os erros e redefine
changed e dirty.

Os grupos são descobertos dos bindings com `when: groupcommit`. Um nome de campo
ou grupo inexistente falha imediatamente; um Field informado junto com um grupo
precisa pertencer àquele grupo.

As mensagens ficam disponíveis por campo:

~~~javascript
console.log(this.errors.email);
~~~

Bindings twoway validam automaticamente o campo durante input ou change.

## Mensagens declarativas de validação

Use data-validation-for com um campo declarado em static fields:

~~~html
<label for="email">E-mail</label>
<input
    id="email"
    data-bind="target: value; source: email; mode: twoway;">
<small data-validation-for="email"></small>
~~~

O ValidationBinder:

- combina as mensagens do campo;
- esconde o elemento quando não há erro;
- define role="alert" e aria-live="polite";
- atualiza aria-invalid no controle ligado;
- conecta o controle à mensagem com aria-describedby.

Um data-validation-for apontando para campo inexistente gera erro na
inicialização.

## Máscaras

Use `mask` em qualquer Field cujo valor textual deva ser formatado:

~~~javascript
static fields = {
    codigo: Field.string().mask("AA-####"),
    cep: Field.postalCode("BR").mask("#####-###"),
    cpf: Field.cpf().mask("###.###.###-##")
};
~~~

Tokens:

| Token | Aceita |
|---|---|
| # | Dígito |
| A | Letra |
| * | Letra ou dígito |

Em inputs ligados a value, a máscara é aplicada enquanto o usuário edita.

## Telefones, códigos postais e documentos

### Telefone

~~~javascript
telefone: Field.phone({
    minDigits: 10,
    maxDigits: 15,
    requireCountryCode: true,
    countryCode: true,
    requireAreaCode: true,
    extension: true
})
~~~

Phone faz validação estrutural: caracteres permitidos, quantidade de dígitos,
código de país, código de área e ramal. Regras oficiais específicas de uma
operadora devem ser adicionadas com `custom` ou biblioteca especializada.

### Códigos postais

Há padrões internos para BR, US, CA, GB, PT, DE e FR.

~~~javascript
cepBrasil: Field.postalCode("BR"),
zipCode: Field.postalCode("US")
~~~

Registre outro país:

~~~javascript
Field.registerPostalCode("NL", /^\d{4}\s?[A-Z]{2}$/i);
~~~

### CPF e CNPJ

~~~javascript
cpf: Field.cpf(),
cnpj: Field.cnpj()
~~~

Os validadores verificam os dígitos calculados e rejeitam sequências
repetidas.

### Outros documentos

~~~javascript
Field.registerDocument(
    "BR",
    "RG",
    value => validarRG(value)
);

class PessoaViewModel extends ViewModel {
    static fields = {
        rg: Field.document("RG", "BR")
    };
}
~~~

A ordem de RegisterDocument é país, tipo e função. A ordem de Field.document
é tipo, país e opções.

## Web Components

Um componente BindifyJS é um Custom Element real, criado com
customElements.define, Shadow DOM e slots.

Cada componente normalmente possui:

~~~text
components/
├── aviso.html
├── aviso.js
└── aviso.css
~~~

### Template do componente

~~~html
<!-- components/aviso.html -->
<template data-component="meu-aviso">
    <article>
        <header>
            <slot name="titulo"></slot>
        </header>

        <p data-bind="target: textContent; source: mensagem;"></p>

        <button data-event="event: click; method: fechar;">
            Fechar
        </button>
    </article>
</template>

<link rel="stylesheet" href="./aviso.css">
~~~

O nome do Custom Element precisa conter hífen. O arquivo pode conter style
inline, link de stylesheet externo ou ambos. O CSS é carregado dentro do
Shadow Root.

### Classe do componente

~~~javascript
// components/aviso.js
import { Component } from "../core/Component.js";
import { Field } from "../core/Field.js";

export default class Aviso extends Component {
    static properties = ["mensagem"];
    static methods = ["abrir", "fechar"];

    static fields = {
        mensagem: Field.string()
    };

    mensagem = "";

    abrir() {
        this.show();
        return this;
    }

    fechar() {
        this.hide();
        return this;
    }
}
~~~

- static properties define a API pública de propriedades.
- static methods define métodos publicados no elemento.
- static fields tipa e valida o estado.
- propriedades não publicadas permanecem internas ao ViewModel.

### Registrar e usar

Declare o componente na página consumidora:

~~~html
<link
    rel="component"
    href="components/aviso.html"
    script="components/aviso.js">
~~~

Depois use o elemento:

~~~html
<meu-aviso
    mensagem="Operação concluída."
    data-bind="target: mensagem; source: aviso; mode: twoway;">

    <h2 slot="titulo">Resultado</h2>
</meu-aviso>
~~~

O caminho de script é resolvido em relação à página que contém o link. CSS
referenciado dentro do arquivo do componente é resolvido em relação ao HTML
do componente.

### Propriedades e atributos

Por padrão, toda propriedade pública usa atributo e reflete alterações nos
dois sentidos:

~~~javascript
static properties = ["texto", "limiteMaximo"];
~~~

~~~html
<meu-componente texto="Olá" limite-maximo="10"></meu-componente>
~~~

camelCase é convertido para kebab-case.

~~~javascript
const componente = document.querySelector("meu-componente");

componente.texto = "Novo texto";
console.log(componente.getAttribute("texto")); // Novo texto

componente.setAttribute("texto", "Pelo atributo");
console.log(componente.texto); // Pelo atributo
~~~

O comportamento pode ser configurado no Field:

~~~javascript
static properties = [
    "titulo",
    "configuracao",
    "senha",
    "limiteMaximo"
];

static fields = {
    // Primitivos usam atributo e reflexão por padrão.
    titulo: Field.string()
        .valueIfEmpty("Sem título"),

    // Aceita o atributo, mas não escreve alterações de volta nele.
    configuracao: Field.object()
        .useAttribute(true)
        .useReflection(false),

    // Propriedade JavaScript pública sem canal por atributo.
    senha: Field.string()
        .useAttribute(false),

    // Usa o atributo HTML "max" em vez de "limite-maximo".
    limiteMaximo: Field.integer()
        .attributeName("max")
};
~~~

Defaults:

| Configuração | Valor padrão |
|---|---|
| useAttribute | true para primitivos; false para array e object |
| useReflection | mesmo valor efetivo de useAttribute |
| attributeName | camelCase convertido para kebab-case |
| valueIfEmpty | não definido; preserva o valor inicial da propriedade |

`useAttribute(false)` também torna o default de `useReflection` igual a false.
Uma chamada explícita de `useReflection(false)` permite usar o atributo somente
como entrada. `useReflection(true)` junto com `useAttribute(false)` é inválido.

~~~javascript
entrada: Field.string()
    .useAttribute(true)
    .useReflection(false),

estadoInterno: Field.object()
    .useAttribute(false)
~~~

`valueIfEmpty` é aplicado a null, undefined e strings vazias. false, zero,
arrays vazios e objetos vazios não são considerados vazios:

~~~javascript
quantidade: Field.integer().valueIfEmpty(10),
mensagem: Field.string().valueIfEmpty("Sem mensagem")
~~~

Quando um atributo é removido, a propriedade volta ao `valueIfEmpty`, quando
configurado, ou ao valor inicial declarado na classe do componente.

Alterar um atributo:

1. converte o valor de acordo com Field;
2. atualiza o ViewModel interno;
3. emite bindify-property-change com property e value;
4. atualiza uma source externa quando houver binding twoway.

~~~html
<meu-componente
    data-bind="target: texto; source: mensagem; mode: twoway;">
</meu-componente>
~~~

Booleanos usam presença/ausência do atributo e números são convertidos pelo
Field. Arrays e objetos são property-only por padrão. Quando `useAttribute(true)`
for explícito, o atributo deve conter JSON válido:

~~~html
<lista-resumo itens='[{"id":1,"nome":"Primeiro"}]'></lista-resumo>
~~~

Para senhas, tokens e outros valores que não devem aparecer no DOM, use
`useAttribute(false)`.

### Métodos públicos

~~~javascript
const aviso = document.querySelector("meu-aviso");
aviso.abrir();
aviso.fechar();
~~~

Somente métodos listados em static methods são publicados no elemento host.

### Eventos do componente

Use emit para criar um CustomEvent que atravessa o Shadow DOM:

~~~javascript
confirmar() {
    this.emit("confirmar", {
        id: this.id,
        valor: this.valor
    });
}
~~~

Por padrão, o evento usa bubbles: true e composed: true.

~~~html
<meu-editor
    data-event="event: confirmar; method: salvarEdicao;">
</meu-editor>
~~~

~~~javascript
salvarEdicao(event) {
    console.log(event.detail);
}
~~~

Opções podem ser sobrescritas:

~~~javascript
this.emit("cancelar", null, {
    bubbles: false,
    composed: false,
    cancelable: true
});
~~~

### Mostrar e esconder

Component fornece helpers que controlam hidden no host:

~~~javascript
this.hide();
this.show();
~~~

Para expor esses helpers como API pública, crie métodos listados em
static methods, como no componente Aviso.

### Ciclo de vida

~~~javascript
export default class Relogio extends Component {
    static fields = {
        horario: Field.string()
    };

    horario = "";
    timer = null;

    async initialize() {
        // Executa uma única vez por instância.
        this.horario = await carregarHorarioInicial();
    }

    connected() {
        // Executa em cada conexão ao documento.
        this.use(
            setInterval(() => {
                this.horario = new Date().toLocaleTimeString();
            }, 1000),
            timer => clearInterval(timer)
        );
    }
}
~~~

O host expõe uma Promise ready associada à inicialização:

~~~javascript
const relogio = document.querySelector("meu-relogio");
await relogio.ready;
~~~

Ao remover e reinserir um componente:

- o Shadow Root e o ViewModel são preservados;
- initialize não é repetido;
- bindings, eventos e observadores são religados;
- connected e disconnected acompanham cada conexão;
- recursos registrados com use são liberados em cada desconexão;
- um segundo Shadow Root não é criado.

## Referências de elementos

Use `data-element-ref` quando o ViewModel precisar chamar uma API imperativa
do DOM, como câmera, canvas, foco, seleção ou reprodução de mídia:

~~~html
<video data-element-ref="camera" autoplay playsinline></video>
<canvas data-element-ref="cameraCanvas" hidden></canvas>
~~~

~~~javascript
class CadastroViewModel extends ViewModel {
    camera = null;
    cameraCanvas = null;

    async iniciarCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        this.camera.srcObject = stream;
        await this.camera.play();
    }
}
~~~

A propriedade precisa existir previamente no ViewModel. Uma referência não
pode ser usada por dois elementos simultaneamente. Quando o elemento é
removido, o valor anterior da propriedade é restaurado. O mecanismo funciona
também em componentes com Shadow DOM.

## DOM dinâmico

O Runtime usa MutationObserver para ligar automaticamente elementos inseridos
depois da inicialização:

~~~javascript
const output = document.createElement("output");
output.dataset.bind =
    "target: textContent; source: mensagem; mode: oneway;";
document.body.append(output);
~~~

Alterações nos atributos data-element-ref, data-bind, data-event,
data-command e data-validation-for também refazem os respectivos bindings.
Elementos removidos têm referências, listeners e subscriptions liberados.

## Plugins do runtime

Plugins observam o lifecycle da aplicação sem acoplar telemetria, sessão ou
infraestrutura às ViewModels:

~~~javascript
const removeTelemetry = BindifyJS.use({
    beforeStart(context) {
        telemetry.mark("bindify:start");
    },

    afterStart(context) {
        telemetry.measure("bindify:ready");
    },

    beforeStop(context) {
        telemetry.mark("bindify:stop");
    },

    afterStop(context) {
        telemetry.flush();
    },

    onError(error, context) {
        telemetry.capture(error, context);
        return true;
    }
});
~~~

Os hooks são executados na ordem de registro e podem ser assíncronos.
`use()` devolve uma função que remove o plugin. Os hooks disponíveis são
`beforeStart`, `afterStart`, `beforeStop`, `afterStop` e `onError`.
Em `onError`, retornar `true` marca a falha como tratada e evita a chamada ao
`onError` da ViewModel e o log padrão; retorne `false` ou `undefined` quando o
plugin apenas registrar a falha.

Erros de `beforeStart` ou `afterStart` encerram e limpam a inicialização.
Erros de hooks de parada são enviados ao error boundary, mas não impedem o
cleanup. Cada instância de `Bindify` possui plugins, converters e configuração
próprios.

## Configuração de desenvolvimento e produção

Configure antes de iniciar:

~~~javascript
BindifyJS.configure({
    development: false
});
~~~

Ao definir `development: false`, os defaults relacionados passam a:

~~~javascript
{
    development: false,
    exposeViewModel: false,
    detailedErrors: false
}
~~~

- `exposeViewModel: false` não publica a ViewModel em
  `document.documentElement.viewModel` nem no host público de componentes;
- `detailedErrors: false` mantém o erro original para plugins e `onError`, mas
  publica somente uma mensagem e um contexto sanitizados em `errorState` e no
  erro de inicialização exibido pela página.

As opções podem ser controladas individualmente:

~~~javascript
BindifyJS.configure({
    development: false,
    exposeViewModel: true,
    detailedErrors: false
});
~~~

Essa configuração reduz exposição acidental e detalhes em mensagens, mas não
impede inspeção do JavaScript recebido pelo navegador e não bloqueia DevTools.

## API pública

BindifyJS.js publica a API como módulo e em globalThis.BindifyJS.

### Política de nomes

Cada operação possui somente um nome público. Classes e construtores usam
PascalCase; métodos, propriedades, factories e regras usam camelCase; atributos
HTML usam kebab-case.

Exemplos canônicos: `Field.string().required().maxLength(80)`,
`viewModel.clearErrors()` e `BindifyJS.start()`. Não existem aliases com nomes
antigos ou diferenças apenas de caixa.

~~~javascript
import BindifyJS, {
    Bindify,
    ViewModel,
    Field,
    Component
} from "./BindifyJS.js";
~~~

Principais membros:

| API | Finalidade |
|---|---|
| start(root) | Carrega componentes e inicia o ViewModel declarado. |
| stop(root) | Desliga bindings, cancela pendências, chama dispose e libera recursos. |
| bindDocument(viewModel, root) | Liga templates, bindings, eventos e validações. |
| unbindDocument(root) | Libera bindings e templates de uma árvore. |
| observeBindings(viewModel, root) | Observa mudanças dinâmicas no DOM. |
| makeObservable(value) | Cria um objeto observável. |
| parseBinding(text) | Analisa uma declaração de binding. |
| parseEvent(text) | Analisa uma declaração de evento. |
| parseItems(text) | Analisa uma declaração data-bind-items. |
| loadComponents(root) | Carrega links rel="component". |
| use(plugin) | Registra um plugin do lifecycle. |
| configure(options) | Define comportamento de desenvolvimento e produção. |
| registerConverter(name, converter) | Registra transformação para bindings. |

Classes também exportadas:

- Path
- BindingParser
- Observable
- ViewModel
- Field
- Component
- Binder
- EventBinder
- TemplateBinder
- ValidationBinder
- ItemsBinder
- BindingGroupBinder
- ElementRefBinder
- ComponentLoader
- Runtime
- Application
- ConverterRegistry
- Command
- CommandBinder

### Instância independente

~~~javascript
import { Bindify } from "./BindifyJS.js";

const app = new Bindify();
const viewModel = await app.start(document);
~~~

BindifyJS.js não inicia aplicações como efeito colateral. Para bootstrap
automático, carregue BindifyJS.auto.js. Esse módulo também exporta
`startApplication` e `stopApplication`.

### Testes

~~~powershell
npm test
~~~

A suíte usa o test runner nativo do Node e cobre normalização tipada,
`fieldState`, baseline/reset, cancelamento assíncrono, transações de grupos,
objetos observáveis, proteção de caminhos, atributos seguros, inicialização
concorrente, rollback, eventos assíncronos e componentes duplicados.

## Verificações e erros antecipados

Durante a inicialização, BindifyJS verifica:

- se html declara viewmodel;
- se a classe existe em globalThis e herda de ViewModel;
- se cada campo declarado realmente existe;
- se os descritores de static fields foram criados por Field;
- se todo target existe no elemento;
- se toda source existe no ViewModel;
- se sources existem e são compatíveis com o modo do binding;
- se métodos de data-event existem;
- se data-validation-for aponta para campo declarado;
- se condições e coleções existem;
- se componentes possuem nome com hífen;
- se propriedades e métodos públicos existem;
- se chaves de listas são válidas e únicas;
- se JSON de atributos de Array e Object é válido.

Esses erros são intencionais: bindings incorretos falham na inicialização em
vez de permanecer silenciosamente quebrados.

## Exemplo de login incluído

LoginPage.html demonstra em conjunto:

- ViewModel de página com initialize assíncrono;
- carregamento de JSON por fetch;
- componente login-form com validação interna;
- commit transacional com data-binding-group e `groupcommit`;
- commits parciais por ação para recuperação de senha;
- navegação sem commit para o exemplo de cadastro;
- bindings twoway entre página e componente;
- eventos personalizados entrar e limpar;
- componente mensagem-card com método público;
- Shadow DOM, CSS encapsulado e slots;
- data-if, data-else e data-for;
- histórico limitado a dez itens;
- mensagens de validação e atributos ARIA.

Arquivos principais:

~~~text
LoginPage.html
LoginPageViewModel.js
components/login.html
components/login.js
components/login.css
components/card.html
components/card.js
components/card.css
mocks/logins.json
~~~

## Limitações atuais

- `custom` é síncrono; validadores assíncronos devem usar `customAsync`.
- O carregador link rel="component" pertence ao BindifyJS; não é uma tag padrão
  da plataforma Web.
- Componentes associados nativamente a formulários por ElementInternals ainda
  não estão implementados.
- Propriedades e atributos não possuem serializadores personalizados além dos
  tipos e do JSON fornecidos por Field.
- Não há etapa de build, empacotamento ou resolução automática de imports.

## Segurança e conteúdo confiável

BindifyJS não usa `eval`, `new Function` ou `innerHTML` para aplicar dados de
bindings. Texto interpolado, mensagens de validação e itens de listas são
escritos com `textContent`.

Os caminhos de binding rejeitam `__proto__`, `prototype` e `constructor`.
Templates `data-for` não permitem interpolação em atributos `on*`, `srcdoc` ou
`style`. Atributos de URL aceitam caminhos relativos e os protocolos `http`,
`https`, `mailto` e `tel`; protocolos executáveis e URLs `data:` são
rejeitados.

Arquivos de componentes, scripts declarados em `link[rel="component"]` e o
HTML da aplicação são código confiável da aplicação. Não carregue componentes
de origens não controladas. Regras de `Field` são validação de interface e
nunca substituem autenticação, autorização, sanitização e validação no
servidor.

O exemplo de cadastro captura uma imagem para exercitar câmera, bindings,
validação e cleanup. Ele não implementa reconhecimento facial, comparação de
templates biométricos nem prova de vida. Em produção, a imagem deve ser enviada
por canal seguro a um serviço biométrico apropriado, com consentimento,
retenção mínima, criptografia e atendimento à legislação aplicável. A imagem
capturada não é gravada no `sessionStorage` pelo exemplo.

Objetos observáveis preservam instâncias como `Date`, `Map`, `Set`, elementos
DOM e classes da aplicação. A observação profunda é aplicada a arrays e
objetos simples. Referências compartilhadas mantêm identidade e notificam
todos os caminhos pelos quais foram observadas.

## Licença

BindifyJS é distribuída sob a licença MIT. Você pode usar, copiar, modificar,
publicar e distribuir a biblioteca, inclusive em projetos comerciais, desde
que preserve o aviso de copyright e a licença.

Copyright (c) 2026 Castello Branco Tecnologia LTDA  
Copyright (c) 2026 Cesar Castello Branco Filho

Consulte o arquivo [LICENSE](./LICENSE) para ler os termos completos.
