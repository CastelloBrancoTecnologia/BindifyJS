# Receitas mínimas

Cada pasta contém uma página executável e um ViewModel pequeno. Sirva a raiz
do repositório por HTTP e abra o `index.html` desejado.

- `basic-binding`: binding one-way, two-way e getter calculado.
- `validation`: Fields, mensagens e estado visual de erro.
- `command`: Command, canExecute e pending.
- `list`: template reativo com chave estável.
- `visual-state`: `data-class`, `data-css-var`, animação e `calc()`.
- `binding-group`: edição transacional, commit e cancelamento.

Exemplo:

```text
python -m http.server 8000
```

```text
http://127.0.0.1:8000/examples/basic-binding/
```
