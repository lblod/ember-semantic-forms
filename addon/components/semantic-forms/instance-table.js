import Component from '@glimmer/component';

import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';

import { JSON_API_TYPE } from 'frontend-lmb/utils/constants';

export default class FormInstanceTableComponent extends Component {
  @service store;
  @service semanticFormRepository;

  @tracked formInfo = null;

  constructor() {
    super(...arguments);
    this.onInit();
  }

  get initialized() {
    return this.formInfo !== null;
  }

  @action
  async removeInstance(instance) {
    const result = await fetch(
      `/form-content/${this.formInfo.formDefinition.id}/instances/${instance.id}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': JSON_API_TYPE,
        },
      }
    );

    if (!result.ok) {
      this.errorMessage =
        'Er ging iets mis bij het verwijderen van het formulier. Probeer het later opnieuw.';
      return;
    }
    if (this.args.onRemoveInstance) {
      this.args.onRemoveInstance(instance.id);
    }
  }

  @action
  async onInit() {
    const form = this.args.formDefinition;

    const formInfo = await this.semanticFormRepository.fetchInstances(form, {
      page: this.args.page,
      size: this.args.size,
      sort: this.args.sort,
      filter: this.args.filter,
    });

    this.formInfo = formInfo;
  }
}
