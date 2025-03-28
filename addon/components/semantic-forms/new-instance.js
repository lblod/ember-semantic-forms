import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';
import { guidFor } from '@ember/object/internals';

import { v4 as uuid } from 'uuid';
import { RDF, FORM } from '../../utils/constants';
import { NamedNode } from 'rdflib';
import { ForkingStore } from '@lblod/ember-submission-form-fields';
import { FORM_GRAPH, META_GRAPH, SOURCE_GRAPH } from '../../utils/constants';
import { task } from 'ember-concurrency';

export default class NewInstanceComponent extends Component {
  @service store;
  @service semanticFormDirtyState;
  @service semanticFormRepository;

  @tracked sourceTriples;
  @tracked errorMessage;
  @tracked formInfo = null;
  @tracked forceShowErrors = false;
  createdAt = null;
  formStore = null;
  savedTriples = null;
  formId = `form-${guidFor(this)}`;

  constructor() {
    super(...arguments);
    this.setupNewForm.perform();
  }

  save = task({ keepLatest: true }, async () => {
    let ttlCode = this.sourceTriples;
    this.errorMessage = null;
    const isValid = this.semanticFormRepository.isValidForm(this.formInfo);
    this.forceShowErrors = !isValid;
    if (!isValid) {
      this.errorMessage =
        'Niet alle velden zijn correct ingevuld. Probeer het later opnieuw.';
      return;
    }

    if (this.args.beforeCreate) {
      try {
        ttlCode = await this.args.beforeCreate(
          ttlCode,
          this.formInfo.sourceNode.value
        );
      } catch (e) {
        this.errorMessage = e;
        return;
      }
    }

    const result = await this.semanticFormRepository.createFormInstance(
      this.formInfo.sourceNode.value,
      this.formInfo.definition.id,
      ttlCode
    );

    if (result.errorMessage) {
      this.errorMessage = result.errorMessage;
      return;
    }

    if (this.args.onCreate) {
      await this.args.onCreate({
        instanceTtl: ttlCode,
        instanceId: result.id,
      });
    }

    this.semanticFormDirtyState.markClean(this.formId);
  });

  setupNewForm = task(async () => {
    this.createdAt = new Date();
    const form = this.args.form;
    const uri = `${form.prefix}${uuid()}`;
    const sourceTtl = this.args.buildSourceTtl
      ? await this.args.buildSourceTtl(uri)
      : '';

    const formStore = new ForkingStore();

    const graphs = {
      formGraph: FORM_GRAPH,
      metaGraph: META_GRAPH,
      sourceGraph: SOURCE_GRAPH,
    };

    this.semanticFormRepository.loadFormInto(
      formStore,
      form,
      sourceTtl,
      graphs
    );

    if (this.args.buildMetaTtl) {
      const metaTtl = await this.args.buildMetaTtl();
      formStore.parse(metaTtl, META_GRAPH, 'text/turtle');
    }
    const sourceNode = new NamedNode(uri);

    const formNode = formStore.any(
      undefined,
      RDF('type'),
      FORM('Form'),
      FORM_GRAPH
    );

    this.formInfo = {
      definition: form,
      formNode,
      formStore,
      graphs,
      sourceNode,
    };
    this.registerObserver(formStore);
  });

  willDestroy() {
    super.willDestroy(...arguments);
    this.semanticFormDirtyState.markClean(this.formId);
    this.formInfo?.formStore?.clearObservers();
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
      } else if (new Date().getTime() - this.createdAt.getTime() > 200) {
        this.semanticFormDirtyState.markDirty(this.formId);
      }
    };
    formStore.registerObserver(onFormUpdate);
    onFormUpdate();
    this.args.formInitialized ? this.args.formInitialized() : null;
  }
}
