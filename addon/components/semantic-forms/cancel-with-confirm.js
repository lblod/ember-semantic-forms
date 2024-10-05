import Component from '@glimmer/component';

import { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class FormCancelWithConfirmComponent extends Component {
  @service semanticFormDirtyState;

  @tracked isModalOpen = false;

  @action
  confirmCancel() {
    this.isModalOpen = false;
    this.args.cancel();
  }

  @action
  closeModal() {
    this.isModalOpen = false;
  }

  @action
  cancel() {
    if (this.semanticFormDirtyState.hasDirtyForms) {
      this.isModalOpen = true;
    } else {
      this.confirmCancel();
    }
  }
}
