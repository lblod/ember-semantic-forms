import Service from '@ember/service';

import { timeout } from 'ember-concurrency';
import {
  JSON_API_TYPE,
  RESOURCE_CACHE_TIMEOUT,
} from 'frontend-lmb/utils/constants';
import { validateForm } from '@lblod/ember-submission-form-fields';
import { tracked } from '@glimmer/tracking';
import EmberObject from '@ember/object';

const Definition = EmberObject.extend({
  formTtl: '',
  metaTtl: null,
  prefix: '',
  withHistory: false,
});

export default class FormRepositoryService extends Service {
  @tracked showSourceTriples;

  definitions = {};

  async createFormInstance(instanceUri, definitionId, ttlCode) {
    const result = await fetch(`/form-content/${definitionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_API_TYPE,
      },
      body: JSON.stringify({
        contentTtl: ttlCode,
        instanceUri: instanceUri,
      }),
    });

    await timeout(RESOURCE_CACHE_TIMEOUT);

    return await this._handleCreateResult(result);
  }

  async updateFormInstance(
    instanceId,
    instanceUri,
    definitionId,
    ttlCode,
    description
  ) {
    const result = await fetch(
      `/form-content/${definitionId}/instances/${instanceId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': JSON_API_TYPE,
        },
        body: JSON.stringify({
          contentTtl: ttlCode,
          instanceUri: instanceUri,
          description: description,
        }),
      }
    );

    await timeout(RESOURCE_CACHE_TIMEOUT);

    return await this._handleUpdateResult(result);
  }

  async _handleCreateResult(result) {
    if (!result.ok) {
      return {
        id: null,
        errorMessage:
          'Er ging iets mis bij het opslaan van het formulier. Probeer het later opnieuw.',
      };
    }

    const { id } = await result.json();

    return {
      id: id ?? null,
      errorMessage: id
        ? null
        : 'Het formulier werd niet correct opgeslagen. Probeer het later opnieuw.',
    };
  }

  async _handleUpdateResult(result) {
    if (!result.ok) {
      return {
        body: null,
        errorMessage:
          'Er ging iets mis bij het opslaan van het formulier. Probeer het later opnieuw.',
      };
    }

    const body = await result.json();

    return {
      body: body?.instance?.instanceUri ? body : null,
      errorMessage: body?.instance?.instanceUri
        ? null
        : 'Het formulier werd niet correct opgeslagen. Probeer het later opnieuw.',
    };
  }

  _retrieveForm = async (id) => {
    const response = await fetch(`/form-content/${id}`);
    if (!response.ok) {
      let error = new Error(response.statusText);
      error.status = response.status;
      throw error;
    }

    const form = await response.json();
    if (!form.formTtl) {
      throw new Error('Received form without formTtl');
    }

    return form;
  };

  async getFormDefinition(formId) {
    const definition = this.definitions[formId];
    if (definition) {
      return definition;
    }

    const { formTtl, metaTtl, prefix, withHistory } = await this._retrieveForm(
      formId
    );

    const def = Definition.create({
      id: formId,
      formTtl,
      metaTtl,
      prefix,
      withHistory,
    });
    this.definitions[formId] = def;
    return def;
  }

  isValidForm(formInfo) {
    if (this._isFormInfo(formInfo)) {
      return false;
    }

    return validateForm(formInfo.formNode, {
      ...formInfo.graphs,
      sourceNode: formInfo.sourceNode,
      store: formInfo.formStore,
    });
  }

  _isFormInfo(formInfo) {
    if (!formInfo) {
      return false;
    }

    const properties = ['graphs', 'sourceNode', 'formStore'];

    const arePropertiesSet = Object.keys(formInfo).map((key) =>
      properties.includes(key)
    );

    return arePropertiesSet.every((isSet) => isSet);
  }

  async loadFormInto(
    store,
    { formTtl, metaTtl },
    sourceTtl,
    { formGraph, metaGraph, sourceGraph }
  ) {
    store.parse(formTtl, formGraph, 'text/turtle');
    store.parse(metaTtl || '', metaGraph, 'text/turtle');
    store.parse(sourceTtl || '', sourceGraph, 'text/turtle');
  }
}
