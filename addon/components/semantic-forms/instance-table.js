import Component from '@glimmer/component';

import { A } from '@ember/array';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';

import { JSON_API_TYPE } from '../../utils/constants';

export default class FormInstanceTableComponent extends Component {
  @service store;
  @service toaster;
  @service semanticFormRepository;

  @tracked isTableLoading;
  @tracked isModalOpen;

  @tracked formInfo = null;
  @tracked labels = A();

  @tracked isDeleteModalOpen;
  @tracked isDeleting;
  @tracked instanceToRemove;

  selectedLabelOnLoad = {
    name: 'Uri',
    var: 'uri',
    uri: null,
    order: 0,
  };

  constructor() {
    super(...arguments);
    this.labels.push(this.selectedLabelOnLoad);
    this.loadTable();
  }

  get initialized() {
    return this.formInfo !== null;
  }

  @action
  openRemoveInstanceModal(instance) {
    this.instanceToRemove = instance;
    this.isDeleteModalOpen = true;
  }

  @action
  async removeInstance() {
    this.isDeleting = true;
    const result = await fetch(
      `/form-content/${this.formInfo.formDefinition.id}/instances/${this.instanceToRemove.id}`,
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
    this.isDeleting = false;
    this.isDeleteModalOpen = false;
    await this.loadTable();
    if (this.args.onRemoveInstance) {
      this.args.onRemoveInstance(this.instanceToRemove.id);
    }
    this.instanceToRemove = null;
  }

  @action
  async loadTable() {
    this.isTableLoading = true;
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
    this.isTableLoading = false;
  }

  @action
  async updateTable(selectedLabels) {
    this.isTableLoading = true;
    this.labels.clear();
    this.labels.push(...selectedLabels);
    await this.loadTable();
  }

  @action
  downloadStarted() {
    this.isModalOpen = false;
    this.toaster.success('Download instanties gestart', 'Download', {
      timeOut: 2000,
    });
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

  get tableTitle() {
    return this.args.title ?? `${this.formInfo?.formDefinition?.id} beheer`;
  }

  get tableDescription() {
    return this.args.description ?? null;
  }

  get newFormRoute() {
    return this.args.newFormRoute || 'forms.form.new';
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.labels.clear();
  }
}
