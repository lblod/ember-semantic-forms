import Component from '@glimmer/component';

import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { guidFor } from '@ember/object/internals';

import { RDF, FORM } from '../../utils/constants';
import { NamedNode } from 'rdflib';
import { ForkingStore } from '@lblod/ember-submission-form-fields';
import { FORM_GRAPH, META_GRAPH, SOURCE_GRAPH } from '../../utils/constants';
import { task } from 'ember-concurrency';

export default class InstanceComponent extends Component {
  @service store;
  @service semanticFormDirtyState;
  @service semanticFormRepository;

  @tracked sourceTriples;
  @tracked errorMessage;
  @tracked formInfo = null;
  @tracked hasChanges = false;
  @tracked forceShowErrors = false;
  @tracked showEditButtons = false;
  @tracked isSaveHistoryModalOpen = false;
  @tracked isValidForm = false;

  createdAt = null;
  formStore = null;
  savedTriples = null;
  formId = `form-${guidFor(this)}`;

  historyMessage;

  get saveTitle() {
    return this.args.saveTitle || 'Pas aan';
  }

  get saveButtonLoadingText() {
    if (this.save.isRunning) {
      return 'Opslaan';
    }
    if (this.isRunningValidationsOnForm) {
      return 'Valideren';
    }

    return null;
  }

  save = task({ keepLatest: true }, async () => {
    let ttlCode = this.sourceTriples;
    const instanceId = this.formInfo.instanceId;
    this.errorMessage = null;

    if (this.args.beforeSave) {
      try {
        ttlCode = await this.args.beforeSave(
          ttlCode,
          this.formInfo.sourceNode.value
        );
      } catch (e) {
        this.errorMessage = e;
        this.isSaveHistoryModalOpen = false;
        return;
      }
    }

    const result = await this.semanticFormRepository.updateFormInstance(
      instanceId,
      this.formInfo.sourceNode.value,
      this.formInfo.definition.id,
      ttlCode,
      this.historyMessage
    );

    if (result.errorMessage) {
      this.errorMessage = result.errorMessage;
      return;
    }

    if (this.args.onSave) {
      await this.args.onSave({
        instanceId,
        instanceTtl: ttlCode,
        response: result.body,
      });
    }

    this.semanticFormDirtyState.markClean(this.formId);
    this.hasChanges = false;
    this.isSaveHistoryModalOpen = false;
  });

  @action
  async tryOpenHistoryModal() {
    this.forceShowErrors = !this.isValidForm;

    if (this.args.customHistoryMessage) {
      this.isSaveHistoryModalOpen = true;
    } else {
      this.save.perform();
    }
  }

  @action
  updateHistoryMessage(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    this.historyMessage = event.target.value.trim();
  }

  setupForm = () => {
    this.createdAt = new Date();
    this.setupFormForTtl.perform(this.args.initialFormTtl?.current);
  };

  setupFormForTtl = task(async (newFormTtl = null) => {
    const form = this.args.form;
    const instanceId = this.args.instanceId;

    const { formInstanceTtl, instanceUri } = await this.retrieveFormInstance(
      form.id,
      instanceId
    );

    const formStore = new ForkingStore();

    const graphs = {
      formGraph: FORM_GRAPH,
      metaGraph: META_GRAPH,
      sourceGraph: SOURCE_GRAPH,
    };

    this.semanticFormRepository.loadFormInto(
      formStore,
      form,
      newFormTtl || formInstanceTtl,
      graphs
    );

    if (this.args.buildMetaTtl) {
      const metaTtl = await this.args.buildMetaTtl();
      formStore.parse(metaTtl, META_GRAPH, 'text/turtle');
    }

    const formNode = formStore.any(
      undefined,
      RDF('type'),
      FORM('Form'),
      FORM_GRAPH
    );
    const sourceNode = new NamedNode(instanceUri);

    this.formInfo = {
      instanceId,
      definition: form,
      formNode,
      formStore,
      graphs,
      sourceNode,
    };

    this.registerObserver(formStore);
  });

  async retrieveFormInstance(formId, id) {
    const response = await fetch(`/form-content/${formId}/instances/${id}`);
    if (!response.ok) {
      let error = new Error(response.statusText);
      error.status = response.status;
      throw error;
    }
    const { formInstanceTtl, instanceUri } = await response.json();
    return { formInstanceTtl, instanceUri };
  }

  willDestroy() {
    super.willDestroy(...arguments);
    this.semanticFormDirtyState.markClean(this.formId);
    this.formInfo?.formStore?.clearObservers();
  }

  get isRunningValidationsOnForm() {
    return this.semanticFormRepository.validateForm?.isRunning;
  }

  registerObserver(formStore) {
    const onFormUpdate = () => {
      if (this.isDestroyed) {
        return;
      }

      this.sourceTriples = this.formInfo.formStore.serializeDataMergedGraph(
        this.formInfo.graphs.sourceGraph
      );

      if (this.savedTriples === null) {
        this.savedTriples = this.sourceTriples;
      }

      if (this.savedTriples === this.sourceTriples) {
        this.semanticFormDirtyState.markClean(this.formId);
        this.hasChanges = false;
      } else if (new Date().getTime() - this.createdAt.getTime() > 200) {
        this.semanticFormDirtyState.markDirty(this.formId);
        this.hasChanges = true;
      } else if (this.args.initialFormTtl?.current) {
        this.semanticFormDirtyState.markDirty(this.formId);
        this.hasChanges = true;
      }
      this.isValidForm = false;
      this.isValidForm = this.semanticFormRepository.validateForm.perform(
        this.formInfo,
        (validationResult) => (this.isValidForm = validationResult)
      );
    };
    formStore.registerObserver(onFormUpdate);
    onFormUpdate();
    this.args.formInitialized ? this.args.formInitialized() : null;
    this.showEditButtons = true;
  }
}
