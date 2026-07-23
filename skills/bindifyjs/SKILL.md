---
name: bindifyjs
description: Build, modify, review, debug, or test declarative browser applications that use BindifyJS, including ViewModels, Fields, data-bind, data-event, Commands, binding groups, lists, validation, CSS state, lifecycle cleanup, and BindifyJS Web Components. Use when working in a BindifyJS repository or when a user asks to create BindifyJS HTML/JavaScript without a build step.
---

# BindifyJS

Build applications with native HTML, CSS and JavaScript. Keep presentation in
CSS, declarations in HTML and behavior in the ViewModel.

## Workflow

1. Inspect `package.json`, `BindifyJS.js`, `BindifyJS.d.ts` and the affected
   example before changing code.
2. Read `references/patterns.md` for the feature being used.
3. Prefer an existing recipe under `examples/` as the starting pattern.
4. Declare state as ViewModel properties and describe typed/validated
   properties in `static fields`.
5. Bind only existing DOM targets and ViewModel paths.
6. Keep asynchronous work in ViewModel methods or Commands. Use resource
   cleanup and cancellation when work outlives an event.
7. Run `npm test`. For browser behavior, serve the repository over HTTP and
   exercise the affected example.

## Design rules

- Do not add a build requirement, framework dependency or TypeScript runtime.
- Do not put arbitrary JavaScript expressions in declarative attributes.
- Use `data-class` for conditional classes and `data-css-var` for CSS custom
  properties. Do not replace whole `class` or `style` attributes unnecessarily.
- Use `Field` as the single definition of validation rules and messages.
- Use `alsoChanges` when a source change must notify a calculated getter or
  method.
- Use `Command` for actions with `canExecute`, pending state or concurrency
  control; use `data-event` for ordinary event-to-method routing.
- Ensure every resource, listener, subscription and pending asynchronous
  operation has cleanup.

## Library changes

When changing BindifyJS itself, follow the repository `AGENTS.md`. Update the
runtime integration, public export, `.d.ts`, README, recipe and tests together.
Validate inputs before mutating the DOM and restore original element state
during cleanup.

## References

- Read `references/patterns.md` for binding and ViewModel patterns.
- Read the root `README.md` only when full API detail is required.
- Use `examples/README.md` to select a minimal executable recipe.
