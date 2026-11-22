import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vite-plus/test';
import { uiProvider } from './ui-context.js';
import { Button } from './ui/button.js';
import { Checkbox } from './ui/checkbox.js';
import { Select } from './ui/select.js';
import type { SelectProps } from './ui/slots.js';

const options = [
  { value: 'news', label: 'News' },
  { value: 'opinion', label: 'Opinion' },
];
const select = <Select id="category" value="news" onChange={() => {}} options={options} />;

describe('ui slots', () => {
  it('renders the built-in without a provider', () => {
    const html = renderToStaticMarkup(select);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('News');
  });

  it("renders the site's component with the slot's props", () => {
    const MySelect = ({ id, value, options }: SelectProps) => (
      <span data-site-select id={id}>
        {value}:{options.length}
      </span>
    );
    const Ui = uiProvider({ Select: MySelect });
    const html = renderToStaticMarkup(<Ui>{select}</Ui>);
    expect(html).toBe('<span data-site-select="true" id="category">news:2</span>');
  });

  it('falls back to the built-in for slots the site leaves out', () => {
    const Ui = uiProvider({ Select: () => <i>site</i> });
    const html = renderToStaticMarkup(
      <Ui>
        <Checkbox checked onChange={() => {}} aria-label="On" />
        <Button>Save</Button>
      </Ui>,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('>Save</button>');
    expect(html).not.toContain('<i>site</i>');
  });

  it("gives a site slot that wraps the admin's own component the built-in (no loop)", () => {
    const Wrapped = (p: SelectProps) => (
      <div data-wrapper>
        <Select {...p} />
      </div>
    );
    const Ui = uiProvider({ Select: Wrapped });
    const html = renderToStaticMarkup(<Ui>{select}</Ui>);
    expect(html.match(/data-wrapper/g)).toHaveLength(1);
    expect(html).toContain('role="combobox"');
  });

  it('keeps other slots inside a site slot', () => {
    const Ui = uiProvider({
      Select: () => <Button>inner</Button>,
      Button: ({ children }) => <b>{children}</b>,
    });
    expect(renderToStaticMarkup(<Ui>{select}</Ui>)).toBe('<b>inner</b>');
  });
});
