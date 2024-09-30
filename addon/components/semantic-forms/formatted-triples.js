import Component from '@glimmer/component';

// as taken from LMB
export default class FormattedTriplesComponent extends Component {
  get formattedTriples() {
    if (!this.args.triples) {
      return '';
    }
    return this.args.triples;
  }
}
