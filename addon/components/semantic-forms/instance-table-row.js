import Component from '@glimmer/component';

export default class FormInstanceTableRowComponent extends Component {
  get valuesShown() {
    return Object.entries(this.args.instance)
      .filter(([key]) => this.args.labels.map((l) => l.name).includes(key))
      .map(([key]) => {
        return this.args.instance[key];
      });
  }
}
