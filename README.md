# ember-semantic-forms

This ember addon offers frontend-side components and services to work with forms managed by the [form-content-service](https://github.com/lblod/form-content-service/)

## Compatibility

- Ember.js v4.4 or above
- Ember CLI v4.4 or above
- Node.js v14 or above

## Installation

```
ember install @lblod/ember-semantic-forms
```

### Required setup

Installing the addon is not enough to get a working setup. The addon talks to
the form-content-service over HTTP and expects that service to be reachable.

**1. Route `/form-content` to the form-content-service.**

Every request the addon makes is prefixed with `/form-content`. The prefix is
hardcoded: the addon does not read `ENV.API` or any other configuration, so you
cannot point it somewhere else. Add rules to your app's `dispatcher.ex` so that
`/form-content/*` reaches the service, e.g.:

```elixir
match "/form-content/*path", Proxy.forward_to_service("form-content")
```

If these rules are missing, every request fails with a 404 and no form will
load.

**2. Provide a session.**

Writes (creating, updating and deleting instances) and the history endpoints go
through mu-auth on behalf of the logged-in user, so the requests must carry a
`mu-session-id`. The service returns `401 Not authenticated` without it. Your
app is responsible for sending the session cookie/header; the addon does not
manage authentication.

**3. Services your app must provide.**

Some components inject services from the host app and will fail at runtime if
they are absent:

- `toaster` — used by `SemanticForms::InstanceTable`.
- `store` (ember-data) — used by `SemanticForms::History`, which queries the
  `gebruiker` model to resolve the users in the history list. Without a
  `gebruiker` model the history table breaks.

For an example use of this plugin, have a look at [the LMB frontend](https://github.com/lblod/frontend-lokaal-mandatenbeheer/).

## Requirements on the form definition

The addon renders whatever `formTtl` the service returns, but the service has
strict expectations about the shape of a form definition. Listing, reading and
saving instances only work if the definition:

- declares `form:targetType`;
- uses the same predicate for `form:targetLabel` as the `sh:path` of a field
  that is part of `form:includes`;
- ensures every instance carries a `mu:uuid`, typically by setting
  `form:dataGenerator form:addMuUuid` on the form's generator.

Forms that do not follow these conventions fail with an
`Unsupported Form: did not specify target type` or `no valid target label
supplied` error. See the [form-content-service
documentation](https://github.com/lblod/form-content-service#form-definition-conventions)
for the full list of conventions.

## Usage

### Fetching Form Definitions

A form definition is the description of which fields should be present in a form. It is used to render a form which is then used to create or edit form instances.

The form-content-service identifies a definition by its id, not by its URI. The
id is the value of `mu:uuid` on the definition, i.e. the id part of
`http://data.lblod.info/id/lmb/forms/<id>`. If you have a definition URI, pass
the uuid, not the full URI.

Given a form definition id, you can use the semantic forms repository to fetch
a form definition:

```js
import { service } from '@ember/service';

export default class MyComponent extends Component {
  @service semanticFormRepository;

  async load() {
    const definition = await this.semanticFormRepository.getFormDefinition(
      semanticFormId
    );
  }
}
```

`getFormDefinition(id, noCache = false)` returns a `Definition` object with the
shape:

| property      | type      | description                                                                                   |
| ------------- | --------- | --------------------------------------------------------------------------------------------- |
| `id`          | `string`  | the definition id you passed in                                                               |
| `formTtl`     | `string`  | turtle describing the form                                                                    |
| `metaTtl`     | `string`  | turtle with helper data, e.g. concept schemes; may be `null`                                  |
| `prefix`      | `string`  | URI prefix used to mint new instance URIs; defaults to `http://data.lblod.info/form-data/instances/` |
| `withHistory` | `boolean` | whether the service tracks a history for instances of this form                               |

Definitions are cached per id for the lifetime of the service. Pass
`noCache = true` as the second argument to bypass the cache and refetch. You
need this after editing a form definition, otherwise you keep rendering the
definition you loaded first.

Note that `prefix` and `withHistory` are part of the contract the addon relies
on: `SemanticForms::NewInstance` builds the instance URI as
`${definition.prefix}${uuid()}`. If the service ever responds without a
`prefix`, new instances get the URI `undefined<uuid>`.

### Service API

`semanticFormRepository` exposes more than `getFormDefinition`. All of these
are `async` methods unless noted otherwise.

| method                                                                 | description                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `getFormDefinition(id, noCache = false)`                               | fetch a definition, see above                                                                         |
| `createFormInstance(instanceUri, definitionId, ttlCode)`               | create an instance, returns `{ id, errorMessage }`                                                    |
| `updateFormInstance(instanceId, instanceUri, definitionId, ttlCode, description)` | update an instance, returns `{ body, errorMessage }`                                        |
| `fetchInstances(definition, options)`                                  | list instances. `options` supports `page`, `size`, `sort`, `filter` and `labels`. Returns `{ instances, formDefinition, labels }` |
| `getHeaderLabels(formId)`                                              | the configurable column labels for the instance table                                                |
| `getInstanceUsageCount(instanceId)`                                    | returns `{ hasUsage, count }` for inbound references                                                  |
| `loadFormInto(store, definition, sourceTtl, graphs)`                   | parse a definition plus data into a `ForkingStore`. `graphs` must contain `{ formGraph, metaGraph, sourceGraph }` |
| `isValidForm(formInfo)`                                                | validate a loaded form, returns a boolean                                                             |
| `validateForm`                                                         | **an ember-concurrency task, not a promise.** Call `validateForm.perform(formInfo, cb)`; use `.isRunning` for the busy state |

The `formInfo` object expected by `isValidForm` and `validateForm` has the
shape `{ formStore, formNode, graphs, sourceNode }`, which is exactly what the
components build internally.

`validateForm` debounces by 250 ms, so validation results are not available
synchronously and `.isRunning` stays `true` for at least that long.

### Error handling

The repository does not use a single failure mode:

- `createFormInstance` and `updateFormInstance` **never throw** on HTTP errors.
  They return `{ errorMessage: '...' }`, already translated to Dutch, and you
  are expected to show it.
- `fetchInstances`, `getFormDefinition`, `getHeaderLabels` and
  `getInstanceUsageCount` **throw** an `Error` whose `.status` is set to the
  HTTP status. Wrap these in `try`/`catch` if you want to react to them.

FIXME it could be worthwhile picking a single approach

### Cache timeout after writes

`createFormInstance` and `updateFormInstance` wait 1000 ms before resolving.
This is a deliberate workaround while waiting for backend driven frontend
revalidation: the resource cache is invalidated by the write, but the service
does not wait for that before responding. As a result:

- a save always takes at least one second, which matters in tests;
- in tests you will need to advance/await that time (`waitFor`) rather than
  expecting the promise to settle immediately.

See `RESOURCE_CACHE_TIMEOUT` in `addon/utils/constants.js`.

### Create new instances for a Form

Once you have the form definition, you can use the `SemanticForms::NewInstance` component to create new instances for the form:

```hbs
<SemanticForms::NewInstance
  @onCreate={{this.closeModal}}
  @onCancel={{this.closeModal}}
  @form={{this.bestuursperiodeFormDefinition}}
  @buildSourceTtl={{this.buildSourceTtl}}
  @buildMetaTtl={{this.buildMetaTtl}}
/>
```

This has the following parameters:

- `@onCreate`: an action to call when the creation completes. It receives
  `{ instanceTtl, instanceId }`: the turtle that was stored and the id of the
  newly created instance. Use `instanceId` if you need to navigate to or
  reference the new instance.
- `@onCancel`: an action to call when the creation is cancelled. When omitted,
  the "Annuleer" button is not rendered.
- `@form`: the form definition to create instances for
- `@buildSourceTtl`: an action that allows a source ttl to be created, returns a ttl string. It receives the URI that was minted for the new instance, so you can use it as the subject of the initial triples. This can set starting values for fields.
- `@buildMetaTtl`: an action that handles a meta ttl to be created, returns a ttl string. This can set helper values about the form, e.g. helper data for custom components.
- `@beforeCreate(ttlCode, instanceUri)`: an optional action that runs right
  before the POST, after the user has filled in the form. It receives the
  serialized turtle and the instance URI and must return the turtle to store.
  Use it for last-minute normalisation; throwing from it aborts the save and
  the error is shown in the form. It is the last hook, so it runs after
  `@buildSourceTtl` and after the user input rather than before.
- `@formInitialized`: an action called once the form store is loaded and its
  observer registered. Useful to hide a skeleton.

Note that the create button is disabled while the form is invalid, which
includes the 250 ms validation window after every edit.

### Edit form instances

Given a form definition and an instance id, you can edit the instance like this:

```hbs
<SemanticForms::Instance
  @instanceId={{@mandataris.id}}
  @form={{@form}}
  @customHistoryMessage={{true}}
  @onCancel={{this.toggleModal}}
  @onSave={{this.onSave}}
  @formInitialized={{this.onFormInitialized}}
  @buildMetaTtl={{this.buildMetaTtl}}
  @initialFormTtl={{this.initialFormTtlResource}}
/>
```

This component has the following parameters:

- `@instanceId`: the id of the form instance to edit. This is the `mu:uuid` of
  the instance, not its URI.
- `@form`: the form definition to edit an instance for
- `@customHistoryMessage`: when `true`, pressing save first opens a modal
  asking the user for a description of the change. That description is sent
  along with the update and ends up as the history entry's `dct:description`.
  When `false` or omitted, the save happens immediately and no description is
  sent, so the service falls back to its own behaviour. This is **not** about
  editing an existing history message; it only affects the message written for
  the update you are about to perform.
- `@onCancel`: action to run when the form edit is cancelled. When omitted, the
  "Annuleer" button is not rendered — unlike in `NewInstance`, where the button
  is always rendered but the action may be missing.
- `@onSave`: action to run when the form is saved. It receives
  `{ instanceId, instanceTtl, response }`, where `response` is the parsed body
  returned by the service.
- `@beforeSave(ttlCode, instanceUri)`: optional action that runs right before
  the PUT. Same contract as `@beforeCreate` on `NewInstance`: return the turtle
  to store, throw to abort.
- `@formInitialized`: action to run when the form is initialized. Fires after
  the store is loaded and the first observer callback has run.
- `@buildMetaTtl`: an action that handles a meta ttl to be created, returns a ttl string. This can set helper values about the form, e.g. helper data for custom components.
- `@initialFormTtl`: an ember-resource instance that has the initial form ttl to be set for the instance. If this is present, the current ttl values of the form instance will be ignored; the resource's `.current` is used instead. This is useful when resetting the form instance to a historic version for instance.
- `@saveTitle`: label for the save button. Defaults to `"Pas aan"`.
- `@show`: when `true`, renders the form read-only and hides the whole
  toolbar, including the save and cancel buttons.
- `@formClass`: CSS class for the form element. Defaults to
  `au-u-max-width-medium`. Pass e.g. `au-u-flex` when the form has to span a
  wider or custom layout.
- `@hideDescriptionModalOnSave`: accepted for compatibility but **not
  implemented**. It has no effect. Use `@customHistoryMessage` to control the
  history modal.

### History

Form instances keep a history of the updates performed on them. It tracks the date of the update, the user who did the update and the values at the time of the update. This component allows you to see a history instance and restore it.

```hbs
<SemanticForms::History
  @instanceId={{@model.id}}
  @form={{@model.form}}
  @onRestore={{this.onRestore}}
/>
```

It takes the following parameters:

- `@instanceId`: the id of the form instance to see the history for
- `@form`: the form definition to see the history for
- `@onRestore`: an action to be called when a restore is requested.

The component fetches 10 entries per page and paginates internally; there are no
`@page`/`@size` arguments. It also resolves the `dct:creator` of each entry
through ember-data, so it needs a `gebruiker` model in the host app.

This `@onRestore` action is meant to do the actual restore, the component
doesn't do it for you. The action receives the parsed body of
`GET /form-content/history?historyUri=...`, which is an object of the shape
`{ formInstanceTtl }`:

```js
import { trackedFunction } from 'reactiveweb/function';

@action
async onRestore({ formInstanceTtl }) {
  this.initialFormTtl = trackedFunction(this, async () => formInstanceTtl);
}
```

Be aware that the service sets a `text/turtle` content type on this response
while actually sending a JSON-serialized object. The addon calls `response.json()`,
which works today because of that serialization, but it breaks if the service
ever starts sending real turtle.

FIXME: this is kind of weird and we should fix this in the service

An example of such a restoration of a historic version could be showing the
user a modal with a `SemanticForms::Instance` with `@initialFormTtl` set to that
turtle. Restoring is not symmetric: the history entry only contains the
properties controlled by the form definition that was used to make the update,
so restoring it can wipe properties that other form definitions manage. See the
caution in the form-content-service docs.

### Listing Instances

You can list form instances that belong to a certain form by using the `SemanticForms::InstanceTable` component. The search can become very inefficient though as it does a lower-cased string contains function on all objects of the form instance (and it will not even find nested path values). In general, it can be better to use a mu-resource-based/mu-search-based approach to rendering the instances and then using forms to edit them.

```hbs
<SemanticForms::InstanceTable
  @sort={{this.sort}}
  @page={{this.page}}
  @size={{this.size}}
  @filter={{this.filter}}
  @search={{this.search}}
  @formDefinition={{this.model.formDefinition}}
  @onRemoveInstance={{this.onRemoveInstance}}
  @editRoute="forms.form.instance"
>
  <:extraActions>
    <AuButton role="menuitem" @skin="link" {{on "click" this.myAction}}>
      Some extra action
    </AuButton>
  </:extraActions>
</SemanticForms::InstanceTable>
```

This component takes the following parameters:

- `@sort`: the field to sort on
- `@page`: the page to show
- `@size`: the number of items per page
- `@filter`: the search string to use
- `@search`: an action to search on the input provided by the user. Expected to set the filter parameter.
- `@formDefinition`: the form definition to use
- `@onRemoveInstance`: an action to call when an instance is removed. It
  receives the **id** of the removed instance, not the instance itself.
- `@editRoute`: the route to transition to when the user clicks on edit for an instance
- `@title`: heading of the table. Defaults to `"<definitionId> beheer"`.
- `@description`: description shown under the heading.
- `@newFormRoute`: route used by the always-rendered "Voeg item toe" button.
  Defaults to `forms.form.new`. The definition id is passed as the model.
- `@noDataMessage`: text shown when the table is empty. Defaults to
  `"Geen instance gevonden."`.
- `@showDownloadButton`: renders the CSV download option in the overflow menu.
- `@onTableLoaded`: accepted but never called. Do not rely on it.

It also yields a named block, `:extraActions`, which is rendered inside the
"Meer acties" dropdown. Use it to add actions such as editing or deleting the
form definition itself.

FIXME Things that may surprise consumers and could warrant an update:

- The "Voeg item toe" link is always rendered. The component is not usable as a
  read-only table.
- The rows in `instances` are plain objects of the shape
  `{ uri, id, <labelName>: value, ... }`, augmented with `meta.count` and
  `meta.pagination`. They are **not** ember-data records, even though
  `AuDataTable` makes them look like it.
- All UI strings are hardcoded Dutch ("Bewerk", "Verwijder", "Zoek...",
  "Voeg item toe").
- The component injects `toaster` and calls `toaster.success` after starting a
  download.
