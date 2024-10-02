import { module, test } from 'qunit';
import { setupRenderingTest } from 'dummy/tests/helpers';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module(
  'Integration | Component | semantic-forms/save-with-history',
  function (hooks) {
    setupRenderingTest(hooks);

    test('it renders', async function (assert) {
      // Set any properties with this.set('myProperty', 'value');
      // Handle any actions with this.set('myAction', function(val) { ... });

      await render(hbs`<SemanticForms::SaveWithHistory />`);

      assert.dom(this.element).hasText('');

      // Template block usage:
      await render(hbs`
      <SemanticForms::SaveWithHistory>
        template block text
      </SemanticForms::SaveWithHistory>
    `);

      assert.dom(this.element).hasText('template block text');
    });
  }
);
