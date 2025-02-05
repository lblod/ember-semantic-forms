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

  @tracked isModalOpen;

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
    const formInfo = await this.semanticFormRepository.fetchInstances(
      this.args.formDefinition,
      {
        page: this.args.page,
        size: this.args.size,
        sort: this.args.sort,
        filter: this.args.filter,
        labels: this.labels,
      }
    );

    this.formInfo = formInfo;
    this.args.onTableLoaded();
  }

  refreshTable = restartableTask(async () => {
    await timeout(250);
    if (this.labelsDiverge) {
      this.labels.clear();
      this.labels.push(...this.args.labels);
      await this.loadTable();
    }
    this.refreshTable.perform();
  });

  @action filterRow(instance) {
    return Object.fromEntries(
      Object.entries(instance).filter(([key]) =>
        this.labels.map((l) => l.name).includes(key)
      )
    );
  }

  get downloadAllLink() {
    if (!this.formInfo?.formDefinition) {
      return null;
    }
    const labelsQueryParam = encodeURIComponent(JSON.stringify(this.labels));
    const sortQueryParam = this.args.sort ?? '';

    return `/form-content/instance-table/${this.formInfo.formDefinition.id}/download?sort=${sortQueryParam}&labels=${labelsQueryParam}`;
  }

  get downloadPageLink() {
    return (
      this.downloadAllLink +
      `&page[number]=${this.args.page}&page[size]=${this.args.size}`
    );
  }

  get labelsDiverge() {
    if (!this.labels || this.args.labels.length !== this.labels.length) {
      return true;
    }

    const thisSortedLabels = this.labels
      .sort((a, b) => a.order - b.order)
      .map((l) => l.name);
    const argsSortedLabels = this.args.labels
      .sort((a, b) => a.order - b.order)
      .map((l) => l.name);

    return (
      JSON.stringify(thisSortedLabels) !== JSON.stringify(argsSortedLabels)
    );
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.refreshTable.cancelAll();
    this.labels.clear();
  }
}
