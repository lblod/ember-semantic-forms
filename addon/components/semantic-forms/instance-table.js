import Component from '@glimmer/component';

import { A } from '@ember/array';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';

import { JSON_API_TYPE } from 'frontend-lmb/utils/constants';

import { timeout, restartableTask } from 'ember-concurrency';

export default class FormInstanceTableComponent extends Component {
  @service store;
  @service semanticFormRepository;

  @tracked formInfo = null;
  @tracked labels = A();

  constructor() {
    super(...arguments);
    this.labels.push(...this.args.labels);
    this.loadTable();
    this.refreshTable.perform();
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
  async loadTable() {
    const formInfo = await this.semanticFormRepository.fetchInstances(this.args.formDefinition, {
      page: this.args.page,
      size: this.args.size,
      sort: this.args.sort,
      filter: this.args.filter,
      labels: this.labels,
    });

    this.formInfo = formInfo;
    this.args.onTableLoaded()
  }

  refreshTable = restartableTask(async () => {
    await timeout(250);
    if(this.areLabelsUpdated || this.isOrderOfLabelUpdated) {
      this.labels.clear();
      this.labels.push(...this.args.labels);
      await this.loadTable();
    }
    this.refreshTable.perform();
  });

  @action filterRow(instance) {
    return Object.fromEntries(
      Object.entries(instance).filter(([key]) => this.labels.map(l => l.name).includes(key))
    );
  }

  get areLabelsUpdated() {
    return this.labels.length !== this.args.labels.length ?? null;
  }
  get isOrderOfLabelUpdated() {
    for (const label of this.labels) {
      const sameLabel = this.args.labels.find(l => l.name === label.name);

      if(!label?.order && sameLabel.order) {
        return true;
      }
      return label.order !== sameLabel?.order
    }
    return false
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.refreshTable.cancelAll();
    this.labels.clear();
  }
}
