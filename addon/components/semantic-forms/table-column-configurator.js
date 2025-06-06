import Component from '@glimmer/component';

import { A } from '@ember/array';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { service } from '@ember/service';

export default class SemanticFormsTableColumnConfiguratorComponent extends Component {
  @service toaster;
  @tracked labels = A();

  constructor() {
    super(...arguments);

    const selectedVarsOfLabel = this.args.selectedLabelsOnLoad
      .map((l) => l.var ?? null)
      .filter((v) => v);
    let labelsWithIsSelectedProperty = this.args.labels.map((label) => {
      return {
        ...label,
        isSelected: !!selectedVarsOfLabel.includes(label.var),
      };
    });

    this.labels.push(...labelsWithIsSelectedProperty);
  }

  @action
  toggleLabel(label) {
    if (this.disabledSelection) {
      return;
    }

    if (label.isSelected && this.selectedLabels.length === 1) {
      this.toaster.success(
        'Er moet minstens 1 kolom aangeduid zijn.',
        'Kolom configuratie',
        {
          timeOut: 2000,
        }
      );
      return;
    }
    const selectedState = label.isSelected;
    this.labels.removeObject(label);

    delete label.isSelected;
    this.labels.push({ ...label, isSelected: !selectedState });

    this.args.onSelectionUpdated(this.selectedLabels);
  }

  @action
  moveLabel(label, upDown) {
    const indexOfLabel = this.selectedLabels.indexOf(label);
    let switchLabel = null;
    if (upDown === 'up') {
      switchLabel = A([...this.selectedLabels]).objectAt(indexOfLabel - 1);
    } else {
      switchLabel = A([...this.selectedLabels]).objectAt(indexOfLabel + 1);
    }

    if (!switchLabel) {
      return;
    }

    this.labels.removeObjects([label, switchLabel]);
    this.labels.pushObjects([
      {
        ...label,
        order: switchLabel.order,
      },
      {
        ...switchLabel,
        order: label.order,
      },
    ]);
    this.args.onSelectionUpdated(this.selectedLabels);
  }

  get sortedLabels() {
    return this.labels.sort((a, b) => a.order - b.order);
  }

  get selectedLabels() {
    return (
      this.labels
        ?.filter((label) => label.isSelected)
        .sort((a, b) => a.order - b.order) ?? []
    );
  }

  get disabledSelection() {
    return this.args.disabledSelection;
  }
}
