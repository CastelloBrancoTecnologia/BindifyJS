# BindifyJS patterns

## Minimal page

Declare `viewmodel="TypeName"` on `<html>`, load the ViewModel module, then
load `BindifyJS.auto.js`. Assign the type to `globalThis.TypeName`.

## Property binding

```html
<input data-bind="target: value; source: nome; mode: twoway;">
<output data-bind="target: textContent; source: nome;"></output>
```

Modes: `oneway`, `twoway`, `onetime`, `onewaytosource`. Use `when:
lostfocus` or `when: groupcommit` only for bindings that write to the source.

## Fields and validation

```js
static fields = {
    email: Field.email().required("Informe o e-mail.")
};
```

```html
<small data-validation-for="email"></small>
```

Keep every rule and message in `Field`. Read state through
`fieldState.email.valid`, `changed`, `pending` and `error`.

## Calculated values

```js
static fields = {
    nome: Field.string().alsoChanges("nomeCompleto"),
    sobrenome: Field.string().alsoChanges("nomeCompleto")
};

get nomeCompleto() {
    return `${this.nome} ${this.sobrenome}`.trim();
}
```

## Events and commands

```html
<button data-event="event: click; method: limpar;">Limpar</button>
<button data-command="saveCommand">Salvar</button>
```

Use events for direct routing. Use Commands when availability, pending or
concurrency matters.

## Lists and collections

Use `<template data-for="item in itens" data-for-key="id">` for arbitrary DOM.
Use `data-bind-items` only for `select` and `datalist`.

## Visual state

```html
<section
  data-class="error: hasErrors; pending: loading;"
  data-css-var="progress: progress; accent: theme.accent;">
</section>
```

Keep transitions, animations, `calc()` and `var()` in CSS.

## Binding groups

Put `data-binding-group` on the container, use `when: groupcommit` in its
editable bindings and trigger with `data-binding-commit` or
`data-binding-cancel`. Validation remains defined by `Field`.

## Web Components

Extend `Component`, declare public properties/methods explicitly and keep
resources inside lifecycle cleanup. Preserve attribute/property reflection
rules defined by each `Field`.
