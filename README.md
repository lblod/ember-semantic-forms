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

## Usage

### Fetching Form Definitions

A form definition is the description of which fields should be present in a form. It is used to render a form which is then used to create or edit form instances. Given a form definition id, you can use the semantic forms repository to fetch a form definition:

```
    @service semanticFormRepository;
    [...]
    const definition =
      await this.semanticFormRepository.getFormDefinition(semanticFormID);
```

### Create new instances for a Form

Once you have the form definition, you can use the `SemanticForms::NewInstance` component to create new instances for the form:

```
<SemanticForms::NewInstance
  @onCreate={{this.closeModal}}
  @onCancel={{this.closeModal}}
  @form={{this.bestuursperiodeFormDefinition}}
  @buildSourceTtl={{this.buildSourceTtl}}
  @buildMetaTtl={{this.buildMetaTtl}}
/>
```

This has the following parameters:

- @onCreate: an action to call when the creation completes
- @onCancel: an action to call when the creation is cancelled
- @form: the form definition to create instances for
- @buildSourceTtl: an action that allows a source ttl to be created, returns a ttl string. This can set starting values for fields.
- @buildMetaTtl: an action that handles a meta ttl to be created, returns a ttl string. This can set helper values about the form, e.g. helper data for custom components.

### Edit form instances

Given a form definition and an instance id, you can edit the instance like this:

```
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

- @instanceId: the id of the form instance to edit
- @form: the form definition to edit an instance for
- @customHistoryMessage: allow editing the form history message if this is set to true
- @onCancel: action to run when the form edit is cancelled
- @onSave: action to run when the form is saved
- @formInitialized: action to run when the form is initialized
- @buildMetaTtl: an action that handles a meta ttl to be created, returns a ttl string. This can set helper values about the form, e.g. helper data for custom components.
- @initialFormTtl: an ember-resource instance that has the initial form ttl to be set for the instance. If this is present, the current ttl values of the form instance will be ignored. This is useful when resetting the form instance to a historic version for instance.

### History

Form instances keep a history of the updates performed on them. It tracks the date of the update, the user who did the update and the values at the time of the update. This component allows you to see a history instance and restore it.

```
  <SemanticForms::History
    @instanceId={{@model.id}}
    @form={{@model.form}}
    @onRestore={{this.onRestore}}
  />
```

It takes the following parameters:

- @instanceId: the id of the form instance to see the history for
- @form: the form definition to see the history for
- @onRestore: an action to be called when a restore is requested.

This `@onRestore` action is meant to do the actual restore, the component doesn't do it for you. The action receives a `historicalInstance` with the `formInstanceTtl` that was active at the time. An example of such a restoration of a historic version could be showing the user a modal with a `SemanticForms::Instance` with the `@initialFormTtl` set to the `historicalInstance.formInstanceTtl`.

### Listing Instances

You can list form instances that belong to a certain form by using the `SemanticForms::InstanceTable` component. The search can become very inefficient though as it does a lower-cased string contains function on all objects of the form instance (and it will not even find nested path values). In general, it can be better to use a mu-resource-based/mu-search-based approach to rendering the instances and then using forms to edit them.

```
<SemanticForms::InstanceTable
  @sort={{this.sort}}
  @page={{this.page}}
  @size={{this.size}}
  @filter={{this.filter}}
  @search={{this.search}}
  @formDefinition={{this.model.formDefinition}}
  @onRemoveInstance={{this.onRemoveInstance}}
  @editRoute="forms.form.instance"
/>
```

This component takes the following parameters:

- @sort: the field to sort on
- @page: the page to show
- @size: the number of items per page
- @filter: the search string to use
- @search: an action to search on the input provided by the user. Expected to set the filter parameter.
- @formDefinition: the form definition to use
- @onRemoveInstance: an action to call when an instance is removed
- @editRoute: the route to transition to when the user clicks on edit for an instance
