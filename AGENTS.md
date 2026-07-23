# Guia para agentes

## Objetivo

Desenvolva BindifyJS como um motor declarativo para navegador, sem etapa de
build e sem dependências de runtime. Preserve a filosofia KISS: HTML descreve
bindings, CSS descreve apresentação e ViewModels concentram comportamento e
regras de negócio.

## Organização

- `core/`: motor e binders independentes.
- `BindifyJS.js`: composição e API pública.
- `BindifyJS.d.ts`: contrato de tipos mantido manualmente.
- `examples/`: receitas mínimas, executáveis e focadas.
- `tests/`: testes unitários com `node:test`.
- páginas na raiz: casos de uso completos.
- `skills/bindifyjs/`: instruções para agentes que usam a biblioteca.

## Convenções

- Use JavaScript e HTML nativos; não introduza compilador obrigatório.
- Use camelCase para propriedades, métodos e APIs públicas JavaScript.
- Não crie aliases para APIs renomeadas durante a fase alpha.
- Mantenha gramáticas declarativas restritas a nomes, caminhos e opções
  conhecidas. Não use `eval` nem execute expressões arbitrárias do HTML.
- Coloque regras e mensagens de validação somente em `Field`.
- Preserve classes, atributos e estilos que não pertençam ao binding.
- Todo binder precisa validar antes de alterar o DOM e restaurar o estado
  original no cleanup.
- Toda funcionalidade pública deve funcionar em DOM adicionado dinamicamente.
- Erros precisam identificar o atributo, target, source ou opção inválida.

## Alterações na API

Ao adicionar ou mudar uma API pública:

1. implemente no módulo responsável;
2. integre ao runtime e ao cleanup;
3. exporte em `BindifyJS.js`;
4. atualize `BindifyJS.d.ts`;
5. documente no `README.md`;
6. adicione ou atualize uma receita em `examples/`;
7. cubra sucesso, erro e cleanup em `tests/`.

## Verificação

Execute:

```text
npm test
```

Não considere uma alteração concluída enquanto os testes falharem. Teste
também a página de exemplo afetada em um servidor HTTP quando a mudança
envolver comportamento real do navegador.

## Segurança

- Trate HTML da aplicação e componentes como código confiável, mas dados de
  ViewModels como conteúdo.
- Prefira `textContent` para dados.
- Bloqueie caminhos que alcancem prototypes.
- Não confunda validação de interface com autorização ou validação do servidor.
- Nunca prometa impedir inspeção pelo DevTools; código entregue ao navegador é
  observável pelo usuário.
