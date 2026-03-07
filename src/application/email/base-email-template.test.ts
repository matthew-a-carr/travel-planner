import { describe, expect, it } from 'vitest';
import { renderBaseEmailTemplate } from './base-email-template';

describe('renderBaseEmailTemplate', () => {
  it('renders consistent branded text and html shells', () => {
    const template = renderBaseEmailTemplate({
      previewText: 'Preview line',
      greeting: 'Hi Alex,',
      paragraphs: ['Paragraph one.', 'Paragraph two.'],
      action: {
        label: 'Open Travel Planner',
        url: 'https://travel.matthewcarr.dev/login',
      },
      closingLines: ['Thanks,', 'Travel Planner'],
    });

    expect(template.text).toContain('Hi Alex,');
    expect(template.text).toContain('Paragraph one.');
    expect(template.text).toContain('Open Travel Planner: https://travel.matthewcarr.dev/login');
    expect(template.text).toContain('Travel Planner');

    expect(template.html).toContain('Travel Planner');
    expect(template.html).toContain('Preview line');
    expect(template.html).toContain('Open Travel Planner');
    expect(template.html).toContain('https://travel.matthewcarr.dev/login');
  });

  it('escapes untrusted html content', () => {
    const template = renderBaseEmailTemplate({
      previewText: '<script>alert(1)</script>',
      greeting: 'Hi <b>Alex</b>,',
      paragraphs: ['Use <a href="https://example.com">this</a>.'],
      closingLines: ['Thanks <team>'],
    });

    expect(template.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(template.html).toContain('Hi &lt;b&gt;Alex&lt;/b&gt;,');
    expect(template.html).toContain('&lt;a href=&quot;https://example.com&quot;&gt;this&lt;/a&gt;');
    expect(template.html).toContain('Thanks &lt;team&gt;');
  });
});
