import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { service } from '@ember/service';

export default class FormTripleContentComponent extends Component {
  @tracked expanded = false;
  @service formRepository;

  get showSourceTriples() {
    return this.formRepository.showSourceTriples;
  }

  @action
  toggleExpanded() {
    this.expanded = !this.expanded;
  }
}
