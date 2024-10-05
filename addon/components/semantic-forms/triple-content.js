import Component from '@glimmer/component';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { service } from '@ember/service';

export default class FormTripleContentComponent extends Component {
  @tracked expanded = false;
  @service semanticFormRepository;

  get showSourceTriples() {
    return this.semanticFormRepository.showSourceTriples;
  }

  @action
  toggleExpanded() {
    this.expanded = !this.expanded;
  }
}
